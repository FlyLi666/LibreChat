const express = require('express');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { decryptV2, encryptV2, logger } = require('@librechat/data-schemas');
const db = require('~/models');

const router = express.Router();
const DEFAULT_WECHAT_ILINK_BASE_URL = 'https://ilinkai.weixin.qq.com';
const WECHAT_REQUEST_TIMEOUT_MS = 15000;
const WECHAT_POLL_TIMEOUT_MS = 40000;
const WECHAT_RUNTIME_DURATION_MS = 10 * 60 * 1000;
const CHANNEL_VERSION = '1.0.0';
const WECHAT_MESSAGE_TYPE = {
  BOT: 2,
};
const WECHAT_MESSAGE_STATE = {
  FINISH: 2,
};
const WECHAT_ITEM_TYPE = {
  TEXT: 1,
};
const WECHAT_DEFAULT_SETTINGS = {
  characterLimit: 2000,
  concurrencyMode: 'queue',
  keywords: [],
  showToolCalls: false,
  showUsage: false,
};
const WECHAT_CONCURRENCY_MODES = new Set(['queue', 'parallel', 'latest']);
const FALLBACK_AGENT_NAME = 'Lobe AI';
const VIRTUAL_LOBE_AGENT_IDS = new Set(['lobe-ai']);
const LOBE_STYLE_AGENT_ID_PATTERN = /^agt[_-]/i;

const agentChannelProviderSchema = new mongoose.Schema(
  {
    agentId: { type: String, required: true, index: true },
    applicationId: { type: String, required: true },
    connectedAt: { type: Date },
    credentials: { type: String, required: true },
    cursor: { type: String },
    enabled: { type: Boolean, default: true },
    lastError: { type: String },
    lastMessageAt: { type: Date },
    platform: { type: String, required: true, index: true },
    runtimeStatus: { type: String, default: 'disconnected' },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    user: { type: String, required: true, index: true },
  },
  { timestamps: true },
);

agentChannelProviderSchema.index(
  { agentId: 1, platform: 1, user: 1 },
  { name: 'agent_channel_provider_owner_unique', unique: true },
);
agentChannelProviderSchema.index(
  { applicationId: 1, platform: 1 },
  { name: 'agent_channel_provider_app_platform' },
);

const AgentChannelProvider =
  mongoose.models.AgentChannelProvider ||
  mongoose.model('AgentChannelProvider', agentChannelProviderSchema);

const wechatRuntimes = new Map();

function stripTrailingSlashes(url) {
  let end = url.length;
  while (end > 0 && url[end - 1] === '/') end--;
  return url.slice(0, end);
}

function getWechatIlinkBaseUrl() {
  return stripTrailingSlashes(process.env.WECHAT_ILINK_BASE_URL || DEFAULT_WECHAT_ILINK_BASE_URL);
}

async function fetchWechatJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(WECHAT_REQUEST_TIMEOUT_MS),
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = payload?.errmsg || `${response.status} ${text}`;
    throw new Error(message);
  }

  return payload;
}

function getUserId(req) {
  return req.user?.id || req.user?._id?.toString();
}

function summarizeProvider(provider) {
  if (!provider) return null;
  return {
    agentId: provider.agentId,
    applicationId: provider.applicationId,
    connectedAt: provider.connectedAt,
    enabled: provider.enabled,
    id: provider._id.toString(),
    lastError: provider.lastError,
    lastMessageAt: provider.lastMessageAt,
    platform: provider.platform,
    runtimeStatus: provider.runtimeStatus,
    settings: provider.settings || {},
    updatedAt: provider.updatedAt,
    user: provider.user,
  };
}

function normalizeWechatSettings(settings = {}) {
  const characterLimit = Number.parseInt(settings.characterLimit, 10);
  const keywords = Array.isArray(settings.keywords)
    ? settings.keywords
        .map((keyword) => String(keyword).trim())
        .filter(Boolean)
        .slice(0, 20)
    : [];
  const concurrencyMode = WECHAT_CONCURRENCY_MODES.has(settings.concurrencyMode)
    ? settings.concurrencyMode
    : WECHAT_DEFAULT_SETTINGS.concurrencyMode;

  return {
    ...WECHAT_DEFAULT_SETTINGS,
    characterLimit:
      Number.isFinite(characterLimit) && characterLimit > 0
        ? Math.min(characterLimit, 20000)
        : WECHAT_DEFAULT_SETTINGS.characterLimit,
    concurrencyMode,
    keywords,
    showToolCalls: settings.showToolCalls === true,
    showUsage: settings.showUsage === true,
  };
}

function isVirtualLobeAgentId(agentId) {
  return VIRTUAL_LOBE_AGENT_IDS.has(agentId) || LOBE_STYLE_AGENT_ID_PATTERN.test(agentId);
}

async function resolveChannelAgent(req, res, user) {
  const routeAgentId = req.params.agentId;
  const directAgent = await db.getAgent({ id: routeAgentId });

  if (directAgent) {
    return { agent: directAgent, agentId: directAgent.id || routeAgentId };
  }

  if (isVirtualLobeAgentId(routeAgentId)) {
    const existingProvider = user
      ? await AgentChannelProvider.findOne({
          enabled: true,
          platform: 'wechat',
          user,
        }).lean()
      : null;
    if (existingProvider?.agentId) {
      const providerAgent = await db.getAgent({ id: existingProvider.agentId });
      if (providerAgent) {
        return { agent: providerAgent, agentId: providerAgent.id || existingProvider.agentId };
      }
    }

    const fallbackAgent = await db.getAgent({ name: FALLBACK_AGENT_NAME });
    if (fallbackAgent) {
      return { agent: fallbackAgent, agentId: fallbackAgent.id };
    }
  }

  res.status(404).json({ error: 'Agent not found for channel binding' });
  return null;
}

async function encryptCredentials(credentials) {
  return encryptV2(JSON.stringify(credentials));
}

async function decryptCredentials(encrypted) {
  return JSON.parse(await decryptV2(encrypted));
}

function randomUin() {
  const value = crypto.randomInt(0, 0xffffffff);
  return Buffer.from(String(value)).toString('base64');
}

function buildWechatBotHeaders(botToken) {
  return {
    Authorization: `Bearer ${botToken}`,
    AuthorizationType: 'ilink_bot_token',
    'Content-Type': 'application/json',
    'X-WECHAT-UIN': randomUin(),
  };
}

async function fetchWechatBotJson(path, credentials, options = {}) {
  const response = await fetch(`${credentials.baseurl || getWechatIlinkBaseUrl()}${path}`, {
    ...options,
    headers: {
      ...buildWechatBotHeaders(credentials.botToken),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(payload?.errmsg || `${response.status} ${text}`);
  }

  const ret = payload?.ret;
  if (typeof ret === 'number' && ret !== 0) {
    const error = new Error(payload.errmsg || `WeChat API ret=${ret}`);
    error.code = payload.errcode || ret;
    throw error;
  }

  return payload;
}

async function updateProviderRuntime(providerId, value) {
  await AgentChannelProvider.updateOne({ _id: providerId }, { $set: value });
}

async function drainWechatBacklog(providerId, cursor) {
  await AgentChannelProvider.updateOne(
    { _id: providerId },
    {
      $set: {
        cursor,
        lastError: undefined,
        runtimeStatus: 'connected',
        'settings.skipNextWechatBacklog': false,
      },
    },
  );
}

function getWechatMessageSender(message) {
  return message?.from_user_id || message?.sender_id || message?.fromUserId || '';
}

function getWechatContextToken(message) {
  return (
    message?.context_token || message?.contextToken || message?.msg_id || message?.client_id || ''
  );
}

function extractWechatMessageText(message) {
  let items = [];
  if (Array.isArray(message?.item_list)) {
    items = message.item_list;
  } else if (Array.isArray(message?.items)) {
    items = message.items;
  }
  const parts = [];

  for (const item of items) {
    if (item?.text_item?.text) {
      parts.push(item.text_item.text);
    } else if (item?.text) {
      parts.push(item.text);
    } else if (item?.voice_item?.text) {
      parts.push(item.voice_item.text);
    } else if (item?.file_item?.file_name) {
      parts.push(`[file: ${item.file_item.file_name}]`);
    }
  }

  return parts.join('\n').trim();
}

function getWechatThreadKey(fromUserId) {
  return Buffer.from(fromUserId).toString('base64url');
}

function getWechatThreadState(provider, fromUserId) {
  const key = getWechatThreadKey(fromUserId);
  return {
    key,
    state: provider.settings?.wechatThreads?.[key] || {},
  };
}

function getWechatMessageKey(contextToken) {
  return Buffer.from(contextToken).toString('base64url');
}

async function markWechatMessageProcessed(provider, messageKey, value) {
  provider.settings = provider.settings || {};
  provider.settings.processedWechatMessages = provider.settings.processedWechatMessages || {};
  provider.settings.processedWechatMessages[messageKey] = value;

  await AgentChannelProvider.updateOne(
    { _id: provider._id },
    {
      $set: {
        [`settings.processedWechatMessages.${messageKey}`]: value,
      },
    },
  );
}

async function updateWechatThreadState(providerId, key, value) {
  await AgentChannelProvider.updateOne(
    { _id: providerId },
    {
      $set: {
        [`settings.wechatThreads.${key}`]: {
          ...value,
          updatedAt: new Date(),
        },
      },
    },
  );
}

async function sendWechatText(credentials, toUserId, text, contextToken) {
  if (!toUserId) {
    throw new Error('Missing WeChat recipient');
  }
  if (!contextToken) {
    throw new Error('Missing WeChat context token');
  }

  return fetchWechatBotJson('/ilink/bot/sendmessage', credentials, {
    body: JSON.stringify({
      base_info: { channel_version: CHANNEL_VERSION },
      msg: {
        client_id: crypto.randomUUID(),
        context_token: contextToken,
        from_user_id: '',
        item_list: [
          {
            text_item: { text },
            type: WECHAT_ITEM_TYPE.TEXT,
          },
        ],
        message_state: WECHAT_MESSAGE_STATE.FINISH,
        message_type: WECHAT_MESSAGE_TYPE.BOT,
        to_user_id: toUserId,
      },
    }),
    method: 'POST',
  });
}

async function handleWechatInboundMessage({ provider, credentials, message }) {
  const text = extractWechatMessageText(message);
  const fromUserId = getWechatMessageSender(message);
  const contextToken = getWechatContextToken(message);

  if (!text || !fromUserId || !contextToken) {
    return { skipped: true };
  }

  const messageKey = getWechatMessageKey(contextToken);
  if (provider.settings?.processedWechatMessages?.[messageKey]) {
    return { duplicate: true, skipped: true };
  }

  /**
   * This is the narrow integration point for the next Agent bridge slice.
   * Lobe routes this through BotMessageRouter -> AgentBridgeService -> BotCallbackService.
   * V2 does not yet have that service layer, so we make inbound handling explicit
   * and testable instead of pretending a fake chat reply is wired.
   */
  const replyHandler = router.locals?.wechatReplyHandler;
  if (typeof replyHandler !== 'function') {
    logger?.warn?.('[AgentChannel] WeChat inbound bridge is not configured', {
      agentId: provider.agentId,
      providerId: provider._id?.toString?.(),
    });
    return { bridged: false, fromUserId, text };
  }

  const { key: threadKey, state: threadState } = getWechatThreadState(provider, fromUserId);
  const replyResult = await replyHandler({
    agentId: provider.agentId,
    conversationId: threadState.conversationId,
    fromUserId,
    message,
    ownerUserId: provider.user,
    parentMessageId: threadState.parentMessageId,
    provider: summarizeProvider(provider),
    text,
  });
  const replyText = typeof replyResult === 'string' ? replyResult : replyResult?.replyText;

  if (!replyText) {
    return { bridged: true, replied: false };
  }

  await sendWechatText(credentials, fromUserId, replyText, contextToken);
  await markWechatMessageProcessed(provider, messageKey, {
    contextToken,
    fromUserId,
    processedAt: new Date(),
  });
  if (replyResult && typeof replyResult === 'object') {
    await updateWechatThreadState(provider._id, threadKey, {
      conversationId: replyResult.conversationId,
      fromUserId,
      parentMessageId: replyResult.parentMessageId || replyResult.responseMessageId,
    });
  }
  return { bridged: true, replied: true };
}

function stopWechatRuntime(providerId) {
  const runtime = wechatRuntimes.get(providerId);
  if (!runtime) return;

  runtime.abort.abort();
  if (runtime.timer) {
    clearTimeout(runtime.timer);
  }
  wechatRuntimes.delete(providerId);
}

function startWechatRuntime(provider, credentials) {
  const providerId = provider._id.toString();
  stopWechatRuntime(providerId);

  const abort = new AbortController();
  const runtime = { abort, timer: null };
  wechatRuntimes.set(providerId, runtime);

  const loop = async () => {
    const startedAt = Date.now();
    let cursor = provider.cursor || '';
    await updateProviderRuntime(providerId, {
      lastError: undefined,
      runtimeStatus: 'connecting',
    });

    while (!abort.signal.aborted && Date.now() - startedAt < WECHAT_RUNTIME_DURATION_MS) {
      try {
        const payload = await fetchWechatBotJson('/ilink/bot/getupdates', credentials, {
          body: JSON.stringify({
            base_info: { channel_version: CHANNEL_VERSION },
            get_updates_buf: cursor,
          }),
          method: 'POST',
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(WECHAT_POLL_TIMEOUT_MS)]),
        });

        cursor = payload.get_updates_buf || cursor;
        const messages = Array.isArray(payload.msgs) ? payload.msgs : [];
        const runtimePatch = {
          connectedAt: provider.connectedAt || new Date(),
          cursor,
          lastError: undefined,
          runtimeStatus: 'connected',
        };
        if (messages.length > 0) {
          runtimePatch.lastMessageAt = new Date();
          if (provider.settings?.skipNextWechatBacklog) {
            provider.settings.skipNextWechatBacklog = false;
            await drainWechatBacklog(providerId, cursor);
            continue;
          }

          for (const message of messages) {
            try {
              await handleWechatInboundMessage({ provider, credentials, message });
            } catch (error) {
              logger?.error?.('[AgentChannel] Failed to handle WeChat inbound message', error);
            }
          }
        }
        await updateProviderRuntime(providerId, runtimePatch);
      } catch (error) {
        if (abort.signal.aborted) break;
        const message = error instanceof Error ? error.message : String(error);
        await updateProviderRuntime(providerId, {
          lastError: message,
          runtimeStatus: 'failed',
        });
        await new Promise((resolve) => setTimeout(resolve, 3000));
      }
    }

    if (!abort.signal.aborted) {
      runtime.timer = setTimeout(() => startWechatRuntime(provider, credentials), 1000);
    }
  };

  loop().catch((error) => {
    logger?.error?.('[AgentChannel] WeChat runtime failed', error);
  });
}

function scheduleWechatRuntimeRestore() {
  if (process.env.NODE_ENV === 'test') return;

  const timer = setTimeout(async () => {
    try {
      const providers = await AgentChannelProvider.find({
        enabled: true,
        platform: 'wechat',
      });

      for (const provider of providers) {
        try {
          const credentials = await decryptCredentials(provider.credentials);
          startWechatRuntime(provider, credentials);
        } catch (error) {
          logger?.error?.('[AgentChannel] Failed to restore WeChat runtime', error);
          await updateProviderRuntime(provider._id, {
            lastError: error instanceof Error ? error.message : String(error),
            runtimeStatus: 'failed',
          });
        }
      }
    } catch (error) {
      logger?.error?.('[AgentChannel] Failed to query WeChat runtimes for restore', error);
    }
  }, 5000);

  timer.unref?.();
}

router.post('/wechat/qrcode', async (_req, res, next) => {
  try {
    const payload = await fetchWechatJson(
      `${getWechatIlinkBaseUrl()}/ilink/bot/get_bot_qrcode?bot_type=3`,
      { method: 'GET' },
    );
    return res.json({
      qrcode: payload.qrcode,
      qrcodeContent: payload.qrcode_img_content,
      qrcode_img_content: payload.qrcode_img_content,
      status: 'wait',
    });
  } catch (error) {
    return next(error);
  }
});

router.get('/wechat/qrcode/:qrcode/status', async (req, res, next) => {
  try {
    const { qrcode } = req.params;
    const payload = await fetchWechatJson(
      `${getWechatIlinkBaseUrl()}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`,
      {
        headers: { 'iLink-App-ClientVersion': '1' },
        method: 'GET',
      },
    );
    return res.json(payload);
  } catch (error) {
    return next(error);
  }
});

router.get('/:agentId/wechat', async (req, res, next) => {
  try {
    const user = getUserId(req);
    const resolved = await resolveChannelAgent(req, res, user);
    if (!resolved) return undefined;

    const provider = await AgentChannelProvider.findOne({
      agentId: resolved.agentId,
      platform: 'wechat',
      user,
    }).lean();

    if (!provider) {
      return res.status(404).json({ error: 'WeChat channel is not connected' });
    }

    return res.json(summarizeProvider(provider));
  } catch (error) {
    return next(error);
  }
});

router.post('/:agentId/wechat/connect', async (req, res, next) => {
  try {
    const user = getUserId(req);
    const credentials = {
      baseurl: stripTrailingSlashes(req.body.baseurl || getWechatIlinkBaseUrl()),
      botId: req.body.botId || req.body.ilink_bot_id,
      botToken: req.body.botToken || req.body.bot_token,
      userId: req.body.userId || req.body.ilink_user_id,
    };

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const resolved = await resolveChannelAgent(req, res, user);
    if (!resolved) return undefined;

    if (!credentials.botToken || !credentials.botId || !credentials.userId) {
      return res.status(400).json({ error: 'Missing WeChat bot credentials' });
    }

    const encryptedCredentials = await encryptCredentials(credentials);
    const provider = await AgentChannelProvider.findOneAndUpdate(
      { agentId: resolved.agentId, platform: 'wechat', user },
      {
        $set: {
          agentId: resolved.agentId,
          applicationId: credentials.botId,
          connectedAt: new Date(),
          credentials: encryptedCredentials,
          enabled: true,
          lastError: undefined,
          platform: 'wechat',
          runtimeStatus: 'connecting',
          settings: normalizeWechatSettings(req.body.settings),
          user,
        },
      },
      { new: true, upsert: true },
    );

    startWechatRuntime(provider, credentials);

    return res.json({
      ...summarizeProvider(provider),
      runtimeStatus: 'connecting',
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:agentId/wechat/settings', async (req, res, next) => {
  try {
    const user = getUserId(req);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const resolved = await resolveChannelAgent(req, res, user);
    if (!resolved) return undefined;

    const provider = await AgentChannelProvider.findOne({
      agentId: resolved.agentId,
      enabled: true,
      platform: 'wechat',
      user,
    });

    if (!provider) {
      return res.status(404).json({ error: 'WeChat channel is not connected' });
    }

    provider.settings = normalizeWechatSettings(req.body.settings);
    await provider.save();

    return res.json(summarizeProvider(provider));
  } catch (error) {
    return next(error);
  }
});

router.post('/:agentId/wechat/start', async (req, res, next) => {
  try {
    const user = getUserId(req);
    const resolved = await resolveChannelAgent(req, res, user);
    if (!resolved) return undefined;

    const provider = await AgentChannelProvider.findOne({
      agentId: resolved.agentId,
      enabled: true,
      platform: 'wechat',
      user,
    });

    if (!provider) {
      return res.status(404).json({ error: 'WeChat channel is not connected' });
    }

    const credentials = await decryptCredentials(provider.credentials);
    startWechatRuntime(provider, credentials);

    return res.json({
      ...summarizeProvider(provider),
      runtimeStatus: 'connecting',
    });
  } catch (error) {
    return next(error);
  }
});

router.post('/:agentId/wechat/disconnect', async (req, res, next) => {
  try {
    const user = getUserId(req);
    const resolved = await resolveChannelAgent(req, res, user);
    if (!resolved) return undefined;

    const provider = await AgentChannelProvider.findOne({
      agentId: resolved.agentId,
      platform: 'wechat',
      user,
    });

    if (!provider) {
      return res.status(404).json({ error: 'WeChat channel is not connected' });
    }

    stopWechatRuntime(provider._id.toString());
    provider.enabled = false;
    provider.runtimeStatus = 'disconnected';
    await provider.save();

    return res.json(summarizeProvider(provider));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

router._internals = {
  AgentChannelProvider,
  drainWechatBacklog,
  extractWechatMessageText,
  getWechatContextToken,
  getWechatMessageSender,
  getWechatMessageKey,
  getWechatThreadKey,
  handleWechatInboundMessage,
  markWechatMessageProcessed,
  normalizeWechatSettings,
  resolveChannelAgent,
  scheduleWechatRuntimeRestore,
  sendWechatText,
};

scheduleWechatRuntimeRestore();

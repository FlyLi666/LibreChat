const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { logger } = require('@librechat/data-schemas');
const { Constants, EModelEndpoint, parseTextParts } = require('librechat-data-provider');
const { getAppConfig } = require('~/server/services/Config');
const { buildOptions, initializeClient } = require('~/server/services/Endpoints/agents');
const { disposeClient } = require('~/server/cleanup');
const db = require('~/models');

const DEFAULT_AGENT_CHANNEL_TIMEOUT_MS = 120000;

function createNoopResponse() {
  const response = new EventEmitter();
  response.headersSent = false;
  response.writableEnded = false;
  response.finished = false;
  response.setHeader = () => {};
  response.getHeader = () => undefined;
  response.write = () => true;
  response.flush = () => {};
  response.end = () => {
    response.writableEnded = true;
    response.finished = true;
    response.emit('close');
  };
  response.status = () => response;
  response.json = () => response;
  return response;
}

function createChannelRequest({ appConfig, body, user }) {
  return {
    baseUrl: '/api/agents/chat',
    body,
    config: appConfig,
    conversationCreatedAt: new Date().toISOString(),
    headers: {},
    method: 'POST',
    originalUrl: '/api/agents/chat',
    path: '/chat',
    query: {},
    resolvedConversation: null,
    user,
  };
}

function normalizeUser(user) {
  const plain = typeof user?.toObject === 'function' ? user.toObject() : user;
  if (!plain) {
    return null;
  }

  return {
    ...plain,
    id: plain.id || plain._id?.toString?.() || plain._id,
  };
}

function extractReplyText(responseMessage) {
  if (typeof responseMessage?.text === 'string' && responseMessage.text.trim()) {
    return responseMessage.text.trim();
  }

  if (Array.isArray(responseMessage?.content)) {
    return parseTextParts(responseMessage.content, true).trim();
  }

  return '';
}

async function withTimeout(promise, timeoutMs) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Agent channel reply timed out')), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function runAgentReply({
  agentId,
  conversationId,
  ownerUserId,
  parentMessageId = Constants.NO_PARENT,
  text,
  timeoutMs = DEFAULT_AGENT_CHANNEL_TIMEOUT_MS,
}) {
  if (!agentId) {
    throw new Error('Missing agent id for channel reply');
  }
  if (!ownerUserId) {
    throw new Error('Missing channel owner user id');
  }
  if (!text) {
    throw new Error('Missing channel message text');
  }

  const user = normalizeUser(await db.getUserById(ownerUserId, '-password -__v'));
  if (!user?.id) {
    throw new Error('Channel owner user not found');
  }

  const appConfig = await getAppConfig({
    role: user.role,
    tenantId: user.tenantId,
    userId: user.id,
  });
  const body = {
    agent_id: agentId,
    conversationId: conversationId || crypto.randomUUID(),
    endpoint: EModelEndpoint.agents,
    isTemporary: false,
    parentMessageId,
    text,
  };
  const req = createChannelRequest({ appConfig, body, user });
  const res = createNoopResponse();
  const abortController = new AbortController();
  const endpointOption = await buildOptions(
    req,
    EModelEndpoint.agents,
    body,
    EModelEndpoint.agents,
  );
  req.body.endpointOption = endpointOption;

  let client;
  try {
    const result = await withTimeout(
      initializeClient({
        endpointOption,
        req,
        res,
        signal: abortController.signal,
      }),
      timeoutMs,
    );
    client = result.client;

    let userMessage;
    const response = await withTimeout(
      client.sendMessage(text, {
        abortController,
        conversationId: body.conversationId,
        getReqData: (data = {}) => {
          if (data.userMessage) {
            userMessage = data.userMessage;
          }
        },
        onStart: (message) => {
          userMessage = message;
        },
        parentMessageId,
        progressOptions: { res },
        user: user.id,
        userMCPAuthMap: result.userMCPAuthMap,
      }),
      timeoutMs,
    );

    const databasePromise = response.databasePromise;
    delete response.databasePromise;
    const { conversation } = databasePromise ? await databasePromise : {};
    const replyText = extractReplyText(response);

    return {
      conversationId:
        response.conversationId || body.conversationId || conversation?.conversationId,
      parentMessageId: response.messageId,
      replyText,
      responseMessageId: response.messageId,
      userMessageId: userMessage?.messageId,
    };
  } finally {
    abortController.requestCompleted = true;
    if (client) {
      disposeClient(client);
    }
  }
}

function createWechatReplyHandler(options = {}) {
  return async function wechatReplyHandler({
    agentId,
    conversationId,
    ownerUserId,
    parentMessageId,
    text,
  }) {
    try {
      return await runAgentReply({
        agentId,
        conversationId,
        ownerUserId,
        parentMessageId,
        text,
        timeoutMs: options.timeoutMs,
      });
    } catch (error) {
      logger?.error?.('[AgentChannelBridge] Failed to generate channel reply', error);
      throw error;
    }
  };
}

module.exports = {
  createWechatReplyHandler,
  extractReplyText,
  runAgentReply,
};

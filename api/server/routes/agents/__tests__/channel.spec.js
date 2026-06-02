const express = require('express');
const { EventEmitter } = require('node:events');
const request = require('supertest');

const mockGetAgent = jest.fn();
const mockHttpsRequest = jest.fn();

jest.mock('~/models', () => ({
  getAgent: (...args) => mockGetAgent(...args),
}));

jest.mock('node:https', () => ({
  request: (...args) => mockHttpsRequest(...args),
}));

describe('agent channel routes', () => {
  let app;
  let channelRouter;

  beforeEach(() => {
    jest.useRealTimers();
    mockHttpsRequest.mockImplementation((options, callback) => {
      const requestEmitter = new EventEmitter();
      requestEmitter.write = jest.fn();
      requestEmitter.destroy = jest.fn((error) => requestEmitter.emit('error', error));
      requestEmitter.end = jest.fn(() => {
        process.nextTick(() => {
          const response = new EventEmitter();
          response.statusCode = 200;
          response.setEncoding = jest.fn();
          callback(response);

          const payload = String(options.path).includes('/get_bot_qrcode')
            ? {
                qrcode: 'qr-real-123',
                qrcode_img_content: 'https://ilinkai.weixin.qq.com/qrcode/qr-real-123',
              }
            : {
                bot_token: 'bot-token-123',
                ilink_bot_id: 'bot-id-123',
                ilink_user_id: 'user-id-123',
                status: 'confirmed',
              };

          response.emit('data', JSON.stringify(payload));
          response.emit('end');
        });
      });

      return requestEmitter;
    });
    global.fetch = jest.fn(async (url) => {
      if (String(url).includes('/get_bot_qrcode')) {
        return {
          ok: true,
          text: async () =>
            JSON.stringify({
              qrcode: 'qr-real-123',
              qrcode_img_content: 'https://ilinkai.weixin.qq.com/qrcode/qr-real-123',
            }),
        };
      }

      return {
        ok: true,
        text: async () =>
          JSON.stringify({
            bot_token: 'bot-token-123',
            ilink_bot_id: 'bot-id-123',
            ilink_user_id: 'user-id-123',
            status: 'confirmed',
          }),
      };
    });
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: 'user-123' };
      next();
    });
    mockGetAgent.mockResolvedValue({ id: 'agent-real-id', user: 'user-123' });
    jest.resetModules();
    channelRouter = require('../channel');
    channelRouter.locals = {};
    app.use('/api/agents/channel', channelRouter);
  });

  it('creates a WeChat QR code session and exposes its polling status', async () => {
    const created = await request(app).post('/api/agents/channel/wechat/qrcode').expect(200);

    expect(created.body).toEqual(
      expect.objectContaining({
        qrcode: 'qr-real-123',
        qrcodeContent: 'https://ilinkai.weixin.qq.com/qrcode/qr-real-123',
        qrcode_img_content: 'https://ilinkai.weixin.qq.com/qrcode/qr-real-123',
        status: 'wait',
      }),
    );

    const status = await request(app)
      .get(`/api/agents/channel/wechat/qrcode/${created.body.qrcode}/status`)
      .expect(200);

    expect(status.body).toEqual({
      bot_token: 'bot-token-123',
      ilink_bot_id: 'bot-id-123',
      ilink_user_id: 'user-id-123',
      status: 'confirmed',
    });
    expect(mockHttpsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 4,
        headers: expect.objectContaining({ 'iLink-App-ClientVersion': '1' }),
        hostname: 'ilinkai.weixin.qq.com',
        method: 'GET',
        path: '/ilink/bot/get_bot_qrcode?bot_type=3',
      }),
      expect.any(Function),
    );
    expect(mockHttpsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 4,
        headers: expect.objectContaining({ 'iLink-App-ClientVersion': '1' }),
        hostname: 'ilinkai.weixin.qq.com',
        method: 'GET',
        path: '/ilink/bot/get_qrcode_status?qrcode=qr-real-123',
      }),
      expect.any(Function),
    );
  });

  it('keeps WeChat QR polling in wait state when iLink status times out', async () => {
    mockHttpsRequest.mockImplementationOnce((_options, _callback) => {
      const requestEmitter = new EventEmitter();
      requestEmitter.write = jest.fn();
      requestEmitter.destroy = jest.fn((error) => requestEmitter.emit('error', error));
      requestEmitter.end = jest.fn(() => {
        process.nextTick(() => {
          requestEmitter.emit('timeout');
        });
      });
      return requestEmitter;
    });

    const response = await request(app)
      .get('/api/agents/channel/wechat/qrcode/pending-qr/status')
      .expect(200);

    expect(response.body).toEqual({ status: 'wait' });
    expect(mockHttpsRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 4,
        path: '/ilink/bot/get_qrcode_status?qrcode=pending-qr',
      }),
      expect.any(Function),
    );
  });

  it('resolves Lobe-style virtual ids to the connected real Agent provider', async () => {
    const provider = {
      _id: { toString: () => 'provider-123' },
      agentId: 'agent-real-id',
      applicationId: 'bot-id-123',
      enabled: true,
      platform: 'wechat',
      runtimeStatus: 'connected',
      settings: {},
      user: 'user-123',
    };
    const findOne = jest
      .spyOn(channelRouter._internals.AgentChannelProvider, 'findOne')
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(provider),
      })
      .mockReturnValueOnce({
        lean: jest.fn().mockResolvedValue(provider),
      });
    mockGetAgent
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'agent-real-id', user: 'user-123' });

    const response = await request(app).get('/api/agents/channel/lobe-ai/wechat').expect(200);

    expect(response.body).toEqual(expect.objectContaining({ agentId: 'agent-real-id' }));
    expect(mockGetAgent).toHaveBeenCalledWith({ id: 'lobe-ai' });
    expect(mockGetAgent).toHaveBeenCalledWith({ id: 'agent-real-id' });
    expect(findOne).toHaveBeenLastCalledWith({
      agentId: 'agent-real-id',
      platform: 'wechat',
      user: 'user-123',
    });
  });

  it('extracts text from WeChat message items', () => {
    const { extractWechatMessageText, getWechatContextToken, getWechatMessageSender } =
      channelRouter._internals;

    const message = {
      context_token: 'ctx-123',
      from_user_id: 'wechat-user-1@im.wechat',
      item_list: [
        { text_item: { text: 'hello' }, type: 1 },
        { voice_item: { text: 'voice text' }, type: 4 },
        { file_item: { file_name: 'brief.pdf' }, type: 3 },
      ],
    };

    expect(getWechatMessageSender(message)).toBe('wechat-user-1@im.wechat');
    expect(getWechatContextToken(message)).toBe('ctx-123');
    expect(extractWechatMessageText(message)).toBe('hello\nvoice text\n[file: brief.pdf]');
  });

  it('sends WeChat text replies through iLink sendmessage', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ ret: 0 }),
    }));

    await channelRouter._internals.sendWechatText(
      { baseurl: 'https://ilink.test', botToken: 'bot-token-123' },
      'wechat-user-1@im.wechat',
      'hello back',
      'ctx-123',
    );

    expect(global.fetch).toHaveBeenCalledWith(
      'https://ilink.test/ilink/bot/sendmessage',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer bot-token-123',
          AuthorizationType: 'ilink_bot_token',
        }),
      }),
    );
    const requestBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(requestBody.msg).toEqual(
      expect.objectContaining({
        context_token: 'ctx-123',
        from_user_id: '',
        message_state: 2,
        message_type: 2,
        to_user_id: 'wechat-user-1@im.wechat',
      }),
    );
    expect(requestBody.msg.item_list[0]).toEqual({
      text_item: { text: 'hello back' },
      type: 1,
    });
  });

  it('bridges inbound WeChat messages through the configured reply handler', async () => {
    const replyHandler = jest.fn(async ({ text }) => `reply: ${text}`);
    channelRouter.locals.wechatReplyHandler = replyHandler;
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ ret: 0 }),
    }));
    jest.spyOn(channelRouter._internals.AgentChannelProvider, 'updateOne').mockResolvedValue({});

    const result = await channelRouter._internals.handleWechatInboundMessage({
      credentials: { baseurl: 'https://ilink.test', botToken: 'bot-token-123' },
      message: {
        context_token: 'ctx-123',
        from_user_id: 'wechat-user-1@im.wechat',
        item_list: [{ text_item: { text: 'ping' }, type: 1 }],
      },
      provider: {
        _id: { toString: () => 'provider-123' },
        agentId: 'agent-real-id',
        applicationId: 'bot-id-123',
        platform: 'wechat',
        settings: {},
        user: 'user-123',
      },
    });

    expect(result).toEqual({ bridged: true, replied: true });
    expect(replyHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        agentId: 'agent-real-id',
        fromUserId: 'wechat-user-1@im.wechat',
        ownerUserId: 'user-123',
        text: 'ping',
      }),
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('skips inbound WeChat messages that were already processed', async () => {
    const replyHandler = jest.fn(async ({ text }) => `reply: ${text}`);
    channelRouter.locals.wechatReplyHandler = replyHandler;
    const message = {
      context_token: 'ctx-duplicate',
      from_user_id: 'wechat-user-1@im.wechat',
      item_list: [{ text_item: { text: 'ping' }, type: 1 }],
    };
    const messageKey = channelRouter._internals.getWechatMessageKey(message.context_token);

    const result = await channelRouter._internals.handleWechatInboundMessage({
      credentials: { baseurl: 'https://ilink.test', botToken: 'bot-token-123' },
      message,
      provider: {
        _id: { toString: () => 'provider-123' },
        agentId: 'agent-real-id',
        applicationId: 'bot-id-123',
        platform: 'wechat',
        settings: {
          processedWechatMessages: {
            [messageKey]: { processedAt: new Date() },
          },
        },
        user: 'user-123',
      },
    });

    expect(result).toEqual({ duplicate: true, skipped: true });
    expect(replyHandler).not.toHaveBeenCalled();
  });

  it('drains a one-shot WeChat backlog without replying', async () => {
    const updateOne = jest
      .spyOn(channelRouter._internals.AgentChannelProvider, 'updateOne')
      .mockResolvedValue({});

    await channelRouter._internals.drainWechatBacklog('provider-drain', 'cursor-after-drain');

    expect(updateOne).toHaveBeenCalledWith(
      { _id: 'provider-drain' },
      expect.objectContaining({
        $set: expect.objectContaining({
          cursor: 'cursor-after-drain',
          'settings.skipNextWechatBacklog': false,
        }),
      }),
    );
  });

  it('persists WeChat thread state when the reply handler returns Agent metadata', async () => {
    const replyHandler = jest.fn(async () => ({
      conversationId: 'conversation-123',
      parentMessageId: 'assistant-message-123',
      replyText: 'agent reply',
    }));
    channelRouter.locals.wechatReplyHandler = replyHandler;
    global.fetch = jest.fn(async () => ({
      ok: true,
      text: async () => JSON.stringify({ ret: 0 }),
    }));
    const updateOne = jest
      .spyOn(channelRouter._internals.AgentChannelProvider, 'updateOne')
      .mockResolvedValue({});

    const result = await channelRouter._internals.handleWechatInboundMessage({
      credentials: { baseurl: 'https://ilink.test', botToken: 'bot-token-123' },
      message: {
        context_token: 'ctx-123',
        from_user_id: 'wechat-user-1@im.wechat',
        item_list: [{ text_item: { text: 'ping' }, type: 1 }],
      },
      provider: {
        _id: 'provider-123',
        agentId: 'agent-real-id',
        applicationId: 'bot-id-123',
        platform: 'wechat',
        settings: {},
        user: 'user-123',
      },
    });

    expect(result).toEqual({ bridged: true, replied: true });
    expect(updateOne).toHaveBeenCalledWith({ _id: 'provider-123' }, expect.any(Object));
    const threadUpdate = updateOne.mock.calls.find(([_, update]) =>
      Object.keys(update.$set ?? {}).some((key) => key.startsWith('settings.wechatThreads.')),
    );
    const patch = threadUpdate[1].$set;
    const [threadPath] = Object.keys(patch).filter((key) =>
      key.startsWith('settings.wechatThreads.'),
    );
    expect(threadPath).toMatch(/^settings\.wechatThreads\./);
    expect(patch[threadPath]).toEqual(
      expect.objectContaining({
        conversationId: 'conversation-123',
        fromUserId: 'wechat-user-1@im.wechat',
        parentMessageId: 'assistant-message-123',
      }),
    );
    expect(replyHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: undefined,
        parentMessageId: undefined,
      }),
    );
  });
});

const mockBuildOptions = jest.fn();
const mockInitializeClient = jest.fn();
const mockDisposeClient = jest.fn();
const mockGetAppConfig = jest.fn();
const mockGetUserById = jest.fn();

jest.mock('~/server/services/Endpoints/agents', () => ({
  buildOptions: (...args) => mockBuildOptions(...args),
  initializeClient: (...args) => mockInitializeClient(...args),
}));

jest.mock('~/server/cleanup', () => ({
  disposeClient: (...args) => mockDisposeClient(...args),
}));

jest.mock('~/server/services/Config', () => ({
  getAppConfig: (...args) => mockGetAppConfig(...args),
}));

jest.mock('~/models', () => ({
  getUserById: (...args) => mockGetUserById(...args),
}));

describe('AgentChannelBridge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserById.mockResolvedValue({
      _id: 'user-123',
      role: 'USER',
      tenantId: 'tenant-1',
    });
    mockGetAppConfig.mockResolvedValue({
      endpoints: { agents: { capabilities: [] } },
      interfaceConfig: {},
    });
    mockBuildOptions.mockResolvedValue({
      agent_id: 'agent-123',
      endpoint: 'agents',
      model_parameters: {},
    });
  });

  it('runs an Agent reply as the channel owner and extracts text content', async () => {
    const sendMessage = jest.fn(async (_text, options) => {
      options.onStart({ messageId: 'user-message-1' }, 'agent-message-1');
      return {
        content: [{ text: { value: 'hello from agent' }, type: 'text' }],
        conversationId: options.conversationId,
        databasePromise: Promise.resolve({
          conversation: { conversationId: options.conversationId },
        }),
        messageId: 'agent-message-1',
        text: '',
      };
    });
    const client = { sendMessage };
    mockInitializeClient.mockResolvedValue({ client, userMCPAuthMap: { server: {} } });

    const { runAgentReply } = require('../AgentChannelBridge');
    const result = await runAgentReply({
      agentId: 'agent-123',
      conversationId: 'conversation-123',
      ownerUserId: 'user-123',
      parentMessageId: 'parent-message-123',
      text: 'wechat says hi',
      timeoutMs: 1000,
    });

    expect(mockGetUserById).toHaveBeenCalledWith('user-123', '-password -__v');
    expect(mockGetAppConfig).toHaveBeenCalledWith({
      role: 'USER',
      tenantId: 'tenant-1',
      userId: 'user-123',
    });
    expect(mockBuildOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          agent_id: 'agent-123',
          conversationId: 'conversation-123',
          endpoint: 'agents',
          text: 'wechat says hi',
        }),
      }),
      'agents',
      expect.objectContaining({ agent_id: 'agent-123' }),
      'agents',
    );
    expect(sendMessage).toHaveBeenCalledWith(
      'wechat says hi',
      expect.objectContaining({
        conversationId: 'conversation-123',
        parentMessageId: 'parent-message-123',
        user: 'user-123',
        userMCPAuthMap: { server: {} },
      }),
    );
    expect(result).toEqual({
      conversationId: 'conversation-123',
      parentMessageId: 'agent-message-1',
      replyText: 'hello from agent',
      responseMessageId: 'agent-message-1',
      userMessageId: 'user-message-1',
    });
    expect(mockDisposeClient).toHaveBeenCalledWith(client);
  });
});

const mockAddServer = jest.fn();
const mockGetAgents = jest.fn();
const mockCreateAgent = jest.fn();
const mockGetUserPluginAuthValue = jest.fn();

jest.mock('@librechat/data-schemas', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

jest.mock('~/config', () => ({
  getMCPServersRegistry: () => ({
    addServer: mockAddServer,
  }),
}));

jest.mock('~/server/services/PermissionService', () => ({
  grantPermission: jest.fn().mockResolvedValue({}),
}));

jest.mock('~/server/utils/import/defaults', () => ({
  resolveImportDefaultModel: jest.fn().mockResolvedValue('gpt-4o-mini'),
}));

jest.mock('~/server/services/PluginService', () => ({
  getUserPluginAuthValue: (...args) => mockGetUserPluginAuthValue(...args),
}));

jest.mock('~/models', () => ({
  createAgent: (...args) => mockCreateAgent(...args),
  deleteAgent: jest.fn(),
  getAgents: (...args) => mockGetAgents(...args),
}));

const { getInstallStatus, installMarketItem, __testUtils } = require('./index');

const req = {
  config: {},
  query: {},
  user: {
    id: 'user_1',
    name: 'Test User',
    role: 'USER',
  },
};

describe('communityMarket service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAgents.mockResolvedValue([]);
    mockGetUserPluginAuthValue.mockResolvedValue(null);
  });

  it('normalizes market route kinds and builds encoded market URLs', () => {
    expect(__testUtils.normalizeKind('skills')).toBe('skill');
    expect(__testUtils.normalizeKind('plugins')).toBe('mcp');
    expect(__testUtils.normalizeKind('agents')).toBe('agent');
    expect(__testUtils.buildMarketOpenUrl('mcp', 'github/server', 'deployment')).toBe(
      '/community/mcp/github%2Fserver?activeTab=deployment',
    );
  });

  it('builds chat-menu MCP config for remote market MCPs', () => {
    const { config } = __testUtils.buildMcpConfig(
      {
        name: 'GitHub MCP',
        url: 'https://mcp.example.com/sse',
        env: {
          GITHUB_TOKEN: {
            description: 'Personal access token',
          },
        },
      },
      'github',
    );

    expect(config).toEqual(
      expect.objectContaining({
        chatMenu: true,
        startup: false,
        title: 'GitHub MCP',
        type: 'sse',
        url: 'https://mcp.example.com/sse',
      }),
    );
    expect(config.customUserVars.GITHUB_TOKEN).toEqual(
      expect.objectContaining({
        description: 'Personal access token',
        title: 'GITHUB_TOKEN',
      }),
    );
  });

  it('returns stable needs_config status for MCPs that require local stdio setup', async () => {
    const market = {
      getDetail: jest.fn().mockResolvedValue({
        command: 'npx',
        deployment: { type: 'local' },
        identifier: 'filesystem',
        installation: { instructions: 'Run this MCP server locally before connecting it.' },
        name: 'Filesystem',
      }),
    };

    const first = await getInstallStatus({
      market,
      kind: 'plugins',
      identifier: 'filesystem',
      req,
    });
    const second = await getInstallStatus({
      market,
      kind: 'plugins',
      identifier: 'filesystem',
      req,
    });

    expect(first).toEqual(second);
    expect(first).toEqual(
      expect.objectContaining({
        configUrl: '/community/mcp/filesystem?activeTab=deployment',
        deployment: { type: 'local' },
        instructions: 'Run this MCP server locally before connecting it.',
        kind: 'mcp',
        openUrl: '/community/mcp/filesystem?activeTab=deployment',
        status: 'needs_config',
        transport: 'stdio',
      }),
    );
    expect(first.missing).toEqual(['command', 'args']);
  });

  it('does not report remote MCPs with custom user variables as installed before configuration', async () => {
    const market = {
      getDetail: jest.fn().mockResolvedValue({
        env: {
          GITHUB_TOKEN: {
            description: 'Personal access token',
          },
        },
        identifier: 'github-mcp',
        name: 'GitHub MCP',
        url: 'https://mcp.example.com/mcp',
      }),
    };

    const status = await getInstallStatus({
      market,
      kind: 'mcp',
      identifier: 'github-mcp',
      req,
    });
    const install = await installMarketItem({
      market,
      kind: 'mcp',
      identifier: 'github-mcp',
      req,
    });

    expect(mockAddServer).not.toHaveBeenCalled();
    expect(status).toEqual(
      expect.objectContaining({
        configUrl: '/community/mcp/github-mcp?activeTab=deployment',
        openUrl: '/community/mcp/github-mcp?activeTab=deployment',
        reason: 'mcp_user_variables_required',
        status: 'needs_config',
      }),
    );
    expect(status.missing).toEqual(['GITHUB_TOKEN']);
    expect(install).toEqual(
      expect.objectContaining({
        action: 'needs_config',
        reason: 'mcp_user_variables_required',
        status: 'needs_config',
      }),
    );
  });

  it('returns the chat URL when an agent is already installed', async () => {
    mockGetAgents.mockResolvedValue([
      {
        id: 'agent_existing',
        name: 'Renamed Research Helper',
        support_contact: {
          sourceMetadata: {
            identifier: 'research-helper',
            kind: 'agent',
            market: 'lobe-community-market',
          },
        },
      },
    ]);

    const result = await installMarketItem({
      market: {
        getDetail: jest.fn().mockResolvedValue({
          identifier: 'research-helper',
          name: 'Research Helper',
        }),
      },
      kind: 'agents',
      identifier: 'research-helper',
      req,
    });

    expect(result).toEqual(
      expect.objectContaining({
        action: 'existing',
        openUrl: '/c/new?agent_id=agent_existing',
        status: 'installed',
      }),
    );
    expect(mockGetAgents).toHaveBeenCalledWith(
      expect.objectContaining({
        $and: expect.arrayContaining([
          expect.objectContaining({
            $or: expect.arrayContaining([
              expect.objectContaining({
                'support_contact.sourceMetadata.identifier': 'research-helper',
              }),
            ]),
          }),
        ]),
      }),
    );
  });

  it('forks Lobe agent config fields and source metadata into the local agent', async () => {
    mockCreateAgent.mockResolvedValue({
      _id: 'mongo_agent_research',
      id: 'agent_research',
      name: 'Research Helper',
    });

    const result = await installMarketItem({
      market: {
        getDetail: jest.fn().mockResolvedValue({
          config: {
            openingMessage: 'What are we researching today?',
            openingQuestions: ['Summarize this paper.'],
            systemRole: 'Use papers carefully.',
          },
          description: 'Research helper',
          identifier: 'research-helper',
          name: 'Research Helper',
        }),
      },
      kind: 'agents',
      identifier: 'research-helper',
      req,
    });

    expect(mockCreateAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        conversation_starters: ['What are we researching today?', 'Summarize this paper.'],
        instructions: 'Use papers carefully.',
        support_contact: expect.objectContaining({
          name: 'lobe-community-market',
          sourceMetadata: expect.objectContaining({
            identifier: 'research-helper',
            kind: 'agent',
            market: 'lobe-community-market',
          }),
        }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({
        openUrl: '/c/new?agent_id=agent_research',
        status: 'installed',
      }),
    );
  });

  it('installs remote MCPs through the DB registry with chatMenu enabled', async () => {
    mockAddServer.mockResolvedValue({
      config: {
        chatMenu: true,
        title: 'GitHub MCP',
        type: 'streamable-http',
        url: 'https://mcp.example.com/mcp',
      },
      serverName: 'github-mcp',
    });

    const result = await installMarketItem({
      market: {
        getDetail: jest.fn().mockResolvedValue({
          identifier: 'github-mcp',
          name: 'GitHub MCP',
          url: 'https://mcp.example.com/mcp',
        }),
      },
      kind: 'mcp',
      identifier: 'github-mcp',
      req,
    });

    expect(mockAddServer).toHaveBeenCalledWith(
      'github-mcp',
      expect.objectContaining({
        chatMenu: true,
        startup: false,
        title: 'GitHub MCP',
      }),
      'DB',
      'user_1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        action: 'created',
        local: expect.objectContaining({ serverName: 'github-mcp', type: 'mcp' }),
        openUrl: '/c/new',
        status: 'installed',
      }),
    );
  });
});

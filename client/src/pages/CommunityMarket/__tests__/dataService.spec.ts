import { dataService } from 'librechat-data-provider';
import { getMarketDetail, installMarketItem } from '../dataService';

jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');
  return {
    ...actual,
    dataService: {
      createAgent: jest.fn(),
      getAgentById: jest.fn(),
      listAgents: jest.fn(),
    },
  };
});

const mockedDataService = dataService as jest.Mocked<typeof dataService>;

describe('community market data service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/community/agent/research-assistant');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('loads local Agent market details from the market source instead of the local agent store', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        description: 'Research helper',
        identifier: 'research-assistant',
        name: 'Research Assistant',
      }),
      ok: true,
    }) as jest.Mock;

    const detail = await getMarketDetail('agent', 'research-assistant', 'zh-CN');

    expect(mockedDataService.getAgentById).not.toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/community-market/agents/research-assistant?locale=zh-CN'),
      undefined,
    );
    expect(detail?.name).toBe('Research Assistant');
  });

  it('normalizes localized object fields before the UI renders market details', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        category: { en: 'Coding', zh_CN: '编程' },
        description: { en: 'Security helper', zh_CN: '安全助手' },
        identifier: 'skill-vetter',
        name: { en: 'skill-vetter', zh_CN: '技能审查' },
      }),
      ok: true,
    }) as jest.Mock;

    const detail = await getMarketDetail('skill', 'skill-vetter', 'zh-CN');

    expect(detail).toMatchObject({
      category: '编程',
      description: '安全助手',
      name: '技能审查',
    });
  });

  it('can fork a local Agent market item into the local agent store', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: jest.fn().mockResolvedValue({
        description: 'Research helper',
        identifier: 'research-assistant',
        name: 'Research Assistant',
        systemRole: 'Use papers carefully.',
      }),
      ok: true,
    }) as jest.Mock;
    mockedDataService.listAgents.mockResolvedValue({ data: [] } as never);
    mockedDataService.createAgent.mockResolvedValue({
      id: 'agent_research',
      name: 'Research Assistant',
    } as never);

    const result = await installMarketItem('agent', 'research-assistant');

    expect(mockedDataService.createAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        instructions: 'Use papers carefully.',
        name: 'Research Assistant',
      }),
    );
    expect(result).toMatchObject({
      openUrl: '/c/new?agent_id=agent_research',
      state: 'installed',
    });
  });

  it('falls back to the Agent list when the market does not expose a detail endpoint', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          body: { error: { code: 404 } },
          message: '[object Object]',
        }),
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue('not found'),
      })
      .mockResolvedValueOnce({
        json: jest.fn().mockResolvedValue({
          items: [
            {
              config: { systemRole: 'Use papers carefully.' },
              description: 'Research helper',
              identifier: 'research-assistant',
              name: 'Research Assistant',
            },
          ],
        }),
        ok: true,
      }) as jest.Mock;

    const detail = await getMarketDetail('agent', 'research-assistant', 'zh-CN');

    expect(detail).toMatchObject({
      name: 'Research Assistant',
      systemRole: 'Use papers carefully.',
    });
    expect(global.fetch).toHaveBeenLastCalledWith(
      expect.stringContaining(
        '/api/community-market/agents?locale=zh-CN&pageSize=24&q=research-assistant',
      ),
      undefined,
    );
  });
});

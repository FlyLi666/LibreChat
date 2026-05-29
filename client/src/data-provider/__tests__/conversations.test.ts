import { useInfiniteQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import { useConversationsInfiniteQuery } from '../queries';

jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(),
  useInfiniteQuery: jest.fn(),
  useQueryClient: jest.fn(),
}));

jest.mock('librechat-data-provider', () => {
  const actual = jest.requireActual('librechat-data-provider');
  return {
    ...actual,
    dataService: {
      ...actual.dataService,
      listConversations: jest.fn(),
    },
  };
});

afterEach(() => {
  jest.clearAllMocks();
});

describe('useConversationsInfiniteQuery', () => {
  it('includes agent_id in the query key and request params', async () => {
    (useInfiniteQuery as jest.Mock).mockReturnValue({});
    (dataService.listConversations as jest.Mock).mockResolvedValue({
      conversations: [],
      nextCursor: null,
    });

    useConversationsInfiniteQuery({
      agent_id: 'agent_123',
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      tags: ['work'],
      search: 'report',
    });

    const queryConfig = (useInfiniteQuery as jest.Mock).mock.calls[0][0];

    expect(queryConfig.queryKey).toEqual([
      QueryKeys.allConversations,
      {
        isArchived: undefined,
        sortBy: 'updatedAt',
        sortDirection: 'desc',
        tags: ['work'],
        search: 'report',
        agent_id: 'agent_123',
      },
    ]);

    await queryConfig.queryFn({ pageParam: 'cursor_1' });

    expect(dataService.listConversations).toHaveBeenCalledWith({
      isArchived: undefined,
      sortBy: 'updatedAt',
      sortDirection: 'desc',
      tags: ['work'],
      search: 'report',
      agent_id: 'agent_123',
      cursor: 'cursor_1',
    });
  });
});

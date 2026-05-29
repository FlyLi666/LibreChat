import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import AgentSidebar from '../AgentSidebar';
import type { ResolvedAgentRouteContext } from '../useAgentRouteContext';

if (typeof Request === 'undefined') {
  global.Request = class Request {
    constructor(
      public url: string,
      public init?: RequestInit,
    ) {}
  } as any;
}

const mockUseConversationsInfiniteQuery = jest.fn();

jest.mock('~/data-provider', () => ({
  useConversationsInfiniteQuery: (...args: unknown[]) => mockUseConversationsInfiniteQuery(...args),
}));

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) =>
    ({
      com_agent_load_more_topics: 'Load more topics',
      com_agent_lookup_fallback: 'Agent lookup did not resolve',
      com_agent_lookup_loading: 'Resolving assistant...',
      com_agent_message_channels: 'Message channels',
      com_agent_profile: 'Assistant profile',
      com_agent_search_topics: 'Search topics',
      com_agent_soon: 'Soon',
      com_agent_tasks: 'Tasks',
      com_agent_topics: 'Topics',
      com_agent_topics_empty: 'No topics for this assistant yet.',
      com_agent_topics_unavailable: 'Topics need a resolved assistant id.',
      com_image_new_topic: 'New topic',
      com_ui_loading: 'Loading...',
      com_ui_new_conversation_title: 'New Conversation Title',
      com_ui_no_results_found: 'No results found',
      com_ui_search: 'Search',
    })[key] ?? key,
}));

const resolvedAgentContext: ResolvedAgentRouteContext = {
  requestedAgentId: 'lobe-ai',
  routeAgentId: 'lobe-ai',
  resolvedAgentId: 'agent-real-id',
  agent: {
    id: 'agent-real-id',
    name: 'Lobe AI',
    description: 'Personal assistant',
    avatar: null,
    created_at: 0,
    provider: 'openAI',
    model: 'gpt-4',
    model_parameters: {
      temperature: null,
      maxContextTokens: null,
      max_context_tokens: null,
      max_output_tokens: null,
      top_p: null,
      frequency_penalty: null,
      presence_penalty: null,
    },
  },
  displayName: 'Lobe AI',
  subtitle: 'Personal assistant',
  lookupStatus: 'resolved',
};

const fallbackAgentContext: ResolvedAgentRouteContext = {
  requestedAgentId: 'lobe-ai',
  routeAgentId: 'lobe-ai',
  resolvedAgentId: undefined,
  agent: null,
  displayName: 'Lobe AI',
  subtitle: 'lobe-ai',
  lookupStatus: 'fallback',
};

function renderSidebar(
  agentContext: ResolvedAgentRouteContext,
  initialEntry = '/agent/lobe-ai/new',
) {
  const router = createMemoryRouter(
    [
      {
        path: '/agent/:agentId/:conversationId?',
        element: (
          <AgentSidebar agentId="lobe-ai" conversationId="new" agentContext={agentContext} />
        ),
      },
    ],
    { initialEntries: [initialEntry] },
  );

  render(<RouterProvider router={router} />);

  return router;
}

describe('AgentSidebar', () => {
  beforeEach(() => {
    mockUseConversationsInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            conversations: [
              {
                conversationId: 'convo-1',
                title: 'Real topic',
                createdAt: '2026-05-29T08:00:00.000Z',
                updatedAt: '2026-05-29T09:00:00.000Z',
              },
              {
                conversationId: 'convo-2',
                title: 'Older topic',
                createdAt: '2026-05-28T08:00:00.000Z',
                updatedAt: '2026-05-28T09:00:00.000Z',
              },
            ],
            nextCursor: null,
          },
        ],
      },
      fetchNextPage: jest.fn(),
      isFetchingNextPage: false,
      isLoading: false,
    });
  });

  it('navigates sidebar actions to assistant routes', () => {
    const router = renderSidebar(resolvedAgentContext);

    fireEvent.click(screen.getByRole('button', { name: 'Assistant profile' }));
    expect(router.state.location.pathname).toBe('/agent/lobe-ai/profile');

    fireEvent.click(screen.getByRole('button', { name: 'Message channels' }));
    expect(router.state.location.pathname).toBe('/agent/lobe-ai/channel');

    fireEvent.click(screen.getByRole('button', { name: 'Tasks' }));
    expect(router.state.location.pathname).toBe('/agent/lobe-ai/task');

    fireEvent.click(screen.getByRole('button', { name: 'New topic' }));
    expect(router.state.location.pathname).toBe('/agent/lobe-ai/new');

    fireEvent.click(screen.getByRole('button', { name: 'Real topic' }));
    expect(router.state.location.pathname).toBe('/agent/lobe-ai/convo-1');
  });

  it('collapses and expands date groups', () => {
    renderSidebar(resolvedAgentContext);

    expect(screen.getByRole('button', { name: 'Real topic' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /May 29/i }));
    expect(screen.queryByRole('button', { name: 'Real topic' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Older topic' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /May 29/i }));
    expect(screen.getByRole('button', { name: 'Real topic' })).toBeInTheDocument();
  });

  it('keeps the assistant tools close to an empty search result', () => {
    renderSidebar(resolvedAgentContext);

    fireEvent.change(screen.getByPlaceholderText('Search topics'), {
      target: { value: 'missing' },
    });

    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Real topic' })).not.toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Assistant tools' })).toBeInTheDocument();
    expect(screen.getByTestId('agent-topic-results')).not.toHaveClass('flex-1');
  });

  it('shows a virtual empty state when the agent id cannot be resolved', () => {
    renderSidebar(fallbackAgentContext);

    expect(screen.getByText('Agent lookup did not resolve')).toBeInTheDocument();
    expect(screen.getByText('Topics need a resolved assistant id.')).toBeInTheDocument();
    expect(screen.queryByText('Recent assistant topic')).not.toBeInTheDocument();
  });
});

import React from 'react';
import { RecoilRoot } from 'recoil';
import '@testing-library/jest-dom/extend-expect';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivePanelProvider } from '~/Providers/ActivePanelContext';
import type { MutableSnapshot } from 'recoil';
import store from '~/store';

jest.mock('@librechat/client', () => {
  const actual = jest.requireActual('@librechat/client');
  return {
    ...actual,
    useMediaQuery: () => true,
    TooltipAnchor: ({ render }: { render: React.ReactNode }) => render,
  };
});

jest.mock('~/hooks', () => ({
  useChatHelpers: () => ({}),
  useLocalize: () => (key: string) => key,
  useNewConvo: () => ({ newConversation: jest.fn() }),
}));

jest.mock('~/hooks/Nav/useUnifiedSidebarLinks', () => ({
  __esModule: true,
  default: () => {
    const MockIcon = () => null;
    const MockConversationPanel = () => <div data-testid="conversation-panel" />;
    const MockMemoryPanel = () => <div data-testid="memory-panel" />;
    return {
      panelLinks: [
        {
          title: 'com_ui_chat_history',
          icon: MockIcon,
          id: 'conversations',
          Component: MockConversationPanel,
        },
        { title: 'com_ui_prompts', icon: MockIcon, id: 'prompts', Component: MockMemoryPanel },
      ],
      workspaceLinks: [
        { title: 'com_nav_home', icon: MockIcon, id: 'home' },
        { title: 'com_nav_image_gen', icon: MockIcon, id: 'image' },
        { title: 'com_nav_documents', icon: MockIcon, id: 'documents' },
      ],
      assistantLinks: [
        { title: 'com_nav_lobe_ai', icon: MockIcon, id: 'lobe-ai' },
        { title: 'com_nav_community_market', icon: MockIcon, id: 'community-market' },
        { title: 'com_nav_resources', icon: MockIcon, id: 'resources' },
      ],
    };
  },
}));

jest.mock('~/components/UnifiedSidebar/ConversationsSection', () => () => (
  <div data-testid="conversation-section" />
));

jest.mock('~/components/Nav/AccountSettings', () => ({
  __esModule: true,
  default: () => <div data-testid="account-settings" />,
}));

import UnifiedSidebar from '../UnifiedSidebar';

function renderSidebar(route: string, expanded = true) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RecoilRoot
        initializeState={({ set }: MutableSnapshot) => {
          set(store.sidebarExpanded, expanded);
        }}
      >
        <MemoryRouter initialEntries={[route]}>
          <ActivePanelProvider>
            <UnifiedSidebar />
          </ActivePanelProvider>
        </MemoryRouter>
      </RecoilRoot>
    </QueryClientProvider>,
  );
}

describe('UnifiedSidebar mobile drawer', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it.each([
    '/image',
    '/notebook',
    '/community',
    '/community/agent',
    '/community/skill',
    '/community/mcp/demo',
    '/agent/lobe-ai/channel',
  ])('opens on full-page route %s when sidebarExpanded is true', (route) => {
    const { container } = renderSidebar(route, true);

    expect(screen.getByTestId('close-sidebar-button')).toBeInTheDocument();
    expect(container.querySelector('.translate-x-0')).toBeInTheDocument();
    expect(container.querySelector('.-translate-x-full')).not.toBeInTheDocument();
  });

  it('opens secondary tool panels inside the mobile drawer', () => {
    renderSidebar('/c/new', true);

    fireEvent.click(screen.getByRole('button', { name: 'com_ui_prompts' }));

    expect(screen.getByTestId('memory-panel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'com_ui_back' })).toBeInTheDocument();
  });
});

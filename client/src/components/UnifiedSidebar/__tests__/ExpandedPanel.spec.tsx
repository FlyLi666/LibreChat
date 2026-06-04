import React from 'react';
import { RecoilRoot } from 'recoil';
import '@testing-library/jest-dom/extend-expect';
import {
  Boxes,
  FileText,
  Home,
  Image,
  LibraryBig,
  MessagesSquare,
  NotebookPen,
  Sparkles,
} from 'lucide-react';
import { MemoryRouter } from 'react-router-dom';
import { render, fireEvent, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { MutableSnapshot } from 'recoil';
import { ActivePanelProvider, DEFAULT_PANEL } from '~/Providers/ActivePanelContext';

const mockNewConversation = jest.fn();
const mockClearMessagesCache = jest.fn();
let mockHelpAndFaqURL = 'https://help.hezi.test/docs';

jest.mock('~/store', () => {
  const { atom } = jest.requireActual('recoil');
  let counter = 0;
  const switchAtom = atom({
    key: 'mock-newChatSwitchToHistory',
    default: true,
  });
  return {
    __esModule: true,
    default: {
      conversationByIndex: () =>
        atom({ key: `mock-conversationByIndex-${counter++}`, default: null }),
      newChatSwitchToHistory: switchAtom,
    },
  };
});

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) => key,
  useNewConvo: () => ({ newConversation: mockNewConversation }),
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ data: { helpAndFaqURL: mockHelpAndFaqURL } }),
}));

jest.mock('~/utils', () => ({
  clearMessagesCache: (...args: unknown[]) => mockClearMessagesCache(...args),
  cn: (...classes: unknown[]) => classes.filter(Boolean).join(' '),
}));

jest.mock('~/components/Chat/Menus/OpenSidebar', () => ({
  CLOSE_SIDEBAR_ID: 'close-sidebar',
}));

jest.mock('~/components/Nav/AccountSettings', () => ({
  __esModule: true,
  default: () => <div data-testid="account-settings" />,
}));

import ExpandedPanel from '../ExpandedPanel';
import store from '~/store';

const createPanelLinks = () => [
  {
    title: 'com_ui_chat_history' as const,
    icon: MessagesSquare,
    id: DEFAULT_PANEL,
  },
  {
    title: 'com_ui_prompts' as const,
    icon: NotebookPen,
    id: 'prompts',
  },
];

const createPrimaryLinks = () => [
  {
    title: 'com_nav_home' as const,
    icon: Home,
    id: 'home',
    onClick: jest.fn(),
  },
  {
    title: 'com_nav_image_gen' as const,
    icon: Image,
    id: 'image',
    onClick: jest.fn(),
  },
  {
    title: 'com_nav_documents' as const,
    icon: FileText,
    id: 'documents',
    onClick: jest.fn(),
  },
];

const createAssistantLinks = () => [
  {
    title: 'com_nav_lobe_ai' as const,
    icon: Sparkles,
    id: 'lobe-ai',
    onClick: jest.fn(),
  },
  {
    title: 'com_nav_community_market' as const,
    icon: Boxes,
    id: 'community-market',
    onClick: jest.fn(),
  },
  {
    title: 'com_nav_resources' as const,
    icon: LibraryBig,
    id: 'resources',
    onClick: jest.fn(),
  },
];

const createQueryClient = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderPanel({
  expanded = true,
  onCollapse = jest.fn(),
  onExpand = jest.fn(),
  initialPanel = DEFAULT_PANEL,
  route = '/c/new',
  initializeState,
}: {
  expanded?: boolean;
  onCollapse?: jest.Mock;
  onExpand?: jest.Mock;
  initialPanel?: string;
  route?: string;
  initializeState?: (snapshot: MutableSnapshot) => void;
} = {}) {
  if (initialPanel !== DEFAULT_PANEL) {
    localStorage.setItem('side:active-panel', initialPanel);
  }

  const result = render(
    <QueryClientProvider client={createQueryClient()}>
      <RecoilRoot initializeState={initializeState}>
        <MemoryRouter initialEntries={[route]}>
          <ActivePanelProvider>
            <ExpandedPanel
              links={createPanelLinks()}
              workspaceLinks={createPrimaryLinks()}
              assistantLinks={createAssistantLinks()}
              expanded={expanded}
              onCollapse={onCollapse}
              onExpand={onExpand}
            />
          </ActivePanelProvider>
        </MemoryRouter>
      </RecoilRoot>
    </QueryClientProvider>,
  );

  return { ...result, onCollapse, onExpand };
}

describe('ExpandedPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockHelpAndFaqURL = 'https://help.hezi.test/docs';
    jest.spyOn(window, 'open').mockImplementation(() => null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('NavIconButton collapse toggle', () => {
    it('keeps recent conversations and exposes chat tools as second-level panel entries', () => {
      const { onCollapse } = renderPanel({ expanded: true });

      expect(screen.getByText('com_nav_recent')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'com_nav_chat_tools' })).toBeInTheDocument();

      const inactiveButton = screen.getByRole('button', { name: 'com_ui_prompts' });
      fireEvent.click(inactiveButton);

      expect(onCollapse).not.toHaveBeenCalled();
      expect(localStorage.getItem('side:active-panel')).toBe('prompts');
    });

    it('does not put chat secondary tools in the collapsed primary rail', () => {
      renderPanel({ expanded: false });

      expect(screen.getByRole('button', { name: 'com_nav_image_gen' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'com_ui_prompts' })).not.toBeInTheDocument();
    });

    it('collapses the secondary panel after clicking a primary full-page nav item', () => {
      const { onCollapse } = renderPanel({ expanded: true });

      fireEvent.click(screen.getByRole('button', { name: 'com_nav_image_gen' }));

      expect(onCollapse).toHaveBeenCalledTimes(1);
    });

    it('uses the current route for full-page nav item highlighting', () => {
      renderPanel({ expanded: true, route: '/image' });

      expect(screen.getByRole('button', { name: 'com_nav_image_gen' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.queryByRole('button', { name: 'com_ui_chat_history' })).not.toBeInTheDocument();
    });

    it('hides conversation panel items on full-page tool routes', () => {
      renderPanel({ expanded: true, route: '/notebook' });

      expect(screen.getByRole('button', { name: 'com_nav_documents' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.queryByRole('button', { name: 'com_ui_chat_history' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'com_ui_prompts' })).not.toBeInTheDocument();
    });

    it('highlights resources for the community MCP route', () => {
      renderPanel({ expanded: true, route: '/community/mcp' });

      expect(screen.getByRole('button', { name: 'com_nav_resources' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'com_nav_community_market' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('highlights community market for community home and market routes', () => {
      const { unmount } = renderPanel({ expanded: true, route: '/community' });

      expect(screen.getByRole('button', { name: 'com_nav_community_market' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'com_nav_resources' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );

      unmount();
      renderPanel({ expanded: true, route: '/community/skill' });

      expect(screen.getByRole('button', { name: 'com_nav_community_market' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });

    it('highlights Lobe AI for assistant routes', () => {
      renderPanel({ expanded: true, route: '/agent/lobe-ai/new' });

      expect(screen.getByRole('button', { name: 'com_nav_lobe_ai' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByText('com_nav_recent')).toBeInTheDocument();
      expect(screen.getByRole('navigation', { name: 'com_nav_chat_tools' })).toBeInTheDocument();
    });

    it('renders full-page nav items before chat secondary tools', () => {
      renderPanel({ expanded: true });

      const buttons = screen
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label'));

      expect(buttons).toEqual(expect.arrayContaining(['com_nav_image_gen', 'com_ui_prompts']));
      expect(buttons.indexOf('com_nav_image_gen')).toBeLessThan(buttons.indexOf('com_ui_prompts'));
    });

    it('opens the configured help page from the bottom rail help button', () => {
      renderPanel({ expanded: true });

      fireEvent.click(screen.getByRole('button', { name: 'com_nav_help_faq' }));

      expect(window.open).toHaveBeenCalledWith(
        'https://help.hezi.test/docs',
        '_blank',
        'noopener,noreferrer',
      );
    });

    it('disables the bottom rail help button when no help page is configured', () => {
      mockHelpAndFaqURL = '/';
      renderPanel({ expanded: true });

      const helpButton = screen.getByRole('button', { name: 'com_nav_help_faq' });
      fireEvent.click(helpButton);

      expect(helpButton).toBeDisabled();
      expect(window.open).not.toHaveBeenCalled();
    });
  });

  describe('NewChatButton panel switch', () => {
    it('switches to chat history panel on new chat click when setting is enabled', () => {
      renderPanel({ expanded: true, initialPanel: 'prompts' });

      const newChatLink = screen.getByTestId('new-chat-button');
      fireEvent.click(newChatLink);

      expect(mockNewConversation).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('side:active-panel')).toBe(DEFAULT_PANEL);
    });

    it('does not switch panel on new chat click when setting is disabled', () => {
      renderPanel({
        expanded: true,
        initialPanel: 'prompts',
        initializeState: ({ set }: MutableSnapshot) => {
          set(store.newChatSwitchToHistory, false);
        },
      });

      const newChatLink = screen.getByTestId('new-chat-button');
      fireEvent.click(newChatLink);

      expect(mockNewConversation).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('side:active-panel')).toBe('prompts');
    });
  });
});

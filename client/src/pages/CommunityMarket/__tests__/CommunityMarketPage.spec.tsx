import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import CommunityMarketPage from '../CommunityMarketPage';
import {
  getMarketCategories,
  getMarketDetail,
  getMarketInstallStatus,
  getMarketList,
  installMarketItem,
} from '../dataService';

jest.mock('~/components/Chat/Menus/OpenSidebar', () => () => null);
jest.mock('@librechat/client', () => ({
  Button: ({
    children,
    className,
    disabled,
    onClick,
    variant,
  }: {
    children: React.ReactNode;
    className?: string;
    disabled?: boolean;
    onClick?: () => void;
    variant?: string;
  }) => (
    <button className={className} data-variant={variant} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Skeleton: ({ className }: { className?: string }) => <div className={className} />,
}));
jest.mock('../dataService', () => ({
  getMarketCategories: jest.fn(),
  getMarketDetail: jest.fn(),
  getMarketInstallStatus: jest.fn(),
  getMarketList: jest.fn(),
  installMarketItem: jest.fn(),
}));

const mockedGetMarketCategories = getMarketCategories as jest.MockedFunction<
  typeof getMarketCategories
>;
const mockedGetMarketDetail = getMarketDetail as jest.MockedFunction<typeof getMarketDetail>;
const mockedGetMarketInstallStatus = getMarketInstallStatus as jest.MockedFunction<
  typeof getMarketInstallStatus
>;
const mockedGetMarketList = getMarketList as jest.MockedFunction<typeof getMarketList>;
const mockedInstallMarketItem = installMarketItem as jest.MockedFunction<typeof installMarketItem>;

const marketItem = {
  author: 'LobeHub',
  category: 'coding-agents-ides',
  description: 'Use this skill to code carefully.',
  identifier: 'demo-skill',
  installCount: 12,
  name: 'Demo Skill',
  resourcesCount: 1,
  updatedAt: '2026-05-29T00:00:00.000Z',
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderMarket(initialPath: string) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route
            path="/community"
            element={
              <>
                <CommunityMarketPage />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/community/:tab"
            element={
              <>
                <CommunityMarketPage />
                <LocationProbe />
              </>
            }
          />
          <Route
            path="/community/:tab/:identifier"
            element={
              <>
                <CommunityMarketPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('CommunityMarketPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.clear();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: jest.fn().mockResolvedValue(undefined),
      },
    });

    mockedGetMarketCategories.mockResolvedValue([
      { category: 'coding-agents-ides', count: 7 },
      { category: 'web-frontend-development', count: 3 },
    ]);
    mockedGetMarketList.mockResolvedValue({
      items: [marketItem],
      pageSize: 24,
      totalCount: 1,
      totalPages: 1,
    });
    mockedGetMarketDetail.mockResolvedValue({
      ...marketItem,
      skillMd: '# Demo Skill',
    });
    mockedGetMarketInstallStatus.mockResolvedValue({ state: 'uninstalled' });
    mockedInstallMarketItem.mockResolvedValue({ state: 'installed' });
  });

  it('renders /community as the community home instead of the Skill list', () => {
    renderMarket('/community');

    expect(screen.getByText('Community Home')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Agents \/ Assistants/i }).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByRole('button', { name: /Skills/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /MCP/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Models/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Providers/i }).length).toBeGreaterThan(0);
    expect(mockedGetMarketList).not.toHaveBeenCalled();
  });

  it('normalizes legacy /community/assistant to the agent market route', async () => {
    renderMarket('/community/assistant?locale=en-US');

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/community/agent?locale=en-US'),
    );
  });

  it('renders Models and Providers placeholder routes', () => {
    const { unmount } = renderMarket('/community/models');

    expect(screen.getByRole('heading', { name: 'Models' })).toBeInTheDocument();
    expect(screen.getByText(/模型目录路由已就位/)).toBeInTheDocument();
    expect(mockedGetMarketList).not.toHaveBeenCalled();

    unmount();
    renderMarket('/community/providers');

    expect(screen.getByRole('heading', { name: 'Providers' })).toBeInTheDocument();
    expect(screen.getByText(/Provider 目录路由已就位/)).toBeInTheDocument();
  });

  it('uses only live category counts instead of curated fallback counts', async () => {
    renderMarket('/community/skill');

    const categoryButton = await screen.findByRole('button', { name: /编程代理与 IDE/i });

    expect(within(categoryButton).getByText('7')).toBeInTheDocument();
    expect(screen.queryByText('5万')).not.toBeInTheDocument();
  });

  it('renders details as a modal and closes back to the list route', async () => {
    const user = userEvent.setup();
    renderMarket('/community/skill/demo-skill?activeTab=skill');

    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/community/skill/demo-skill');

    await user.click(screen.getByRole('button', { name: '关闭详情' }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent('/community/skill'),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('gives feedback when copying the Skill install command', async () => {
    const user = userEvent.setup();
    renderMarket('/community/skill/demo-skill');

    await screen.findByRole('dialog');
    await user.click(screen.getByRole('button', { name: /复制 CLI 命令/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('CLI 命令已复制。');
  });

  it('keeps installed Skill and MCP primary actions enabled so users can open them', async () => {
    mockedGetMarketInstallStatus.mockResolvedValueOnce({
      openUrl: '/skills/local-demo',
      state: 'installed',
    });
    const { unmount } = renderMarket('/community/skill/demo-skill');

    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: '打开' })).toBeEnabled();

    unmount();
    mockedGetMarketInstallStatus.mockResolvedValueOnce({
      openUrl: '/c/new',
      state: 'installed',
    });
    renderMarket('/community/mcp/demo-skill');

    await screen.findByRole('dialog');
    expect(screen.getByRole('button', { name: '打开' })).toBeEnabled();
  });
});

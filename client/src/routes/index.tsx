import { createBrowserRouter, Navigate, Outlet } from 'react-router-dom';
import {
  Login,
  RequireAdmin,
  VerifyEmail,
  Registration,
  ResetPassword,
  ApiErrorWatcher,
  TwoFactorScreen,
  RequestPasswordReset,
} from '~/components/Auth';
import { MarketplaceProvider } from '~/components/Agents/MarketplaceContext';
import AgentMarketplace from '~/components/Agents/Marketplace';
import { OAuthSuccess, OAuthError } from '~/components/OAuth';
import { AuthContextProvider } from '~/hooks/AuthContext';
import RouteErrorBoundary from './RouteErrorBoundary';
import StartupLayout from './Layouts/Startup';
import LoginLayout from './Layouts/Login';
import dashboardRoutes from './Dashboard';
import ShareRoute from './ShareRoute';
import ChatRoute from './ChatRoute';
import AgentRoute from './AgentRoute';
import Search from './Search';
import Root from './Root';

const AuthLayout = () => (
  <AuthContextProvider>
    <Outlet />
    <ApiErrorWatcher />
  </AuthContextProvider>
);

const loadInlinePromptsView = () =>
  import('~/components/Prompts/layouts/InlinePromptsView').then((m) => ({
    Component: m.default,
  }));

const loadSkillsView = () =>
  import('~/components/Skills/layouts/SkillsView').then((m) => ({
    Component: m.default,
  }));

const loadNotebookPage = () =>
  import('~/pages/Notebook').then((m) => ({
    Component: m.default,
  }));

const loadImagePage = () =>
  import('~/pages/Image').then((m) => ({
    Component: m.default,
  }));

const loadCommunityMarketPage = () =>
  import('~/pages/CommunityMarket').then((m) => ({
    Component: m.default,
  }));

const baseEl = document.querySelector('base');
const baseHref = baseEl?.getAttribute('href') || '/';

export const router = createBrowserRouter(
  [
    {
      path: 'share/:shareId',
      element: <ShareRoute />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      path: 'oauth',
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'success',
          element: <OAuthSuccess />,
        },
        {
          path: 'error',
          element: <OAuthError />,
        },
      ],
    },
    {
      path: '/',
      element: <StartupLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: 'register',
          element: <Registration />,
        },
        {
          path: 'forgot-password',
          element: <RequestPasswordReset />,
        },
        {
          path: 'reset-password',
          element: <ResetPassword />,
        },
      ],
    },
    {
      path: 'verify',
      element: <VerifyEmail />,
      errorElement: <RouteErrorBoundary />,
    },
    {
      element: <AuthLayout />,
      errorElement: <RouteErrorBoundary />,
      children: [
        {
          path: '/',
          element: <LoginLayout />,
          children: [
            {
              path: 'login',
              element: <Login />,
            },
            {
              path: 'login/2fa',
              element: <TwoFactorScreen />,
            },
          ],
        },
        dashboardRoutes,
        {
          path: '/',
          element: <Root />,
          children: [
            {
              index: true,
              element: <Navigate to="/c/new" replace={true} />,
            },
            {
              path: 'c/:conversationId?',
              element: <ChatRoute />,
            },
            {
              path: 'agent/:agentId',
              element: <AgentRoute />,
            },
            {
              path: 'agent/:agentId/profile',
              element: <AgentRoute />,
            },
            {
              path: 'agent/:agentId/topics',
              element: <AgentRoute />,
            },
            {
              path: 'agent/:agentId/channel',
              element: <AgentRoute />,
            },
            {
              path: 'agent/:agentId/task',
              element: <AgentRoute />,
            },
            {
              path: 'agent/:agentId/task/:taskId',
              element: <AgentRoute />,
            },
            {
              path: 'agent/:agentId/:conversationId/page',
              element: <AgentRoute />,
            },
            {
              path: 'agent/:agentId/:conversationId?',
              element: <AgentRoute />,
            },
            {
              path: 'search',
              element: <Search />,
            },
            {
              path: 'image',
              lazy: loadImagePage,
            },
            {
              path: 'notebook',
              element: (
                <RequireAdmin>
                  <Outlet />
                </RequireAdmin>
              ),
              children: [
                {
                  index: true,
                  lazy: loadNotebookPage,
                },
              ],
            },
            {
              path: 'community',
              lazy: loadCommunityMarketPage,
            },
            {
              path: 'community/:tab',
              lazy: loadCommunityMarketPage,
            },
            {
              path: 'community/:tab/:identifier',
              lazy: loadCommunityMarketPage,
            },
            {
              path: 'prompts',
              element: <Navigate to="/prompts/new" replace={true} />,
            },
            {
              path: 'prompts/new',
              lazy: loadInlinePromptsView,
            },
            {
              path: 'prompts/:promptId',
              lazy: loadInlinePromptsView,
            },
            {
              path: 'skills',
              lazy: loadSkillsView,
            },
            {
              path: 'skills/new',
              lazy: loadSkillsView,
            },
            {
              path: 'skills/:skillId',
              lazy: loadSkillsView,
            },
            {
              path: 'skills/:skillId/edit',
              lazy: loadSkillsView,
            },
            {
              path: 'agents',
              element: (
                <MarketplaceProvider>
                  <AgentMarketplace />
                </MarketplaceProvider>
              ),
            },
            {
              path: 'agents/:category',
              element: (
                <MarketplaceProvider>
                  <AgentMarketplace />
                </MarketplaceProvider>
              ),
            },
          ],
        },
      ],
    },
  ],
  { basename: baseHref },
);

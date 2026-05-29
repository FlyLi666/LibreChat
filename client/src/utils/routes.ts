import { matchPath } from 'react-router-dom';

const matchesRouteStart = (pathname: string, pattern: string) =>
  matchPath({ path: pattern, end: false }, pathname) != null;

export const isArtifactRoute = (pathname: string) =>
  matchesRouteStart(pathname, '/c/*') || matchesRouteStart(pathname, '/share/*');

export const getActiveAssistantId = (pathname: string) => {
  const match = matchPath({ path: '/agent/:agentId/*', end: false }, pathname);
  return match?.params.agentId;
};

export const getConversationRoutePath = ({
  pathname,
  conversationId,
  search = '',
}: {
  pathname: string;
  conversationId: string;
  search?: string;
}) => {
  const agentId = getActiveAssistantId(pathname);
  const path = agentId ? `/agent/${agentId}/${conversationId}` : `/c/${conversationId}`;
  return `${path}${search}`;
};

export const isNewConversationRoute = (pathname: string) =>
  pathname === '/c/new' || matchPath({ path: '/agent/:agentId/new', end: true }, pathname) != null;

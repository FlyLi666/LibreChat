import { useMemo } from 'react';
import { useRecoilValue } from 'recoil';
import { useNavigate } from 'react-router-dom';
import {
  Boxes,
  BotMessageSquare,
  FileText,
  Home,
  LibraryBig,
  MessagesSquare,
  Sparkles,
} from 'lucide-react';
import { useUserKeyQuery } from 'librechat-data-provider/react-query';
import { getConfigDefaults, getEndpointField } from 'librechat-data-provider';
import type { TEndpointsConfig } from 'librechat-data-provider';
import type { NavLink } from '~/common';
import ConversationsSection from '~/components/UnifiedSidebar/ConversationsSection';
import { useGetEndpointsQuery, useGetStartupConfig } from '~/data-provider';
import useSideNavLinks from '~/hooks/Nav/useSideNavLinks';
import { useAuthContext } from '~/hooks';
import store from '~/store';
import { createHeziNotebookLink } from './heziNotebookLink';
import { createHeziImageLink } from './heziImageLink';
import LobeAiPanel from '~/components/UnifiedSidebar/LobeAiPanel';

const defaultInterface = getConfigDefaults().interface;

export default function useUnifiedSidebarLinks() {
  const navigate = useNavigate();
  const { user } = useAuthContext();
  const conversation = useRecoilValue(store.conversationByIndex(0));
  const endpoint = conversation?.endpoint;
  const { data: startupConfig } = useGetStartupConfig();
  const { data: endpointsConfig = {} as TEndpointsConfig } = useGetEndpointsQuery();

  const interfaceConfig = useMemo(
    () => startupConfig?.interface ?? defaultInterface,
    [startupConfig],
  );

  const endpointType = useMemo(
    () => getEndpointField(endpointsConfig, endpoint, 'type'),
    [endpoint, endpointsConfig],
  );

  const userProvidesKey = useMemo(
    () => !!(endpointsConfig?.[endpoint ?? '']?.userProvide ?? false),
    [endpointsConfig, endpoint],
  );

  const { data: keyExpiry = { expiresAt: undefined } } = useUserKeyQuery(endpoint ?? '');

  const keyProvided = useMemo(
    () => (userProvidesKey ? !!(keyExpiry.expiresAt ?? '') : true),
    [keyExpiry.expiresAt, userProvidesKey],
  );

  const sideNavLinks = useSideNavLinks({
    keyProvided,
    endpoint,
    endpointType,
    interfaceConfig,
    endpointsConfig,
    includeHidePanel: false,
  });

  const links = useMemo(() => {
    const conversationLink: NavLink = {
      title: 'com_ui_chat_history',
      label: '',
      icon: MessagesSquare,
      id: 'conversations',
      Component: ConversationsSection,
    };
    const homeLink: NavLink = {
      title: 'com_nav_home',
      label: '',
      icon: Home,
      id: 'home',
      onClick: () => navigate('/'),
    };
    const imageLink = createHeziImageLink(navigate);
    const notebookLink = createHeziNotebookLink(user?.role, navigate);
    const docsLink: NavLink | null = notebookLink
      ? {
          ...notebookLink,
          title: 'com_nav_documents',
          icon: FileText,
          id: 'documents',
        }
      : null;
    const agentBuilderLink = sideNavLinks.find((link) => link.id === 'agents');
    const communityLink: NavLink = {
      title: 'com_nav_community_market',
      label: '',
      icon: Boxes,
      id: 'community-market',
      onClick: () => navigate('/community'),
    };
    const resourcesLink: NavLink = {
      title: 'com_nav_resources',
      label: '',
      icon: LibraryBig,
      id: 'resources',
      onClick: () => navigate('/community/mcp'),
    };
    const lobeAiLink: NavLink = {
      title: 'com_nav_lobe_ai',
      label: '',
      icon: Sparkles,
      id: 'lobe-ai',
      Component: LobeAiPanel,
    };
    const wechatBotLink: NavLink = {
      title: 'com_nav_wechat_bot',
      label: '',
      icon: BotMessageSquare,
      id: 'wechat-bot',
      onClick: () => navigate('/agent/lobe-ai/channel'),
    };

    return {
      workspaceLinks: [homeLink, imageLink, ...(docsLink ? [docsLink] : [])],
      assistantLinks: [
        lobeAiLink,
        wechatBotLink,
        ...(agentBuilderLink
          ? [{ ...agentBuilderLink, title: 'com_nav_create_assistant' as const }]
          : []),
        communityLink,
        resourcesLink,
      ],
      panelLinks: [
        conversationLink,
        ...sideNavLinks.filter((link) => link.id !== 'agents' && link.id !== 'community-market'),
      ],
    };
  }, [navigate, sideNavLinks, user?.role]);

  return links;
}

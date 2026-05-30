import { useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  FileText,
  Hash,
  ListTodo,
  MessageSquare,
  Plus,
  Search,
  UserRound,
} from 'lucide-react';
import { Constants } from 'librechat-data-provider';
import type { ConversationListResponse } from 'librechat-data-provider';
import { useLocation, useNavigate } from 'react-router-dom';
import { useConversationsInfiniteQuery } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { getAgentAvatarUrl } from '~/utils/agents';
import cn from '~/utils/cn';
import type { ResolvedAgentRouteContext } from './useAgentRouteContext';

type AgentSidebarProps = {
  agentId: string;
  conversationId?: string;
  agentContext: ResolvedAgentRouteContext;
};

type SidebarAction = {
  id: 'new' | 'search' | 'profile' | 'channel' | 'task';
  label: string;
  icon: typeof Plus;
  badge?: string;
  active?: boolean;
  onClick?: () => void;
};

type GroupedTopics = {
  key: string;
  label: string;
  topics: ConversationListResponse['conversations'];
};

const routeSegments = new Set(['profile', 'topics', 'channel', 'task', Constants.NEW_CONVO]);

function SidebarActionButton({ action }: { action: SidebarAction }) {
  const Icon = action.icon;

  return (
    <button
      type="button"
      title={action.label}
      aria-label={action.label}
      onClick={action.onClick}
      className={cn(
        'group flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
        action.active
          ? 'bg-surface-active-alt text-text-primary shadow-[inset_0_0_0_1px_rgba(255,255,255,0.10)]'
          : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
      {action.badge && (
        <span className="rounded-full bg-surface-hover px-2 py-0.5 text-[10px] font-medium text-text-tertiary">
          {action.badge}
        </span>
      )}
    </button>
  );
}

function AgentAvatar({ agentContext }: { agentContext: ResolvedAgentRouteContext }) {
  const avatarUrl = getAgentAvatarUrl(agentContext.agent);
  const initials = (agentContext.displayName || 'LA')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt={`${agentContext.displayName} avatar`}
        className="size-10 shrink-0 rounded-full object-cover shadow-lg shadow-sky-950/40"
      />
    );
  }

  return (
    <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-300 via-sky-400 to-violet-500 text-sm font-semibold text-text-primary shadow-lg shadow-sky-950/40">
      {initials || 'LA'}
    </div>
  );
}

function getDateKey(value: string | number | Date | undefined) {
  const date = value ? new Date(value) : new Date(0);

  if (Number.isNaN(date.getTime())) {
    return 'unknown';
  }

  return date.toISOString().slice(0, 10);
}

function getTopicDateLabel(value: string | number | Date | undefined) {
  const date = value ? new Date(value) : new Date(0);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
}

function groupTopics(topics: ConversationListResponse['conversations']) {
  const groups = new Map<string, GroupedTopics>();

  topics.forEach((topic) => {
    const label = getTopicDateLabel(topic.updatedAt || topic.createdAt);
    const key = getDateKey(topic.updatedAt || topic.createdAt);

    if (!groups.has(key)) {
      groups.set(key, { key, label, topics: [] });
    }

    groups.get(key)?.topics.push(topic);
  });

  return Array.from(groups.values());
}

export default function AgentSidebar({ agentId, conversationId, agentContext }: AgentSidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const localize = useLocalize();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [collapsedTopicGroups, setCollapsedTopicGroups] = useState<Set<string>>(() => new Set());
  const [isTopicSectionCollapsed, setIsTopicSectionCollapsed] = useState(false);
  const routeAgentId = agentContext.routeAgentId || agentId;
  const activeSegment = conversationId ?? Constants.NEW_CONVO;
  const isConversationRoute = !!conversationId && !routeSegments.has(conversationId);
  const hasResolvedAgent = !!agentContext.resolvedAgentId;
  const isSearchFocused =
    activeSegment === 'topics' && new URLSearchParams(location.search).get('focus') === 'search';
  const conversationQueryParams = {
    agent_id: agentContext.resolvedAgentId,
    sortBy: 'updatedAt',
    sortDirection: 'desc',
  } as Parameters<typeof useConversationsInfiniteQuery>[0] & { agent_id?: string };

  const { data, fetchNextPage, isFetchingNextPage, isLoading } = useConversationsInfiniteQuery(
    conversationQueryParams,
    {
      enabled: hasResolvedAgent,
      staleTime: 30000,
      cacheTime: 300000,
    },
  );

  const conversations = useMemo(() => {
    return data ? data.pages.flatMap((page) => page.conversations) : [];
  }, [data]);

  const filteredConversations = useMemo(() => {
    const query = searchValue.trim().toLowerCase();

    if (!query) {
      return conversations;
    }

    return conversations.filter((conversation) =>
      (conversation.title || localize('com_ui_new_conversation_title'))
        .toLowerCase()
        .includes(query),
    );
  }, [conversations, localize, searchValue]);

  const groupedTopics = useMemo(() => groupTopics(filteredConversations), [filteredConversations]);
  const hasNextPage = data?.pages?.[data.pages.length - 1]?.nextCursor != null;

  const goTo = (segment: string) => {
    navigate(`/agent/${routeAgentId}/${segment}`);
  };

  const goToNewTopic = () => {
    goTo(Constants.NEW_CONVO);
  };

  const focusSearch = () => {
    setIsTopicSectionCollapsed(false);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  };

  const toggleTopicGroup = (groupKey: string) => {
    setCollapsedTopicGroups((current) => {
      const next = new Set(current);

      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }

      return next;
    });
  };

  const primaryActions: SidebarAction[] = [
    {
      id: 'new',
      label: localize('com_image_new_topic'),
      icon: Plus,
      active: activeSegment === Constants.NEW_CONVO,
      onClick: goToNewTopic,
    },
    {
      id: 'search',
      label: localize('com_ui_search'),
      icon: Search,
      active: isSearchFocused || searchValue.trim().length > 0,
      onClick: focusSearch,
    },
  ];

  const secondaryActions: SidebarAction[] = [
    {
      id: 'profile',
      label: localize('com_agent_profile'),
      icon: UserRound,
      active: activeSegment === 'profile',
      onClick: () => goTo('profile'),
    },
    {
      id: 'channel',
      label: localize('com_agent_message_channels'),
      icon: Hash,
      active: activeSegment === 'channel',
      onClick: () => goTo('channel'),
    },
    {
      id: 'task',
      label: localize('com_agent_tasks'),
      icon: ListTodo,
      badge: localize('com_agent_soon'),
      active: activeSegment === 'task',
      onClick: () => goTo('task'),
    },
  ];

  let topicsContent;
  if (!hasResolvedAgent) {
    topicsContent = (
      <div className="rounded-md border border-border-light px-3 py-4 text-sm leading-5 text-text-tertiary">
        {localize('com_agent_topics_unavailable')}
      </div>
    );
  } else if (isLoading) {
    topicsContent = (
      <div className="px-3 py-4 text-sm text-text-tertiary">{localize('com_ui_loading')}</div>
    );
  } else if (groupedTopics.length === 0) {
    topicsContent = (
      <div className="rounded-md border border-border-light px-3 py-4 text-sm leading-5 text-text-tertiary">
        {searchValue.trim()
          ? localize('com_ui_no_results_found')
          : localize('com_agent_topics_empty')}
      </div>
    );
  } else {
    topicsContent = groupedTopics.map((group) => (
      <section key={group.key}>
        <button
          type="button"
          aria-expanded={!collapsedTopicGroups.has(group.key)}
          onClick={() => toggleTopicGroup(group.key)}
          className="mb-1 flex h-7 w-full items-center gap-1 rounded-md px-1 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-text-tertiary transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {collapsedTopicGroups.has(group.key) ? (
            <ChevronRight className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <ChevronDown className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          <span className="min-w-0 flex-1 truncate">{group.label}</span>
          <span className="text-[10px] text-text-tertiary">{group.topics.length}</span>
        </button>
        {!collapsedTopicGroups.has(group.key) && (
          <div className="space-y-1">
            {group.topics.map((topic) => {
              const isActive = isConversationRoute && conversationId === topic.conversationId;

              return (
                <button
                  type="button"
                  key={topic.conversationId}
                  onClick={() => navigate(`/agent/${routeAgentId}/${topic.conversationId}`)}
                  className={cn(
                    'flex h-10 w-full items-center gap-3 rounded-md px-3 text-left text-sm transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                    isActive
                      ? 'bg-surface-hover text-text-primary'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                  )}
                >
                  <FileText className="size-4 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">
                    {topic.title || localize('com_ui_new_conversation_title')}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    ));
  }

  return (
    <aside
      data-testid="agent-sidebar"
      className="hidden h-full w-[292px] shrink-0 border-r border-border-light bg-surface-primary-alt md:flex md:flex-col"
    >
      <div className="border-b border-border-light px-4 py-4">
        <button
          type="button"
          title="Assistant selector"
          className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <AgentAvatar agentContext={agentContext} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-text-primary">
              {agentContext.displayName}
            </div>
            <div className="truncate text-xs text-text-tertiary">{agentContext.subtitle}</div>
          </div>
          {agentContext.lookupStatus === 'resolved' ? (
            <CheckCircle2
              className="size-4 shrink-0 text-emerald-700 dark:text-emerald-300/80"
              aria-hidden="true"
            />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-text-tertiary" aria-hidden="true" />
          )}
        </button>
        {agentContext.lookupStatus !== 'resolved' && (
          <p className="mt-2 px-2 text-xs leading-5 text-text-tertiary">
            {localize(
              agentContext.lookupStatus === 'loading'
                ? 'com_agent_lookup_loading'
                : 'com_agent_lookup_fallback',
            )}
          </p>
        )}
      </div>

      <nav className="space-y-1 px-3 py-3" aria-label="Assistant primary actions">
        {primaryActions.map((action) => (
          <SidebarActionButton key={action.id} action={action} />
        ))}
      </nav>

      <div className="flex min-h-0 flex-col border-t border-border-light px-3 py-3">
        <button
          type="button"
          aria-expanded={!isTopicSectionCollapsed}
          onClick={() => setIsTopicSectionCollapsed((value) => !value)}
          className="mb-2 flex h-8 items-center justify-between rounded-md px-2 text-left transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <h2 className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
            {localize('com_agent_topics')}
          </h2>
          <span className="flex items-center gap-1 text-text-tertiary">
            <MessageSquare className="size-3.5" aria-hidden="true" />
            {isTopicSectionCollapsed ? (
              <ChevronRight className="size-3.5" aria-hidden="true" />
            ) : (
              <ChevronDown className="size-3.5" aria-hidden="true" />
            )}
          </span>
        </button>

        {!isTopicSectionCollapsed && (
          <>
            <div className="relative mb-3">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary" />
              <input
                ref={searchInputRef}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={localize('com_agent_search_topics')}
                className="h-9 w-full rounded-md border border-border-light bg-surface-hover pl-8 pr-3 text-sm text-text-primary outline-none placeholder:text-text-tertiary focus:border-border-medium focus:bg-surface-hover"
              />
            </div>

            <div
              data-testid="agent-topic-results"
              className="max-h-[min(42vh,360px)] min-h-0 space-y-3 overflow-y-auto"
            >
              {topicsContent}
            </div>

            {hasResolvedAgent && hasNextPage && (
              <button
                type="button"
                disabled={isFetchingNextPage}
                onClick={() => fetchNextPage()}
                className="mt-3 h-9 rounded-md border border-border-light px-3 text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isFetchingNextPage
                  ? localize('com_ui_loading')
                  : localize('com_agent_load_more_topics')}
              </button>
            )}
          </>
        )}
      </div>

      <nav
        className="space-y-1 border-t border-border-light px-3 py-3"
        aria-label="Assistant tools"
      >
        {secondaryActions.map((action) => (
          <SidebarActionButton key={action.id} action={action} />
        ))}
      </nav>
    </aside>
  );
}

import type { ReactNode } from 'react';
import { Hash, ListTodo, MessageSquarePlus, UserRound } from 'lucide-react';
import { Constants } from 'librechat-data-provider';
import { useLocation, useNavigate } from 'react-router-dom';
import { useLocalize } from '~/hooks';
import cn from '~/utils/cn';
import AgentSidebar from './AgentSidebar';
import type { ResolvedAgentRouteContext } from './useAgentRouteContext';

type AssistantLayoutProps = {
  agentId: string;
  conversationId?: string;
  agentContext: ResolvedAgentRouteContext;
  children: ReactNode;
};

export default function AssistantLayout({
  agentId,
  conversationId,
  agentContext,
  children,
}: AssistantLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const localize = useLocalize();
  const routeAgentId = agentContext.routeAgentId || agentId;
  const pathParts = location.pathname.split('/').filter(Boolean);
  const agentIndex = pathParts.findIndex((part) => part === 'agent');
  const activeSegment =
    agentIndex >= 0 ? pathParts[agentIndex + 2] || Constants.NEW_CONVO : conversationId;
  const mobileActions = [
    {
      id: Constants.NEW_CONVO,
      label: localize('com_image_new_topic'),
      icon: MessageSquarePlus,
      to: Constants.NEW_CONVO,
    },
    {
      id: 'profile',
      label: localize('com_agent_profile'),
      icon: UserRound,
      to: 'profile',
    },
    {
      id: 'channel',
      label: localize('com_agent_message_channels'),
      icon: Hash,
      to: 'channel',
    },
    {
      id: 'task',
      label: localize('com_agent_tasks'),
      icon: ListTodo,
      to: 'task',
    },
  ];

  return (
    <section
      data-testid="assistant-layout"
      className="flex h-full min-h-0 w-full overflow-hidden bg-surface-primary text-text-primary"
    >
      <AgentSidebar agentId={agentId} conversationId={conversationId} agentContext={agentContext} />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-primary">
        <nav
          aria-label="Assistant mobile navigation"
          className="shrink-0 overflow-x-auto border-b border-border-light bg-surface-primary-alt px-3 py-2 md:hidden"
        >
          <div className="flex min-w-max gap-2">
            {mobileActions.map((action) => {
              const Icon = action.icon;
              const isActive = activeSegment === action.id;

              return (
                <button
                  type="button"
                  key={action.id}
                  onClick={() => navigate(`/agent/${routeAgentId}/${action.to}`)}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600',
                    isActive
                      ? 'bg-surface-active-alt text-text-primary'
                      : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </nav>
        {children}
      </main>
    </section>
  );
}

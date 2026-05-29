import type { ReactNode } from 'react';
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
  return (
    <section
      data-testid="assistant-layout"
      className="flex h-full min-h-0 w-full overflow-hidden bg-[#0f1117] text-text-primary"
    >
      <AgentSidebar agentId={agentId} conversationId={conversationId} agentContext={agentContext} />
      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-surface-primary">
        {children}
      </main>
    </section>
  );
}

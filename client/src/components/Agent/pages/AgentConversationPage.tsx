import { FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocalize } from '~/hooks';
import AgentPageShell from './AgentPageShell';

export default function AgentConversationPage({
  agentId,
  conversationId,
}: {
  agentId: string;
  conversationId: string;
}) {
  const localize = useLocalize();
  const navigate = useNavigate();

  return (
    <AgentPageShell
      testId="agent-conversation-page"
      eyebrow={agentId}
      title={localize('com_agent_conversation_page')}
      description={localize('com_agent_conversation_page_subtitle')}
      actions={
        <button
          type="button"
          onClick={() => navigate(`/agent/${agentId}/${conversationId}`)}
          className="rounded-md bg-surface-submit px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-surface-submit-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {localize('com_agent_back_to_chat')}
        </button>
      }
    >
      <section className="rounded-lg border border-border-light bg-surface-primary-alt p-6">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-xl bg-surface-hover text-text-secondary">
            <FileText className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-text-primary">{conversationId}</h2>
            <p className="mt-1 text-sm text-text-secondary">
              {localize('com_agent_conversation_page_hint')}
            </p>
          </div>
        </div>
      </section>
    </AgentPageShell>
  );
}

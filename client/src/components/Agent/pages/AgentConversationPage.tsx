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
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {localize('com_agent_back_to_chat')}
        </button>
      }
    >
      <section className="rounded-lg border border-white/10 bg-[#171b24] p-6">
        <div className="flex items-center gap-4">
          <div className="bg-white/8 flex size-12 items-center justify-center rounded-xl text-white/60">
            <FileText className="size-6" aria-hidden="true" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">{conversationId}</h2>
            <p className="mt-1 text-sm text-white/50">
              {localize('com_agent_conversation_page_hint')}
            </p>
          </div>
        </div>
      </section>
    </AgentPageShell>
  );
}

import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Constants } from 'librechat-data-provider';
import {
  AgentChannelsPage,
  AgentConversationPage,
  AgentProfilePage,
  AgentTasksPage,
  AgentTopicsPage,
  AssistantLayout,
} from '~/components/Agent';
import useAgentRouteContext from '~/components/Agent/useAgentRouteContext';
import { useLocalize } from '~/hooks';
import ChatRoute from './ChatRoute';

const reservedAgentPages = new Set(['profile', 'topics', 'channel', 'task']);

export default function AgentRoute() {
  const { agentId = '', conversationId, taskId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const localize = useLocalize();
  const agentContext = useAgentRouteContext(agentId);

  if (!agentId) {
    return <Navigate to="/c/new" replace={true} />;
  }

  const pathParts = location.pathname.split('/').filter(Boolean);
  const agentIndex = pathParts.findIndex((part) => part === 'agent');
  const section = agentIndex >= 0 ? pathParts[agentIndex + 2] : undefined;
  const isConversationPage = section === conversationId && pathParts[agentIndex + 3] === 'page';
  const activeConversationId =
    conversationId && !reservedAgentPages.has(conversationId) ? conversationId : undefined;

  let content;
  if (section === 'profile') {
    content = <AgentProfilePage agentId={agentId} agentContext={agentContext} />;
  } else if (section === 'topics') {
    content = <AgentTopicsPage agentId={agentId} />;
  } else if (section === 'channel') {
    content = <AgentChannelsPage agentId={agentId} />;
  } else if (section === 'task') {
    content = <AgentTasksPage agentId={agentId} taskId={taskId} />;
  } else if (isConversationPage && conversationId) {
    content = <AgentConversationPage agentId={agentId} conversationId={conversationId} />;
  } else if (activeConversationId) {
    content = <ChatRoute />;
  } else {
    content = (
      <div
        data-testid="agent-new-topic-entry"
        className="flex h-full min-h-0 flex-col items-center justify-center gap-4 bg-surface-primary px-6 text-center"
      >
        <div className="max-w-sm space-y-2">
          <h1 className="text-xl font-semibold text-text-primary">
            {localize('com_agent_new_topic_title')}
          </h1>
          <p className="text-sm text-text-secondary">{localize('com_agent_new_topic_subtitle')}</p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/agent/${agentId}/${Constants.NEW_CONVO}`)}
          className="rounded-md bg-surface-submit px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-surface-submit-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {localize('com_image_new_topic')}
        </button>
      </div>
    );
  }

  return (
    <AssistantLayout agentId={agentId} conversationId={section} agentContext={agentContext}>
      {content}
    </AssistantLayout>
  );
}

import { Hash, ListTodo, Plus, Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocalize } from '~/hooks';

const actions = [
  {
    id: 'new',
    title: 'com_image_new_topic',
    icon: Plus,
    to: '/agent/lobe-ai/new',
  },
  {
    id: 'topics',
    title: 'com_ui_search',
    icon: Search,
    to: '/agent/lobe-ai/topics?focus=search',
  },
  {
    id: 'profile',
    title: 'com_agent_profile',
    icon: UserRound,
    to: '/agent/lobe-ai/profile',
  },
  {
    id: 'channel',
    title: 'com_agent_message_channels',
    icon: Hash,
    to: '/agent/lobe-ai/channel',
  },
  {
    id: 'task',
    title: 'com_agent_tasks',
    icon: ListTodo,
    to: '/agent/lobe-ai/task',
  },
] as const;

export default function LobeAiPanel() {
  const navigate = useNavigate();
  const localize = useLocalize();

  return (
    <div className="flex h-full flex-col gap-2 bg-surface-primary-alt p-3">
      {actions.map((action) => {
        const Icon = action.icon;

        return (
          <button
            key={action.id}
            type="button"
            className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            onClick={() => navigate(action.to)}
          >
            <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{localize(action.title)}</span>
            {action.id === 'task' && (
              <span className="rounded-full bg-surface-active-alt px-2 py-0.5 text-[10px] text-text-secondary">
                {localize('com_agent_soon')}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

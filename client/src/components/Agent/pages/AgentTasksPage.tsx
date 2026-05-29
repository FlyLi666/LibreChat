import { useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, CircleDot, Clock3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocalize } from '~/hooks';
import cn from '~/utils/cn';
import AgentPageShell from './AgentPageShell';

type TaskStatus = 'running' | 'backlog' | 'done';

type AgentTask = {
  id: string;
  title: string;
  detail: string;
  status: TaskStatus;
};

const seedTasks: AgentTask[] = [
  {
    id: 'live-profile-polish',
    title: 'Profile polish pass',
    detail: 'Align the assistant profile editing surface with the Lobe-style dark canvas.',
    status: 'running',
  },
  {
    id: 'topics-data-hook',
    title: 'Wire topic data',
    detail: 'Replace the local topic array with the real assistant-scoped conversation source.',
    status: 'backlog',
  },
  {
    id: 'sidebar-shell',
    title: 'Assistant shell route',
    detail: 'Render assistant chat inside the dedicated layout.',
    status: 'done',
  },
];

const statusIcons = {
  running: Clock3,
  backlog: CircleDot,
  done: CheckCircle2,
};

export default function AgentTasksPage({
  agentId,
  taskId,
  tasks = seedTasks,
}: {
  agentId: string;
  taskId?: string;
  tasks?: AgentTask[];
}) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const [openGroups, setOpenGroups] = useState<Record<TaskStatus, boolean>>({
    running: true,
    backlog: true,
    done: false,
  });

  const groupedTasks = useMemo(
    () => ({
      running: tasks.filter((task) => task.status === 'running'),
      backlog: tasks.filter((task) => task.status === 'backlog'),
      done: tasks.filter((task) => task.status === 'done'),
    }),
    [tasks],
  );
  const selectedTask = tasks.find((task) => task.id === taskId);

  return (
    <AgentPageShell
      testId="agent-task-page"
      eyebrow={agentId}
      title={localize('com_agent_tasks')}
      description={localize('com_agent_tasks_subtitle')}
    >
      <section className="grid min-h-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          {(Object.keys(groupedTasks) as TaskStatus[]).map((status) => {
            const Icon = statusIcons[status];
            const isOpen = openGroups[status];
            return (
              <section key={status} className="rounded-lg border border-white/10 bg-[#171b24]">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroups((current) => ({ ...current, [status]: !current[status] }))
                  }
                  className="hover:bg-white/7 flex h-12 w-full items-center gap-3 px-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30"
                >
                  <ChevronDown
                    className={cn(
                      'text-white/42 size-4 transition-transform',
                      !isOpen && '-rotate-90',
                    )}
                    aria-hidden="true"
                  />
                  <Icon className="size-4 text-sky-200" aria-hidden="true" />
                  <span className="flex-1 text-sm font-semibold text-white">
                    {localize(`com_agent_task_${status}`)}
                  </span>
                  <span className="bg-white/8 text-white/48 rounded-full px-2 py-0.5 text-xs">
                    {groupedTasks[status].length}
                  </span>
                </button>
                {isOpen ? (
                  <div className="divide-white/8 divide-y border-t border-white/10">
                    {groupedTasks[status].map((task) => (
                      <button
                        type="button"
                        key={task.id}
                        onClick={() => navigate(`/agent/${agentId}/task/${task.id}`)}
                        className={cn(
                          'w-full px-4 py-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300/50',
                          task.id === taskId ? 'bg-sky-400/10' : 'hover:bg-white/7',
                        )}
                      >
                        <div className="text-sm font-medium text-white">{task.title}</div>
                        <div className="text-white/48 mt-1 line-clamp-2 text-xs leading-5">
                          {task.detail}
                        </div>
                      </button>
                    ))}
                    {groupedTasks[status].length === 0 ? (
                      <div className="text-white/42 px-4 py-5 text-sm">
                        {localize('com_agent_task_empty_group')}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>

        <aside className="rounded-lg border border-white/10 bg-[#171b24] p-5">
          {selectedTask ? (
            <div data-testid="agent-task-detail" className="space-y-4">
              <div>
                <div className="text-white/38 text-xs font-medium uppercase tracking-[0.12em]">
                  {localize(`com_agent_task_${selectedTask.status}`)}
                </div>
                <h2 className="mt-2 text-lg font-semibold text-white">{selectedTask.title}</h2>
              </div>
              <p className="text-white/58 text-sm leading-6">{selectedTask.detail}</p>
              <textarea
                defaultValue={selectedTask.detail}
                className="hover:border-white/18 min-h-36 w-full resize-y rounded-md border border-white/10 bg-[#10131a] p-3 text-sm leading-6 text-white outline-none transition-colors focus:border-sky-300/70 focus:ring-2 focus:ring-sky-400/20"
                aria-label={localize('com_agent_task_notes')}
              />
            </div>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center text-center">
              <CircleDot className="text-white/28 size-10" aria-hidden="true" />
              <h2 className="mt-4 text-base font-semibold text-white">
                {localize('com_agent_task_no_selection')}
              </h2>
              <p className="mt-2 text-sm leading-6 text-white/50">
                {localize('com_agent_task_no_selection_subtitle')}
              </p>
            </div>
          )}
        </aside>
      </section>
    </AgentPageShell>
  );
}

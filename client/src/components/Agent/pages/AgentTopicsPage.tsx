import { useMemo, useState } from 'react';
import { ArrowUpDown, MessageSquare, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLocalize } from '~/hooks';
import AgentPageShell from './AgentPageShell';

export type AgentTopic = {
  id: string;
  title: string;
  preview?: string;
  updatedAt?: string;
  count?: number;
};

type AgentTopicsPageProps = {
  agentId: string;
  topics?: AgentTopic[];
};

export default function AgentTopicsPage({ agentId, topics = [] }: AgentTopicsPageProps) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'title'>('recent');

  const visibleTopics = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return topics
      .filter((topic) => {
        if (!normalizedQuery) {
          return true;
        }
        return [topic.title, topic.preview].some((value) =>
          value?.toLowerCase().includes(normalizedQuery),
        );
      })
      .sort((a, b) => {
        if (sort === 'title') {
          return a.title.localeCompare(b.title);
        }
        return (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '');
      });
  }, [query, sort, topics]);

  return (
    <AgentPageShell
      testId="agent-topics-page"
      eyebrow={agentId}
      title={localize('com_agent_topics')}
      description={localize('com_agent_topics_subtitle')}
      actions={
        <button
          type="button"
          onClick={() => navigate(`/agent/${agentId}/new`)}
          className="rounded-md bg-surface-submit px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-surface-submit-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {localize('com_image_new_topic')}
        </button>
      }
    >
      <section className="rounded-lg border border-border-light bg-surface-primary-alt">
        <div className="flex flex-col gap-3 border-b border-border-light p-4 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-tertiary"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-10 w-full rounded-md border border-border-light bg-surface-primary pl-9 pr-3 text-sm text-text-primary outline-none transition-colors placeholder:text-text-tertiary hover:border-border-medium focus:border-sky-300/70 focus:ring-2 focus:ring-sky-400/20"
              placeholder={localize('com_agent_search_topics')}
            />
          </label>
          <button
            type="button"
            onClick={() => setSort((current) => (current === 'recent' ? 'title' : 'recent'))}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border-light bg-surface-hover px-3 text-sm font-medium text-text-primary transition-colors hover:bg-surface-active-alt focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ArrowUpDown className="size-4" aria-hidden="true" />
            {sort === 'recent'
              ? localize('com_agent_sort_recent')
              : localize('com_agent_sort_title')}
          </button>
        </div>

        {visibleTopics.length > 0 ? (
          <div className="divide-y divide-border-light">
            {visibleTopics.map((topic) => (
              <button
                type="button"
                key={topic.id}
                onClick={() => navigate(`/agent/${agentId}/${topic.id}`)}
                className="flex w-full items-center gap-4 px-4 py-4 text-left transition-colors hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300/50"
              >
                <div className="dark:bg-sky-400/14 flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-100 text-sky-700 dark:text-sky-200">
                  <MessageSquare className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-text-primary">
                    {topic.title}
                  </div>
                  <div className="mt-1 truncate text-xs text-text-tertiary">{topic.preview}</div>
                </div>
                <div className="shrink-0 text-right text-xs text-text-tertiary">
                  <div>{topic.updatedAt}</div>
                  <div className="mt-1">{topic.count ?? 0}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-surface-hover text-text-secondary">
              <MessageSquare className="size-7" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">
                {localize('com_agent_topics_empty')}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-text-secondary">
                {localize('com_agent_topics_empty_subtitle')}
              </p>
            </div>
          </div>
        )}
      </section>
    </AgentPageShell>
  );
}

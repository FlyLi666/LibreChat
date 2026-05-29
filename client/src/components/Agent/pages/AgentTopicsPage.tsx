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
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-white/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {localize('com_image_new_topic')}
        </button>
      }
    >
      <section className="rounded-lg border border-white/10 bg-[#171b24]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center">
          <label className="relative min-w-0 flex-1">
            <Search
              className="text-white/38 pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="placeholder:text-white/28 hover:border-white/18 h-10 w-full rounded-md border border-white/10 bg-[#10131a] pl-9 pr-3 text-sm text-white outline-none transition-colors focus:border-sky-300/70 focus:ring-2 focus:ring-sky-400/20"
              placeholder={localize('com_agent_search_topics')}
            />
          </label>
          <button
            type="button"
            onClick={() => setSort((current) => (current === 'recent' ? 'title' : 'recent'))}
            className="bg-white/7 hover:bg-white/12 inline-flex h-10 items-center justify-center gap-2 rounded-md border border-white/10 px-3 text-sm font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            <ArrowUpDown className="size-4" aria-hidden="true" />
            {sort === 'recent'
              ? localize('com_agent_sort_recent')
              : localize('com_agent_sort_title')}
          </button>
        </div>

        {visibleTopics.length > 0 ? (
          <div className="divide-white/8 divide-y">
            {visibleTopics.map((topic) => (
              <button
                type="button"
                key={topic.id}
                onClick={() => navigate(`/agent/${agentId}/${topic.id}`)}
                className="hover:bg-white/7 flex w-full items-center gap-4 px-4 py-4 text-left transition-colors focus-visible:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-300/50"
              >
                <div className="bg-sky-400/14 flex size-10 shrink-0 items-center justify-center rounded-lg text-sky-200">
                  <MessageSquare className="size-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-white">{topic.title}</div>
                  <div className="text-white/48 mt-1 truncate text-xs">{topic.preview}</div>
                </div>
                <div className="text-white/38 shrink-0 text-right text-xs">
                  <div>{topic.updatedAt}</div>
                  <div className="mt-1">{topic.count ?? 0}</div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 px-6 text-center">
            <div className="bg-white/8 text-white/52 flex size-14 items-center justify-center rounded-2xl">
              <MessageSquare className="size-7" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                {localize('com_agent_topics_empty')}
              </h2>
              <p className="text-white/52 mt-2 max-w-md text-sm leading-6">
                {localize('com_agent_topics_empty_subtitle')}
              </p>
            </div>
          </div>
        )}
      </section>
    </AgentPageShell>
  );
}

/* eslint-disable i18next/no-literal-string */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Boxes, Search, Sparkles } from 'lucide-react';
import { Button, Input } from '@librechat/client';
import CategoryList from './components/CategoryList';
import DetailPanel from './components/DetailPanel';
import MarketListBody from './components/MarketListBody';
import { AGENT_SORTS, COMMUNITY_NAV_ITEMS, MARKET_TABS, MCP_SORTS, SKILL_SORTS } from './constants';
import useCommunityMarket from './hooks/useCommunityMarket';
import useDebouncedValue from './hooks/useDebouncedValue';
import {
  formatCount,
  getCommunityPath,
  getCommunitySectionFromParam,
  getDefaultCategory,
  getDefaultSort,
  isMarketKind,
  normalizeCategory,
} from './utils';
import type { CommunitySection, MarketItem, MarketKind } from './types';
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';
import { cn } from '~/utils';

const MARKET_LANGUAGE_STORAGE_KEY = 'hezi-community-market-language';
const DEFAULT_MARKET_LANGUAGE = 'zh-CN';

function getStoredMarketLanguage() {
  const stored = window.localStorage.getItem(MARKET_LANGUAGE_STORAGE_KEY);
  return stored === 'en-US' || stored === 'zh-CN' ? stored : DEFAULT_MARKET_LANGUAGE;
}

function normalizeMarketLanguage(language?: string | null) {
  return language === 'en-US' || language === 'zh-CN' ? language : DEFAULT_MARKET_LANGUAGE;
}

function getSortOptions(kind: MarketKind) {
  if (kind === 'skill') {
    return SKILL_SORTS;
  }
  if (kind === 'mcp') {
    return MCP_SORTS;
  }
  return AGENT_SORTS;
}

function getTitle(kind: MarketKind) {
  if (kind === 'skill') {
    return 'Skill 市场';
  }
  if (kind === 'mcp') {
    return 'MCP 市场';
  }
  return 'Agent 市场';
}

function getSubtitle(kind: MarketKind) {
  if (kind === 'agent') {
    return '来源：LobeHub Market，支持浏览、发现、Fork 到本地 Agent 并直接进入聊天。';
  }
  return '来源：LobeHub Market，浏览内容会按中英切换缓存在本机浏览器。';
}

function CommunityNav({ active }: { active: CommunitySection }) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-1 border-b border-border-light px-3 py-3">
      {COMMUNITY_NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          className={cn(
            'flex min-w-0 items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium',
            active === item.id
              ? 'bg-surface-active-alt text-text-primary'
              : 'text-text-secondary hover:bg-surface-hover',
          )}
          onClick={() => navigate(getCommunityPath(item.id))}
        >
          <item.icon className="h-4 w-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}

function CommunityStaticPage({
  section,
}: {
  section: Extract<CommunitySection, 'home' | 'models' | 'providers'>;
}) {
  const navigate = useNavigate();
  const isHome = section === 'home';
  const staticCopy = {
    home: {
      subtitle: '一个入口进入 Agents / Assistants、Skills、MCP、Models 和 Providers。',
      title: 'Community Home',
    },
    models: {
      subtitle: '模型目录路由已就位，后续可以接入模型市场、评测和启用状态。',
      title: 'Models',
    },
    providers: {
      subtitle: 'Provider 目录路由已就位，后续可以接入服务商说明、密钥和可用区域。',
      title: 'Providers',
    },
  }[section];

  return (
    <div className="flex h-full min-h-0 bg-surface-primary text-text-primary">
      <aside className="hidden w-[320px] shrink-0 border-r border-border-light bg-surface-primary-alt lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border-light px-4 text-sm text-text-secondary">
          <Boxes className="h-4 w-4" />
          <span>社区市场</span>
        </div>
        <CommunityNav active={section} />
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border-light px-4">
          <OpenSidebar />
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold">{staticCopy.title}</h1>
            <p className="truncate text-sm text-text-tertiary">{staticCopy.subtitle}</p>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto bg-surface-secondary p-4 md:p-6">
          <div className="mx-auto grid max-w-6xl gap-3 md:grid-cols-2 xl:grid-cols-3">
            {COMMUNITY_NAV_ITEMS.filter((item) => isHome || item.id === section).map((item) => (
              <button
                key={item.id}
                className={cn(
                  'flex min-h-[136px] flex-col items-start justify-between rounded-lg border border-border-light bg-surface-primary p-4 text-left shadow-sm transition-colors hover:bg-surface-hover',
                  activeClass(section, item.id),
                )}
                onClick={() => navigate(getCommunityPath(item.id))}
              >
                <div className="flex items-center gap-3">
                  <item.icon className="h-5 w-5 text-text-secondary" />
                  <span className="font-semibold">{item.label}</span>
                </div>
                <p className="mt-3 text-sm text-text-secondary">{item.description}</p>
                <ArrowRight className="mt-3 h-4 w-4 text-text-tertiary" />
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function activeClass(active: CommunitySection, item: CommunitySection) {
  return active === item ? 'ring-1 ring-border-medium' : '';
}

function CommunityMarketBrowser({ identifier, kind }: { identifier?: string; kind: MarketKind }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [language, setLanguage] = useState(() =>
    normalizeMarketLanguage(searchParams.get('locale') || getStoredMarketLanguage()),
  );
  const debouncedQuery = useDebouncedValue(query);
  const category = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || getDefaultSort(kind);
  const activeCategory = category || getDefaultCategory(kind);
  const sortOptions = getSortOptions(kind);

  useEffect(() => {
    const urlLanguage = searchParams.get('locale');
    if (!urlLanguage) {
      return;
    }

    const normalized = normalizeMarketLanguage(urlLanguage);
    if (normalized !== language) {
      window.localStorage.setItem(MARKET_LANGUAGE_STORAGE_KEY, normalized);
      setLanguage(normalized);
    }
  }, [language, searchParams]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (debouncedQuery) {
      next.set('q', debouncedQuery);
    } else {
      next.delete('q');
    }
    setSearchParams(next, { replace: true });
    // Keep URL search in sync with input only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  const market = useCommunityMarket({
    category,
    identifier,
    kind,
    language,
    query: debouncedQuery,
    sort,
  });

  const nextTab = useMemo(() => {
    const currentIndex = MARKET_TABS.findIndex((item) => item.id === kind);
    return MARKET_TABS[(currentIndex + 1) % MARKET_TABS.length] ?? MARKET_TABS[0];
  }, [kind]);

  const updateParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  const updateCategory = (nextCategory: string) => {
    const normalized = normalizeCategory(nextCategory);
    const next = new URLSearchParams(searchParams);
    if (normalized) {
      next.set('category', normalized);
    } else {
      next.delete('category');
    }
    if (nextCategory === 'all' || nextCategory === 'discover') {
      next.set('sort', getDefaultSort(kind));
    }
    setSearchParams(next);
  };

  const openItem = (item: MarketItem) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('activeTab');
    const next = nextParams.toString();
    navigate(`/community/${kind}/${item.identifier}${next ? `?${next}` : ''}`);
  };

  const closeDetail = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('activeTab');
    const next = nextParams.toString();
    navigate(`/community/${kind}${next ? `?${next}` : ''}`);
  };

  const toggleLanguage = () => {
    const nextLanguage = language === 'zh-CN' ? 'en-US' : 'zh-CN';
    window.localStorage.setItem(MARKET_LANGUAGE_STORAGE_KEY, nextLanguage);
    setLanguage(nextLanguage);
    const next = new URLSearchParams(searchParams);
    next.set('locale', nextLanguage);
    next.delete('activeTab');
    setSearchParams(next);
  };

  return (
    <div className="flex h-full min-h-0 bg-surface-primary text-text-primary">
      <aside className="hidden w-[320px] shrink-0 border-r border-border-light bg-surface-primary-alt lg:flex lg:flex-col">
        <div className="flex h-14 items-center gap-2 border-b border-border-light px-4 text-sm text-text-secondary">
          <Boxes className="h-4 w-4" />
          <span>社区市场</span>
        </div>
        <CommunityNav active={kind} />
        <CategoryList
          active={activeCategory}
          categories={market.categoriesQuery.data}
          kind={kind}
          onChange={updateCategory}
        />
      </aside>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border-light px-4">
          <OpenSidebar />
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <Input
              className="h-10 rounded-xl border-border-light bg-surface-primary-alt pl-9"
              placeholder="搜索名称、介绍或关键词..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="h-10 rounded-xl border border-border-light bg-surface-primary px-3 text-sm text-text-primary"
            value={sort}
            onChange={(event) => updateParam('sort', event.target.value)}
          >
            {sortOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <Button className="rounded-xl" variant="outline" onClick={toggleLanguage}>
            {language === 'zh-CN' ? 'EN' : '中文'}
            <span className="sr-only">当前市场内容语言会缓存在本机浏览器</span>
          </Button>
        </div>
        <div className="relative flex min-h-0 flex-1">
          <div className="min-h-0 flex-1 overflow-y-auto bg-surface-secondary p-4 md:p-6">
            <div className="mx-auto flex max-w-6xl flex-col gap-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="text-xl font-semibold">{getTitle(kind)}</h1>
                  <p className="mt-1 text-sm text-text-tertiary">{getSubtitle(kind)}</p>
                </div>
                <Button
                  variant="outline"
                  className="hidden rounded-xl md:inline-flex"
                  onClick={() => {
                    const next = searchParams.toString();
                    navigate(`/community/${nextTab.id}${next ? `?${next}` : ''}`);
                  }}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  切换到 {nextTab.label}
                </Button>
              </div>
              <MarketListBody
                hasMore={market.hasMore}
                isEmpty={market.isEmpty}
                isError={market.listQuery.isError}
                isLoading={market.isLoading}
                isLoadingMore={market.isLoadingMore}
                items={market.items}
                kind={kind}
                onLoadMore={market.loadMore}
                onOpen={openItem}
              />
              <div className="flex justify-center pt-2 text-sm text-text-tertiary">
                {market.listQuery.data?.totalCount
                  ? `共 ${formatCount(market.listQuery.data.totalCount)} 个条目`
                  : null}
              </div>
            </div>
          </div>
        </div>
        <DetailPanel
          identifier={identifier}
          isLoading={market.detailQuery.isLoading}
          item={market.detailItem}
          kind={kind}
          onClose={closeDetail}
        />
      </main>
    </div>
  );
}

export default function CommunityMarketPage() {
  const { identifier, tab } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const section = getCommunitySectionFromParam(tab);

  useEffect(() => {
    if (tab !== 'assistant') {
      return;
    }

    const next = searchParams.toString();
    navigate(`/community/agent${identifier ? `/${identifier}` : ''}${next ? `?${next}` : ''}`, {
      replace: true,
    });
  }, [identifier, navigate, searchParams, tab]);

  useEffect(() => {
    if (!tab || tab === 'assistant') {
      return;
    }
    if (section === 'home' && tab !== 'home') {
      navigate('/community', { replace: true });
    }
  }, [navigate, section, tab]);

  if (tab === 'assistant') {
    return null;
  }

  if (isMarketKind(section)) {
    return <CommunityMarketBrowser identifier={identifier} kind={section} />;
  }

  return <CommunityStaticPage section={section} />;
}

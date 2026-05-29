import type { CategoryItem, CommunitySection, MarketItem, MarketKind } from './types';

export function formatCount(value?: number) {
  if (!value) {
    return '0';
  }
  if (value >= 10000) {
    return `${Math.round(value / 1000) / 10}万`;
  }
  return String(value);
}

export function formatDate(value?: string) {
  if (!value) {
    return '今天';
  }

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return '今天';
  }

  const diff = Date.now() - date.getTime();
  if (diff < 48 * 60 * 60 * 1000) {
    return diff < 24 * 60 * 60 * 1000 ? '今天' : '昨天';
  }

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate(),
  ).padStart(2, '0')}`;
}

export function getKindFromParam(tab?: string): MarketKind {
  if (tab === 'mcp' || tab === 'agent' || tab === 'assistant') {
    return tab === 'assistant' ? 'agent' : tab;
  }
  return 'skill';
}

export function getCommunitySectionFromParam(tab?: string): CommunitySection {
  if (!tab || tab === 'home') {
    return 'home';
  }
  if (tab === 'assistant') {
    return 'agent';
  }
  if (
    tab === 'agent' ||
    tab === 'skill' ||
    tab === 'mcp' ||
    tab === 'models' ||
    tab === 'providers'
  ) {
    return tab;
  }
  return 'home';
}

export function getCommunityPath(section: CommunitySection) {
  return section === 'home' ? '/community' : `/community/${section}`;
}

export function isMarketKind(section: CommunitySection): section is MarketKind {
  return section === 'skill' || section === 'mcp' || section === 'agent';
}

export function getDefaultSort(kind: MarketKind) {
  if (kind === 'skill') {
    return 'installCount';
  }
  return 'recommended';
}

export function getDefaultCategory(kind: MarketKind) {
  return kind === 'skill' ? 'all' : 'discover';
}

export function getSourceUrl(item: MarketItem, kind: MarketKind) {
  if (item.sourceUrl || item.github?.url) {
    return item.sourceUrl || item.github?.url || '';
  }
  if (kind === 'agent') {
    return '';
  }
  return `https://market.lobehub.com/discover/${kind === 'skill' ? 'skill' : 'mcp'}/${
    item.identifier
  }`;
}

export function normalizeCategory(category: string) {
  return category === 'all' || category === 'discover' ? '' : category;
}

export function normalizeAgentCategories(categories?: CategoryItem[]): CategoryItem[] {
  return categories?.length ? categories : [{ category: 'general', count: 0 }];
}

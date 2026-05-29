import { useMemo } from 'react';
import { AGENT_CATEGORIES, MCP_CATEGORIES, SKILL_CATEGORIES } from '../constants';
import { formatCount, getDefaultCategory } from '../utils';
import type { CategoryItem, MarketKind } from '../types';
import { cn } from '~/utils';

export default function CategoryList({
  active,
  categories,
  kind,
  onChange,
}: {
  active: string;
  categories?: CategoryItem[];
  kind: MarketKind;
  onChange: (category: string) => void;
}) {
  const normalized = useMemo(() => {
    const source = categories ?? [];
    const countMap = new Map(
      source.map((item) => [item.category || item.name || '', item.count || 0]),
    );
    const allCount = source.reduce((sum, item) => sum + (item.count || 0), 0);
    let curated = AGENT_CATEGORIES;
    if (kind === 'skill') {
      curated = SKILL_CATEGORIES;
    } else if (kind === 'mcp') {
      curated = MCP_CATEGORIES;
    }

    return curated.map((item) => {
      const apiCount = countMap.get(item.key);
      const fallbackAllCount =
        item.key === getDefaultCategory(kind) && allCount ? allCount : undefined;
      return {
        ...item,
        count: apiCount ?? fallbackAllCount,
      };
    });
  }, [categories, kind]);

  return (
    <div className="flex min-h-0 flex-col gap-1 overflow-y-auto px-4 py-4">
      {normalized.map((item) => {
        const selected = active === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            className={cn(
              'flex h-11 items-center gap-3 rounded-xl px-3 text-left text-sm transition-colors',
              selected
                ? 'bg-surface-active-alt font-medium text-text-primary'
                : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
            )}
            onClick={() => onChange(item.key)}
          >
            <Icon className="h-4.5 w-4.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.count ? (
              <span className="rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-text-tertiary">
                {formatCount(item.count)}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

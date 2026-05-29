/* eslint-disable i18next/no-literal-string */
import { Clock, Download, FileText, Github, Hammer, Star } from 'lucide-react';
import MarketIcon from './MarketIcon';
import { formatCount, formatDate, getSourceUrl } from '../utils';
import type { MarketItem, MarketKind } from '../types';

export default function MarketCard({
  item,
  kind,
  onOpen,
}: {
  item: MarketItem;
  kind: MarketKind;
  onOpen: (item: MarketItem) => void;
}) {
  const sourceUrl = getSourceUrl(item, kind);

  return (
    <div
      className="flex min-h-[214px] cursor-pointer flex-col overflow-hidden rounded-xl border border-border-light bg-surface-primary transition-colors hover:border-border-medium hover:bg-surface-hover"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(item)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(item);
        }
      }}
    >
      <div className="flex gap-4 p-5">
        <div className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-secondary text-text-primary">
          <MarketIcon item={item} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-text-primary">{item.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-text-tertiary">
                {item.ratingAvg ? (
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    {item.ratingAvg.toFixed(1)}
                  </span>
                ) : null}
                {item.author ? <span>{item.author}</span> : null}
                {item.isOfficial ? <span>官方</span> : null}
                {kind === 'agent' ? <span>Agent</span> : null}
              </div>
            </div>
            {sourceUrl ? (
              <a
                className="rounded-lg p-1.5 text-text-tertiary hover:bg-surface-hover hover:text-text-primary"
                href={sourceUrl}
                rel="noreferrer"
                target="_blank"
                aria-label="打开来源"
                onClick={(event) => event.stopPropagation()}
              >
                <Github className="h-4 w-4" />
              </a>
            ) : null}
          </div>
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-text-secondary">
            {item.description || '这个条目暂时没有介绍。'}
          </p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between border-t border-dashed border-border-light bg-surface-primary-alt px-5 py-3 text-xs text-text-tertiary">
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          {formatDate(item.updatedAt)}
        </span>
        <div className="flex items-center gap-3">
          {kind === 'skill' ? (
            <span className="inline-flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" />
              {(item.resourcesCount || 0) + 1}
            </span>
          ) : (
            <>
              <span className="inline-flex items-center gap-1">
                <Hammer className="h-3.5 w-3.5" />
                {item.toolsCount || 0}
              </span>
              {kind === 'mcp' ? (
                <span>{item.connectionType === 'local' ? '本地服务' : '远程/混合'}</span>
              ) : null}
            </>
          )}
          <span className="inline-flex items-center gap-1">
            <Download className="h-3.5 w-3.5" />
            {formatCount(item.installCount)}
          </span>
          {item.github?.stars ? (
            <span className="inline-flex items-center gap-1">
              <Star className="h-3.5 w-3.5" />
              {formatCount(item.github.stars)}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

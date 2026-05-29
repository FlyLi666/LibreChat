/* eslint-disable i18next/no-literal-string */
import { Button, Skeleton } from '@librechat/client';
import MarketCard from './MarketCard';
import type { MarketItem, MarketKind } from '../types';

export default function MarketListBody({
  hasMore,
  isEmpty,
  isError,
  isLoading,
  isLoadingMore,
  items,
  kind,
  onLoadMore,
  onOpen,
}: {
  hasMore: boolean;
  isEmpty: boolean;
  isError: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  items: MarketItem[];
  kind: MarketKind;
  onLoadMore: () => void;
  onOpen: (item: MarketItem) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 xl:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-[214px] rounded-xl" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-xl border border-border-light bg-surface-primary p-8 text-sm text-text-secondary">
        市场数据加载失败。后端会自动向 Lobe Market
        注册临时客户端；如果这里持续失败，需要检查服务器能否访问 market.lobehub.com。
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="rounded-xl border border-border-light bg-surface-primary p-8 text-sm text-text-secondary">
        没有找到匹配的条目。
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {items.map((item) => (
          <MarketCard key={item.identifier} item={item} kind={kind} onOpen={onOpen} />
        ))}
      </div>
      {hasMore ? (
        <div className="flex justify-center py-3">
          <Button
            className="rounded-xl"
            disabled={isLoadingMore}
            variant="outline"
            onClick={onLoadMore}
          >
            {isLoadingMore ? '加载中...' : '加载更多'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMarketCategories, getMarketDetail, getMarketList } from '../dataService';
import type { CategoryItem, MarketItem, MarketKind, MarketListResponse } from '../types';

type UseCommunityMarketParams = {
  category: string;
  identifier?: string;
  kind: MarketKind;
  language: string;
  query: string;
  sort: string;
};

export default function useCommunityMarket({
  category,
  identifier,
  kind,
  language,
  query,
  sort,
}: UseCommunityMarketParams) {
  const [page, setPage] = useState(1);
  const [loadedItems, setLoadedItems] = useState<MarketItem[]>([]);

  useEffect(() => {
    setPage(1);
    setLoadedItems([]);
  }, [category, kind, language, query, sort]);

  const listParams = useMemo(() => {
    const params = new URLSearchParams({
      locale: language,
      page: String(page),
      pageSize: '24',
      sort,
    });
    if (category) {
      params.set('category', category);
    }
    if (query) {
      params.set('q', query);
    }
    return params;
  }, [category, language, page, query, sort]);

  const categoriesQuery = useQuery<CategoryItem[]>(
    ['community-market-categories', kind, language],
    () => getMarketCategories(kind, language),
    { staleTime: 1000 * 60 * 30 },
  );

  const listQuery = useQuery<MarketListResponse<MarketItem>>(
    ['community-market-list', kind, listParams.toString()],
    () => getMarketList(kind, listParams),
    { keepPreviousData: true, staleTime: 1000 * 60 * 5 },
  );

  useEffect(() => {
    const nextItems = listQuery.data?.items ?? listQuery.data?.data;
    if (!nextItems) {
      return;
    }

    setLoadedItems((current) => {
      const merged = page === 1 ? [] : [...current];
      const seen = new Set(merged.map((item) => item.identifier));
      nextItems.forEach((item) => {
        if (!seen.has(item.identifier)) {
          merged.push(item);
          seen.add(item.identifier);
        }
      });
      return merged;
    });
  }, [listQuery.data?.data, listQuery.data?.items, page]);

  const detailFromList = useMemo(
    () => loadedItems.find((item) => item.identifier === identifier) ?? null,
    [identifier, loadedItems],
  );

  const detailQuery = useQuery<MarketItem | null>(
    ['community-market-detail', kind, identifier, language],
    () => getMarketDetail(kind, identifier ?? '', language),
    {
      enabled: Boolean(identifier),
      staleTime: 1000 * 60 * 5,
    },
  );

  const totalPages = listQuery.data?.totalPages;
  const hasMore =
    !listQuery.isError && Boolean(totalPages ? page < totalPages : listQuery.data?.after);

  return {
    categoriesQuery,
    detailItem: detailQuery.data ?? detailFromList ?? null,
    detailQuery,
    hasMore,
    isEmpty: !listQuery.isError && !(listQuery.isLoading && page === 1) && loadedItems.length === 0,
    isLoading: listQuery.isLoading && page === 1,
    isLoadingMore: listQuery.isFetching && page > 1,
    items: loadedItems,
    listQuery,
    loadMore: () => setPage((current) => current + 1),
  };
}

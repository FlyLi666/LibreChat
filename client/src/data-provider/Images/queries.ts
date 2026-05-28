import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { UseQueryOptions, QueryObserverResult } from '@tanstack/react-query';
import type { TImageBatch, TImageModel, TImageTopic } from 'librechat-data-provider';

export const useImageModelsQuery = (
  config?: UseQueryOptions<TImageModel[]>,
): QueryObserverResult<TImageModel[]> => {
  return useQuery<TImageModel[]>(
    [QueryKeys.imageModels],
    async () => {
      const response = await dataService.getImageModels();
      return response.models;
    },
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      staleTime: 5 * 60 * 1000,
      ...config,
    },
  );
};

export const useImageTopicsQuery = (
  config?: UseQueryOptions<TImageTopic[]>,
): QueryObserverResult<TImageTopic[]> => {
  return useQuery<TImageTopic[]>(
    [QueryKeys.imageTopics],
    async () => {
      const response = await dataService.getImageTopics();
      return response.topics;
    },
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

export const useImageBatchesQuery = (
  topicId: string | null | undefined,
  config?: UseQueryOptions<TImageBatch[]>,
): QueryObserverResult<TImageBatch[]> => {
  return useQuery<TImageBatch[]>(
    [QueryKeys.imageBatches, topicId ?? ''],
    async () => {
      if (!topicId) {
        return [];
      }
      const response = await dataService.getImageBatches(topicId);
      return response.batches;
    },
    {
      enabled: !!topicId && (config?.enabled ?? true),
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';
import type {
  TGenerateImageRequest,
  TGenerateImageResponse,
  TImageBatch,
  TImageTopic,
} from 'librechat-data-provider';

export const useGenerateImageMutation = (): UseMutationResult<
  TGenerateImageResponse,
  unknown,
  TGenerateImageRequest
> => {
  const queryClient = useQueryClient();
  const applyResponse = (
    response: TGenerateImageResponse | undefined,
    variables: TGenerateImageRequest,
  ) => {
    if (!response) {
      return;
    }
    if (response.topic) {
      queryClient.setQueryData<TImageTopic[]>([QueryKeys.imageTopics], (topics = []) => [
        response.topic as TImageTopic,
        ...topics.filter((topic) => topic._id !== response.topic?._id),
      ]);
    }
    const topicId = response.topic?._id || variables.topicId;
    if (topicId && response.batch) {
      queryClient.setQueryData<TImageBatch[]>([QueryKeys.imageBatches, topicId], (batches = []) => [
        response.batch,
        ...batches.filter((batch) => batch._id !== response.batch?._id),
      ]);
    }
  };

  return useMutation((payload: TGenerateImageRequest) => dataService.generateImage(payload), {
    onSuccess: (response, variables) => {
      applyResponse(response, variables);
    },
    onError: (error, variables) => {
      applyResponse(
        (error as { response?: { data?: TGenerateImageResponse } })?.response?.data,
        variables,
      );
    },
  });
};

export const useDeleteImageGenerationMutation = (): UseMutationResult<void, unknown, string> => {
  const queryClient = useQueryClient();
  return useMutation((generationId: string) => dataService.deleteImageGeneration(generationId), {
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.imageBatches]);
    },
  });
};

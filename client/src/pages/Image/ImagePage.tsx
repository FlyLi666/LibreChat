import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, ImagePlus, Maximize2, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import { v4 } from 'uuid';
import type {
  TImageBatch,
  TImageModel,
  TImageParamSchema,
  TImageTopic,
} from 'librechat-data-provider';
import { Button, OGDialog, OGDialogContent, OGDialogTitle } from '@librechat/client';
import {
  useGenerateImageMutation,
  useDeleteImageBatchMutation,
  useDeleteImageGenerationMutation,
  useDeleteImageTopicMutation,
  useImageBatchesQuery,
  useImageModelsQuery,
  useImageTopicsQuery,
  useUpdateImageTopicMutation,
  useUploadImageMutation,
} from '~/data-provider/Images';
import { useGetStartupConfig } from '~/data-provider';
import { useLocalize } from '~/hooks';
import { cn, triggerDownload } from '~/utils';
import {
  getDefaultImageParams,
  getImageModels as getLocalImageModels,
} from '~/components/Image/modelParams';

type Params = Record<string, unknown>;

const schemaLabelFallbacks: Record<string, string> = {
  aspectRatio: 'com_image_config_aspect',
  cfg: 'com_image_config_cfg',
  imageNum: 'com_image_config_image_num',
  quality: 'com_image_config_quality',
  resolution: 'com_image_config_resolution',
  seed: 'com_image_config_seed',
  size: 'com_image_config_size',
  steps: 'com_image_config_steps',
  strength: 'com_image_config_strength',
};

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function getTopicTime(topic: TImageTopic) {
  const raw = topic.updatedAt || topic.createdAt;
  const time = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(time) ? time : 0;
}

export function groupTopics(topics: TImageTopic[]) {
  const todayStart = startOfLocalDay(new Date());
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
  const sevenDaysStart = todayStart - 6 * 24 * 60 * 60 * 1000;
  const groups = [
    { label: '今天', topics: [] as TImageTopic[] },
    { label: '昨天', topics: [] as TImageTopic[] },
    { label: '过去 7 天', topics: [] as TImageTopic[] },
    { label: '更早', topics: [] as TImageTopic[] },
  ];

  for (const topic of topics) {
    const time = getTopicTime(topic);
    if (time >= todayStart) {
      groups[0].topics.push(topic);
    } else if (time >= yesterdayStart) {
      groups[1].topics.push(topic);
    } else if (time >= sevenDaysStart) {
      groups[2].topics.push(topic);
    } else {
      groups[3].topics.push(topic);
    }
  }

  return groups;
}

export function mergeImageBatches(inlineBatches: TImageBatch[], remoteBatches: TImageBatch[]) {
  const remoteById = new Map(remoteBatches.map((batch) => [batch._id, batch]));
  const inlineIds = new Set(inlineBatches.map((batch) => batch._id));
  return [
    ...inlineBatches.map((batch) => remoteById.get(batch._id) ?? batch),
    ...remoteBatches.filter((batch) => !inlineIds.has(batch._id)),
  ];
}

export function filterDeletedGenerations(
  batches: TImageBatch[],
  deletedGenerationIds: ReadonlySet<string>,
) {
  return batches
    .map((batch) => {
      const generations = Array.isArray(batch.generations) ? batch.generations : [];
      return {
        ...batch,
        generations:
          deletedGenerationIds.size === 0
            ? generations
            : generations.filter((generation) => !deletedGenerationIds.has(generation._id)),
      };
    })
    .filter((batch) => batch.generations.length > 0);
}

function getSchemaLabel(schema: TImageParamSchema, localize: ReturnType<typeof useLocalize>) {
  const key =
    schema.i18nLabel || schemaLabelFallbacks[schema.name] || `com_image_config_${schema.name}`;
  return localize(key as Parameters<typeof localize>[0]);
}

function getImageDownloadFilename(url: string) {
  try {
    const parsed = new URL(url, window.location.origin);
    const filename = parsed.pathname.split('/').filter(Boolean).pop();
    return filename || 'hezi-image.png';
  } catch {
    return 'hezi-image.png';
  }
}

function supportsReferenceImages(model: TImageModel | undefined) {
  return (model?.paramSchemas ?? []).some(
    (schema) =>
      schema.name === 'imageUrls' && (schema.type === 'image' || schema.type === 'images'),
  );
}

function ParamControl({
  schema,
  value,
  onChange,
}: {
  schema: TImageParamSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const localize = useLocalize();
  const label = getSchemaLabel(schema, localize);

  if (schema.type === 'enum') {
    return (
      <label className="grid gap-1 text-xs font-medium text-text-secondary">
        <span>{label}</span>
        <select
          className="h-9 rounded-lg border border-border-light bg-surface-primary px-2 text-sm text-text-primary"
          value={String(value ?? schema.default ?? '')}
          onChange={(event) => onChange(event.target.value)}
        >
          {(schema.enum ?? []).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (schema.type === 'number') {
    return (
      <label className="grid gap-1 text-xs font-medium text-text-secondary">
        <span>{label}</span>
        <input
          className="h-9 rounded-lg border border-border-light bg-surface-primary px-2 text-sm text-text-primary"
          type="number"
          min={schema.min}
          max={schema.max}
          step={schema.step}
          value={Number(value ?? schema.default ?? 1)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </label>
    );
  }

  return null;
}

function TopicSidebar({
  topics,
  activeTopicId,
  onSelect,
  onNewTopic,
  onRenameTopic,
  onDeleteTopic,
  renaming,
  deleting,
}: {
  topics: TImageTopic[];
  activeTopicId: string | null;
  onSelect: (topicId: string) => void;
  onNewTopic: () => void;
  onRenameTopic: (topicId: string, title: string) => Promise<void>;
  onDeleteTopic: (topicId: string) => Promise<void>;
  renaming: boolean;
  deleting: boolean;
}) {
  const localize = useLocalize();
  const groups = groupTopics(topics);
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  const beginRename = (topic: TImageTopic) => {
    setEditingTopicId(topic._id);
    setEditingTitle(topic.title);
  };

  const cancelRename = () => {
    setEditingTopicId(null);
    setEditingTitle('');
  };

  const saveRename = async (topic: TImageTopic) => {
    const title = editingTitle.trim();
    if (!title || title === topic.title) {
      cancelRename();
      return;
    }
    await onRenameTopic(topic._id, title);
    cancelRename();
  };

  return (
    <aside className="hidden w-64 shrink-0 border-r border-border-light bg-surface-primary-alt lg:flex lg:flex-col">
      <div className="border-b border-border-light p-3">
        <Button variant="outline" size="sm" className="w-full justify-start" onClick={onNewTopic}>
          {localize('com_image_new_topic')}
        </Button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.map((group) => (
          <section key={group.label} className="mb-4">
            <h2 className="mb-1 px-2 text-xs font-semibold text-text-tertiary">{group.label}</h2>
            <div className="grid gap-1">
              {group.topics.map((topic) => (
                <div
                  key={topic._id}
                  className={cn(
                    'group flex items-center gap-1 rounded-lg px-1 py-1 text-sm transition-colors hover:bg-surface-hover',
                    topic._id === activeTopicId
                      ? 'bg-surface-active-alt text-text-primary'
                      : 'text-text-secondary',
                  )}
                >
                  {editingTopicId === topic._id ? (
                    <input
                      className="min-w-0 flex-1 rounded-md border border-border-light bg-surface-primary px-2 py-1 text-sm text-text-primary outline-none"
                      value={editingTitle}
                      onBlur={() => void saveRename(topic)}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          void saveRename(topic);
                        }
                        if (event.key === 'Escape') {
                          cancelRename();
                        }
                      }}
                    />
                  ) : (
                    <button
                      className="min-w-0 flex-1 rounded-md px-1 py-1 text-left"
                      onClick={() => onSelect(topic._id)}
                    >
                      <span className="line-clamp-1">{topic.title}</span>
                    </button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
                    aria-label={localize('com_ui_rename')}
                    disabled={renaming || editingTopicId === topic._id}
                    onClick={() => beginRename(topic)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-7 opacity-100 md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100"
                    aria-label={localize('com_image_action_delete')}
                    disabled={deleting}
                    onClick={() => void onDeleteTopic(topic._id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function GenerationCard({
  batch,
  onDeleteBatch,
  onDeleteGeneration,
  onRecreateBatch,
  deletingBatch,
  deleting,
  generating,
}: {
  batch: TImageBatch;
  onDeleteBatch: (batchId: string) => void;
  onDeleteGeneration: (generationId: string) => void;
  onRecreateBatch: (batch: TImageBatch) => void;
  deletingBatch: boolean;
  deleting: boolean;
  generating: boolean;
}) {
  const localize = useLocalize();
  const [preview, setPreview] = useState<{ url: string; prompt: string } | null>(null);

  return (
    <article className="rounded-lg border border-border-light bg-surface-primary p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">{batch.prompt}</p>
          <p className="mt-1 text-xs text-text-tertiary">{batch.model}</p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 shrink-0 gap-1 px-2 text-xs text-text-secondary"
          aria-label={localize('com_image_action_delete_batch')}
          disabled={deletingBatch}
          onClick={() => onDeleteBatch(batch._id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
          {localize('com_image_action_delete_batch')}
        </Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {batch.generations.map((generation) => {
          const imageUrl = generation.status === 'succeeded' ? generation.asset?.url : undefined;
          const hasImage = !!imageUrl;

          return (
            <div
              key={generation._id}
              className="group relative aspect-square overflow-hidden rounded-lg bg-surface-secondary"
            >
              <div className="bg-surface-primary/90 absolute right-1 top-1 z-10 flex gap-0.5 rounded-lg p-1 opacity-100 shadow-sm transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={localize('com_image_action_zoom')}
                  disabled={!hasImage}
                  onClick={() => imageUrl && setPreview({ url: imageUrl, prompt: batch.prompt })}
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={localize('com_image_action_download')}
                  disabled={!hasImage}
                  onClick={() =>
                    imageUrl && triggerDownload(imageUrl, getImageDownloadFilename(imageUrl))
                  }
                >
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={localize('com_image_action_recreate')}
                  disabled={generating}
                  onClick={() => onRecreateBatch(batch)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  aria-label={localize('com_image_action_delete')}
                  disabled={deleting}
                  onClick={() => onDeleteGeneration(generation._id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              {generation.status === 'pending' && (
                <div className="flex h-full items-center justify-center text-sm text-text-secondary">
                  生成中...
                </div>
              )}
              {generation.status === 'failed' && (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-red-600">
                  {generation.error || localize('com_image_error_no_channel')}
                </div>
              )}
              {imageUrl && (
                <img src={imageUrl} alt={batch.prompt} className="h-full w-full object-cover" />
              )}
            </div>
          );
        })}
      </div>
      <OGDialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <OGDialogContent className="h-[90vh] max-h-[90vh] w-[94vw] max-w-5xl overflow-hidden border-border-light bg-surface-primary p-0">
          <OGDialogTitle className="border-b border-border-light px-4 py-3 text-sm font-medium text-text-primary">
            {preview?.prompt}
          </OGDialogTitle>
          <div className="flex h-[calc(90vh-56px)] items-center justify-center bg-surface-primary-alt p-4">
            {preview && (
              <img
                src={preview.url}
                alt={preview.prompt}
                className="max-h-full max-w-full object-contain"
              />
            )}
          </div>
        </OGDialogContent>
      </OGDialog>
    </article>
  );
}

function ModelInspector({
  model,
  params,
  referenceFile,
  supportsReferenceImage,
  onReferenceFileChange,
  onClearReferenceFile,
  onParamChange,
}: {
  model: TImageModel | undefined;
  params: Params;
  referenceFile: File | null;
  supportsReferenceImage: boolean;
  onReferenceFileChange: (file: File | null) => void;
  onClearReferenceFile: () => void;
  onParamChange: (name: string, value: unknown) => void;
}) {
  const localize = useLocalize();

  return (
    <aside className="hidden w-72 shrink-0 border-l border-border-light bg-surface-primary-alt p-4 xl:block">
      <h2 className="text-sm font-semibold text-text-primary">
        {model?.displayName || localize('com_image_model')}
      </h2>
      <div className="mt-4 grid gap-3">
        {(model?.paramSchemas ?? []).map((schema) => (
          <ParamControl
            key={schema.name}
            schema={schema}
            value={params[schema.name]}
            onChange={(value) => onParamChange(schema.name, value)}
          />
        ))}
      </div>
      {supportsReferenceImage ? (
        <div className="mt-5 rounded-lg border border-dashed border-border-medium p-3 text-sm text-text-secondary">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-text-primary hover:bg-surface-hover">
            <ImagePlus className="h-4 w-4" />
            <span>{localize('com_image_reference_image')}</span>
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              aria-label={localize('com_image_reference_image')}
              onChange={(event) => onReferenceFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
          {referenceFile && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-surface-primary px-3 py-2">
              <span className="min-w-0 truncate text-xs text-text-secondary">
                {referenceFile.name}
              </span>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                aria-label={localize('com_image_action_delete')}
                onClick={onClearReferenceFile}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </aside>
  );
}

export default function ImagePage() {
  const localize = useLocalize();
  const { data: startupConfig } = useGetStartupConfig();
  const {
    data: remoteModels,
    isLoading: modelsLoading,
    isError: modelsError,
  } = useImageModelsQuery();
  const {
    data: topics = [],
    isLoading: topicsLoading,
    isError: topicsError,
  } = useImageTopicsQuery();
  const [activeTopicId, setActiveTopicId] = useState<string | null>(null);
  const {
    data: batches = [],
    isLoading: batchesLoading,
    isError: batchesError,
  } = useImageBatchesQuery(activeTopicId, { refetchInterval: activeTopicId ? 3000 : false });
  const generateMutation = useGenerateImageMutation();
  const uploadImageMutation = useUploadImageMutation();
  const deleteBatchMutation = useDeleteImageBatchMutation();
  const deleteGenerationMutation = useDeleteImageGenerationMutation();
  const updateTopicMutation = useUpdateImageTopicMutation();
  const deleteTopicMutation = useDeleteImageTopicMutation();
  const localModels = useMemo(() => getLocalImageModels(), []);
  const models = remoteModels?.length ? remoteModels : localModels;
  const configuredDefaultModelId = startupConfig?.imageGenDefaultModel || 'gpt-image-2';
  const [modelId, setModelId] = useState(configuredDefaultModelId);
  const hasAppliedConfiguredDefault = useRef(false);
  const model = useMemo(
    () => models.find((item) => item.modelId === modelId) ?? models[0],
    [modelId, models],
  );
  const supportsReferenceImage = supportsReferenceImages(model);
  const [params, setParams] = useState<Params>(() => getDefaultImageParams(model));
  const [prompt, setPrompt] = useState('');
  const [inlineBatches, setInlineBatches] = useState<TImageBatch[]>([]);
  const [referenceFile, setReferenceFile] = useState<File | null>(null);
  const [deletedGenerationIds, setDeletedGenerationIds] = useState<Set<string>>(() => new Set());
  const [deletedBatchIds, setDeletedBatchIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!activeTopicId && topics[0]?._id) {
      setActiveTopicId(topics[0]._id);
    }
  }, [activeTopicId, topics]);

  useEffect(() => {
    if (hasAppliedConfiguredDefault.current || !startupConfig?.imageGenDefaultModel) {
      return;
    }
    if (models.some((item) => item.modelId === startupConfig.imageGenDefaultModel)) {
      setModelId(startupConfig.imageGenDefaultModel);
      hasAppliedConfiguredDefault.current = true;
    }
  }, [models, startupConfig?.imageGenDefaultModel]);

  useEffect(() => {
    setParams(getDefaultImageParams(model));
    // `model` may be a fresh object from remote query data; reset only when the selected model changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.modelId]);

  useEffect(() => {
    if (!supportsReferenceImage) {
      setReferenceFile(null);
    }
  }, [supportsReferenceImage]);

  const displayedBatches = useMemo(() => {
    return filterDeletedGenerations(
      mergeImageBatches(inlineBatches, batches).filter((batch) => !deletedBatchIds.has(batch._id)),
      deletedGenerationIds,
    );
  }, [batches, deletedBatchIds, deletedGenerationIds, inlineBatches]);

  const upsertInlineBatch = (batch: TImageBatch | undefined) => {
    if (!batch) {
      return;
    }
    setInlineBatches((prev) => [batch, ...prev.filter((item) => item._id !== batch._id)]);
  };

  const startNewTopic = () => {
    setActiveTopicId(null);
    setInlineBatches([]);
    setDeletedBatchIds(new Set());
    setDeletedGenerationIds(new Set());
    setPrompt('');
  };

  const hasActiveTopic = !!activeTopicId;
  const selectingInitialTopic = !activeTopicId && topics.length > 0;
  const isLoadingBatches = hasActiveTopic && batchesLoading;
  const hasBatchesError = hasActiveTopic && batchesError;

  const submit = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || !model) {
      return;
    }
    const imageNum = Number(params.imageNum || 1);
    try {
      const nextParams: Params = { ...params };
      if (referenceFile && supportsReferenceImage) {
        const formData = new FormData();
        formData.append('endpoint', 'default');
        formData.append('file', referenceFile, encodeURIComponent(referenceFile.name));
        formData.append('file_id', v4());
        formData.append('width', '1');
        formData.append('height', '1');
        const upload = await uploadImageMutation.mutateAsync(formData);
        const imageUrl = upload.filepath || upload.preview;
        if (imageUrl) {
          nextParams.imageUrls = [imageUrl];
        }
      }
      const response = await generateMutation.mutateAsync({
        topicId: activeTopicId,
        provider: model.provider,
        model: model.modelId,
        prompt: trimmed,
        params: nextParams,
        imageNum,
      });
      if (response.topic?._id) {
        setActiveTopicId(response.topic._id);
      }
      upsertInlineBatch(response.batch);
      setPrompt('');
    } catch (error) {
      const data = (error as { response?: { data?: { topic?: TImageTopic; batch?: TImageBatch } } })
        ?.response?.data;
      if (data?.topic?._id) {
        setActiveTopicId(data.topic._id);
      }
      upsertInlineBatch(data?.batch);
    }
  };

  const deleteGeneration = async (generationId: string) => {
    await deleteGenerationMutation.mutateAsync(generationId);
    setDeletedGenerationIds((prev) => {
      const next = new Set(prev);
      next.add(generationId);
      return next;
    });
  };

  const deleteBatch = async (batchId: string) => {
    await deleteBatchMutation.mutateAsync(batchId);
    setDeletedBatchIds((prev) => {
      const next = new Set(prev);
      next.add(batchId);
      return next;
    });
  };

  const recreateBatch = async (batch: TImageBatch) => {
    const response = await generateMutation.mutateAsync({
      topicId: batch.topicId || activeTopicId,
      provider: batch.provider,
      model: batch.model,
      prompt: batch.prompt,
      params: batch.params,
      imageNum: Number(
        (batch.params as Params | undefined)?.imageNum || batch.generations.length || 1,
      ),
    });
    if (response.topic?._id) {
      setActiveTopicId(response.topic._id);
    }
    upsertInlineBatch(response.batch);
  };

  const renameTopic = async (topicId: string, title: string) => {
    await updateTopicMutation.mutateAsync({ topicId, title });
  };

  const deleteTopic = async (topicId: string) => {
    await deleteTopicMutation.mutateAsync(topicId);
    setInlineBatches([]);
    setDeletedBatchIds(new Set());
    setDeletedGenerationIds(new Set());
    if (activeTopicId === topicId) {
      const nextTopic = topics.find((topic) => topic._id !== topicId);
      setActiveTopicId(nextTopic?._id ?? null);
    }
  };

  const renderWorkspace = () => {
    if (modelsLoading || topicsLoading || selectingInitialTopic || isLoadingBatches) {
      return (
        <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-text-secondary">
          {localize('com_image_generating')}
        </div>
      );
    }

    if (modelsError || topicsError || hasBatchesError) {
      return (
        <div className="flex h-full min-h-[420px] items-center justify-center px-4 text-center text-sm text-red-600">
          {localize('com_image_error_no_channel')}
        </div>
      );
    }

    if (displayedBatches.length === 0) {
      return (
        <div className="flex h-full min-h-[420px] items-center justify-center">
          <div className="text-center">
            <h1 className="text-lg font-semibold text-text-primary">
              {localize('com_image_empty')}
            </h1>
            <p className="mt-2 text-sm text-text-secondary">{localize('com_image_brand')}</p>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto grid max-w-4xl gap-4">
        {displayedBatches.map((batch) => (
          <GenerationCard
            key={batch._id}
            batch={batch}
            deletingBatch={deleteBatchMutation.isLoading}
            deleting={deleteGenerationMutation.isLoading}
            generating={generateMutation.isLoading}
            onDeleteBatch={deleteBatch}
            onDeleteGeneration={deleteGeneration}
            onRecreateBatch={(nextBatch) => void recreateBatch(nextBatch)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-surface-primary text-text-primary">
      <TopicSidebar
        topics={topics}
        activeTopicId={activeTopicId}
        onSelect={setActiveTopicId}
        onNewTopic={startNewTopic}
        onRenameTopic={renameTopic}
        onDeleteTopic={deleteTopic}
        renaming={updateTopicMutation.isLoading}
        deleting={deleteTopicMutation.isLoading}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-6">{renderWorkspace()}</div>
        <div className="border-t border-border-light bg-surface-primary px-4 py-3 md:px-6">
          <div className="mx-auto flex max-w-4xl flex-col gap-3 rounded-lg border border-border-light bg-surface-primary-alt p-3">
            <textarea
              className="min-h-20 resize-none rounded-lg border border-border-light bg-surface-primary px-3 py-2 text-sm outline-none focus:border-border-medium"
              placeholder={localize('com_image_prompt_placeholder')}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
            <div className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="hezi-image-model">
                {localize('com_image_model')}
              </label>
              <select
                id="hezi-image-model"
                aria-label={localize('com_image_model')}
                className="h-9 rounded-lg border border-border-light bg-surface-primary px-2 text-sm"
                value={model?.modelId}
                onChange={(event) => setModelId(event.target.value)}
              >
                {models.map((item) => (
                  <option key={item.modelId} value={item.modelId} disabled={item.disabled}>
                    {item.modelId}
                  </option>
                ))}
              </select>
              <div className="flex flex-wrap gap-2 xl:hidden">
                {(model?.paramSchemas ?? []).map((schema) => (
                  <ParamControl
                    key={schema.name}
                    schema={schema}
                    value={params[schema.name]}
                    onChange={(value) => setParams((prev) => ({ ...prev, [schema.name]: value }))}
                  />
                ))}
              </div>
              <Button
                className="ml-auto"
                disabled={
                  !prompt.trim() || generateMutation.isLoading || uploadImageMutation.isLoading
                }
                onClick={submit}
              >
                {generateMutation.isLoading || uploadImageMutation.isLoading
                  ? localize('com_image_generating')
                  : localize('com_image_generate')}
              </Button>
            </div>
          </div>
        </div>
      </main>
      <ModelInspector
        model={model}
        params={params}
        referenceFile={referenceFile}
        supportsReferenceImage={supportsReferenceImage}
        onReferenceFileChange={setReferenceFile}
        onClearReferenceFile={() => setReferenceFile(null)}
        onParamChange={(name, value) => setParams((prev) => ({ ...prev, [name]: value }))}
      />
    </div>
  );
}

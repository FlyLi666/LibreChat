import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  Download,
  Home,
  ImageIcon,
  ImagePlus,
  Lightbulb,
  Maximize2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
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
import OpenSidebar from '~/components/Chat/Menus/OpenSidebar';
import {
  getDefaultImageParams,
  getImageModels as getLocalImageModels,
} from '~/components/Image/modelParams';

type Params = Record<string, unknown>;
type ImageStartupConfig = {
  imageGenDefaultModel?: string;
};

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

const imageCreateTitle = '即刻创作';
const imageModeLabel = '图片';

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
  mobileOpen = false,
  onSelect,
  onNewTopic,
  onMobileClose,
  onRenameTopic,
  onDeleteTopic,
  renaming,
  deleting,
}: {
  topics: TImageTopic[];
  activeTopicId: string | null;
  mobileOpen?: boolean;
  onSelect: (topicId: string) => void;
  onNewTopic: () => void;
  onMobileClose?: () => void;
  onRenameTopic: (topicId: string, title: string) => Promise<void>;
  onDeleteTopic: (topicId: string) => Promise<void>;
  renaming: boolean;
  deleting: boolean;
}) {
  const localize = useLocalize();
  const [query, setQuery] = useState('');
  const filteredTopics = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) {
      return topics;
    }
    return topics.filter((topic) => topic.title.toLowerCase().includes(keyword));
  }, [query, topics]);
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

  const topicLabel = `图片主题 ${filteredTopics.length}`;

  const selectTopic = (topicId: string) => {
    onSelect(topicId);
    onMobileClose?.();
  };

  const createTopic = () => {
    onNewTopic();
    onMobileClose?.();
  };

  const renderHeader = (mobile = false) => (
    <div className="flex h-16 items-center justify-between border-b border-border-light px-5">
      <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
        <Home className="h-4 w-4" />
        <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-text-tertiary" />
        <span className="text-text-primary">{imageModeLabel}</span>
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="size-8 rounded-lg text-text-tertiary"
        aria-label={mobile ? '关闭图片主题' : '收起图片侧栏'}
        onClick={mobile ? onMobileClose : undefined}
      >
        {mobile ? <X className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>
    </div>
  );

  const renderTopics = () => (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
      <button
        className="flex h-11 items-center gap-3 rounded-xl px-1 text-left text-[15px] font-medium text-text-secondary transition-colors hover:text-text-primary"
        onClick={createTopic}
      >
        <span className="flex size-6 items-center justify-center rounded-md border border-border-light bg-white">
          <Plus className="h-4 w-4" />
        </span>
        <span>{localize('com_image_new_topic')}</span>
      </button>
      <label className="flex h-11 items-center gap-3 rounded-xl px-1 text-[15px] text-text-tertiary">
        <Search className="h-5 w-5" />
        <input
          className="min-w-0 flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary"
          placeholder="搜索"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <section className="min-h-0">
        <div className="mb-6 flex items-center gap-2 text-sm font-medium text-text-tertiary">
          <span>{topicLabel}</span>
          <ChevronDown className="h-4 w-4" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {filteredTopics.map((topic) => (
            <div key={topic._id} className="group relative">
              {editingTopicId === topic._id ? (
                <input
                  className="aspect-square w-full rounded-xl border border-border-medium bg-white px-2 text-center text-sm font-medium text-text-primary outline-none"
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
                  className={cn(
                    'flex aspect-square w-full items-center justify-center rounded-xl border text-center text-3xl font-semibold transition-all',
                    topic._id === activeTopicId
                      ? 'border-border-medium bg-white text-text-primary shadow-sm ring-2 ring-black/5'
                      : 'border-transparent bg-[#e9e9ea] text-black hover:bg-white hover:shadow-sm',
                  )}
                  title={topic.title}
                  onClick={() => selectTopic(topic._id)}
                >
                  <span className="line-clamp-2 px-2">{topic.title || '未命名'}</span>
                </button>
              )}
              <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-lg bg-white/90 shadow-sm"
                  aria-label={localize('com_ui_rename')}
                  disabled={renaming || editingTopicId === topic._id}
                  onClick={() => beginRename(topic)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 rounded-lg bg-white/90 shadow-sm"
                  aria-label={localize('com_image_action_delete')}
                  disabled={deleting}
                  onClick={() => void onDeleteTopic(topic._id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );

  return (
    <>
      <aside className="hidden w-[448px] shrink-0 border-r border-border-light bg-[#f7f7f8] text-text-primary lg:flex lg:flex-col">
        {renderHeader()}
        {renderTopics()}
      </aside>
      {mobileOpen && (
        <>
          <div className="fixed inset-0 z-[105] bg-black/40 lg:hidden" role="presentation">
            <button className="h-full w-full" aria-label="关闭图片主题" onClick={onMobileClose} />
          </div>
          <aside
            data-testid="image-topic-drawer"
            className="fixed left-0 top-0 z-[106] flex h-dvh w-[min(88vw,390px)] flex-col border-r border-border-light bg-[#f7f7f8] text-text-primary shadow-2xl lg:hidden"
            aria-label="图片主题"
          >
            {renderHeader(true)}
            {renderTopics()}
          </aside>
        </>
      )}
    </>
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

function PromptComposer({
  model,
  models,
  modelId,
  params,
  prompt,
  referenceFile,
  supportsReferenceImage,
  generating,
  uploading,
  onModelChange,
  onPromptChange,
  onReferenceFileChange,
  onClearReferenceFile,
  onParamChange,
  onSubmit,
}: {
  model: TImageModel | undefined;
  models: TImageModel[];
  modelId: string;
  params: Params;
  prompt: string;
  referenceFile: File | null;
  supportsReferenceImage: boolean;
  generating: boolean;
  uploading: boolean;
  onModelChange: (modelId: string) => void;
  onPromptChange: (prompt: string) => void;
  onReferenceFileChange: (file: File | null) => void;
  onClearReferenceFile: () => void;
  onParamChange: (name: string, value: unknown) => void;
  onSubmit: () => void;
}) {
  const localize = useLocalize();
  const [configOpen, setConfigOpen] = useState(false);
  const paramSchemas = (model?.paramSchemas ?? []).filter((schema) => schema.name !== 'imageUrls');
  const disabled = !prompt.trim() || generating || uploading;

  return (
    <div className="mx-auto w-full max-w-[1050px] rounded-2xl border border-border-light bg-white p-2 shadow-[0_8px_28px_rgba(0,0,0,0.06)]">
      <div className="flex min-h-[104px] gap-3 p-1">
        {supportsReferenceImage ? (
          <label className="flex size-[88px] shrink-0 cursor-pointer items-center justify-center rounded-xl bg-[#f5f5f5] text-text-tertiary transition-colors hover:bg-surface-hover">
            {referenceFile ? (
              <span className="line-clamp-3 px-2 text-center text-xs text-text-secondary">
                {referenceFile.name}
              </span>
            ) : (
              <Plus className="h-7 w-7" />
            )}
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              aria-label={localize('com_image_reference_image')}
              onChange={(event) => onReferenceFileChange(event.target.files?.[0] ?? null)}
            />
          </label>
        ) : null}
        <textarea
          className="min-h-[96px] min-w-0 flex-1 resize-none bg-transparent px-1 py-3 text-[15px] text-text-primary outline-none placeholder:text-text-tertiary"
          placeholder="描述你想要生成的内容"
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
        />
        {referenceFile ? (
          <Button
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 rounded-lg text-text-tertiary"
            aria-label={localize('com_image_action_delete')}
            onClick={onClearReferenceFile}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-border-light px-1 py-2">
        <div className="flex h-10 items-center gap-2 rounded-xl bg-[#f6f6f7] px-3 text-sm font-medium text-text-primary">
          <ImageIcon className="h-4 w-4" />
          <span>{imageModeLabel}</span>
          <ChevronDown className="h-4 w-4 text-text-tertiary" />
        </div>
        <label className="sr-only" htmlFor="hezi-image-model">
          {localize('com_image_model')}
        </label>
        <select
          id="hezi-image-model"
          aria-label={localize('com_image_model')}
          className="h-10 max-w-[220px] rounded-xl border-0 bg-transparent px-2 text-sm text-text-secondary outline-none hover:bg-[#f6f6f7]"
          value={modelId}
          onChange={(event) => onModelChange(event.target.value)}
        >
          {models.map((item) => (
            <option key={item.modelId} value={item.modelId} disabled={item.disabled}>
              {item.modelId}
            </option>
          ))}
        </select>
        <div className="relative">
          <Button
            size="icon"
            variant="ghost"
            className={cn('size-10 rounded-xl', configOpen && 'bg-[#f6f6f7]')}
            aria-label="图像参数"
            onClick={() => setConfigOpen((open) => !open)}
          >
            <Settings2 className="h-4 w-4" />
          </Button>
          {configOpen && (
            <div className="absolute bottom-12 left-0 z-20 grid w-72 gap-3 rounded-2xl border border-border-light bg-white p-4 shadow-xl">
              <div className="text-sm font-semibold text-text-primary">
                {model?.displayName || localize('com_image_model')}
              </div>
              {paramSchemas.map((schema) => (
                <ParamControl
                  key={schema.name}
                  schema={schema}
                  value={params[schema.name]}
                  onChange={(value) => onParamChange(schema.name, value)}
                />
              ))}
            </div>
          )}
        </div>
        {supportsReferenceImage ? (
          <span className="flex size-10 items-center justify-center rounded-xl text-text-secondary">
            <ImagePlus className="h-4 w-4" />
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            className="size-10 rounded-xl text-text-tertiary"
            aria-label="提示优化"
          >
            <Lightbulb className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            className="size-10 rounded-xl"
            disabled={disabled}
            aria-label={
              generating || uploading
                ? localize('com_image_generating')
                : localize('com_image_generate')
            }
            onClick={onSubmit}
          >
            {generating || uploading ? (
              <Sparkles className="h-4 w-4 animate-pulse" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
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
  const imageStartupConfig = startupConfig as ImageStartupConfig | undefined;
  const configuredDefaultModelId = imageStartupConfig?.imageGenDefaultModel || 'gpt-image-2';
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
  const [topicsPanelOpen, setTopicsPanelOpen] = useState(false);
  const [deletedGenerationIds, setDeletedGenerationIds] = useState<Set<string>>(() => new Set());
  const [deletedBatchIds, setDeletedBatchIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!activeTopicId && topics[0]?._id) {
      setActiveTopicId(topics[0]._id);
    }
  }, [activeTopicId, topics]);

  useEffect(() => {
    if (hasAppliedConfiguredDefault.current || !imageStartupConfig?.imageGenDefaultModel) {
      return;
    }
    if (models.some((item) => item.modelId === imageStartupConfig.imageGenDefaultModel)) {
      setModelId(imageStartupConfig.imageGenDefaultModel);
      hasAppliedConfiguredDefault.current = true;
    }
  }, [imageStartupConfig?.imageGenDefaultModel, models]);

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
  const isWorkspaceBusy =
    modelsLoading || topicsLoading || selectingInitialTopic || isLoadingBatches;
  const hasWorkspaceError = modelsError || topicsError || hasBatchesError;
  const shouldDockComposer = !isWorkspaceBusy && !hasWorkspaceError && displayedBatches.length > 0;

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

  const renderPromptComposer = () => (
    <PromptComposer
      model={model}
      models={models}
      modelId={model?.modelId ?? modelId}
      params={params}
      prompt={prompt}
      referenceFile={referenceFile}
      supportsReferenceImage={supportsReferenceImage}
      generating={generateMutation.isLoading}
      uploading={uploadImageMutation.isLoading}
      onModelChange={setModelId}
      onPromptChange={setPrompt}
      onReferenceFileChange={setReferenceFile}
      onClearReferenceFile={() => setReferenceFile(null)}
      onParamChange={(name, value) => setParams((prev) => ({ ...prev, [name]: value }))}
      onSubmit={submit}
    />
  );

  const renderWorkspace = () => {
    if (isWorkspaceBusy) {
      return (
        <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-text-secondary">
          {localize('com_image_generating')}
        </div>
      );
    }

    if (hasWorkspaceError) {
      return (
        <div className="flex h-full min-h-[420px] items-center justify-center px-4 text-center text-sm text-red-600">
          {localize('com_image_error_no_channel')}
        </div>
      );
    }

    if (displayedBatches.length === 0) {
      return (
        <div className="flex min-h-full items-center justify-center px-4 py-10">
          <div className="grid w-full max-w-[1100px] gap-20">
            <div className="flex items-center justify-center gap-3 text-center text-4xl font-semibold text-black md:text-5xl">
              <span>{imageCreateTitle}</span>
              <button className="inline-flex items-center gap-1 rounded-xl px-1 text-black transition-colors hover:bg-surface-hover">
                <span>{imageModeLabel}</span>
                <ChevronDown className="mt-1 h-5 w-5 text-text-secondary" />
              </button>
            </div>
            {renderPromptComposer()}
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto grid w-full max-w-4xl gap-4 px-4 py-6">
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
    <div className="flex h-full min-h-0 w-full overflow-hidden bg-[#f7f7f8] text-text-primary">
      <TopicSidebar
        topics={topics}
        activeTopicId={activeTopicId}
        mobileOpen={topicsPanelOpen}
        onSelect={setActiveTopicId}
        onNewTopic={startNewTopic}
        onMobileClose={() => setTopicsPanelOpen(false)}
        onRenameTopic={renameTopic}
        onDeleteTopic={deleteTopic}
        renaming={updateTopicMutation.isLoading}
        deleting={deleteTopicMutation.isLoading}
      />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f1f1f2]">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border-light bg-surface-primary px-3 md:hidden">
          <OpenSidebar />
          <h1 className="min-w-0 truncate text-sm font-semibold text-text-primary">
            {localize('com_nav_image_gen')}
          </h1>
          <Button
            size="icon"
            variant="ghost"
            className="ml-auto size-9 rounded-xl text-text-secondary"
            aria-label="打开图片主题"
            onClick={() => setTopicsPanelOpen(true)}
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 flex-1 p-2 md:p-4">
          <div className="h-full overflow-hidden rounded-[22px] border border-border-light bg-white shadow-sm">
            {shouldDockComposer ? (
              <div className="flex h-full min-h-0 flex-col">
                <div data-testid="image-history-scroll" className="min-h-0 flex-1 overflow-y-auto">
                  {renderWorkspace()}
                </div>
                <div
                  data-testid="image-composer-dock"
                  className="shrink-0 border-t border-border-light bg-white/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_30px_rgba(0,0,0,0.04)] md:px-4"
                >
                  {renderPromptComposer()}
                </div>
              </div>
            ) : (
              <div className="h-full overflow-y-auto">{renderWorkspace()}</div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

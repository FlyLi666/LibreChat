import { useEffect, useMemo, useState } from 'react';
import { Download, Maximize2, RefreshCw, Trash2 } from 'lucide-react';
import type {
  TImageBatch,
  TImageModel,
  TImageParamSchema,
  TImageTopic,
} from 'librechat-data-provider';
import { Button } from '@librechat/client';
import {
  useGenerateImageMutation,
  useImageBatchesQuery,
  useImageModelsQuery,
  useImageTopicsQuery,
} from '~/data-provider/Images';
import { useLocalize } from '~/hooks';
import { cn } from '~/utils';
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

function groupTopics(topics: TImageTopic[]) {
  return [
    { label: '今天', topics },
    { label: '昨天', topics: [] },
    { label: '过去 7 天', topics: [] },
    { label: '更早', topics: [] },
  ];
}

export function mergeImageBatches(inlineBatches: TImageBatch[], remoteBatches: TImageBatch[]) {
  const remoteById = new Map(remoteBatches.map((batch) => [batch._id, batch]));
  const inlineIds = new Set(inlineBatches.map((batch) => batch._id));
  return [
    ...inlineBatches.map((batch) => remoteById.get(batch._id) ?? batch),
    ...remoteBatches.filter((batch) => !inlineIds.has(batch._id)),
  ];
}

function getSchemaLabel(schema: TImageParamSchema, localize: ReturnType<typeof useLocalize>) {
  const key =
    schema.i18nLabel || schemaLabelFallbacks[schema.name] || `com_image_config_${schema.name}`;
  return localize(key as Parameters<typeof localize>[0]);
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
}: {
  topics: TImageTopic[];
  activeTopicId: string | null;
  onSelect: (topicId: string) => void;
  onNewTopic: () => void;
}) {
  const localize = useLocalize();
  const groups = groupTopics(topics);

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
                <button
                  key={topic._id}
                  className={cn(
                    'rounded-lg px-2 py-2 text-left text-sm transition-colors hover:bg-surface-hover',
                    topic._id === activeTopicId
                      ? 'bg-surface-active-alt text-text-primary'
                      : 'text-text-secondary',
                  )}
                  onClick={() => onSelect(topic._id)}
                >
                  <span className="line-clamp-1">{topic.title}</span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

function GenerationCard({ batch }: { batch: TImageBatch }) {
  const localize = useLocalize();

  return (
    <article className="rounded-lg border border-border-light bg-surface-primary p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-text-primary">{batch.prompt}</p>
          <p className="mt-1 text-xs text-text-tertiary">{batch.model}</p>
        </div>
        <div className="flex gap-1 text-text-secondary">
          <Button size="icon" variant="ghost" aria-label={localize('com_image_action_zoom')}>
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label={localize('com_image_action_download')}>
            <Download className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label={localize('com_image_action_recreate')}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" aria-label={localize('com_image_action_delete')}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {batch.generations.map((generation) => (
          <div
            key={generation._id}
            className="aspect-square overflow-hidden rounded-lg bg-surface-secondary"
          >
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
            {generation.status === 'succeeded' && generation.asset?.url && (
              <img
                src={generation.asset.url}
                alt={batch.prompt}
                className="h-full w-full object-cover"
              />
            )}
          </div>
        ))}
      </div>
    </article>
  );
}

function ModelInspector({
  model,
  params,
  onParamChange,
}: {
  model: TImageModel | undefined;
  params: Params;
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
      <div className="mt-5 rounded-lg border border-dashed border-border-medium p-4 text-sm text-text-secondary">
        {localize('com_image_reference_image')}
      </div>
    </aside>
  );
}

export default function ImagePage() {
  const localize = useLocalize();
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
  const localModels = useMemo(() => getLocalImageModels(), []);
  const models = remoteModels?.length ? remoteModels : localModels;
  const [modelId, setModelId] = useState('gpt-image-2');
  const model = useMemo(
    () => models.find((item) => item.modelId === modelId) ?? models[0],
    [modelId, models],
  );
  const [params, setParams] = useState<Params>(() => getDefaultImageParams(model));
  const [prompt, setPrompt] = useState('');
  const [inlineBatches, setInlineBatches] = useState<TImageBatch[]>([]);

  useEffect(() => {
    if (!activeTopicId && topics[0]?._id) {
      setActiveTopicId(topics[0]._id);
    }
  }, [activeTopicId, topics]);

  useEffect(() => {
    setParams(getDefaultImageParams(model));
    // `model` may be a fresh object from remote query data; reset only when the selected model changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model?.modelId]);

  const displayedBatches = useMemo(() => {
    return mergeImageBatches(inlineBatches, batches);
  }, [batches, inlineBatches]);

  const upsertInlineBatch = (batch: TImageBatch | undefined) => {
    if (!batch) {
      return;
    }
    setInlineBatches((prev) => [batch, ...prev.filter((item) => item._id !== batch._id)]);
  };

  const startNewTopic = () => {
    setActiveTopicId(null);
    setInlineBatches([]);
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
      const response = await generateMutation.mutateAsync({
        topicId: activeTopicId,
        provider: model.provider,
        model: model.modelId,
        prompt: trimmed,
        params,
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
          <GenerationCard key={batch._id} batch={batch} />
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
                disabled={!prompt.trim() || generateMutation.isLoading}
                onClick={submit}
              >
                {generateMutation.isLoading
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
        onParamChange={(name, value) => setParams((prev) => ({ ...prev, [name]: value }))}
      />
    </div>
  );
}

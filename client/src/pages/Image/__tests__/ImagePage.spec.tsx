import React from 'react';
import { RecoilRoot } from 'recoil';
import '@testing-library/jest-dom/extend-expect';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { TImageBatch } from 'librechat-data-provider';
import ImagePage, { filterDeletedGenerations, groupTopics, mergeImageBatches } from '../ImagePage';

const mockGenerateImage = jest.fn();
const mockUploadReferenceImage = jest.fn();
const mockDeleteImageGeneration = jest.fn();
const mockDeleteImageBatch = jest.fn();
const mockUpdateImageTopic = jest.fn();
const mockDeleteImageTopic = jest.fn();
let mockStartupConfig: Record<string, unknown> = {};
let mockBatchesLoading = false;
let mockBatches: unknown[] = [];
let mockTopics: unknown[] = [];
let mockLastBatchesTopicId: string | null | undefined = undefined;

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string, values?: Record<string, unknown>) => {
    const text =
      {
        com_image_empty: '还没有作品，画点什么吧',
        com_image_brand: 'HeZi LibreAI',
        com_image_model: 'Model',
        com_image_prompt_placeholder: '描述你想要生成的内容',
        com_image_generate: '生成',
        com_image_action_delete: '删除',
        com_image_action_cancel: '取消',
        com_image_action_download: '下载',
        com_image_action_recreate: '重新生成',
        com_image_action_zoom: '放大查看',
        com_image_action_delete_batch: '删除整组',
        com_image_action_copy_prompt: '复制提示词',
        com_image_action_optimize_prompt: '提示优化',
        com_image_action_reuse_settings: '复用设置',
        com_image_close_topics: '关闭图片主题',
        com_image_count: '{{count}} 张图片',
        com_image_collapse_sidebar: '收起图片侧栏',
        com_image_create_title: '即刻创作',
        com_image_create_topic: '创作新主题',
        com_image_empty_topic: '这个主题还没有图片，继续描述你想生成的内容',
        com_image_generation_failed_hint: '生成遇到了问题。你可以重试，或调整描述后再试',
        com_image_generating: '生成中...',
        com_image_generating_title: '正在生成图片',
        com_image_generating_step_queue: '排队',
        com_image_generating_step_generate: '生成',
        com_image_generating_step_save: '保存',
        com_image_generating_waited: '已等待 {{time}}',
        com_image_wait_less_than_minute: '不到 1 分钟',
        com_image_wait_minutes: '{{count}} 分钟',
        com_image_generating_4k_hint: '4K 图通常需要 2-4 分钟，请保持页面打开',
        com_image_composer_4k_hint: '4K 分辨率会更慢，通常需要 2-4 分钟',
        com_image_mode_image: '图片',
        com_image_open_sidebar: '打开图片侧栏',
        com_image_open_topics: '打开图片主题',
        com_image_parameters: '图像参数',
        com_image_topic_count: '图片主题 {{count}}',
        com_image_topic_view: '图片主题视图',
        com_image_topic_view_grid: '网格视图',
        com_image_topic_view_list: '列表视图',
        com_image_topics: '图片主题',
        com_ui_search: '搜索',
        com_ui_untitled: '未命名',
        com_ui_rename: '重命名',
        com_image_config_size: '尺寸',
        com_image_config_aspect: '比例',
        com_image_config_resolution: '分辨率',
        com_image_config_quality: '质量',
        com_image_config_image_num: '数量',
        com_image_reference_image: '参考图',
        com_image_new_topic: '新建主题',
        com_nav_image_gen: '生图',
        com_nav_open_sidebar: '打开侧边栏',
      }[key] ?? key;

    return text.replace(/\{\{(\w+)\}\}/g, (_match, name) => String(values?.[name] ?? ''));
  },
}));

jest.mock('~/data-provider', () => ({
  useGetStartupConfig: () => ({ data: mockStartupConfig }),
}));

jest.mock('~/data-provider/Images', () => ({
  useImageModelsQuery: () => ({
    data: [
      {
        provider: 'openai',
        modelId: 'gpt-image-2',
        displayName: 'GPT Image 2',
        paramSchemas: [
          { name: 'imageUrls', type: 'images', default: [], maxCount: 1 },
          {
            name: 'size',
            type: 'enum',
            default: '1024x1024',
            enum: ['1024x1024', '2160x3840'],
          },
          { name: 'quality', type: 'enum', default: 'standard', enum: ['standard', 'hd'] },
          { name: 'imageNum', type: 'number', default: 1, min: 1, max: 4, step: 1 },
        ],
      },
      {
        provider: 'gemini',
        modelId: 'gemini-3.1-flash-image-preview',
        displayName: 'Nano Banana',
        paramSchemas: [
          { name: 'imageUrls', type: 'images', default: [], maxCount: 1 },
          { name: 'aspectRatio', type: 'enum', default: '1:1', enum: ['1:1', '16:9'] },
          { name: 'resolution', type: 'enum', default: '1K', enum: ['512', '1K'] },
          { name: 'imageNum', type: 'number', default: 1, min: 1, max: 4, step: 1 },
        ],
      },
      {
        provider: 'openai',
        modelId: 'dall-e-3',
        displayName: 'DALL-E 3',
        paramSchemas: [
          { name: 'size', type: 'enum', default: '1024x1024', enum: ['1024x1024'] },
          { name: 'quality', type: 'enum', default: 'standard', enum: ['standard', 'hd'] },
          { name: 'imageNum', type: 'number', default: 1, min: 1, max: 1, step: 1 },
        ],
      },
    ],
  }),
  useImageTopicsQuery: () => ({ data: mockTopics }),
  useImageBatchesQuery: (topicId: string | null) => {
    mockLastBatchesTopicId = topicId;
    return { data: mockBatches, isLoading: mockBatchesLoading };
  },
  useGenerateImageMutation: () => ({
    mutateAsync: mockGenerateImage,
    isLoading: false,
  }),
  useUploadImageMutation: () => ({
    mutateAsync: mockUploadReferenceImage,
    isLoading: false,
  }),
  useDeleteImageGenerationMutation: () => ({
    mutateAsync: mockDeleteImageGeneration,
    isLoading: false,
  }),
  useDeleteImageBatchMutation: () => ({
    mutateAsync: mockDeleteImageBatch,
    isLoading: false,
  }),
  useUpdateImageTopicMutation: () => ({
    mutateAsync: mockUpdateImageTopic,
    isLoading: false,
  }),
  useDeleteImageTopicMutation: () => ({
    mutateAsync: mockDeleteImageTopic,
    isLoading: false,
  }),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="route-location">{`${location.pathname}${location.search}`}</div>;
}

function renderPage(route = '/image') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <RecoilRoot>
          <LocationProbe />
          <ImagePage />
        </RecoilRoot>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe('ImagePage', () => {
  beforeEach(() => {
    mockGenerateImage.mockReset();
    mockGenerateImage.mockResolvedValue({});
    mockUploadReferenceImage.mockReset();
    mockUploadReferenceImage.mockResolvedValue({
      file_id: 'file-ref-1',
      filepath: '/images/user-123/reference.png',
      filename: 'reference.png',
    });
    mockDeleteImageGeneration.mockReset();
    mockDeleteImageGeneration.mockResolvedValue(undefined);
    mockDeleteImageBatch.mockReset();
    mockDeleteImageBatch.mockResolvedValue(undefined);
    mockUpdateImageTopic.mockReset();
    mockUpdateImageTopic.mockResolvedValue({
      _id: 'topic-1',
      title: '新主题名',
      type: 'image',
    });
    mockDeleteImageTopic.mockReset();
    mockDeleteImageTopic.mockResolvedValue(undefined);
    mockStartupConfig = {};
    mockTopics = [];
    mockBatches = [];
    mockBatchesLoading = false;
    mockLastBatchesTopicId = undefined;
    window.localStorage.clear();
  });

  it('groups topics by today, yesterday, past 7 days, and older dates', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-29T12:00:00+08:00'));
    const groups = groupTopics([
      { _id: 'topic-today', title: '今日主题', type: 'image', updatedAt: '2026-05-29T02:00:00Z' },
      {
        _id: 'topic-yesterday',
        title: '昨日主题',
        type: 'image',
        updatedAt: '2026-05-28T02:00:00Z',
      },
      { _id: 'topic-week', title: '七天内主题', type: 'image', updatedAt: '2026-05-25T02:00:00Z' },
      { _id: 'topic-old', title: '更早主题', type: 'image', updatedAt: '2026-05-10T02:00:00Z' },
    ]);

    expect(groups.map((group) => [group.label, group.topics.map((topic) => topic._id)])).toEqual([
      ['Today', ['topic-today']],
      ['Yesterday', ['topic-yesterday']],
      ['Previous 7 days', ['topic-week']],
      ['Older', ['topic-old']],
    ]);
    jest.useRealTimers();
  });

  it('supports localized topic group labels', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-29T12:00:00+08:00'));
    const groups = groupTopics(
      [{ _id: 'topic-today', title: '今日主题', type: 'image', updatedAt: '2026-05-29T02:00:00Z' }],
      {
        older: '更早',
        previous7Days: '过去 7 天',
        today: '今天',
        yesterday: '昨天',
      },
    );

    expect(groups[0].label).toBe('今天');
    jest.useRealTimers();
  });

  it('renders the empty state and default gpt-image-2 controls', () => {
    renderPage();

    expect(screen.getByText('即刻创作')).toBeInTheDocument();
    expect(screen.getAllByText('图片').length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue('gpt-image-2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '图像参数' }));
    expect(screen.getAllByText('尺寸').length).toBeGreaterThan(0);
    expect(screen.getAllByText('质量').length).toBeGreaterThan(0);
    expect(screen.getAllByText('数量').length).toBeGreaterThan(0);
  });

  it('renders mobile-safe global and image topic openers', () => {
    renderPage();

    expect(screen.getByTestId('open-sidebar-button')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '打开图片主题' }));

    const topicDrawer = screen.getByTestId('image-topic-drawer');
    expect(topicDrawer).toBeInTheDocument();
    expect(within(topicDrawer).getByRole('button', { name: '新建主题' })).toBeInTheDocument();
    fireEvent.click(within(topicDrawer).getByRole('button', { name: '关闭图片主题' }));
    expect(screen.queryByTestId('image-topic-drawer')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '生图' })).toBeInTheDocument();
  });

  it('uses the startup-configured image model as the default selection', () => {
    mockStartupConfig = { imageGenDefaultModel: 'dall-e-3' };

    renderPage();

    expect(screen.getByDisplayValue('dall-e-3')).toBeInTheDocument();
    expect(screen.queryByLabelText('参考图')).not.toBeInTheDocument();
  });

  it('prefers refreshed remote batches over matching inline pending batches', () => {
    const pendingBatch: TImageBatch = {
      _id: 'batch-1',
      topicId: 'topic-1',
      provider: 'openai',
      prompt: '画一只穿宇航服的猫',
      model: 'gpt-image-2',
      params: {},
      generations: [{ _id: 'generation-1', status: 'pending' }],
    };
    const succeededBatch: TImageBatch = {
      _id: 'batch-1',
      topicId: 'topic-1',
      provider: 'openai',
      prompt: '画一只穿宇航服的猫',
      model: 'gpt-image-2',
      params: {},
      generations: [
        {
          _id: 'generation-1',
          status: 'succeeded',
          asset: { url: '/images/user-123/cat.png' },
        },
      ],
    };

    expect(mergeImageBatches([pendingBatch], [succeededBatch])).toEqual([succeededBatch]);
  });

  it('does not crash when an optimistic batch has no generations yet', () => {
    const optimisticBatch = {
      _id: 'batch-optimistic',
      topicId: 'topic-1',
      provider: 'openai',
      prompt: '蓝色玻璃 App 图标',
      model: 'gpt-image-2',
      params: {},
    } as TImageBatch;

    expect(filterDeletedGenerations([optimisticBatch], new Set())).toEqual([]);
  });

  it('shows the empty state when no topic is selected and the batches query is disabled', () => {
    mockBatchesLoading = true;

    renderPage();

    expect(screen.getByText('即刻创作')).toBeInTheDocument();
    expect(screen.queryByText('生成中...')).not.toBeInTheDocument();
  });

  it('keeps /image on the home state instead of auto-selecting the first topic', async () => {
    mockTopics = [{ _id: 'topic-1', title: 'One Cat', type: 'image' }];

    renderPage('/image');

    await waitFor(() => {
      expect(mockLastBatchesTopicId).toBeNull();
    });
    expect(screen.getByTestId('route-location')).toHaveTextContent('/image');
    expect(screen.getByText('即刻创作')).toBeInTheDocument();
  });

  it('syncs the active image topic with the topic query param', async () => {
    mockTopics = [
      { _id: 'topic-1', title: 'One Cat', type: 'image' },
      { _id: 'topic-2', title: 'Two Cats', type: 'image' },
    ];

    renderPage('/image?topic=topic-1');

    await waitFor(() => {
      expect(mockLastBatchesTopicId).toBe('topic-1');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Two Cats' }));

    await waitFor(() => {
      expect(screen.getByTestId('route-location')).toHaveTextContent('/image?topic=topic-2');
      expect(mockLastBatchesTopicId).toBe('topic-2');
    });
  });

  it('switches image topics between grid and list views and persists the choice', () => {
    mockTopics = [{ _id: 'topic-1', title: 'One Cat', type: 'image' }];

    renderPage('/image?topic=topic-1');

    const topicButton = screen.getByRole('button', { name: 'One Cat' });
    expect(topicButton).toHaveClass('aspect-square');

    fireEvent.click(screen.getByRole('button', { name: '列表视图' }));

    expect(screen.getByRole('button', { name: 'One Cat' })).toHaveClass('h-11');
    expect(window.localStorage.getItem('hezi:imageTopicViewMode')).toBe('list');
  });

  it('collapses and restores the image topic accordion', () => {
    mockTopics = [{ _id: 'topic-1', title: 'One Cat', type: 'image' }];

    renderPage('/image?topic=topic-1');

    expect(screen.getByRole('button', { name: 'One Cat' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '图片主题 1' }));
    expect(screen.queryByRole('button', { name: 'One Cat' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '图片主题 1' }));
    expect(screen.getByRole('button', { name: 'One Cat' })).toBeInTheDocument();
  });

  it('adapts parameter controls when switching models', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'gemini-3.1-flash-image-preview' },
    });
    fireEvent.click(screen.getByRole('button', { name: '图像参数' }));

    expect(screen.getAllByText('比例').length).toBeGreaterThan(0);
    expect(screen.getAllByText('分辨率').length).toBeGreaterThan(0);
    expect(screen.queryByText('质量')).not.toBeInTheDocument();
  });

  it('only shows the reference image upload for models with imageUrls support', () => {
    renderPage();

    expect(screen.getByLabelText('参考图')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'dall-e-3' },
    });

    expect(screen.queryByLabelText('参考图')).not.toBeInTheDocument();
  });

  it('submits prompt, model, params, and image count', async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('描述你想要生成的内容'), {
      target: { value: '画一只穿宇航服的猫' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-image-2',
          prompt: '画一只穿宇航服的猫',
          imageNum: 1,
          params: expect.objectContaining({
            size: '1024x1024',
            quality: 'standard',
          }),
        }),
      );
    });
  });

  it('uploads a reference image and submits it as imageUrls for img2img', async () => {
    renderPage();

    const reference = new File(['reference-image'], 'reference.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('参考图'), {
      target: { files: [reference] },
    });
    fireEvent.change(screen.getByPlaceholderText('描述你想要生成的内容'), {
      target: { value: '保留参考图构图，改成玻璃质感 App 图标' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(mockUploadReferenceImage).toHaveBeenCalledWith(expect.any(FormData));
      expect(mockGenerateImage).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: '保留参考图构图，改成玻璃质感 App 图标',
          params: expect.objectContaining({
            imageUrls: ['/images/user-123/reference.png'],
          }),
        }),
      );
    });
    expect(screen.getByText('reference.png')).toBeInTheDocument();
  });

  it('keeps the submitted prompt when generation returns failed rows', async () => {
    mockGenerateImage.mockRejectedValue({
      response: {
        data: {
          batch: {
            _id: 'batch-failed',
            prompt: '画一只穿宇航服的猫',
            model: 'gpt-image-2',
            generations: [
              {
                _id: 'generation-failed',
                status: 'failed',
                error: '当前模型暂不可用，请换一个',
              },
            ],
          },
        },
      },
    });
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('描述你想要生成的内容'), {
      target: { value: '画一只穿宇航服的猫' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('描述你想要生成的内容')).toHaveValue('画一只穿宇航服的猫');
      expect(screen.getByText('当前模型暂不可用，请换一个')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('新建主题'));

    expect(screen.getByPlaceholderText('描述你想要生成的内容')).toHaveValue('');
    expect(screen.queryByText('当前模型暂不可用，请换一个')).not.toBeInTheDocument();
  });

  it('deletes a generated image from the feed', async () => {
    mockBatches = [
      {
        _id: 'batch-1',
        topicId: 'topic-1',
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: '画一只穿宇航服的猫',
        params: {},
        generations: [
          {
            _id: 'generation-1',
            status: 'succeeded',
            asset: { url: '/images/user-123/cat.png' },
          },
        ],
      },
    ];
    renderPage();

    expect(screen.getByAltText('画一只穿宇航服的猫')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(mockDeleteImageGeneration).toHaveBeenCalledWith('generation-1');
      expect(screen.queryByAltText('画一只穿宇航服的猫')).not.toBeInTheDocument();
    });
    expect(screen.getByText('即刻创作')).toBeInTheDocument();
  });

  it('shows a long-running status and cancel action for pending 4K generations', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-30T10:03:20.000Z'));
    mockTopics = [{ _id: 'topic-1', title: '赛博朋克少女', type: 'image' }];
    mockBatches = [
      {
        _id: 'batch-1',
        topicId: 'topic-1',
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: '赛博朋克少女',
        params: { size: '2160x3840' },
        generations: [
          {
            _id: 'generation-1',
            status: 'pending',
            createdAt: '2026-05-30T10:00:00.000Z',
          },
        ],
      },
    ];

    renderPage('/image?topic=topic-1');

    expect(screen.getByText('正在生成图片')).toBeInTheDocument();
    expect(screen.getByText('排队')).toBeInTheDocument();
    expect(screen.getByText('生成')).toBeInTheDocument();
    expect(screen.getByText('保存')).toBeInTheDocument();
    expect(screen.getByText('已等待 3 分钟')).toBeInTheDocument();
    expect(screen.getByText('4K 图通常需要 2-4 分钟，请保持页面打开')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '取消' })).toBeInTheDocument();
    jest.useRealTimers();
  });

  it('shows a 4K wait hint in the composer when selecting a 4K size', () => {
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '图像参数' }));
    fireEvent.change(screen.getByLabelText('尺寸'), { target: { value: '2160x3840' } });

    expect(screen.getByText('4K 分辨率会更慢，通常需要 2-4 分钟')).toBeInTheDocument();
  });

  it('keeps the composer outside the history scroll when generations exist', () => {
    mockBatches = [
      {
        _id: 'batch-1',
        topicId: 'topic-1',
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: '画一只穿宇航服的猫',
        params: {},
        generations: [
          {
            _id: 'generation-1',
            status: 'succeeded',
            asset: { url: '/images/user-123/cat.png' },
          },
        ],
      },
    ];

    renderPage();

    const historyScroll = screen.getByTestId('image-history-scroll');
    const composerDock = screen.getByTestId('image-composer-dock');
    const promptInput = screen.getByPlaceholderText('描述你想要生成的内容');

    expect(historyScroll).toContainElement(screen.getByAltText('画一只穿宇航服的猫'));
    expect(historyScroll).not.toContainElement(promptInput);
    expect(composerDock).toContainElement(promptInput);
  });

  it('deletes a full image batch from the feed', async () => {
    mockBatches = [
      {
        _id: 'batch-1',
        topicId: 'topic-1',
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: '蓝色玻璃 App 图标',
        params: {},
        generations: [
          {
            _id: 'generation-1',
            status: 'succeeded',
            asset: { url: '/images/user-123/icon-1.png' },
          },
          {
            _id: 'generation-2',
            status: 'succeeded',
            asset: { url: '/images/user-123/icon-2.png' },
          },
        ],
      },
    ];
    renderPage();

    expect(screen.getAllByAltText('蓝色玻璃 App 图标')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: '删除整组' }));

    await waitFor(() => {
      expect(mockDeleteImageBatch).toHaveBeenCalledWith('batch-1');
      expect(screen.queryByAltText('蓝色玻璃 App 图标')).not.toBeInTheDocument();
    });
    expect(mockDeleteImageGeneration).not.toHaveBeenCalled();
  });

  it('opens a preview dialog for a generated image', () => {
    mockBatches = [
      {
        _id: 'batch-1',
        topicId: 'topic-1',
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: '蓝色玻璃 App 图标',
        params: {},
        generations: [
          {
            _id: 'generation-1',
            status: 'succeeded',
            asset: { url: '/images/user-123/icon.png' },
          },
        ],
      },
    ];
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '放大查看' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByAltText('蓝色玻璃 App 图标')).toHaveLength(2);
  });

  it('downloads a generated image with a stable filename', () => {
    mockBatches = [
      {
        _id: 'batch-1',
        topicId: 'topic-1',
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: '蓝色玻璃 App 图标',
        params: {},
        generations: [
          {
            _id: 'generation-1',
            status: 'succeeded',
            asset: { url: '/images/user-123/hezi-image-abc.png' },
          },
        ],
      },
    ];
    renderPage();
    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation();
    const appendedLinks: HTMLAnchorElement[] = [];
    const appendSpy = jest.spyOn(document.body, 'appendChild').mockImplementation((node: Node) => {
      appendedLinks.push(node as HTMLAnchorElement);
      return node;
    });
    const removeSpy = jest
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node: Node) => node);

    fireEvent.click(screen.getByRole('button', { name: '下载' }));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendedLinks[0]?.href).toContain('/images/user-123/hezi-image-abc.png');
    expect(appendedLinks[0]?.download).toBe('hezi-image-abc.png');

    clickSpy.mockRestore();
    appendSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('recreates a generated batch with its original prompt and params', async () => {
    mockBatches = [
      {
        _id: 'batch-1',
        topicId: 'topic-1',
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: '蓝色玻璃 App 图标',
        params: { imageNum: 2, quality: 'hd', size: '1024x1024' },
        generations: [
          {
            _id: 'generation-1',
            status: 'succeeded',
            asset: { url: '/images/user-123/icon.png' },
          },
        ],
      },
    ];
    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '重新生成' }));

    await waitFor(() => {
      expect(mockGenerateImage).toHaveBeenCalledWith({
        topicId: 'topic-1',
        provider: 'openai',
        model: 'gpt-image-2',
        prompt: '蓝色玻璃 App 图标',
        params: { imageNum: 2, quality: 'hd', size: '1024x1024' },
        imageNum: 2,
      });
    });
  });

  it('renames an image topic from the sidebar', async () => {
    mockTopics = [{ _id: 'topic-1', title: '旧主题名', type: 'image' }];

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '重命名' }));
    fireEvent.change(screen.getByDisplayValue('旧主题名'), { target: { value: '新主题名' } });
    fireEvent.keyDown(screen.getByDisplayValue('新主题名'), { key: 'Enter' });

    await waitFor(() => {
      expect(mockUpdateImageTopic).toHaveBeenCalledWith({
        topicId: 'topic-1',
        title: '新主题名',
      });
    });
  });

  it('deletes an image topic from the sidebar', async () => {
    mockTopics = [{ _id: 'topic-1', title: '旧主题名', type: 'image' }];

    renderPage();

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(mockDeleteImageTopic).toHaveBeenCalledWith('topic-1');
    });
  });
});

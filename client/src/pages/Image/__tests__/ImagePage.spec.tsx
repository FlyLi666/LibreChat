import React from 'react';
import '@testing-library/jest-dom/extend-expect';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { TImageBatch } from 'librechat-data-provider';
import ImagePage, { mergeImageBatches } from '../ImagePage';

const mockGenerateImage = jest.fn();
const mockDeleteImageGeneration = jest.fn();
const mockUpdateImageTopic = jest.fn();
const mockDeleteImageTopic = jest.fn();
let mockBatchesLoading = false;
let mockBatches: unknown[] = [];
let mockTopics: unknown[] = [];

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) =>
    ({
      com_image_empty: '还没有作品，画点什么吧',
      com_image_brand: 'HeZi LibreAI',
      com_image_model: 'Model',
      com_image_prompt_placeholder: '描述你想画的内容...',
      com_image_generate: '生成',
      com_image_action_delete: '删除',
      com_image_action_download: '下载',
      com_image_action_recreate: '重新生成',
      com_image_action_zoom: '放大查看',
      com_ui_rename: '重命名',
      com_image_config_size: '尺寸',
      com_image_config_aspect: '比例',
      com_image_config_resolution: '分辨率',
      com_image_config_quality: '质量',
      com_image_config_image_num: '数量',
      com_image_new_topic: '新建主题',
    })[key] ?? key,
}));

jest.mock('~/data-provider/Images', () => ({
  useImageModelsQuery: () => ({
    data: [
      {
        provider: 'openai',
        modelId: 'gpt-image-2',
        displayName: 'GPT Image 2',
        paramSchemas: [
          { name: 'size', type: 'enum', default: '1024x1024', enum: ['1024x1024'] },
          { name: 'quality', type: 'enum', default: 'standard', enum: ['standard', 'hd'] },
          { name: 'imageNum', type: 'number', default: 1, min: 1, max: 4, step: 1 },
        ],
      },
      {
        provider: 'gemini',
        modelId: 'gemini-3.1-flash-image-preview',
        displayName: 'Nano Banana',
        paramSchemas: [
          { name: 'aspectRatio', type: 'enum', default: '1:1', enum: ['1:1', '16:9'] },
          { name: 'resolution', type: 'enum', default: '1K', enum: ['512', '1K'] },
          { name: 'imageNum', type: 'number', default: 1, min: 1, max: 4, step: 1 },
        ],
      },
    ],
  }),
  useImageTopicsQuery: () => ({ data: mockTopics }),
  useImageBatchesQuery: () => ({ data: mockBatches, isLoading: mockBatchesLoading }),
  useGenerateImageMutation: () => ({
    mutateAsync: mockGenerateImage,
    isLoading: false,
  }),
  useDeleteImageGenerationMutation: () => ({
    mutateAsync: mockDeleteImageGeneration,
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

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ImagePage />
    </QueryClientProvider>,
  );
}

describe('ImagePage', () => {
  beforeEach(() => {
    mockGenerateImage.mockReset();
    mockGenerateImage.mockResolvedValue({});
    mockDeleteImageGeneration.mockReset();
    mockDeleteImageGeneration.mockResolvedValue(undefined);
    mockUpdateImageTopic.mockReset();
    mockUpdateImageTopic.mockResolvedValue({
      _id: 'topic-1',
      title: '新主题名',
      type: 'image',
    });
    mockDeleteImageTopic.mockReset();
    mockDeleteImageTopic.mockResolvedValue(undefined);
    mockTopics = [];
    mockBatches = [];
    mockBatchesLoading = false;
  });

  it('renders the empty state and default gpt-image-2 controls', () => {
    renderPage();

    expect(screen.getByText('还没有作品，画点什么吧')).toBeInTheDocument();
    expect(screen.getByDisplayValue('gpt-image-2')).toBeInTheDocument();
    expect(screen.getAllByText('尺寸').length).toBeGreaterThan(0);
    expect(screen.getAllByText('质量').length).toBeGreaterThan(0);
    expect(screen.getAllByText('数量').length).toBeGreaterThan(0);
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

  it('shows the empty state when no topic is selected and the batches query is disabled', () => {
    mockBatchesLoading = true;

    renderPage();

    expect(screen.getByText('还没有作品，画点什么吧')).toBeInTheDocument();
    expect(screen.queryByText('生成中...')).not.toBeInTheDocument();
  });

  it('adapts parameter controls when switching models', () => {
    renderPage();

    fireEvent.change(screen.getByLabelText('Model'), {
      target: { value: 'gemini-3.1-flash-image-preview' },
    });

    expect(screen.getAllByText('比例').length).toBeGreaterThan(0);
    expect(screen.getAllByText('分辨率').length).toBeGreaterThan(0);
    expect(screen.queryByText('质量')).not.toBeInTheDocument();
  });

  it('submits prompt, model, params, and image count', async () => {
    renderPage();

    fireEvent.change(screen.getByPlaceholderText('描述你想画的内容...'), {
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

    fireEvent.change(screen.getByPlaceholderText('描述你想画的内容...'), {
      target: { value: '画一只穿宇航服的猫' },
    });
    fireEvent.click(screen.getByRole('button', { name: '生成' }));

    await waitFor(() => {
      expect(screen.getByPlaceholderText('描述你想画的内容...')).toHaveValue('画一只穿宇航服的猫');
      expect(screen.getByText('当前模型暂不可用，请换一个')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('新建主题'));

    expect(screen.getByPlaceholderText('描述你想画的内容...')).toHaveValue('');
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
    expect(screen.getByText('还没有作品，画点什么吧')).toBeInTheDocument();
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

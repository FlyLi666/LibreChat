import React from 'react';
import '@testing-library/jest-dom/extend-expect';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ImagePage, { mergeImageBatches } from '../ImagePage';

const mockGenerateImage = jest.fn();
let mockBatchesLoading = false;

jest.mock('~/hooks', () => ({
  useLocalize: () => (key: string) =>
    ({
      com_image_empty: '还没有作品，画点什么吧',
      com_image_brand: 'HeZi LibreAI',
      com_image_model: 'Model',
      com_image_prompt_placeholder: '描述你想画的内容...',
      com_image_generate: '生成',
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
  useImageTopicsQuery: () => ({ data: [] }),
  useImageBatchesQuery: () => ({ data: [], isLoading: mockBatchesLoading }),
  useGenerateImageMutation: () => ({
    mutateAsync: mockGenerateImage,
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
    const pendingBatch = {
      _id: 'batch-1',
      prompt: '画一只穿宇航服的猫',
      model: 'gpt-image-2',
      generations: [{ _id: 'generation-1', status: 'pending' }],
    };
    const succeededBatch = {
      _id: 'batch-1',
      prompt: '画一只穿宇航服的猫',
      model: 'gpt-image-2',
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
});

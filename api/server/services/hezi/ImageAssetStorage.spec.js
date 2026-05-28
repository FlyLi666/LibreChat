const { FileContext } = require('librechat-data-provider');
const { persistGeneratedImageAsset } = require('./ImageAssetStorage');
const { uploadImageBuffer } = require('~/server/services/Files/process');

jest.mock('uuid', () => ({ v4: () => 'file-1' }));

jest.mock('~/server/services/Files/process', () => ({
  uploadImageBuffer: jest.fn(),
}));

describe('ImageAssetStorage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps remote image URLs without writing file storage', async () => {
    const result = await persistGeneratedImageAsset({
      req: {},
      generationId: 'generation-1',
      image: { url: 'https://cdn.example.com/cat.png', mimeType: 'image/png' },
    });

    expect(result).toEqual({
      asset: { url: 'https://cdn.example.com/cat.png', mimeType: 'image/png' },
      fileId: undefined,
    });
    expect(uploadImageBuffer).not.toHaveBeenCalled();
  });

  it('stores base64 image output through LibreChat file storage', async () => {
    uploadImageBuffer.mockResolvedValue({
      file_id: 'file-1',
      filepath: '/images/user-123/hezi-image-generation-1.png',
      type: 'image/png',
      width: 512,
      height: 512,
    });

    const result = await persistGeneratedImageAsset({
      req: { user: { id: 'user-123' }, config: {} },
      generationId: 'generation-1',
      image: { b64: Buffer.from('png').toString('base64'), mimeType: 'image/png' },
    });

    expect(uploadImageBuffer).toHaveBeenCalledWith({
      req: { user: { id: 'user-123' }, config: {} },
      context: FileContext.image_generation,
      resize: false,
      metadata: expect.objectContaining({
        bytes: 3,
        file_id: 'file-1',
        filename: 'hezi-image-generation-1.png',
        type: 'image/png',
      }),
    });
    expect(result).toEqual({
      asset: {
        url: '/images/user-123/hezi-image-generation-1.png',
        width: 512,
        height: 512,
        mimeType: 'image/png',
      },
      fileId: 'file-1',
    });
  });
});

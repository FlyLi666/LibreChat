const { v4 } = require('uuid');
const mime = require('mime-types');
const { FileContext } = require('librechat-data-provider');
const { uploadImageBuffer } = require('~/server/services/Files/process');

function getExtension(mimeType) {
  return mime.extension(mimeType || 'image/png') || 'png';
}

async function persistGeneratedImageAsset({ req, image, generationId }) {
  if (image.url) {
    return {
      asset: image,
      fileId: undefined,
    };
  }

  const mimeType = image.mimeType || 'image/png';
  const buffer = Buffer.from(image.b64, 'base64');
  const fileId = v4();
  const file = await uploadImageBuffer({
    req,
    context: FileContext.image_generation,
    resize: false,
    metadata: {
      buffer,
      width: image.width,
      height: image.height,
      bytes: buffer.length,
      filename: `hezi-image-${generationId}.${getExtension(mimeType)}`,
      file_id: fileId,
      type: mimeType,
    },
  });

  return {
    asset: {
      url: file.filepath,
      width: file.width || image.width,
      height: file.height || image.height,
      mimeType: file.type || mimeType,
    },
    fileId: file.file_id,
  };
}

module.exports = {
  persistGeneratedImageAsset,
};

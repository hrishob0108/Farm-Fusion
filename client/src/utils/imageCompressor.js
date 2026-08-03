import imageCompression from 'browser-image-compression';

export const compressImage = async (file) => {
  // Only compress raster images, skip PDFs
  if (file.type === 'application/pdf') {
    return file;
  }

  const options = {
    maxSizeMB: 1,
    maxWidthOrHeight: 1920,
    useWebWorker: true
  };

  try {
    const compressedFile = await imageCompression(file, options);
    return compressedFile;
  } catch (error) {
    console.warn('[ImageCompressor Warning] Compression skipped:', error);
    return file;
  }
};

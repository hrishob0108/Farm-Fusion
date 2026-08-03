import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Uploads a file buffer to Cloudinary
 * @param {Buffer} fileBuffer - File buffer from multer memoryStorage
 * @param {string} [folder] - Target folder on Cloudinary
 * @returns {Promise<Object>} Cloudinary upload result containing secure_url
 */
export const uploadToCloudinary = (fileBuffer, folder = process.env.CLOUDINARY_FOLDER || 'FarmFusion') => {
  return new Promise((resolve, reject) => {
    if (!fileBuffer || !(fileBuffer instanceof Buffer)) {
      return reject(new Error('Invalid or missing file buffer provided for Cloudinary upload'));
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'auto'
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary Upload Error]:', error);
          return reject(error);
        }
        console.log('[Cloudinary Stream Upload Success]:', result?.secure_url);
        resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

export default cloudinary;

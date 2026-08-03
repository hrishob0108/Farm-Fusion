import multer from 'multer';
import path from 'path';

// Use memoryStorage so uploaded files are held in memory buffer for direct Cloudinary upload
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/pjpeg', 'image/webp'];
  const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedMimeTypes.includes(file.mimetype) || allowedExtensions.includes(ext) || !ext) {
    cb(null, true);
  } else {
    cb(null, false);
    req.fileValidationError = 'Invalid file type. Supported formats: PNG, JPG, JPEG, WEBP.';
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

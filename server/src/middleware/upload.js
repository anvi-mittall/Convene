import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { ApiError } from '../utils/ApiError.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const postersDir = path.resolve(__dirname, '../../uploads/posters');
const resourcesDir = path.resolve(__dirname, '../../uploads/resources');

if (!fs.existsSync(postersDir)) fs.mkdirSync(postersDir, { recursive: true });
if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true });

// Poster storage
const posterStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, postersDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `poster-${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  }
});

const posterFilter = (req, file, cb) => {
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];

  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExtensions.includes(ext) || !allowedMimes.includes(file.mimetype)) {
    return cb(
      ApiError.badRequest(
        'FILE_TYPE_NOT_ALLOWED',
        'Only JPG, PNG, and WEBP image files are allowed for event posters'
      )
    );
  }
  cb(null, true);
};

export const uploadPoster = multer({
  storage: posterStorage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB max
  fileFilter: posterFilter
}).single('poster');

// Resource storage
const resourceStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, resourcesDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const storedName = `${crypto.randomUUID()}${ext}`;
    cb(null, storedName);
  }
});

const allowedResourceExtensions = ['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
const allowedResourceMimes = [
  'application/pdf',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/png',
  'image/jpeg'
];

const resourceFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedResourceExtensions.includes(ext) || !allowedResourceMimes.includes(file.mimetype)) {
    return cb(
      ApiError.badRequest(
        'FILE_TYPE_NOT_ALLOWED',
        'Only PDF, PPT, PPTX, DOC, DOCX, PNG, and JPG files are allowed'
      )
    );
  }
  cb(null, true);
};

export const uploadResource = multer({
  storage: resourceStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
  fileFilter: resourceFilter
}).single('file');

export function deleteFileIfExists(filePath) {
  if (!filePath) return;
  const fullPath = path.resolve(__dirname, '../../', filePath.startsWith('/') ? filePath.slice(1) : filePath);
  if (fs.existsSync(fullPath)) {
    try {
      fs.unlinkSync(fullPath);
    } catch (err) {
      console.error(`Failed to delete file: ${fullPath}`, err);
    }
  }
}

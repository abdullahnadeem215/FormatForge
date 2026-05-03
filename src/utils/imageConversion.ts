// src/utils/imageConversion.ts
import { isHeicFile, heicToJpeg } from './heicSupport';

export interface ImageConversionOptions {
  format: 'jpeg' | 'png' | 'webp';
  quality: number; // 1-100
  width?: number;
  height?: number;
  maintainAspectRatio?: boolean;
}

export interface ConvertedImage {
  blob: Blob;
  url: string;
  width: number;
  height: number;
  sizeKB: number;
}

/**
 * Convert any image file to target format using Canvas API
 */
export async function convertImage(
  file: File,
  options: ImageConversionOptions
): Promise<ConvertedImage> {
  let sourceFile = file;
  
  // Handle HEIC/HEIF files automatically
  if (isHeicFile(file)) {
    sourceFile = (await heicToJpeg(file)) as File;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        
        let width = options.width || img.width;
        let height = options.height || img.height;

        // Apply aspect ratio if needed (though UI usually handles this)
        if (options.maintainAspectRatio && options.width && !options.height) {
          height = Math.round((options.width / img.width) * img.height);
        } else if (options.maintainAspectRatio && options.height && !options.width) {
          width = Math.round((options.height / img.height) * img.width);
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }

        // Apply smoothing for better resizing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        ctx.drawImage(img, 0, 0, width, height);
        
        const mimeType = `image/${options.format === 'jpeg' ? 'jpeg' : options.format}`;
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({
                blob,
                url: URL.createObjectURL(blob),
                width,
                height,
                sizeKB: blob.size / 1024,
              });
            } else {
              reject(new Error('Conversion failed'));
            }
          },
          mimeType,
          options.quality / 100
        );
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(sourceFile);
  });
}

/**
 * Get image dimensions without loading full image potentially
 */
export async function getImageDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = () => reject(new Error('Failed to get dimensions'));
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

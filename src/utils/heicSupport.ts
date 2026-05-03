// src/utils/heicSupport.ts

/**
 * Convert HEIC file to JPEG using heic2any library
 * Note: This runs entirely in the browser
 */
export async function heicToJpeg(file: File): Promise<Blob> {
  const heic2any = (await import('heic2any')).default;
  
  try {
    const result = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.85,
    });
    
    // heic2any can return an array if the HEIC contains multiple images
    const blob = Array.isArray(result) ? result[0] : result;
    return blob;
  } catch (error) {
    console.error('HEIC conversion failed:', error);
    throw new Error('Failed to convert HEIC image. The file might be corrupted or unsupported.');
  }
}

export function isHeicFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase();
  return (
    extension === 'heic' || 
    extension === 'heif' || 
    file.type === 'image/heic' || 
    file.type === 'image/heif'
  );
}

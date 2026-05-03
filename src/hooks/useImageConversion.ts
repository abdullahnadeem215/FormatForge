// src/hooks/useImageConversion.ts
import { useState, useCallback } from 'react';
import { convertImage } from '../utils/imageConversion';

export function useImageConversion() {
  const [isConverting, setIsConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const convertSingle = useCallback(async (file: File, options: any) => {
    setIsConverting(true);
    setError(null);
    
    try {
      const result = await convertImage(file, options);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Conversion failed';
      setError(msg);
      throw err;
    } finally {
      setIsConverting(false);
    }
  }, []);

  return {
    convertSingle,
    isConverting,
    progress,
    error,
  };
}

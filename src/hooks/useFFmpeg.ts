import { FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';
import { useState, useEffect } from 'react';

export function useFFmpeg() {
  const [ffmpeg, setFfmpeg] = useState<FFmpeg | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (loaded || isLoading) return;
    
    setIsLoading(true);
    setError(null);
    setLoadingProgress(0);
    
    try {
      const ffmpegInstance = new FFmpeg();
      
      ffmpegInstance.on('log', ({ message }) => {
        console.log('FFmpeg:', message);
      });
      
      ffmpegInstance.on('progress', ({ progress }) => {
        setLoadingProgress(Math.round(progress * 100));
      });
      
      // Use CDN - this is the most reliable method
      // The files are served correctly from unpkg
      await ffmpegInstance.load({
        coreURL: await toBlobURL('https://unpkg.org/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL('https://unpkg.org/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.wasm', 'application/wasm'),
      });
      
      setFfmpeg(ffmpegInstance);
      setLoaded(true);
    } catch (err) {
      console.error('FFmpeg load error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load FFmpeg');
    } finally {
      setIsLoading(false);
      setLoadingProgress(0);
    }
  };
  
  useEffect(() => {
    load();
  }, []);
  
  return { ffmpeg, loaded, isLoading, loadingProgress, error, load };
}

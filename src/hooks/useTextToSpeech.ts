// src/hooks/useTextToSpeech.ts
import { useState } from 'react';
import { TextToSpeech } from '@capacitor-community/text-to-speech';

export const useTextToSpeech = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outputPath, setOutputPath] = useState<string | null>(null);

  const convert = async (text: string, language: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Map language codes to what the plugin expects
      const langMap: Record<string, string> = {
        en: 'en-US',
        ur: 'ur-PK',
        ar: 'ar-SA',
      };
      await TextToSpeech.speak({
        text: text,
        lang: langMap[language] || 'en-US',
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
      });
      // Community plugin does not save MP3; we set a dummy path
      setOutputPath('speech_synthesized');
      return 'speech_synthesized';
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { convert, isLoading, error, outputPath };
};

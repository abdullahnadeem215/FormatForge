// src/hooks/useBackgroundRemover.ts
import { useState } from 'react';
import { SubjectSegmentation } from '@capacitor-mlkit/subject-segmentation';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

interface BackgroundRemoverOptions {
  backgroundColor?: string;
}

export const useBackgroundRemover = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultPath, setResultPath] = useState<string | null>(null);

  const extractOriginalPixels = async (
    originalBase64: string, 
    maskBase64: string,
    backgroundColor?: string
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const origImg = new Image();
      const maskImg = new Image();
      let loaded = 0;

      const checkDone = () => {
        if (loaded === 2) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = origImg.width;
            canvas.height = origImg.height;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            if (!ctx) return reject(new Error('Canvas not available'));
            
            ctx.drawImage(origImg, 0, 0);
            const origData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = origImg.width;
            maskCanvas.height = origImg.height;
            const maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });
            if (!maskCtx) return reject(new Error('Mask Canvas not available'));

            const scale = Math.min(maskImg.width / origImg.width, maskImg.height / origImg.height);
            const innerW = origImg.width * scale;
            const innerH = origImg.height * scale;
            const padX = (maskImg.width - innerW) / 2;
            const padY = (maskImg.height - innerH) / 2;

            maskCtx.drawImage(
              maskImg,
              padX, padY, innerW, innerH, 
              0, 0, origImg.width, origImg.height 
            );
            const maskData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);

            for (let i = 0; i < origData.data.length; i += 4) {
              const oR = origData.data[i];
              const oG = origData.data[i + 1];
              const oB = origData.data[i + 2];

              const mR = maskData.data[i];
              const mG = maskData.data[i + 1];
              const mB = maskData.data[i + 2];
              const mA = maskData.data[i + 3];

              if (mA < 10) {
                origData.data[i + 3] = 0;
                continue;
              }

              const origMagentaIntensity = ((oR + oB) / 2) - oG;
              const maskMagentaIntensity = ((mR + mB) / 2) - mG;

              const tintedMagenta = maskMagentaIntensity > origMagentaIntensity + 20;
              const nativelyMagenta = origMagentaIntensity > 40 && maskMagentaIntensity > 40;

              if (tintedMagenta || nativelyMagenta) {
                origData.data[i + 3] = 255; 
              } else {
                origData.data[i + 3] = 0; 
              }
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            if (backgroundColor) {
              ctx.fillStyle = backgroundColor;
              ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
               tempCtx.putImageData(origData, 0, 0);
               ctx.drawImage(tempCanvas, 0, 0);
            }

            const imageFormat = backgroundColor ? 'image/jpeg' : 'image/png';
            resolve(canvas.toDataURL(imageFormat).split(',')[1]);

          } catch (err) {
            reject(err);
          }
        }
      };

      origImg.onload = () => { loaded++; checkDone(); };
      maskImg.onload = () => { loaded++; checkDone(); };
      origImg.onerror = reject;
      maskImg.onerror = reject;

      origImg.src = originalBase64.startsWith('data:') 
        ? originalBase64 
        : `data:image/jpeg;base64,${originalBase64}`;
        
      maskImg.src = maskBase64.startsWith('data:') 
        ? maskBase64 
        : `data:image/png;base64,${maskBase64}`;
    });
  };

  const removeBackground = async (imageFile: File, options?: BackgroundRemoverOptions): Promise<string> => {
    setIsLoading(true);
    setError(null);
    let tempFileName: string | null = null;

    try {
      // Step 1: Convert original image to raw base64
      const base64Data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () =>
          resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(imageFile);
      });

      // Step 2: Write input to Data directory (Protects against OS wiping it)
      tempFileName = `mlkit_input_${Date.now()}.jpg`;
      const writeInput = await Filesystem.writeFile({
        path: tempFileName,
        data: base64Data,
        directory: Directory.Data, 
      });
      if (!writeInput?.uri) throw new Error('Failed to write input image to storage');

      // Step 3: Get native file:// path
      const { uri: inputPath } = await Filesystem.getUri({
        path: tempFileName,
        directory: Directory.Data,
      });

      // Step 4: Check availability on Android
      if (Capacitor.getPlatform() === 'android') {
        try {
          const { available } = await SubjectSegmentation.isGoogleSubjectSegmentationModuleAvailable();
          if (!available) {
            SubjectSegmentation.installGoogleSubjectSegmentationModule().catch(() => {});
            throw new Error(
              'ML Kit model is being downloaded by Google Play Services. ' +
              'This only happens once — please wait 30–60 seconds and try again.'
            );
          }
        } catch (checkErr: any) {
          if (checkErr.message?.includes('being downloaded')) throw checkErr;
        }
      }

      // --- STEP 4.5: THE "WARM-UP" TRICK (PREVENTS OFFLINE CRASHES) ---
      // We pass a microscopic 1x1 transparent pixel to the AI first. 
      // This forces the heavy AI model to load into RAM *before* the massive photo is loaded.
      if (Capacitor.getPlatform() === 'android') {
        const dummyName = `warmup_${Date.now()}.png`;
        try {
          await Filesystem.writeFile({
            path: dummyName,
            // Pure 1x1 transparent PNG base64
            data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
            directory: Directory.Data,
          });
          const { uri: dummyUri } = await Filesystem.getUri({ path: dummyName, directory: Directory.Data });
          
          // Silently process the 1x1 pixel to warm up the RAM
          await SubjectSegmentation.processImage({ path: dummyUri, confidence: 0.1 });
        } catch (warmupErr) {
          // If the warmup fails, we just silently ignore it and try to proceed anyway
        } finally {
          Filesystem.deleteFile({ path: dummyName, directory: Directory.Data }).catch(() => {});
        }
      }
      // -------------------------------------------------------------

      // Step 5: Run ML Kit on the REAL image
      const { path: outputPath } = await SubjectSegmentation.processImage({
        path: inputPath,
        confidence: 0.9,
      });

      if (!outputPath) throw new Error('No output path returned from ML Kit');

      // Step 6: Read result file
      let base64Result: string;
      try {
        const fileData = await Filesystem.readFile({
          path: outputPath,
          directory: Directory.Data,
        });
        base64Result = fileData.data as string;
      } catch {
        const fileData = await Filesystem.readFile({ path: outputPath });
        base64Result = fileData.data as string;
      }

      // Step 7: Process image and optionally apply background color
      const fixedBase64 = await extractOriginalPixels(base64Data, base64Result, options?.backgroundColor);

      // Step 8: Write final image back to Data directory
      const extension = options?.backgroundColor ? 'jpg' : 'png';
      const fixedFileName = `bg_removed_final_${Date.now()}.${extension}`;
      
      const writeFixed = await Filesystem.writeFile({
        path: fixedFileName,
        data: fixedBase64,
        directory: Directory.Data,
      });
      if (!writeFixed?.uri) throw new Error('Failed to write fixed image');

      setResultPath(writeFixed.uri);
      return writeFixed.uri;

    } catch (err: any) {
      const msg: string = err.message || 'Background removal failed';
      setError(msg);
      throw err;
    } finally {
      if (tempFileName) {
        Filesystem.deleteFile({ path: tempFileName, directory: Directory.Data })
          .catch(() => {});
      }
      setIsLoading(false);
    }
  };

  const applyBackgroundColor = async (transparentFileUri: string, hexColor: string): Promise<string> => {
    setIsLoading(true);
    return new Promise(async (resolve, reject) => {
      try {
        const fileData = await Filesystem.readFile({ path: transparentFileUri });
        const base64Data = fileData.data as string;

        const img = new Image();
        img.onload = async () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) return reject('Canvas error');

          ctx.fillStyle = hexColor;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0);

          const newBase64 = canvas.toDataURL('image/jpeg', 0.9).split(',')[1];
          const fileName = `bg_colored_${Date.now()}.jpg`;
          
          const writeFixed = await Filesystem.writeFile({
            path: fileName,
            data: newBase64,
            directory: Directory.Data,
          });

          setResultPath(writeFixed.uri);
          resolve(writeFixed.uri);
          setIsLoading(false);
        };
        img.onerror = () => {
          setIsLoading(false);
          reject('Failed to load transparent image');
        };
        img.src = `data:image/png;base64,${base64Data}`;
      } catch (e) {
        setIsLoading(false);
        reject(e);
      }
    });
  };

  return {
    removeBackground,
    applyBackgroundColor,
    isLoading,
    error,
    resultPath,
  };
};

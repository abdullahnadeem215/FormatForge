import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export async function getFFmpeg() {
  if (ffmpeg) return ffmpeg;
  
  ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  
  return ffmpeg;
}

export async function convertAudio(
  file: File, 
  outputFormat: string, 
  onProgress?: (progress: number) => void,
  options?: { bitrate?: string; sampleRate?: string; channels?: string }
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(progress * 100);
    });
  }

  const inputName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
  const outputName = `output.${outputFormat}`;
  
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  const args = ['-i', inputName];
  if (options?.bitrate) args.push('-b:a', options.bitrate);
  if (options?.sampleRate) args.push('-ar', options.sampleRate);
  if (options?.channels) args.push('-ac', options.channels);
  args.push(outputName);
  
  await ffmpeg.exec(args);
  
  const data = await ffmpeg.readFile(outputName);
  
  // Clean up
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);
  
  return new Blob([data], { type: `audio/${outputFormat}` });
}

export async function extractAudioFromVideo(
  file: File, 
  outputFormat: string, 
  onProgress?: (progress: number) => void,
  options?: { bitrate?: string; sampleRate?: string; channels?: string }
): Promise<Blob> {
  const ffmpeg = await getFFmpeg();
  
  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(progress * 100);
    });
  }

  const inputName = 'input' + file.name.substring(file.name.lastIndexOf('.'));
  const outputName = `output.${outputFormat}`;
  
  await ffmpeg.writeFile(inputName, await fetchFile(file));
  
  // -vn: no video
  const args = ['-i', inputName, '-vn'];
  if (options?.bitrate) args.push('-b:a', options.bitrate);
  else if (outputFormat === 'mp3') args.push('-acodec', 'libmp3lame');
  
  if (options?.sampleRate) args.push('-ar', options.sampleRate);
  if (options?.channels) args.push('-ac', options.channels);
  
  args.push(outputName);
  
  await ffmpeg.exec(args);
  
  const data = await ffmpeg.readFile(outputName);

  // Clean up
  await ffmpeg.deleteFile(inputName);
  await ffmpeg.deleteFile(outputName);

  return new Blob([data], { type: `audio/${outputFormat}` });
}

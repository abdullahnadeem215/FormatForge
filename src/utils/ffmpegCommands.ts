export interface ConversionOptions {
  inputFormat?: string;
  outputFormat: string;
  bitrate?: string | number;  // e.g., '192k' or 192
  sampleRate?: string | number; // Hz, e.g., 44100
  channels?: string | number; // 1 (mono) or 2 (stereo)
}

export const SUPPORTED_AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3', mime: 'audio/mpeg', extension: '.mp3' },
  { value: 'wav', label: 'WAV', mime: 'audio/wav', extension: '.wav' },
  { value: 'ogg', label: 'OGG', mime: 'audio/ogg', extension: '.ogg' },
  { value: 'aac', label: 'AAC', mime: 'audio/aac', extension: '.aac' },
  { value: 'flac', label: 'FLAC', mime: 'audio/flac', extension: '.flac' },
  { value: 'm4a', label: 'M4A', mime: 'audio/mp4', extension: '.m4a' },
];

export const SUPPORTED_VIDEO_FORMATS = [
  { value: 'mp4', label: 'MP4', mime: 'video/mp4' },
  { value: 'webm', label: 'WebM', mime: 'video/webm' },
  { value: 'mov', label: 'MOV', mime: 'video/quicktime' },
  { value: 'avi', label: 'AVI', mime: 'video/x-msvideo' },
  { value: 'mkv', label: 'MKV', mime: 'video/x-matroska' },
];

export const SUPPORTED_OUTPUT_AUDIO_FORMATS = [
  { value: 'mp3', label: 'MP3', mime: 'audio/mpeg', extension: '.mp3', codec: 'libmp3lame', bitrate: '192k' },
  { value: 'wav', label: 'WAV', mime: 'audio/wav', extension: '.wav', codec: 'pcm_s16le' },
  { value: 'ogg', label: 'OGG', mime: 'audio/ogg', extension: '.ogg', codec: 'libvorbis', bitrate: '192k' },
  { value: 'aac', label: 'AAC', mime: 'audio/aac', extension: '.aac', codec: 'aac', bitrate: '192k' },
  { value: 'flac', label: 'FLAC', mime: 'audio/flac', extension: '.flac', codec: 'flac' },
  { value: 'm4a', label: 'M4A', mime: 'audio/mp4', extension: '.m4a', codec: 'aac', bitrate: '192k' },
];

export function buildAudioConversionCommand(
  inputFileName: string,
  outputFileName: string,
  options: ConversionOptions
): string[] {
  const args = ['-i', inputFileName];
  
  const outputFormat = SUPPORTED_OUTPUT_AUDIO_FORMATS.find(f => f.value === options.outputFormat);
  if (outputFormat?.codec) {
    args.push('-acodec', outputFormat.codec);
  }
  
  const bitrate = options.bitrate || outputFormat?.bitrate;
  if (bitrate && (options.outputFormat === 'mp3' || options.outputFormat === 'aac' || options.outputFormat === 'ogg')) {
    const br = typeof bitrate === 'number' ? `${bitrate}k` : bitrate;
    args.push('-b:a', br);
  }
  
  if (options.sampleRate) {
    args.push('-ar', options.sampleRate.toString());
  }
  
  if (options.channels) {
    args.push('-ac', options.channels.toString());
  }
  
  args.push(outputFileName);
  return args;
}

export function buildVideoToAudioCommand(
  inputFileName: string,
  outputFileName: string,
  options: ConversionOptions
): string[] {
  const args = ['-i', inputFileName, '-vn'];
  
  const outputFormat = SUPPORTED_OUTPUT_AUDIO_FORMATS.find(f => f.value === options.outputFormat);
  if (outputFormat?.codec) {
    args.push('-acodec', outputFormat.codec);
  }
  
  const bitrate = options.bitrate || outputFormat?.bitrate;
  if (bitrate && (options.outputFormat === 'mp3' || options.outputFormat === 'aac' || options.outputFormat === 'ogg')) {
    const br = typeof bitrate === 'number' ? `${bitrate}k` : bitrate;
    args.push('-b:a', br);
  }
  
  if (options.sampleRate) {
    args.push('-ar', options.sampleRate.toString());
  }
  
  if (options.channels) {
    args.push('-ac', options.channels.toString());
  }
  
  args.push(outputFileName);
  return args;
}

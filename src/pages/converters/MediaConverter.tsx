import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { 
  Music, 
  Video, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Loader2, 
  Settings2,
  Zap
} from 'lucide-react';
import { saveConversion } from '../../utils/storage';
import { cn } from '../../lib/utils';

type ConversionType = 'audio-to-audio' | 'video-to-audio';

export default function MediaConverter() {
  const [conversionType, setConversionType] = useState<ConversionType>(
    window.location.pathname.includes('video') ? 'video-to-audio' : 'audio-to-audio'
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ name: string, url: string, blob: Blob } | null>(null);

  const onFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setResult(null);
      setError(null);
    }
  };

  const saveToDevice = async (blob: Blob, fileName: string) => {
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        await Filesystem.writeFile({
          path: fileName,
          data: base64,
          directory: Directory.Documents
        });
        alert(`✅ Saved to Documents/${fileName}`);
        await Share.share({
          title: 'File Converted',
          text: 'Check out my converted file!',
          url: `file://${fileName}`
        });
      };
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save file. Please check storage permissions.');
    }
  };

  // Convert audio buffer to WAV WITHOUT changing sample rate
  const audioBufferToWav = (buffer: AudioBuffer): Blob => {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate; // CRITICAL: Keep original sample rate
    const format = 1; // PCM
    const bitDepth = 16;
    
    // Get interleaved samples
    const samples = interleaveSamples(buffer);
    const dataLength = samples.length * (bitDepth / 8);
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);
    
    writeString(view, 0, 'RIFF');
    view.setUint32(4, bufferLength - 8, true);
    writeString(view, 8, 'WAVE');
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true);
    view.setUint16(32, numChannels * (bitDepth / 8), true);
    view.setUint16(34, bitDepth, true);
    writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);
    
    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const sample = Math.max(-1, Math.min(1, samples[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
    
    return new Blob([view], { type: 'audio/wav' });
  };

  const interleaveSamples = (buffer: AudioBuffer): Float32Array => {
    const channels = buffer.numberOfChannels;
    const length = buffer.length;
    const result = new Float32Array(length * channels);
    
    for (let channel = 0; channel < channels; channel++) {
      const channelData = buffer.getChannelData(channel);
      for (let i = 0; i < length; i++) {
        result[i * channels + channel] = channelData[i];
      }
    }
    return result;
  };

  const writeString = (view: DataView, offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // For audio files: Direct conversion preserving quality
  const convertAudioFile = async (file: File): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        
        // Preserve original sample rate
        const wavBlob = audioBufferToWav(audioBuffer);
        await audioContext.close();
        resolve(wavBlob);
        
      } catch (err) {
        reject(new Error('Could not convert audio file.'));
      }
    });
  };

  // For video files: Extract audio WITHOUT changing pitch
  const extractAudioFromVideo = async (file: File): Promise<Blob> => {
    return new Promise(async (resolve, reject) => {
      try {
        const video = document.createElement('video');
        const objectUrl = URL.createObjectURL(file);
        video.src = objectUrl;
        
        video.onloadedmetadata = async () => {
          try {
            // Create audio context
            const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            
            // Create media element source
            const source = audioContext.createMediaElementSource(video);
            const destination = audioContext.createMediaStreamDestination();
            source.connect(destination);
            
            // Create media recorder
            const mediaRecorder = new MediaRecorder(destination.stream);
            const chunks: BlobPart[] = [];
            
            mediaRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) {
                chunks.push(e.data);
              }
            };
            
            mediaRecorder.onstop = () => {
              const blob = new Blob(chunks, { type: 'audio/wav' });
              URL.revokeObjectURL(objectUrl);
              resolve(blob);
            };
            
            mediaRecorder.start();
            video.play();
            
            // Stop after video duration
            setTimeout(() => {
              mediaRecorder.stop();
              video.pause();
              source.disconnect();
              audioContext.close();
            }, (video.duration + 0.5) * 1000);
            
          } catch (err) {
            URL.revokeObjectURL(objectUrl);
            reject(err);
          }
        };
        
        video.onerror = () => {
          URL.revokeObjectURL(objectUrl);
          reject(new Error('Failed to load video'));
        };
        
      } catch (err) {
        reject(new Error('Could not extract audio from video.'));
      }
    });
  };

  const handleConvert = async () => {
    if (!selectedFile) return;
    
    setIsConverting(true);
    setConversionProgress(0);
    setError(null);
    
    try {
      const progressInterval = setInterval(() => {
        setConversionProgress(prev => Math.min(prev + 10, 90));
      }, 200);
      
      let blob: Blob;
      let outputFileName: string;
      const fileExt = selectedFile.name.split('.').pop()?.toLowerCase() || '';
      const isAudioFile = ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac'].includes(fileExt);
      
      if (isAudioFile) {
        // Audio to audio conversion
        blob = await convertAudioFile(selectedFile);
        outputFileName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) + '.wav';
      } else {
        // Video to audio extraction
        blob = await extractAudioFromVideo(selectedFile);
        outputFileName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.')) + '_audio.wav';
      }
      
      clearInterval(progressInterval);
      setConversionProgress(100);
      
      const url = URL.createObjectURL(blob);
      setResult({ name: outputFileName, url, blob });
      
      saveConversion({
        type: isAudioFile ? 'audio' : 'video',
        input_format: fileExt,
        output_format: 'wav',
        input_size: selectedFile.size,
        output_size: blob.size,
        status: 'completed',
        file_name: outputFileName
      }, blob);
      
      await saveToDevice(blob, outputFileName);
      
    } catch (err) {
      console.error('Conversion error:', err);
      setError(err instanceof Error ? err.message : 'Conversion failed. Try a different file format.');
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      <header className="space-y-2 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-2">
          <Zap className="w-3 h-3 text-purple-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Native Audio</span>
        </div>
        <h2 className="text-4xl font-extrabold tracking-tight">Media Master</h2>
        <p className="text-text-dim text-sm max-w-lg mx-auto">
          Convert audio files or extract audio from videos. Preserves original pitch and quality.
        </p>
      </header>

      {/* Conversion Type Toggle */}
      <div className="flex p-1 bg-surface border border-border rounded-2xl max-w-md mx-auto">
        <button
          onClick={() => {setConversionType('audio-to-audio'); setSelectedFile(null); setResult(null);}}
          className={cn(
            "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
            conversionType === 'audio-to-audio' ? "bg-accent-grad text-white shadow-lg" : "text-text-dim hover:text-white"
          )}
        >
          🎵 Audio to WAV
        </button>
        <button
          onClick={() => {setConversionType('video-to-audio'); setSelectedFile(null); setResult(null);}}
          className={cn(
            "flex-1 py-3 rounded-xl text-sm font-bold transition-all",
            conversionType === 'video-to-audio' ? "bg-accent-grad text-white shadow-lg" : "text-text-dim hover:text-white"
          )}
        >
          🎬 Video to Audio
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {!selectedFile ? (
            <label className="block border-2 border-dashed border-border rounded-[32px] p-16 text-center hover:border-purple-500 transition-all bg-surface cursor-pointer group">
              <input type="file" onChange={onFileSelect} className="hidden" 
                accept={conversionType === 'audio-to-audio' ? 'audio/*' : 'video/*'} 
              />
              <div className="flex flex-col items-center gap-6">
                <div className="p-6 bg-white/5 rounded-3xl group-hover:scale-110 transition-transform">
                  {conversionType === 'audio-to-audio' ? (
                    <Music className="w-12 h-12 text-purple-400" />
                  ) : (
                    <Video className="w-12 h-12 text-pink-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold">Select {conversionType === 'audio-to-audio' ? 'Audio' : 'Video'} file</h3>
                  <p className="text-sm text-text-dim mt-2">
                    {conversionType === 'audio-to-audio' 
                      ? 'MP3, WAV, OGG, M4A, FLAC, AAC → WAV (original pitch)'
                      : 'MP4, WebM, MOV, AVI → Extract audio as WAV (no pitch change)'}
                  </p>
                </div>
              </div>
            </label>
          ) : (
            <div className="space-y-6">
              <div className="p-6 bg-surface border border-border rounded-[24px] flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/5 rounded-xl">
                    {conversionType === 'audio-to-audio' ? <Music className="w-6 h-6 text-purple-400" /> : <Video className="w-6 h-6 text-pink-400" />}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm truncate max-w-[200px]">{selectedFile.name}</h4>
                    <p className="text-[10px] text-text-dim uppercase tracking-widest">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                {!isConverting && !result && (
                  <button onClick={() => setSelectedFile(null)} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-text-dim" />
                  </button>
                )}
              </div>

              <AnimatePresence>
                {isConverting && (
                  <motion.div className="p-8 bg-purple-500/5 border border-purple-500/20 rounded-[24px] space-y-6 text-center">
                    <div className="relative w-20 h-20 mx-auto">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/5" />
                        <circle cx="40" cy="40" r="36" fill="none" stroke="currentColor" strokeWidth="4" 
                          className="text-purple-500 transition-all duration-300"
                          strokeDasharray={2 * Math.PI * 36}
                          strokeDashoffset={2 * Math.PI * 36 * (1 - conversionProgress / 100)}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-mono font-bold">
                        {conversionProgress}%
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm font-bold animate-pulse">
                       <Loader2 className="w-4 h-4 animate-spin" />
                       Processing...
                    </div>
                  </motion.div>
                )}

                {result && (
                  <motion.div className="p-8 bg-green-500/5 border border-green-500/20 rounded-[24px] space-y-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-6 h-6 text-green-500" />
                        <h4 className="font-bold text-lg">Complete!</h4>
                      </div>
                      <button onClick={() => {setResult(null); setSelectedFile(null);}} className="text-xs font-bold text-text-dim hover:text-white uppercase tracking-widest transition-colors">
                         Start New
                      </button>
                    </div>
                    
                    <div className="bg-black/20 p-6 rounded-2xl space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">{result.name}</span>
                        <span className="text-xs text-text-dim">{(result.blob.size / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                      <audio src={result.url} controls className="w-full h-10 filter invert opacity-80" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 bg-surface border border-border rounded-[24px] space-y-6 sticky top-8">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-purple-400" />
              Output Config
            </h3>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-dim mb-3 block">Output Format</label>
              <div className="text-sm text-text-dim p-3 bg-white/5 rounded-xl text-center">
                WAV (Original Quality, Original Pitch)
              </div>
              <p className="text-[10px] text-text-dim mt-2 text-center">
                Preserves original sample rate - no pitch change
              </p>
            </div>

            <button
              disabled={!selectedFile || isConverting || !!result}
              onClick={handleConvert}
              className="w-full py-4 bg-accent-grad text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed"
            >
              {isConverting ? 'Converting...' : (conversionType === 'audio-to-audio' ? 'Convert to WAV' : 'Extract Audio')}
            </button>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

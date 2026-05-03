import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, File, X, CheckCircle2, AlertCircle, Download, Loader2, Video, Settings2 } from 'lucide-react';
import { extractAudioFromVideo } from '../../services/converters/audio';
import { saveConversion } from '../../utils/storage';
import { AUDIO_OUTPUT_FORMATS } from '../../utils/formats';

const BITRATES = ['64k', '128k', '192k', '256k', '320k'];
const SAMPLE_RATES = ['44100', '48000'];
const CHANNELS = ['1', '2'];

export default function VideoToAudio() {
  const [files, setFiles] = useState<File[]>([]);
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [outputFormat, setOutputFormat] = useState('mp3');
  const [bitrate, setBitrate] = useState('192k');
  const [sampleRate, setSampleRate] = useState('44100');
  const [channels, setChannels] = useState('2');
  const [results, setResults] = useState<{ name: string, blob: Blob, url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'video/*': ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.flv', '.wmv', '.mpg', '.mpeg'] }
  } as any);

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleVideoExtract = async () => {
    if (files.length === 0) return;
    setConverting(true);
    setError(null);
    const newResults: typeof results = [];

    try {
      for (const file of files) {
        const blob = await extractAudioFromVideo(file, outputFormat, (p) => setProgress(p), {
          bitrate,
          sampleRate,
          channels
        });
        const url = URL.createObjectURL(blob);
        const name = file.name.substring(0, file.name.lastIndexOf('.')) + '.' + outputFormat;
        newResults.push({ name, blob, url });

        // Save to history locally
        saveConversion({
          type: 'video',
          input_format: file.name.split('.').pop() || '',
          output_format: outputFormat,
          input_size: file.size,
          output_size: blob.size,
          status: 'completed',
          file_name: name
        });
      }
      setResults(newResults);
      setFiles([]);
    } catch (err) {
      setError('Extraction failed. The video format might be unsupported or FFmpeg is loading.');
      console.error(err);
    } finally {
      setConverting(false);
    }
  };

  return (
    <motion.div
      id="video-audio-container"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="max-w-6xl mx-auto space-y-8"
    >
      <header className="space-y-2">
        <h2 className="text-3xl font-light tracking-tight">Video to Audio</h2>
        <p className="text-text-dim text-sm">Extract high-quality audio tracks using xsukax-inspired high-performance engine.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 space-y-6">
          <div 
            id="video-drop-zone"
            {...getRootProps()} 
            className={cn(
              "border-2 border-dashed rounded-[24px] p-12 text-center transition-all cursor-pointer",
              isDragActive ? "border-purple-500 bg-purple-500/5" : "border-border hover:border-white/20 bg-surface"
            )}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-white/5 rounded-2xl">
                <Video className="w-8 h-8 text-text-dim" />
              </div>
              <div>
                <p className="text-lg font-medium">Click or drag video files here</p>
                <p className="text-sm text-text-dim max-w-md mx-auto">Supports MP4, MOV, AVI, MKV, WebM, FLV, WMV, MPEG</p>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {files.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-2"
              >
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex items-center gap-3">
                      <Video className="w-5 h-5 text-pink-400" />
                      <span className="text-sm font-medium truncate max-w-[200px]">{file.name}</span>
                      <span className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                    </div>
                    <button onClick={() => removeFile(idx)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                      <X className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {results.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                Extracted Audio
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {results.map((res, idx) => (
                  <div key={idx} className="p-4 bg-green-500/5 border border-green-500/20 rounded-xl flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{res.name}</span>
                    <div className="flex items-center gap-2">
                      <audio src={res.url} controls className="h-8 w-48" />
                      <a href={res.url} download={res.name} className="p-2 hover:bg-green-500/10 rounded-lg transition-colors">
                        <Download className="w-4 h-4 text-green-500" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="p-6 bg-surface border border-border rounded-[24px] space-y-6">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-purple-400" />
              Settings
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs text-text-dim font-bold uppercase tracking-widest">Output Format</label>
                <div className="grid grid-cols-2 gap-2">
                  {AUDIO_OUTPUT_FORMATS.map(f => (
                    <button
                      key={f.value}
                      onClick={() => setOutputFormat(f.value)}
                      className={cn(
                        "py-2 rounded-lg text-xs font-bold transition-all border",
                        outputFormat === f.value ? "border-purple-500 bg-purple-500/5 text-white" : "border-transparent bg-white/5 text-text-dim hover:bg-white/10"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs text-text-dim font-bold uppercase tracking-widest">Audio Bitrate</label>
                <div className="grid grid-cols-3 gap-1">
                  {BITRATES.map(b => (
                    <button
                      key={b}
                      onClick={() => setBitrate(b)}
                      className={cn(
                        "py-1.5 rounded-lg text-[10px] font-bold transition-all border",
                        bitrate === b ? "border-purple-500 bg-purple-500/5 text-white" : "border-transparent bg-white/5 text-text-dim"
                      )}
                    >
                      {b}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs text-text-dim font-bold uppercase tracking-widest text-[9px]">Sample Rate</label>
                  <select 
                    value={sampleRate}
                    onChange={(e) => setSampleRate(e.target.value)}
                    className="w-full bg-white/5 border border-border rounded-lg p-2 text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="44100">44.1 kHz</option>
                    <option value="48000">48 kHz</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-text-dim font-bold uppercase tracking-widest text-[9px]">Channels</label>
                  <select 
                    value={channels}
                    onChange={(e) => setChannels(e.target.value)}
                    className="w-full bg-white/5 border border-border rounded-lg p-2 text-xs focus:outline-none focus:border-purple-500"
                  >
                    <option value="1">Mono</option>
                    <option value="2">Stereo</option>
                  </select>
                </div>
              </div>
            </div>

            <button
              id="extract-audio-btn"
              disabled={files.length === 0 || converting}
              onClick={handleVideoExtract}
              className="w-full py-4 bg-accent-grad text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98]"
            >
              {converting ? (
                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Extracting... {Math.round(progress)}%
                  </div>
                </div>
              ) : (
                <>Extract {files.length > 1 ? `${files.length} Audios` : 'Audio'}</>
              )}
            </button>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-500 text-[11px]">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>

          <div className="p-4 bg-white/5 rounded-2xl border border-white/5 text-[10px] text-text-dim space-y-2">
            <p className="font-bold flex items-center gap-2">
              <CheckCircle2 className="w-3 h-3 text-purple-400" />
              Client-Side Processing
            </p>
            <p>Your video tracks are extracted directly in your browser using xsukax-compatible WASM engine. No data is sent to our servers.</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

import { cn } from '../../lib/utils';

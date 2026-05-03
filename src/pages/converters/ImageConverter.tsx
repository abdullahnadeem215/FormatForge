import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Upload, 
  File as FileIcon, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Loader2, 
  Settings2,
  Image as ImageIcon,
  Zap,
  Trash2,
  Maximize,
  Minimize
} from 'lucide-react';
import { convertImage, formatFileSize, getImageDimensions } from '../../utils/imageConversion';
import { isHeicFile, heicToJpeg } from '../../utils/heicSupport';
import { saveConversion } from '../../utils/storage';
import { cn } from '../../lib/utils';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

interface ConversionQueueItem {
  id: string;
  file: File;
  preview: string;
  status: 'pending' | 'converting' | 'completed' | 'failed';
  convertedBlob?: Blob;
  error?: string;
  originalSize: number;
  convertedSize?: number;
  name: string;
}

export default function ImageConverter() {
  const [files, setFiles] = useState<ConversionQueueItem[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [selectedFormat, setSelectedFormat] = useState<'jpeg' | 'png' | 'webp'>('png');
  const [quality, setQuality] = useState(85);
  const [enableResize, setEnableResize] = useState(false);
  const [resizeWidth, setResizeWidth] = useState<string>('');
  const [resizeHeight, setResizeHeight] = useState<string>('');
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [originalDimensions, setOriginalDimensions] = useState<{ width: number; height: number } | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Capacitor Filesystem save function
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
          title: 'Image Converted',
          text: 'Check out my converted image!',
          url: `file://${fileName}`
        });
      };
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save file. Please check storage permissions.');
    }
  };

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;
    
    const newFiles: ConversionQueueItem[] = [];
    const filesArray = Array.from(selectedFiles);
    
    for (let i = 0; i < filesArray.length; i++) {
      const file = filesArray[i];
      const previewUrl = URL.createObjectURL(file);
      
      if (newFiles.length === 0 && files.length === 0 && i === 0) {
        try {
          const dims = await getImageDimensions(file);
          setOriginalDimensions(dims);
          setResizeWidth(dims.width.toString());
          setResizeHeight(dims.height.toString());
        } catch (err) {
          console.error('Failed to get dimensions', err);
        }
      }
      
      newFiles.push({
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 10)}_${i}`,
        file,
        name: file.name,
        preview: previewUrl,
        status: 'pending',
        originalSize: file.size,
      });
    }
    
    setFiles(prev => [...prev, ...newFiles]);
  }, [files.length]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => {
      const filtered = prev.filter(f => f.id !== id);
      const removed = prev.find(f => f.id === id);
      if (removed) URL.revokeObjectURL(removed.preview);
      return filtered;
    });
  };

  const clearAll = () => {
    files.forEach(file => URL.revokeObjectURL(file.preview));
    setFiles([]);
    setOriginalDimensions(null);
    setResizeWidth('');
    setResizeHeight('');
  };

  const convertAll = async () => {
    if (files.length === 0 || isConverting) return;
    
    setIsConverting(true);
    setConversionProgress(0);
    
    const updatedFiles = [...files];
    let width = parseInt(resizeWidth);
    let height = parseInt(resizeHeight);

    for (let i = 0; i < updatedFiles.length; i++) {
        const item = updatedFiles[i];
        if (item.status === 'completed') continue;

        item.status = 'converting';
        setFiles([...updatedFiles]);

        try {
            const result = await convertImage(item.file, {
                format: selectedFormat,
                quality,
                width: enableResize ? (isNaN(width) ? undefined : width) : undefined,
                height: enableResize ? (isNaN(height) ? undefined : height) : undefined,
                maintainAspectRatio: lockAspectRatio
            });

            item.convertedBlob = result.blob;
            item.convertedSize = result.blob.size;
            item.status = 'completed';
            
            saveConversion({
                type: 'image',
                input_format: item.file.name.split('.').pop() || '',
                output_format: selectedFormat,
                input_size: item.originalSize,
                output_size: item.convertedBlob.size,
                status: 'completed',
                file_name: item.name.substring(0, item.name.lastIndexOf('.')) + '.' + selectedFormat
            }, item.convertedBlob);

        } catch (err) {
            item.status = 'failed';
            item.error = err instanceof Error ? err.message : 'Conversion failed';
        }

        setConversionProgress(((i + 1) / updatedFiles.length) * 100);
        setFiles([...updatedFiles]);
    }
    
    setIsConverting(false);
  };

  const downloadFile = async (item: ConversionQueueItem) => {
    if (!item.convertedBlob) return;
    const ext = selectedFormat === 'jpeg' ? 'jpg' : selectedFormat;
    const fileName = `${item.name.substring(0, item.name.lastIndexOf('.'))}.${ext}`;
    await saveToDevice(item.convertedBlob, fileName);
  };

  const downloadAllAsZip = async () => {
    const completed = files.filter(f => f.status === 'completed' && f.convertedBlob);
    if (completed.length === 0) return;

    const zip = new JSZip();
    completed.forEach(item => {
        const ext = selectedFormat === 'jpeg' ? 'jpg' : selectedFormat;
        const name = item.name.substring(0, item.name.lastIndexOf('.')) + '.' + ext;
        zip.file(name, item.convertedBlob!);
    });

    const content = await zip.generateAsync({ type: 'blob' });
    await saveToDevice(content, `converted_images_${Date.now()}.zip`);
  };

  const handleWidthChange = (val: string) => {
    setResizeWidth(val);
    if (lockAspectRatio && originalDimensions) {
        const w = parseInt(val);
        if (!isNaN(w) && w > 0) {
            const h = Math.round((w / originalDimensions.width) * originalDimensions.height);
            setResizeHeight(h.toString());
        }
    }
  };

  const handleHeightChange = (val: string) => {
    setResizeHeight(val);
    if (lockAspectRatio && originalDimensions) {
        const h = parseInt(val);
        if (!isNaN(h) && h > 0) {
            const w = Math.round((h / originalDimensions.height) * originalDimensions.width);
            setResizeWidth(w.toString());
        }
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-6xl mx-auto space-y-8"
    >
      <header className="space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full mb-2">
          <Zap className="w-3 h-3 text-blue-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Offline Core</span>
        </div>
        <h2 className="text-4xl font-extrabold tracking-tight">Image Master</h2>
        <p className="text-text-dim text-sm">Convert, resize, and optimize images. 100% private client-side processing.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          {/* Dropzone */}
          <div 
            onDrop={onDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-[32px] p-16 text-center transition-all cursor-pointer hover:border-blue-500 bg-surface group"
          >
            <input type="file" ref={fileInputRef} onChange={(e) => handleFileSelect(e.target.files)} multiple className="hidden" accept="image/*" />
            <div className="flex flex-col items-center gap-6">
              <div className="p-6 bg-white/5 rounded-3xl group-hover:scale-110 transition-transform">
                <ImageIcon className="w-12 h-12 text-blue-400" />
              </div>
              <div>
                <h3 className="text-xl font-bold italic tracking-tight uppercase">Upload Assets</h3>
                <p className="text-sm text-text-dim mt-2 tracking-tighter">PNG, JPEG, WEBP, HEIC supported</p>
              </div>
            </div>
          </div>

          {/* Queue */}
          <AnimatePresence>
            {files.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between px-2">
                  <h4 className="text-xs font-bold uppercase tracking-[0.2em] text-text-dim">Queue ({files.length})</h4>
                  <button onClick={clearAll} className="text-[10px] font-bold text-red-500 hover:opacity-80 transition-opacity">CLEAR ALL</button>
                </div>
                <div className="grid grid-cols-1 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {files.map((item) => (
                    <motion.div 
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/[0.08] transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <img src={item.preview} className="w-12 h-12 object-cover rounded-xl" alt="" />
                        <div>
                          <p className="text-sm font-bold truncate max-w-[200px]">{item.name}</p>
                          <p className="text-[9px] text-text-dim font-bold tracking-widest uppercase">
                            {formatFileSize(item.originalSize)}
                            {item.convertedSize && ` → ${formatFileSize(item.convertedSize)}`}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {item.status === 'converting' && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                        {item.status === 'completed' && (
                          <button 
                            onClick={() => downloadFile(item)} 
                            className="flex items-center gap-2 px-3 py-1.5 bg-green-500 text-black text-[10px] font-bold rounded-lg hover:bg-green-400 transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" />
                            SAVE
                          </button>
                        )}
                        {item.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                        {!isConverting && (
                          <button onClick={() => removeFile(item.id)} className="p-1.5 hover:bg-red-500/10 hover:text-red-500 text-text-dim rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Settings Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="p-6 bg-surface border border-border rounded-[24px] space-y-8 sticky top-8 shadow-2xl shadow-black/20">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-blue-400" />
              Processing Config
            </h3>

            <div className="space-y-6">
              {/* Output Format */}
              <div className="space-y-3">
                <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-dim">Export Format</label>
                <div className="grid grid-cols-3 gap-2">
                  {['png', 'jpeg', 'webp'].map(f => (
                    <button
                      key={f}
                      onClick={() => setSelectedFormat(f as any)}
                      className={cn(
                        "py-3 rounded-xl text-xs font-bold transition-all border",
                        selectedFormat === f ? "border-blue-500 bg-blue-500/10 text-white" : "border-transparent bg-white/5 text-text-dim hover:bg-white/10"
                      )}
                    >
                      {f.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                   <label className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-dim">Compression</label>
                   <span className="text-xs font-bold text-white">{quality}%</span>
                </div>
                <input 
                  type="range" min="1" max="100" value={quality}
                  onChange={(e) => setQuality(parseInt(e.target.value))}
                  className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              {/* Resize Toggle */}
              <div className="space-y-4 pt-4 border-t border-white/5">
                <label className="flex items-center justify-between cursor-pointer group">
                   <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-widest">Resize Asset</span>
                   <div className="relative inline-flex items-center">
                      <input type="checkbox" checked={enableResize} onChange={(e) => setEnableResize(e.target.checked)} className="sr-only peer" />
                      <div className="w-10 h-5 bg-white/10 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                   </div>
                </label>

                {enableResize && (
                   <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-4 overflow-hidden"
                   >
                     <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                           <label className="text-[9px] font-bold text-text-dim uppercase tracking-widest">Width (px)</label>
                           <input 
                            type="number" value={resizeWidth} onChange={(e) => handleWidthChange(e.target.value)}
                            className="w-full bg-white/5 border border-border rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                            placeholder="Auto"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[9px] font-bold text-text-dim uppercase tracking-widest">Height (px)</label>
                           <input 
                            type="number" value={resizeHeight} onChange={(e) => handleHeightChange(e.target.value)}
                            className="w-full bg-white/5 border border-border rounded-xl p-3 text-sm focus:border-blue-500 outline-none"
                            placeholder="Auto"
                           />
                        </div>
                     </div>
                     <button 
                        onClick={() => setLockAspectRatio(!lockAspectRatio)}
                        className={cn(
                            "flex items-center justify-center gap-2 w-full py-2 text-[10px] font-bold rounded-lg transition-colors border",
                            lockAspectRatio ? "bg-blue-500/10 border-blue-500/20 text-blue-400" : "bg-white/5 border-transparent text-text-dim"
                        )}
                     >
                        {lockAspectRatio ? <Minimize className="w-3 h-3" /> : <Maximize className="w-3 h-3" />}
                        {lockAspectRatio ? "RATIO LOCKED" : "RATIO UNLOCKED"}
                     </button>
                   </motion.div>
                )}
              </div>
            </div>

            <div className="space-y-3 pt-4 border-t border-white/5">
                <button
                    disabled={files.length === 0 || isConverting}
                    onClick={convertAll}
                    className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl shadow-xl shadow-blue-500/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:hover:scale-100 disabled:cursor-not-allowed"
                >
                    {isConverting ? (
                        <div className="flex flex-col items-center gap-2">
                            <span className="text-xs uppercase tracking-widest">Processing... {Math.round(conversionProgress)}%</span>
                            <div className="w-full bg-black/20 h-1 rounded-full px-4">
                                <div className="bg-white h-full rounded-full transition-all duration-300" style={{ width: `${conversionProgress}%` }} />
                            </div>
                        </div>
                    ) : (
                        `PROCEED BATCH (${files.length})`
                    )}
                </button>

                {files.length === 1 && files[0].status === 'completed' && (
                    <button 
                        onClick={() => downloadFile(files[0])}
                        className="w-full py-4 bg-green-500 text-black font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-green-400 transition-all shadow-lg shadow-green-500/20 active:scale-[0.98]"
                    >
                        <Download className="w-5 h-5" /> DOWNLOAD {selectedFormat.toUpperCase()}
                    </button>
                )}

                {files.length > 1 && files.some(f => f.status === 'completed') && (
                    <button 
                        onClick={downloadAllAsZip}
                        className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-white/10 transition-colors"
                    >
                        <Download className="w-4 h-4" /> BUNDLE AS ZIP
                    </button>
                )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

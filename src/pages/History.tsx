// src/pages/History.tsx
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { 
  File, 
  Image as ImageIcon, 
  Music, 
  Video, 
  Trash2, 
  Download, 
  Clock,
  Search,
  AlertCircle
} from 'lucide-react';
import { useStorage } from '../hooks/useStorage';
import { deleteConversion } from '../utils/storage';
import { getFileBlob } from '../utils/db';
import { saveAs } from 'file-saver';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Capacitor } from '@capacitor/core';

export default function HistoryPage() {
  const { history, refreshHistory } = useStorage();
  const [searchTerm, setSearchTerm] = useState('');
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    deleteConversion(id);
    refreshHistory();
  };

  const saveToDevice = async (blob: Blob, fileName: string) => {
    try {
      if (Capacitor.getPlatform() === 'web') {
        saveAs(blob, fileName);
        return;
      }

      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          
          await Filesystem.writeFile({
            path: fileName,
            data: base64,
            directory: Directory.Documents
          });
          
          alert(`✅ File successfully saved to your Documents folder as:\n${fileName}`);

        } catch (err) {
          console.error('Filesystem error:', err);
          alert('Failed to save file. Please check storage permissions.');
        }
      };
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to process file for downloading.');
    }
  };

  const handleDownload = async (conv: any) => {
    try {
      setDownloadError(null);
      const blob = await getFileBlob(conv.id);
      if (blob) {
        await saveToDevice(blob, conv.file_name);
      } else {
        setDownloadError(`File "${conv.file_name}" is no longer in local cache.`);
        setTimeout(() => setDownloadError(null), 3000);
      }
    } catch (err) {
      console.error('Failed to download from history:', err);
      setDownloadError("Failed to retrieve file from local storage.");
      setTimeout(() => setDownloadError(null), 3000);
    }
  };

  const filtered = history.filter(c => 
    c.file_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon className="w-5 h-5 text-blue-400" />;
      case 'audio': return <Music className="w-5 h-5 text-purple-400" />;
      case 'video': return <Video className="w-5 h-5 text-pink-400" />;
      default: return <File className="w-5 h-5 text-gray-400" />;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight">Conversion History</h1>
          <p className="text-text-dim text-sm">View and manage your previous file conversions.</p>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-dim" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 bg-surface border border-border rounded-xl focus:outline-none focus:border-purple-500/50 transition-colors w-full md:w-64 text-sm"
          />
        </div>
      </header>

      <AnimatePresence>
        {downloadError && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-500 text-sm overflow-hidden"
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {downloadError}
          </motion.div>
        )}
      </AnimatePresence>

      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-surface rounded-[24px] border border-border">
          <div className="p-4 bg-white/5 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <Clock className="w-8 h-8 text-text-dim/30" />
          </div>
          <h3 className="text-xl font-semibold">No history found</h3>
          <p className="text-text-dim text-sm">Your converted files will appear here locally.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filtered.map((conv) => (
            <motion.div
              layout
              key={conv.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="group p-4 bg-surface border border-border rounded-2xl flex items-center gap-4 transition-all"
            >
              <div className="p-3 bg-white/5 rounded-xl">
                {getIcon(conv.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold truncate text-sm">{conv.file_name}</h4>
                <div className="flex items-center gap-3 text-[10px] text-text-dim uppercase tracking-wider font-bold">
                   <span>{conv.input_format} → {conv.output_format}</span>
                   <span>•</span>
                   <span>{conv.created_at ? format(new Date(conv.created_at), 'MMM d, h:mm a') : 'Just now'}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={() => handleDownload(conv)}
                  className="p-2 rounded-lg text-gray-400 transition-colors"
                  title="Download File"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => handleDelete(conv.id)}
                  className="p-2 rounded-lg text-gray-400 transition-colors hover:text-red-400 hover:bg-red-400/10"
                  title="Delete from History"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

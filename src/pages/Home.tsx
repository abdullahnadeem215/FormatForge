import React from 'react';
import { motion } from 'motion/react';
import { 
  Image as ImageIcon, 
  Music, 
  Zap,
  Mic,
  Wand2,
  QrCode,
  FileText,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const converters = [
  {
    id: 'image',
    title: 'Image Converter',
    description: 'Convert between JPEG, PNG, WebP. Offline processing.',
    icon: <ImageIcon className="w-8 h-8" />,
    color: 'from-blue-500 to-cyan-500',
    path: '/convert/image'
  },
  {
    id: 'media',                     // merged audio & video-to-audio
    title: 'Media Converter',
    description: 'Convert audio or extract audio from video into (wav-format). Offline.',
    icon: <Music className="w-8 h-8" />,
    color: 'from-purple-500 to-indigo-500',
    path: '/convert/video-to-audio'         // uses existing audio converter (which also supports video import)
  },
  {
    id: 'text-to-speech',
    title: 'Text to Speech',
    description: 'Convert any text to speech – 100% offline.',
    icon: <Mic className="w-8 h-8" />,
    color: 'from-emerald-500 to-teal-500',
    path: '/text-to-speech'
  },
  {
    id: 'bg-remover',
    title: 'Background Remover',
    description: 'Fast AI background removal (ML Kit) – offline after first use.',
    icon: <Wand2 className="w-8 h-8" />,
    color: 'from-cyan-500 to-blue-500',
    path: '/bg-remover'
  },
  {
    id: 'qr-code',
    title: 'QR Code Studio',
    description: 'Generate & scan QR codes. URLs, WiFi, contacts — offline.',
    icon: <QrCode className="w-8 h-8" />,
    color: 'from-violet-500 to-purple-500',
    path: '/qr-code'
  },
  {
    id: 'pdf-tools',
    title: 'PDF Tools',
    description: 'Merge multiple PDFs or split pages. 100% offline.',
    icon: <FileText className="w-8 h-8" />,
    color: 'from-red-500 to-orange-500',
    path: '/pdf-tools'
  }
];

export default function Home() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-10"
    >
      <header className="flex justify-between items-start">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 flex items-center justify-center bg-accent-grad rounded-lg">
              <Zap size={16} className="text-white" fill="currentColor" />
            </div>
            <h2 className="text-sm font-black italic tracking-tighter text-white">FORMATFORGE PRO</h2>
          </div>
          <h1 className="text-4xl font-light tracking-tight">
            What are we <span className="text-white font-medium italic">forging</span> today?
          </h1>
          <p className="text-text-dim text-sm mt-3 max-w-md leading-relaxed">
            Revolutionary offline media conversion powered by modern tech. 
            Choose a tool below to begin.
          </p>
        </div>
        <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-surface border border-border rounded-full text-xs">
          <div className="w-6 h-6 rounded-full bg-accent-grad" />
          <span>Pro Member</span>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {converters.map((converter, idx) => (
          <Link key={converter.id} to={converter.path}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="group relative p-8 bg-surface border border-border rounded-[24px] overflow-hidden cursor-pointer hover:border-purple-500/40 transition-colors"
            >
              {converter.id === 'text-to-speech' || converter.id === 'bg-remover' ? (
                <span className="absolute top-6 right-6 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                  NEW
                </span>
              ) : (
                <span className="absolute top-6 right-6 px-2.5 py-1 bg-text-dim/5 border border-text-dim/20 rounded-md text-[10px] font-bold text-text-dim uppercase tracking-wider">
                  Offline
                </span>
              )}
              
              <div className="relative z-10 space-y-6">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center bg-white/5 text-2xl">
                  {converter.icon}
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">{converter.title}</h3>
                  <p className="text-text-dim text-xs leading-relaxed">
                    {converter.description}
                  </p>
                </div>

                <button className="w-full py-2.5 bg-accent-grad border-none rounded-lg text-white font-semibold text-sm cursor-pointer">
                  Open Converter
                </button>
              </div>
            </motion.div>
          </Link>
        ))}
      </div>
    </motion.div>
  );
}

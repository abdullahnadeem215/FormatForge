import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  QrCode, Download, Upload, Copy, Check,
  Camera, Link, Type, Wifi, Phone, Mail, Trash2, ScanLine, X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

type Tab = 'generate' | 'scan';
type QRType = 'text' | 'url' | 'wifi' | 'phone' | 'email';

const QR_TYPES = [
  { id: 'url' as QRType,   label: 'URL',   icon: <Link  className="w-4 h-4" />, placeholder: 'https://example.com' },
  { id: 'text' as QRType,  label: 'Text',  icon: <Type  className="w-4 h-4" />, placeholder: 'Enter any text...' },
  { id: 'wifi' as QRType,  label: 'WiFi',  icon: <Wifi  className="w-4 h-4" />, placeholder: 'Network name (SSID)' },
  { id: 'phone' as QRType, label: 'Phone', icon: <Phone className="w-4 h-4" />, placeholder: '+92 300 0000000' },
  { id: 'email' as QRType, label: 'Email', icon: <Mail  className="w-4 h-4" />, placeholder: 'email@example.com' },
];

const COLORS = ['#ffffff','#818cf8','#c084fc','#f472b6','#34d399','#38bdf8','#fb923c','#f87171'];

export default function QRCodePage() {
  const [tab, setTab] = useState<Tab>('generate');
  const [qrType, setQrType]         = useState<QRType>('url');
  const [inputValue, setInputValue] = useState('');
  const [wifiPass, setWifiPass]     = useState('');
  const [wifiSec, setWifiSec]       = useState('WPA');
  const [fgColor, setFgColor]       = useState('#ffffff');
  const [bgColor]                   = useState('#08080A');
  const [qrSize, setQrSize]         = useState(280);
  const [qrDataUrl, setQrDataUrl]   = useState<string | null>(null);
  const [copied, setCopied]         = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError]     = useState('');
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanning, setScanning]     = useState(false);
  const [scanError, setScanError]   = useState('');
  const [scanCopied, setScanCopied] = useState(false);
  
  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' } | null>(null);
  
  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const streamRef    = useRef<MediaStream | null>(null);
  const rafRef       = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-dismiss notification
  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'info' | 'error' = 'info') => {
    setNotification({ message, type });
  };

  const buildQrString = (): string => {
    switch (qrType) {
      case 'phone': return `tel:${inputValue}`;
      case 'email': return `mailto:${inputValue}`;
      case 'wifi':  return `WIFI:T:${wifiSec};S:${inputValue};P:${wifiPass};;`;
      default:      return inputValue;
    }
  };

  const generateQR = async () => {
    if (!inputValue.trim()) { setGenError('Please enter some content first!'); return; }
    setGenError(''); setGenerating(true);
    try {
      const dataUrl = await QRCode.toDataURL(buildQrString(), {
        width: qrSize, margin: 2,
        color: { dark: fgColor, light: bgColor },
        errorCorrectionLevel: 'H',
      });
      setQrDataUrl(dataUrl);
    } catch { setGenError('Failed to generate QR. Please try again.'); }
    setGenerating(false);
  };

  // ✅ MOBILE-FRIENDLY DOWNLOAD (works on iOS/Android + shows notification)
  const downloadQR = async () => {
    if (!qrDataUrl) {
      showNotification('No QR code to download', 'error');
      return;
    }

    try {
      // Convert data URL to blob
      const res = await fetch(qrDataUrl);
      const blob = await res.blob();
      const fileName = `formatforge-qr-${Date.now()}.png`;

      // 1. Use Web Share API on mobile (shares to Files / Photos / etc.)
      if (navigator.share && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        await navigator.share({
          title: 'QR Code',
          files: [new File([blob], fileName, { type: 'image/png' })],
        });
        showNotification('QR code shared successfully ✓', 'info');
        return;
      }

      // 2. Fallback: create object URL and trigger download (works on desktop & some mobile browsers)
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showNotification('QR code saved to your Downloads folder 📁', 'info');
    } catch (err) {
      console.error('Download failed:', err);
      showNotification('Could not save automatically. Try long-pressing the QR code image.', 'error');
    }
  };

  const copyQR = async () => {
    if (!qrDataUrl) return;
    try {
      const blob = await (await fetch(qrDataUrl)).blob();
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true); 
      showNotification('QR code copied to clipboard!', 'info');
      setTimeout(() => setCopied(false), 2000);
    } catch { 
      setCopied(false);
      showNotification('Failed to copy image', 'error');
    }
  };

  const resetGen = () => { setQrDataUrl(null); setInputValue(''); setGenError(''); };

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setScanning(false);
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  const scanFrame = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      rafRef.current = requestAnimationFrame(scanFrame); return;
    }
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(video, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);
    if (code) { setScanResult(code.data); stopCamera(); showNotification('QR code detected!', 'info'); return; }
    rafRef.current = requestAnimationFrame(scanFrame);
  }, [stopCamera]);

  const startCamera = async () => {
    setScanError(''); setScanResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setScanning(true);
      rafRef.current = requestAnimationFrame(scanFrame);
    } catch { setScanError('Camera access denied. Please allow permission.'); }
  };

  const handleScanFile = async (file: File) => {
    setScanError(''); setScanResult(null);
    try {
      const img = new Image();
      img.src = URL.createObjectURL(file);
      await new Promise(r => { img.onload = r; });
      const canvas = document.createElement('canvas');
      canvas.width = img.width; canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      if (code) { setScanResult(code.data); showNotification('QR code scanned successfully!', 'info'); return; }
      setScanError('No QR code found in this image.');
    } catch { setScanError('Failed to scan the image.'); }
  };

  const copyScanResult = async () => {
    if (!scanResult) return;
    await navigator.clipboard.writeText(scanResult);
    setScanCopied(true); 
    showNotification('Text copied to clipboard!', 'info');
    setTimeout(() => setScanCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="space-y-8 relative">
      {/* Toast Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={cn(
              "fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg backdrop-blur-md",
              notification.type === 'error' ? "bg-red-500/90 text-white" : "bg-emerald-500/90 text-white"
            )}
          >
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5">
            <QrCode className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">QR Code Studio</h1>
            <p className="text-text-dim text-xs">Generate & scan QR codes. 100% offline.</p>
          </div>
          <span className="ml-auto px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[10px] font-bold text-emerald-400 uppercase tracking-wider">NEW</span>
        </div>
      </header>

      <div className="flex gap-2 p-1 bg-surface border border-border rounded-xl w-fit">
        {(['generate', 'scan'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
              tab === t ? 'bg-accent-grad text-white shadow-lg' : 'text-text-dim hover:text-white'
            )}
          >{t === 'generate' ? 'Generate' : 'Scan'}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'generate' && (
          <motion.div key="generate" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
            <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">QR Type</p>
              <div className="flex flex-wrap gap-2">
                {QR_TYPES.map(qt => (
                  <button key={qt.id} onClick={() => { setQrType(qt.id); setInputValue(''); setQrDataUrl(null); }}
                    className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all',
                      qrType === qt.id ? 'border-purple-500/60 text-white bg-purple-500/10' : 'border-border text-text-dim hover:text-white hover:border-white/20'
                    )}
                  >{qt.icon} {qt.label}</button>
                ))}
              </div>
            </div>

            <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Content</p>
              <input type="text" value={inputValue} onChange={e => { setInputValue(e.target.value); setQrDataUrl(null); }}
                placeholder={QR_TYPES.find(q => q.id === qrType)?.placeholder}
                className="w-full bg-white/5 border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-text-dim focus:outline-none focus:border-purple-500/50 transition-colors"
              />
              {qrType === 'wifi' && (
                <div className="flex gap-3">
                  <input type="text" value={wifiPass} onChange={e => setWifiPass(e.target.value)} placeholder="Password"
                    className="flex-1 bg-white/5 border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-text-dim focus:outline-none focus:border-purple-500/50 transition-colors"
                  />
                  <select value={wifiSec} onChange={e => setWifiSec(e.target.value)} className="bg-white/5 border border-border rounded-xl px-3 py-3 text-sm text-white focus:outline-none">
                    <option value="WPA">WPA</option>
                    <option value="WEP">WEP</option>
                    <option value="nopass">Open</option>
                  </select>
                </div>
              )}
              {genError && <p className="text-red-400 text-xs">{genError}</p>}
            </div>

            <div className="p-6 bg-surface border border-border rounded-[24px] space-y-5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Processing Config</p>
              <div>
                <p className="text-[10px] text-text-dim uppercase tracking-wider mb-2">QR Color</p>
                <div className="flex gap-2 flex-wrap">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setFgColor(c)} style={{ backgroundColor: c }}
                      className={cn('w-8 h-8 rounded-lg border-2 transition-all', fgColor === c ? 'border-purple-400 scale-110' : 'border-transparent')}
                    />
                  ))}
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <p className="text-[10px] text-text-dim uppercase tracking-wider">Size</p>
                  <p className="text-[10px] text-purple-400 font-bold">{qrSize}px</p>
                </div>
                <input type="range" min={128} max={512} step={16} value={qrSize}
                  onChange={e => { setQrSize(+e.target.value); setQrDataUrl(null); }} className="w-full accent-purple-400"
                />
              </div>
            </div>

            {!qrDataUrl ? (
              <button onClick={generateQR} disabled={generating}
                className="w-full py-3.5 bg-accent-grad rounded-xl text-white font-bold text-sm tracking-wide disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {generating ? <><span className="animate-spin inline-block">↻</span> Generating...</> : <><QrCode className="w-4 h-4" /> Generate QR Code</>}
              </button>
            ) : (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-6 bg-surface border border-border rounded-[24px] space-y-5">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Your QR Code</p>
                  <button onClick={resetGen} className="text-text-dim hover:text-white transition-colors"><X className="w-4 h-4" /></button>
                </div>
                <div className="flex justify-center">
                  <div className="p-4 rounded-2xl" style={{ backgroundColor: bgColor }}>
                    <img src={qrDataUrl} alt="QR Code" className="rounded-xl" style={{ width: Math.min(qrSize, 260), height: Math.min(qrSize, 260) }} />
                  </div>
                </div>
                {/* Mobile hint */}
                <p className="text-center text-[10px] text-text-dim">💡 Long-press the QR code to save image</p>
                <div className="flex gap-3">
                  <button onClick={downloadQR} className="flex-1 py-2.5 bg-accent-grad rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" /> Save / Share
                  </button>
                  <button onClick={copyQR} className="px-4 py-2.5 bg-white/5 border border-border rounded-xl text-white text-sm flex items-center gap-2 hover:border-white/20 transition-colors">
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {tab === 'scan' && (
          <motion.div key="scan" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">
            <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Camera Scanner</p>
              <div className="relative w-full aspect-square max-w-sm mx-auto bg-black/40 rounded-2xl overflow-hidden border border-border">
                <video ref={videoRef} className={cn('w-full h-full object-cover', !scanning && 'hidden')} playsInline muted />
                <canvas ref={canvasRef} className="hidden" />
                {!scanning && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-text-dim">
                    <ScanLine className="w-12 h-12 opacity-30" />
                    <p className="text-xs">Camera is off</p>
                  </div>
                )}
                {scanning && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-48 h-48 border-2 border-purple-400 rounded-2xl relative">
                      <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-purple-400 rounded-tl-lg" />
                      <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-purple-400 rounded-tr-lg" />
                      <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-purple-400 rounded-bl-lg" />
                      <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-purple-400 rounded-br-lg" />
                      <motion.div animate={{ y: [0, 176, 0] }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        className="absolute left-1 right-1 h-0.5 bg-purple-400 shadow-[0_0_8px_#c084fc]"
                      />
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                {!scanning ? (
                  <button onClick={startCamera} className="flex-1 py-2.5 bg-accent-grad rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2">
                    <Camera className="w-4 h-4" /> Open Camera
                  </button>
                ) : (
                  <button onClick={stopCamera} className="flex-1 py-2.5 bg-white/5 border border-border rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 hover:border-red-500/40 transition-colors">
                    <X className="w-4 h-4" /> Stop Camera
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Scan from Image</p>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleScanFile(e.target.files[0])} />
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-border rounded-xl flex flex-col items-center gap-3 text-text-dim hover:border-purple-500/40 hover:text-white transition-all"
              >
                <Upload className="w-8 h-8" />
                <span className="text-xs font-semibold uppercase tracking-wider">Upload QR Image</span>
                <span className="text-[10px]">PNG, JPG, WEBP supported</span>
              </button>
            </div>

            {scanError && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">{scanError}</div>}

            <AnimatePresence>
              {scanResult && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                  className="p-6 bg-surface border border-emerald-500/20 rounded-[24px] space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">QR Code Detected!</p>
                    </div>
                    <button onClick={() => setScanResult(null)} className="text-text-dim hover:text-white"><Trash2 className="w-4 h-4" /></button>
                  </div>
                  <p className="text-sm text-white/90 bg-white/5 rounded-xl p-4 break-all font-mono leading-relaxed">{scanResult}</p>
                  <div className="flex gap-3">
                    {scanResult.startsWith('http') && (
                      <a href={scanResult} target="_blank" rel="noopener noreferrer"
                        className="flex-1 py-2.5 bg-accent-grad rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"
                      >
                        <Link className="w-4 h-4" /> Open Link
                      </a>
                    )}
                    <button onClick={copyScanResult}
                      className="flex-1 py-2.5 bg-white/5 border border-border rounded-xl text-white text-sm flex items-center justify-center gap-2 hover:border-white/20 transition-colors"
                    >
                      {scanCopied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                      {scanCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

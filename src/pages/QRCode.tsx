import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  QrCode, Download, Upload, Copy, Check,
  Camera, Link, Type, Wifi, Phone, Mail, Trash2, ScanLine, X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { downloadBlob } from '../utils/download';

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
  const [qrType, setQrType] = useState<QRType>('url');
  const [inputValue, setInputValue] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [wifiSec, setWifiSec] = useState('WPA');
  const [fgColor, setFgColor] = useState('#ffffff');
  const [bgColor] = useState('#08080A');
  const [qrSize, setQrSize] = useState(280);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState('');
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanCopied, setScanCopied] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' } | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
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

  const saveQr = async () => {
    if (!qrDataUrl) {
      showNotification('No QR code to save', 'error');
      return;
    }
    const blob = await fetch(qrDataUrl).then(r => r.blob());
    await downloadBlob(blob, `qr-code-${Date.now()}.png`, showNotification);
  };

  const copyImage = async () => {
    if (!qrDataUrl) return;
    try {
      const blob = await fetch(qrDataUrl).then(r => r.blob());
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      setCopied(true);
      showNotification('QR image copied to clipboard', 'info');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showNotification('Copy failed. Try long-press instead.', 'error');
      setCopied(false);
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
    const video = videoRef.current;
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
    } catch { setScanError('Camera access denied.'); }
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
      if (code) { setScanResult(code.data); showNotification('QR code scanned!', 'info'); return; }
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
    <motion.div className="space-y-8 relative">
      <AnimatePresence>
        {notification && (
          <motion.div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl text-sm font-medium shadow-lg backdrop-blur-md bg-emerald-500/90 text-white">
            {notification.message}
          </motion.div>
        )}
      </AnimatePresence>

      <header>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center"><QrCode className="w-5 h-5" /></div>
          <div><h1 className="text-2xl font-bold">QR Code Studio</h1><p className="text-text-dim text-xs">Generate & scan QR codes</p></div>
        </div>
      </header>

      <div className="flex gap-2 p-1 bg-surface border border-border rounded-xl w-fit">
        {(['generate', 'scan'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={cn('px-5 py-2 rounded-lg text-sm font-semibold capitalize', tab === t ? 'bg-accent-grad text-white' : 'text-text-dim hover:text-white')}>
            {t === 'generate' ? 'Generate' : 'Scan'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'generate' && (
          <motion.div key="generate" className="space-y-5">
            <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
              <p className="text-[10px] font-bold uppercase">QR Type</p>
              <div className="flex flex-wrap gap-2">
                {QR_TYPES.map(qt => (
                  <button key={qt.id} onClick={() => { setQrType(qt.id); setInputValue(''); setQrDataUrl(null); }}
                    className={cn('flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold', qrType === qt.id ? 'border-purple-500 bg-purple-500/10 text-white' : 'border-border text-text-dim hover:text-white')}>
                    {qt.icon} {qt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
              <p className="text-[10px] font-bold uppercase">Content</p>
              <input type="text" value={inputValue} onChange={e => { setInputValue(e.target.value); setQrDataUrl(null); }}
                placeholder={QR_TYPES.find(q => q.id === qrType)?.placeholder}
                className="w-full bg-white/5 border border-border rounded-xl px-4 py-3 text-sm" />
              {qrType === 'wifi' && (
                <div className="flex flex-wrap gap-3">
                  <input type="text" value={wifiPass} onChange={e => setWifiPass(e.target.value)} placeholder="Password" className="flex-1 min-w-[120px] bg-white/5 border border-border rounded-xl px-4 py-3 text-sm" />
                  <select value={wifiSec} onChange={e => setWifiSec(e.target.value)} className="flex-1 min-w-[100px] bg-white/5 border border-border rounded-xl px-4 py-3 text-sm">
                    <option>WPA</option><option>WEP</option><option>nopass</option>
                  </select>
                </div>
              )}
              {genError && <p className="text-red-400 text-xs">{genError}</p>}
            </div>

            <div className="p-6 bg-surface border border-border rounded-[24px] space-y-5">
              <p className="text-[10px] font-bold uppercase">Processing Config</p>
              <div><p className="text-[10px] text-text-dim">QR Color</p><div className="flex gap-2 flex-wrap">{COLORS.map(c => (<button key={c} onClick={() => setFgColor(c)} style={{backgroundColor: c}} className={cn('w-8 h-8 rounded-lg border-2', fgColor === c ? 'border-purple-400 scale-110' : 'border-transparent')} />))}</div></div>
              <div><div className="flex justify-between"><span className="text-[10px] text-text-dim">Size</span><span className="text-[10px] text-purple-400">{qrSize}px</span></div><input type="range" min={128} max={512} step={16} value={qrSize} onChange={e => { setQrSize(+e.target.value); setQrDataUrl(null); }} className="w-full accent-purple-400" /></div>
            </div>

            {!qrDataUrl ? (
              <button onClick={generateQR} disabled={generating} className="w-full py-3.5 bg-accent-grad rounded-xl text-white font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {generating ? <><span className="animate-spin">↻</span> Generating...</> : <><QrCode className="w-4 h-4" /> Generate QR Code</>}
              </button>
            ) : (
              <motion.div className="p-6 bg-surface border border-border rounded-[24px] space-y-5">
                <div className="flex justify-between"><p className="text-[10px] font-bold uppercase">Your QR Code</p><button onClick={resetGen}><X className="w-4 h-4" /></button></div>
                <div className="flex justify-center"><div className="p-4 rounded-2xl" style={{backgroundColor: bgColor}}><img src={qrDataUrl} alt="QR" style={{width: Math.min(qrSize,260), height: Math.min(qrSize,260)}} /></div></div>
                <p className="text-center text-[10px] text-text-dim">💡 Long-press the QR code → "Save Image"</p>
                <div className="flex gap-3">
                  <button onClick={saveQr} className="flex-1 py-2.5 bg-accent-grad rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2"><Download className="w-4 h-4" /> Save</button>
                  <button onClick={copyImage} className="px-4 py-2.5 bg-white/5 border border-border rounded-xl text-white text-sm flex items-center gap-2">{copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}{copied ? 'Copied!' : 'Copy Image'}</button>
                </div>
              </motion.div>
            )}
          </motion.div>
        )}

        {tab === 'scan' && (
          <motion.div key="scan" className="space-y-5">
            <div className="p-6 bg-surface border border-border rounded-[24px]">
              <p className="text-[10px] font-bold uppercase mb-4">Camera Scanner</p>
              <div className="relative w-full aspect-square max-w-sm mx-auto bg-black/40 rounded-2xl overflow-hidden">
                <video ref={videoRef} className={cn('w-full h-full object-cover', !scanning && 'hidden')} playsInline muted />
                {!scanning && <div className="absolute inset-0 flex flex-col items-center justify-center"><ScanLine className="w-12 h-12 opacity-30" /><p className="text-xs">Camera is off</p></div>}
                {scanning && (<div className="absolute inset-0 flex items-center justify-center"><div className="w-48 h-48 border-2 border-purple-400 rounded-2xl relative"><div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-purple-400" /><div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-purple-400" /><div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-purple-400" /><div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-purple-400" /><motion.div animate={{y: [0,176,0]}} transition={{duration:2, repeat:Infinity}} className="absolute left-1 right-1 h-0.5 bg-purple-400" /></div></div>)}
              </div>
              <div className="flex gap-3 mt-4">
                {!scanning ? <button onClick={startCamera} className="flex-1 py-2.5 bg-accent-grad rounded-xl text-white"><Camera className="w-4 h-4 inline mr-2" /> Open Camera</button> : <button onClick={stopCamera} className="flex-1 py-2.5 bg-white/5 border border-border rounded-xl hover:border-red-500/40"><X className="w-4 h-4 inline mr-2" /> Stop</button>}
              </div>
            </div>

            <div className="p-6 bg-surface border border-border rounded-[24px] text-center">
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && handleScanFile(e.target.files[0])} />
              <button onClick={() => fileInputRef.current?.click()} className="w-full py-8 border-2 border-dashed rounded-xl flex flex-col items-center gap-2"><Upload className="w-8 h-8" /><span>Upload QR Image</span></button>
            </div>

            {scanError && <div className="p-4 bg-red-500/10 rounded-xl text-red-400 text-xs">{scanError}</div>}

            <AnimatePresence>
              {scanResult && (
                <motion.div className="p-6 bg-surface border border-emerald-500/20 rounded-[24px] space-y-4">
                  <div className="flex justify-between"><span className="text-[10px] font-bold text-emerald-400">QR Code Detected!</span><button onClick={() => setScanResult(null)}><Trash2 className="w-4 h-4" /></button></div>
                  <p className="text-sm bg-white/5 rounded-xl p-4 break-all">{scanResult}</p>
                  <div className="flex gap-3">
                    {scanResult.startsWith('http') && <a href={scanResult} target="_blank" className="flex-1 py-2.5 bg-accent-grad rounded-xl text-white text-center">Open Link</a>}
                    <button onClick={copyScanResult} className="flex-1 py-2.5 bg-white/5 border border-border rounded-xl">{scanCopied ? <Check className="w-4 h-4 inline text-emerald-400" /> : <Copy className="w-4 h-4 inline" />} {scanCopied ? 'Copied!' : 'Copy'}</button>
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

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText, Download, Upload, Trash2, X,
  Merge, Scissors, ChevronUp, ChevronDown, Check,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { PDFDocument } from 'pdf-lib';

type Tab = 'merge' | 'split';

interface PDFFile {
  id: string;
  file: File;
  name: string;
  pageCount: number;
  size: number;
}

export default function PDFTools() {
  const [tab, setTab] = useState<Tab>('merge');

  // Merge state
  const [mergeFiles, setMergeFiles]     = useState<PDFFile[]>([]);
  const [merging, setMerging]           = useState(false);
  const [mergeError, setMergeError]     = useState('');
  const [mergeDone, setMergeDone]       = useState(false);
  const mergeInputRef                   = useRef<HTMLInputElement>(null);

  // Split state
  const [splitFile, setSplitFile]       = useState<PDFFile | null>(null);
  const [splitRanges, setSplitRanges]   = useState('');
  const [splitting, setSplitting]       = useState(false);
  const [splitError, setSplitError]     = useState('');
  const [splitResults, setSplitResults] = useState<{ name: string; blob: Blob }[]>([]);
  const splitInputRef                   = useRef<HTMLInputElement>(null);

  // Notification state
  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' } | null>(null);

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

  // ── Helpers ──
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const loadPDF = async (file: File): Promise<number> => {
    const buf = await file.arrayBuffer();
    const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
    return pdf.getPageCount();
  };

  // ── Generic download (mobile‑friendly) ──
  const downloadBlob = async (blob: Blob, fileName: string) => {
    try {
      // 1. Use Web Share API on mobile if available
      if (navigator.share && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
        const file = new File([blob], fileName, { type: 'application/pdf' });
        await navigator.share({
          title: 'PDF File',
          files: [file],
        });
        showNotification(`Shared: ${fileName}`, 'info');
        return;
      }

      // 2. Fallback: create object URL + a.download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showNotification(`Downloaded: ${fileName} 📁`, 'info');
    } catch (err) {
      console.error('Download failed:', err);
      showNotification('Could not save automatically. Try long‑pressing the button.', 'error');
    }
  };

  // ── MERGE ──
  const handleMergeFiles = async (fileList: FileList | null) => {
    if (!fileList) return;
    setMergeError('');
    const arr = Array.from(fileList).filter(f => f.type === 'application/pdf');
    if (arr.length === 0) { setMergeError('Please select PDF files only.'); return; }
    const newFiles: PDFFile[] = [];
    for (const file of arr) {
      try {
        const pageCount = await loadPDF(file);
        newFiles.push({ id: `pdf_${Date.now()}_${Math.random()}`, file, name: file.name, pageCount, size: file.size });
      } catch { setMergeError(`Could not read: ${file.name}`); }
    }
    setMergeFiles(prev => [...prev, ...newFiles]);
    setMergeDone(false);
  };

  const moveFile = (index: number, dir: -1 | 1) => {
    const newArr = [...mergeFiles];
    const swapIdx = index + dir;
    if (swapIdx < 0 || swapIdx >= newArr.length) return;
    [newArr[index], newArr[swapIdx]] = [newArr[swapIdx], newArr[index]];
    setMergeFiles(newArr);
  };

  const removeMergeFile = (id: string) => setMergeFiles(prev => prev.filter(f => f.id !== id));

  const doMerge = async () => {
    if (mergeFiles.length < 2) { setMergeError('Add at least 2 PDF files to merge.'); return; }
    setMerging(true); setMergeError(''); setMergeDone(false);
    try {
      const merged = await PDFDocument.create();
      for (const item of mergeFiles) {
        const buf = await item.file.arrayBuffer();
        const src = await PDFDocument.load(buf, { ignoreEncryption: true });
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach(p => merged.addPage(p));
      }
      const bytes = await merged.save();
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const fileName = `merged_${Date.now()}.pdf`;
      await downloadBlob(blob, fileName);
      setMergeDone(true);
    } catch (err) {
      console.error(err);
      setMergeError('Merge failed. Please try again.');
    }
    setMerging(false);
  };

  // ── SPLIT ──
  const handleSplitFile = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setSplitError(''); setSplitResults([]);
    const file = fileList[0];
    if (file.type !== 'application/pdf') { setSplitError('Please select a PDF file.'); return; }
    try {
      const pageCount = await loadPDF(file);
      setSplitFile({ id: `pdf_${Date.now()}`, file, name: file.name, pageCount, size: file.size });
      setSplitRanges(`1-${pageCount}`);
    } catch { setSplitError('Could not read PDF. File may be corrupted.'); }
  };

  const parseRanges = (input: string, maxPage: number): number[][] => {
    return input.split(',').map(r => {
      const parts = r.trim().split('-').map(n => parseInt(n.trim()));
      if (parts.length === 1 && !isNaN(parts[0])) return [parts[0]];
      if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        const pages = [];
        for (let i = parts[0]; i <= parts[1]; i++) pages.push(i);
        return pages;
      }
      return [];
    }).filter(r => r.length > 0 && r.every(p => p >= 1 && p <= maxPage));
  };

  const doSplit = async () => {
    if (!splitFile) return;
    setSplitting(true); setSplitError(''); setSplitResults([]);
    try {
      const ranges = parseRanges(splitRanges, splitFile.pageCount);
      if (ranges.length === 0) { setSplitError('Invalid page ranges. Example: 1-3, 4-6'); setSplitting(false); return; }
      const buf = await splitFile.file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const results: { name: string; blob: Blob }[] = [];
      for (let i = 0; i < ranges.length; i++) {
        const newPdf = await PDFDocument.create();
        const pageIndices = ranges[i].map(p => p - 1);
        const pages = await newPdf.copyPages(src, pageIndices);
        pages.forEach(p => newPdf.addPage(p));
        const bytes = await newPdf.save();
        const blob = new Blob([bytes], { type: 'application/pdf' });
        results.push({ name: `split_part${i + 1}_${Date.now()}.pdf`, blob });
      }
      setSplitResults(results);
      showNotification(`PDF split into ${results.length} parts`, 'info');
    } catch (err) {
      console.error(err);
      setSplitError('Split failed. Please try again.');
    }
    setSplitting(false);
  };

  const downloadSplit = async (item: { name: string; blob: Blob }) => {
    await downloadBlob(item.blob, item.name);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8 relative"
    >
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

      {/* Header */}
      <header>
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PDF Tools</h1>
            <p className="text-text-dim text-xs">Merge & split PDF files. 100% offline.</p>
          </div>
          <span className="ml-auto px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-md text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
            NEW
          </span>
        </div>
      </header>

      {/* Tab switcher */}
      <div className="flex gap-2 p-1 bg-surface border border-border rounded-xl w-fit">
        {(['merge', 'split'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('px-5 py-2 rounded-lg text-sm font-semibold transition-all capitalize',
              tab === t ? 'bg-accent-grad text-white shadow-lg' : 'text-text-dim hover:text-white'
            )}
          >{t === 'merge' ? 'Merge' : 'Split'}</button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ══════════ MERGE TAB ══════════ */}
        {tab === 'merge' && (
          <motion.div key="merge" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">

            {/* Upload */}
            <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Upload PDF Files</p>
              <input ref={mergeInputRef} type="file" accept=".pdf" multiple className="hidden"
                onChange={e => handleMergeFiles(e.target.files)}
              />
              <button onClick={() => mergeInputRef.current?.click()}
                className="w-full py-8 border-2 border-dashed border-border rounded-xl flex flex-col items-center gap-3 text-text-dim hover:border-purple-500/40 hover:text-white transition-all"
              >
                <Upload className="w-8 h-8" />
                <span className="text-xs font-semibold uppercase tracking-wider">Upload PDF Files</span>
                <span className="text-[10px]">Select multiple PDFs to merge</span>
              </button>
            </div>

            {/* File list */}
            <AnimatePresence>
              {mergeFiles.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Order ({mergeFiles.length} files)</p>
                    <button onClick={() => { setMergeFiles([]); setMergeDone(false); }} className="text-[10px] text-red-400 font-bold hover:opacity-80">CLEAR ALL</button>
                  </div>
                  <div className="space-y-2">
                    {mergeFiles.map((item, idx) => (
                      <motion.div key={item.id} layout
                        className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-border"
                      >
                        <div className="flex flex-col gap-1">
                          <button onClick={() => moveFile(idx, -1)} disabled={idx === 0} className="text-text-dim hover:text-white disabled:opacity-20">
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => moveFile(idx, 1)} disabled={idx === mergeFiles.length - 1} className="text-text-dim hover:text-white disabled:opacity-20">
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                          <FileText className="w-4 h-4 text-red-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{item.name}</p>
                          <p className="text-[10px] text-text-dim">{item.pageCount} pages • {formatSize(item.size)}</p>
                        </div>
                        <button onClick={() => removeMergeFile(item.id)} className="text-text-dim hover:text-red-400 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                  <button onClick={() => mergeInputRef.current?.click()}
                    className="w-full py-2.5 bg-white/5 border border-border rounded-xl text-text-dim text-xs font-semibold hover:text-white hover:border-white/20 transition-all flex items-center justify-center gap-2"
                  >
                    <Upload className="w-3.5 h-3.5" /> Add More Files
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {mergeError && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">{mergeError}</div>}

            {mergeDone && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-2">
                <Check className="w-4 h-4" /> Merge complete! PDF saved/shared.
              </div>
            )}

            <button onClick={doMerge} disabled={mergeFiles.length < 2 || merging}
              className="w-full py-3.5 bg-accent-grad rounded-xl text-white font-bold text-sm tracking-wide disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {merging
                ? <><span className="animate-spin inline-block">↻</span> Merging...</>
                : <><Merge className="w-4 h-4" /> Merge {mergeFiles.length > 0 ? `${mergeFiles.length} PDFs` : 'PDFs'}</>
              }
            </button>
          </motion.div>
        )}

        {/* ══════════ SPLIT TAB ══════════ */}
        {tab === 'split' && (
          <motion.div key="split" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="space-y-5">

            {/* Upload */}
            <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Upload PDF File</p>
              <input ref={splitInputRef} type="file" accept=".pdf" className="hidden"
                onChange={e => handleSplitFile(e.target.files)}
              />
              {!splitFile ? (
                <button onClick={() => splitInputRef.current?.click()}
                  className="w-full py-8 border-2 border-dashed border-border rounded-xl flex flex-col items-center gap-3 text-text-dim hover:border-purple-500/40 hover:text-white transition-all"
                >
                  <Upload className="w-8 h-8" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Upload PDF File</span>
                  <span className="text-[10px]">Select a PDF to split</span>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl border border-border">
                  <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{splitFile.name}</p>
                    <p className="text-[10px] text-text-dim">{splitFile.pageCount} pages • {formatSize(splitFile.size)}</p>
                  </div>
                  <button onClick={() => { setSplitFile(null); setSplitResults([]); setSplitError(''); }} className="text-text-dim hover:text-red-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Page ranges */}
            {splitFile && (
              <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
                <p className="text-[10px] font-bold uppercase tracking-widest text-text-dim">Page Ranges</p>
                <p className="text-[11px] text-text-dim">Total pages: <span className="text-white font-bold">{splitFile.pageCount}</span> — Enter ranges separated by commas</p>
                <input
                  type="text" value={splitRanges}
                  onChange={e => setSplitRanges(e.target.value)}
                  placeholder="e.g. 1-3, 4-6, 7"
                  className="w-full bg-white/5 border border-border rounded-xl px-4 py-3 text-sm text-white placeholder:text-text-dim focus:outline-none focus:border-purple-500/50 transition-colors font-mono"
                />
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'First Half', value: `1-${Math.ceil(splitFile.pageCount / 2)}` },
                    { label: 'Second Half', value: `${Math.ceil(splitFile.pageCount / 2) + 1}-${splitFile.pageCount}` },
                    { label: 'Each Page', value: Array.from({ length: splitFile.pageCount }, (_, i) => i + 1).join(', ') },
                  ].map(preset => (
                    <button key={preset.label} onClick={() => setSplitRanges(preset.value)}
                      className="px-3 py-1.5 bg-white/5 border border-border rounded-lg text-[10px] font-semibold text-text-dim hover:text-white hover:border-white/20 transition-all"
                    >{preset.label}</button>
                  ))}
                </div>
              </div>
            )}

            {splitError && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">{splitError}</div>}

            {/* Split results */}
            <AnimatePresence>
              {splitResults.length > 0 && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className="p-6 bg-surface border border-emerald-500/20 rounded-[24px] space-y-4"
                >
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Split Complete — {splitResults.length} parts</p>
                  </div>
                  <div className="space-y-2">
                    {splitResults.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-border">
                        <div className="flex items-center gap-3">
                          <FileText className="w-4 h-4 text-red-400" />
                          <span className="text-sm font-semibold">Part {idx + 1}</span>
                          <span className="text-[10px] text-text-dim">{formatSize(item.blob.size)}</span>
                        </div>
                        <button onClick={() => downloadSplit(item)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-accent-grad rounded-lg text-white text-[10px] font-bold"
                        >
                          <Download className="w-3.5 h-3.5" /> Download
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={doSplit} disabled={!splitFile || splitting}
              className="w-full py-3.5 bg-accent-grad rounded-xl text-white font-bold text-sm tracking-wide disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {splitting
                ? <><span className="animate-spin inline-block">↻</span> Splitting...</>
                : <><Scissors className="w-4 h-4" /> Split PDF</>
              }
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

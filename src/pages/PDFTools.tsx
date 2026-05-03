import React, { useState, useRef, useEffect } from 'react';
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

// ✅ Reusable download helper — no external dependency
const triggerDownload = (blob: Blob, fileName: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
};

export default function PDFTools() {
  const [tab, setTab] = useState<Tab>('merge');
  const [mergeFiles, setMergeFiles] = useState<PDFFile[]>([]);
  const [merging, setMerging] = useState(false);
  const [mergeError, setMergeError] = useState('');
  const [mergeDone, setMergeDone] = useState(false);
  const mergeInputRef = useRef<HTMLInputElement>(null);

  const [splitFile, setSplitFile] = useState<PDFFile | null>(null);
  const [splitRanges, setSplitRanges] = useState('');
  const [splitting, setSplitting] = useState(false);
  const [splitError, setSplitError] = useState('');
  const [splitResults, setSplitResults] = useState<{ name: string; blob: Blob }[]>([]);
  const splitInputRef = useRef<HTMLInputElement>(null);

  const [notification, setNotification] = useState<{ message: string; type: 'info' | 'error' } | null>(null);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const showNotification = (message: string, type: 'info' | 'error' = 'info') => {
    setNotification({ message, type });
  };

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

  // ---- Merge ----
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
      // ✅ FIXED: direct anchor download
      triggerDownload(blob, `merged_${Date.now()}.pdf`);
      showNotification('Merge complete! Downloading…', 'info');
      setMergeDone(true);
    } catch (err) {
      console.error(err);
      setMergeError('Merge failed. Please try again.');
    }
    setMerging(false);
  };

  // ---- Split ----
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

  // ✅ FIXED: direct anchor download
  const downloadSplit = (item: { name: string; blob: Blob }) => {
    triggerDownload(item.blob, item.name);
    showNotification(`Downloading ${item.name}`, 'info');
  };

  return (
    <motion.div className="space-y-8 relative">
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
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">PDF Tools</h1>
            <p className="text-text-dim text-xs">Merge & split PDF files. 100% offline.</p>
          </div>
        </div>
      </header>

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
        {tab === 'merge' && (
          <motion.div key="merge" className="space-y-5">
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

            {mergeFiles.length > 0 && (
              <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
                <div className="flex justify-between">
                  <p className="text-[10px] font-bold uppercase">Order ({mergeFiles.length})</p>
                  <button onClick={() => setMergeFiles([])} className="text-red-400 text-[10px]">CLEAR ALL</button>
                </div>
                {mergeFiles.map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                    <div className="flex flex-col gap-1">
                      <button onClick={() => moveFile(idx, -1)} disabled={idx === 0} className="text-text-dim hover:text-white"><ChevronUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveFile(idx, 1)} disabled={idx === mergeFiles.length - 1} className="text-text-dim hover:text-white"><ChevronDown className="w-3.5 h-3.5" /></button>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center"><FileText className="w-4 h-4 text-red-400" /></div>
                    <div className="flex-1"><p className="text-sm truncate">{item.name}</p><p className="text-[10px] text-text-dim">{item.pageCount} pages • {formatSize(item.size)}</p></div>
                    <button onClick={() => removeMergeFile(item.id)}><X className="w-4 h-4 text-text-dim hover:text-red-400" /></button>
                  </div>
                ))}
                <button onClick={() => mergeInputRef.current?.click()} className="w-full py-2.5 bg-white/5 rounded-xl text-xs">+ Add More Files</button>
              </div>
            )}

            {mergeError && <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">{mergeError}</div>}
            {mergeDone && <div className="p-4 bg-emerald-500/10 rounded-xl text-emerald-400 text-xs flex items-center gap-2"><Check className="w-4 h-4" /> Merge complete!</div>}

            <button onClick={doMerge} disabled={mergeFiles.length < 2 || merging}
              className="w-full py-3.5 bg-accent-grad rounded-xl text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2">
              {merging ? <><span className="animate-spin">↻</span> Merging...</> : <><Merge className="w-4 h-4" /> Merge {mergeFiles.length} PDFs</>}
            </button>
          </motion.div>
        )}

        {tab === 'split' && (
          <motion.div key="split" className="space-y-5">
            <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
              <p className="text-[10px] font-bold uppercase">Upload PDF File</p>
              <input ref={splitInputRef} type="file" accept=".pdf" className="hidden" onChange={e => handleSplitFile(e.target.files)} />
              {!splitFile ? (
                <button onClick={() => splitInputRef.current?.click()} className="w-full py-8 border-2 border-dashed rounded-xl flex flex-col items-center gap-3">
                  <Upload className="w-8 h-8" /><span className="text-xs">Upload PDF File</span>
                </button>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-xl">
                  <FileText className="w-5 h-5 text-red-400" />
                  <div className="flex-1"><p className="text-sm truncate">{splitFile.name}</p><p className="text-[10px] text-text-dim">{splitFile.pageCount} pages • {formatSize(splitFile.size)}</p></div>
                  <button onClick={() => setSplitFile(null)}><X className="w-4 h-4" /></button>
                </div>
              )}
            </div>

            {splitFile && (
              <div className="p-6 bg-surface border border-border rounded-[24px] space-y-4">
                <p className="text-[10px] font-bold uppercase">Page Ranges</p>
                <p className="text-xs text-text-dim">Total pages: <span className="text-white font-bold">{splitFile.pageCount}</span></p>
                <input type="text" value={splitRanges} onChange={e => setSplitRanges(e.target.value)} placeholder="e.g. 1-3, 4-6, 7" className="w-full bg-white/5 border border-border rounded-xl px-4 py-3 text-sm" />
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => setSplitRanges(`1-${Math.ceil(splitFile.pageCount / 2)}`)} className="px-3 py-1.5 bg-white/5 rounded-lg text-[10px]">First Half</button>
                  <button onClick={() => setSplitRanges(`${Math.ceil(splitFile.pageCount / 2) + 1}-${splitFile.pageCount}`)} className="px-3 py-1.5 bg-white/5 rounded-lg text-[10px]">Second Half</button>
                  <button onClick={() => setSplitRanges(Array.from({ length: splitFile.pageCount }, (_, i) => i + 1).join(', '))} className="px-3 py-1.5 bg-white/5 rounded-lg text-[10px]">Each Page</button>
                </div>
              </div>
            )}

            {splitError && <div className="p-4 bg-red-500/10 rounded-xl text-red-400 text-xs">{splitError}</div>}

            {splitResults.length > 0 && (
              <div className="p-6 bg-surface border border-emerald-500/20 rounded-[24px] space-y-4">
                <p className="text-[10px] font-bold text-emerald-400">Split Complete — {splitResults.length} parts</p>
                {splitResults.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                    <div><span className="text-sm">Part {idx + 1}</span><span className="text-[10px] text-text-dim ml-2">{formatSize(item.blob.size)}</span></div>
                    <button onClick={() => downloadSplit(item)} className="flex items-center gap-2 px-3 py-1.5 bg-accent-grad rounded-lg text-white text-[10px]"><Download className="w-3.5 h-3.5" /> Save</button>
                  </div>
                ))}
              </div>
            )}

            <button onClick={doSplit} disabled={!splitFile || splitting} className="w-full py-3.5 bg-accent-grad rounded-xl text-white font-bold disabled:opacity-40 flex items-center justify-center gap-2">
              {splitting ? <><span className="animate-spin">↻</span> Splitting...</> : <><Scissors className="w-4 h-4" /> Split PDF</>}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

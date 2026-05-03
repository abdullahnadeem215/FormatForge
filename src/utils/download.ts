// utils/download.ts
export async function downloadBlob(
  blob: Blob,
  fileName: string,
  onInstruction?: (message: string) => void
): Promise<boolean> {
  // 1. Try native share (mobile)
  if (navigator.share && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
    try {
      const file = new File([blob], fileName, { type: blob.type });
      await navigator.share({ title: 'Save file', files: [file] });
      onInstruction?.('File shared – choose where to save it');
      return true;
    } catch (err) {
      if (err.name !== 'AbortError') console.warn('Share failed', err);
    }
  }

  // 2. Try standard download (works on desktop, some mobile browsers)
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onInstruction?.(`Download started: ${fileName}`);
    return true;
  } catch (err) {
    console.warn('Anchor download failed', err);
  }

  // 3. Last resort: open in new tab + explain long‑press
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  onInstruction?.(
    '👉 Tap the file, then press and hold → "Save to device"'
  );
  return false;
}

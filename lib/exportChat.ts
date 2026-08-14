// Client-side file export helpers — chat logs as markdown, diagrams as SVG
// or PNG. Everything here runs entirely in the browser (Blob + object URLs);
// there's no server round-trip for a download.

import { messageText, type ChatThread } from './chatHistory';

function triggerDownload(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function downloadBlob(content: BlobPart, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  URL.revokeObjectURL(url);
}

export function downloadSvg(svgMarkup: string, filename: string) {
  downloadBlob(svgMarkup, filename, 'image/svg+xml');
}

export function downloadMarkdown(content: string, filename: string) {
  downloadBlob(content, filename, 'text/markdown');
}

export function downloadText(content: string, filename: string) {
  downloadBlob(content, filename, 'text/plain');
}

// Rasterizes an SVG string to a PNG and downloads it — browsers can't export
// SVG markup as PNG directly, so this draws it onto an offscreen canvas via
// an Image element first.
export function downloadSvgAsPng(svgMarkup: string, filename: string, scale = 2): Promise<void> {
  return new Promise((resolve, reject) => {
    const svgBlob = new Blob([svgMarkup], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = (img.width || 480) * scale;
      canvas.height = (img.height || 360) * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('Canvas is not supported in this browser.'));
        return;
      }
      // Filled, not transparent — a transparent PNG of light diagram lines
      // would be unreadable dropped onto most surfaces.
      ctx.fillStyle = '#0a0a0c';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Failed to encode PNG.'));
          return;
        }
        const pngUrl = URL.createObjectURL(blob);
        triggerDownload(pngUrl, filename);
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load the diagram for PNG conversion.'));
    };
    img.src = url;
  });
}

export function threadToMarkdown(thread: Pick<ChatThread, 'title' | 'createdAt' | 'messages'>): string {
  const lines = [`# ${thread.title}`, '', `_${new Date(thread.createdAt).toLocaleString()}_`, ''];
  for (const m of thread.messages) {
    lines.push(m.role === 'user' ? '**You:**' : '**Ai One:**', '', messageText(m.content), '');
  }
  return lines.join('\n');
}

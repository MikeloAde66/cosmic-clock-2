'use client';

import React, { useEffect, useState } from 'react';
import { VAULT_DRAWERS, type VaultDrawer, type VaultProduct } from '@/lib/vaultRegistry';

function formatBytes(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(seconds: number) {
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

// Best-effort: loads audio metadata off-DOM to read its duration. Only
// attempted for audio files, and gives up after 5s rather than hanging the
// upload flow on a file the browser can't probe.
function probeAudioDuration(file: File): Promise<number | undefined> {
  if (!file.type.startsWith('audio/')) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const audio = document.createElement('audio');
    const url = URL.createObjectURL(file);
    let settled = false;
    const finish = (value: number | undefined) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timeout = setTimeout(() => finish(undefined), 5000);
    audio.addEventListener('loadedmetadata', () => {
      clearTimeout(timeout);
      finish(Number.isFinite(audio.duration) ? audio.duration : undefined);
    });
    audio.addEventListener('error', () => {
      clearTimeout(timeout);
      finish(undefined);
    });
    audio.src = url;
  });
}

export default function CosmicVaultAuth() {
  // Security Key 432 Lock State
  const [securityPin, setSecurityPin] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const [products, setProducts] = useState<VaultProduct[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadSku, setUploadSku] = useState<string>('');
  const [uploadDrawer, setUploadDrawer] = useState<VaultDrawer>('PODS');
  const [uploadDescription, setUploadDescription] = useState<string>('');
  const [uploadReadme, setUploadReadme] = useState<string>('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [fileDurations, setFileDurations] = useState<Map<File, number>>(new Map());
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Folder selects (webkitdirectory) can include OS junk files — drop them
  // client-side too, on top of the server-side filter, so the file count
  // shown while picking already matches what will actually upload.
  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const cleaned = Array.from(incoming).filter((f) => !f.name.split('/').pop()?.startsWith('.'));
    setUploadFiles((prev) => [...prev, ...cleaned]);

    cleaned.forEach((file) => {
      probeAudioDuration(file).then((duration) => {
        if (duration === undefined) return;
        setFileDurations((prev) => new Map(prev).set(file, duration));
      });
    });
  };

  const removeUploadFile = (index: number) => {
    setUploadFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const fetchInventory = async () => {
    setIsLoadingInventory(true);
    try {
      const res = await fetch('/api/vault/list');
      const data = await res.json();
      setProducts(data.products || []);
    } catch (err) {
      console.error('Failed to load vault inventory:', err);
    } finally {
      setIsLoadingInventory(false);
    }
  };

  useEffect(() => {
    if (isUnlocked) fetchInventory();
  }, [isUnlocked]);

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (securityPin.trim() === '432') {
      setIsUnlocked(true);
      setErrorMsg('');
    } else {
      setErrorMsg('Invalid Key Code.');
    }
  };

  const resetUploadForm = () => {
    setUploadTitle('');
    setUploadSku('');
    setUploadDrawer('PODS');
    setUploadDescription('');
    setUploadReadme('');
    setUploadFiles([]);
    setFileDurations(new Map());
    setUploadError('');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadFiles.length === 0) {
      setUploadError('Choose at least one file to upload.');
      return;
    }
    setIsUploading(true);
    setUploadError('');

    const form = new FormData();
    form.set('pin', securityPin.trim());
    uploadFiles.forEach((file) => form.append('file', file));
    form.set('title', uploadTitle);
    form.set('sku', uploadSku);
    form.set('drawer', uploadDrawer);
    form.set('description', uploadDescription);
    form.set('readmeGuide', uploadReadme);
    form.set('durations', JSON.stringify(uploadFiles.map((f) => fileDurations.get(f) ?? null)));

    try {
      const res = await fetch('/api/vault/upload', { method: 'POST', body: form });
      if (!res.ok) {
        setUploadError(await res.text());
        return;
      }
      const data: { product: VaultProduct | null; errors: { filename: string; message: string }[] } = await res.json();

      if (data.product) {
        // The server returns the pack's full current track list (existing +
        // new), so replace any card with the same sku+drawer rather than
        // appending a duplicate.
        setProducts((prev) => [
          data.product as VaultProduct,
          ...prev.filter((p) => !(p.sku === data.product!.sku && p.drawer === data.product!.drawer)),
        ]);
      }

      if (data.errors.length > 0) {
        // Keep the failed files staged so the pack upload can just be
        // retried without re-picking everything that already succeeded.
        const failedNames = new Set(data.errors.map((e) => e.filename));
        setUploadFiles((prev) => prev.filter((f) => failedNames.has(f.name)));
        setUploadError(
          `${uploadFiles.length - data.errors.length} uploaded, ${data.errors.length} failed: ` +
            data.errors.map((e) => `${e.filename} (${e.message})`).join('; ')
        );
      } else {
        resetUploadForm();
        setShowUploadModal(false);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

  const totalUploadBytes = uploadFiles.reduce((sum, f) => sum + f.size, 0);

  const visibleProducts = products.filter(
    (item) => selectedCategory === 'ALL' || item.drawer === selectedCategory
  );

  return (
    <div className="w-full h-full overflow-y-auto bg-[#070b14] text-slate-100 font-sans">
      <div className="max-w-6xl px-6 py-10 mx-auto space-y-8">
        {!isUnlocked ? (
          <div className="max-w-md p-8 mx-auto my-12 space-y-6 text-center border shadow-xl bg-slate-900/90 border-slate-800 rounded-xl">
            <h2 className="text-xl font-bold text-slate-100">Cosmic Vault Authentication</h2>

            <form onSubmit={handleUnlock} className="space-y-4">
              <input
                type="password"
                maxLength={6}
                placeholder="Enter Key..."
                value={securityPin}
                onChange={(e) => setSecurityPin(e.target.value)}
                className="w-full px-4 py-3 font-mono text-lg text-center border rounded bg-slate-950 border-slate-800 text-white focus:outline-none focus:border-white/50"
              />
              {errorMsg && <p className="font-mono text-xs text-rose-400">{errorMsg}</p>}
              <button
                type="submit"
                className="w-full py-3 text-xs font-bold uppercase transition-all rounded bg-white hover:bg-neutral-200 text-slate-950"
              >
                Authenticate
              </button>
            </form>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h2 className="text-2xl font-bold text-white">Automated Asset Drawers</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="px-3 py-1.5 text-xs font-mono uppercase bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded transition"
                >
                  + Upload File
                </button>
                <button
                  onClick={() => setIsUnlocked(false)}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded font-mono"
                >
                  LOCK VAULT
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedCategory('ALL')}
                className={`px-3 py-1.5 rounded text-xs font-mono uppercase transition-all border ${
                  selectedCategory === 'ALL'
                    ? 'bg-white/20 text-white border-neutral-700'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                }`}
              >
                ALL DRAWERS
              </button>
              {VAULT_DRAWERS.map((drawer) => (
                <button
                  key={drawer}
                  onClick={() => setSelectedCategory(drawer)}
                  className={`px-3 py-1.5 rounded text-xs font-mono uppercase transition-all border ${
                    selectedCategory === drawer
                      ? 'bg-white/20 text-white border-neutral-700'
                      : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
                  }`}
                >
                  {drawer}
                </button>
              ))}
            </div>

            {isLoadingInventory ? (
              <p className="font-mono text-xs text-slate-500">Loading inventory…</p>
            ) : visibleProducts.length === 0 ? (
              <p className="font-mono text-xs text-slate-500">
                No items in this drawer yet — use + Upload File to add the first one.
              </p>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((item) => {
                  const tracks = item.tracks ?? [];
                  const totalSize = tracks.reduce((s, t) => s + t.sizeBytes, 0);
                  const totalDuration = tracks.reduce((s, t) => s + (t.durationSeconds ?? 0), 0);
                  const isExpanded = expandedIds.has(item.id);

                  return (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between p-5 space-y-4 border bg-slate-900/80 border-slate-800 rounded-xl"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="px-2 py-0.5 bg-neutral-800/80 border border-neutral-700 text-white rounded">
                            {item.drawer}
                          </span>
                          <span className="text-slate-500">{item.dateAdded}</span>
                        </div>

                        <h3 className="text-base font-bold text-slate-100">{item.title}</h3>
                        <p className="text-xs text-slate-400">{item.description}</p>
                        <p className="font-mono text-[10px] text-slate-600">SKU: {item.sku}</p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-500">
                            {tracks.length} file{tracks.length !== 1 ? 's' : ''} • {formatBytes(totalSize)}
                            {totalDuration > 0 ? ` • ${formatDuration(totalDuration)}` : ''}
                          </span>
                          <button
                            onClick={() => toggleExpanded(item.id)}
                            className="font-mono text-[10px] uppercase text-white/70 hover:text-white"
                          >
                            {isExpanded ? '▾ Hide Contents' : '▸ Inspect Contents'}
                          </button>
                        </div>

                        {isExpanded && (
                          <div className="pt-2 space-y-1.5 border-t border-slate-800">
                            {tracks.map((t, i) => (
                              <div key={`${t.filename}-${i}`} className="flex items-center justify-between gap-2">
                                <span className="font-mono text-xs truncate text-slate-300">{t.filename}</span>
                                <div className="flex items-center gap-2 shrink-0">
                                  <span className="text-[10px] font-mono text-slate-500">
                                    {formatBytes(t.sizeBytes)}
                                    {t.durationSeconds ? ` • ${formatDuration(t.durationSeconds)}` : ''}
                                  </span>
                                  <a
                                    href={t.fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="font-mono text-[10px] uppercase underline text-white/70 hover:text-white"
                                  >
                                    Download
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleUpload}
            className="w-full max-w-md p-6 space-y-4 border shadow-2xl bg-slate-900 border-neutral-700 rounded-xl"
          >
            <h3 className="text-lg font-bold text-white">Upload to Vault</h3>

            <input
              type="text"
              placeholder="Title (pack title for multi-file uploads)"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              required
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            />
            <input
              type="text"
              placeholder="SKU (same SKU adds tracks to an existing pack)"
              value={uploadSku}
              onChange={(e) => setUploadSku(e.target.value)}
              required
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            />
            <select
              value={uploadDrawer}
              onChange={(e) => setUploadDrawer(e.target.value as VaultDrawer)}
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            >
              {VAULT_DRAWERS.map((drawer) => (
                <option key={drawer} value={drawer}>
                  {drawer}
                </option>
              ))}
            </select>
            <textarea
              placeholder="Description"
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
              rows={2}
              className="w-full p-3 font-mono text-sm border rounded-lg resize-none bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            />
            <textarea
              placeholder="Readme / install guide"
              value={uploadReadme}
              onChange={(e) => setUploadReadme(e.target.value)}
              rows={2}
              className="w-full p-3 font-mono text-sm border rounded-lg resize-none bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            />
            <div className="flex gap-2">
              <label className="flex-1 px-3 py-2 text-xs font-mono text-center text-white uppercase transition border rounded-lg cursor-pointer bg-neutral-800 hover:bg-neutral-700 border-neutral-700">
                + Add Files
                <input
                  type="file"
                  multiple
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
              <label className="flex-1 px-3 py-2 text-xs font-mono text-center text-white uppercase transition border rounded-lg cursor-pointer bg-neutral-800 hover:bg-neutral-700 border-neutral-700">
                + Add Folder
                <input
                  type="file"
                  multiple
                  {...{ webkitdirectory: 'true' }}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                  className="hidden"
                />
              </label>
            </div>

            {uploadFiles.length > 0 && (
              <div className="space-y-1.5 max-h-40 overflow-y-auto border rounded-lg border-slate-800 bg-slate-950/60 p-2">
                <div className="flex items-center justify-between px-1 font-mono text-[10px] uppercase text-slate-500">
                  <span>
                    {uploadFiles.length} file{uploadFiles.length > 1 ? 's' : ''} • {formatBytes(totalUploadBytes)}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setUploadFiles([]);
                      setFileDurations(new Map());
                    }}
                    className="text-slate-400 hover:text-white"
                  >
                    Clear all
                  </button>
                </div>
                {uploadFiles.map((file, i) => (
                  <div key={`${file.name}-${i}`} className="flex items-center justify-between gap-2 px-1 py-0.5">
                    <span className="font-mono text-xs truncate text-slate-300">
                      {file.name}
                      {fileDurations.has(file) ? ` (${formatDuration(fileDurations.get(file)!)})` : ''}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeUploadFile(i)}
                      className="shrink-0 font-mono text-xs text-slate-500 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}

            {uploadError && <p className="font-mono text-xs text-rose-400">{uploadError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowUploadModal(false);
                  resetUploadForm();
                }}
                className="px-4 py-2 font-mono text-xs text-slate-400 hover:text-slate-200"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isUploading}
                className="px-4 py-2 font-mono text-xs font-bold rounded-lg bg-white text-black hover:bg-neutral-200 disabled:opacity-50"
              >
                {isUploading ? 'UPLOADING…' : 'UPLOAD'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

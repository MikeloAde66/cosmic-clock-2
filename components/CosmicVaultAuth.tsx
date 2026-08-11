'use client';

import React, { useEffect, useState } from 'react';
import { VAULT_DRAWERS, type VaultDrawer, type VaultProduct } from '@/lib/vaultRegistry';

export default function CosmicVaultAuth() {
  // Security Key 432 Lock State
  const [securityPin, setSecurityPin] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const [products, setProducts] = useState<VaultProduct[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState<boolean>(false);

  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadSku, setUploadSku] = useState<string>('');
  const [uploadDrawer, setUploadDrawer] = useState<VaultDrawer>('PODS');
  const [uploadDescription, setUploadDescription] = useState<string>('');
  const [uploadReadme, setUploadReadme] = useState<string>('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');

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
    setUploadFile(null);
    setUploadError('');
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadError('Choose a file to upload.');
      return;
    }
    setIsUploading(true);
    setUploadError('');

    const form = new FormData();
    form.set('pin', securityPin.trim());
    form.set('file', uploadFile);
    form.set('title', uploadTitle);
    form.set('sku', uploadSku);
    form.set('drawer', uploadDrawer);
    form.set('description', uploadDescription);
    form.set('readmeGuide', uploadReadme);

    try {
      const res = await fetch('/api/vault/upload', { method: 'POST', body: form });
      if (!res.ok) {
        setUploadError(await res.text());
        return;
      }
      const data = await res.json();
      setProducts((prev) => [data.product, ...prev]);
      resetUploadForm();
      setShowUploadModal(false);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  };

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
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {visibleProducts.map((item) => (
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

                    {item.isPlaceholder ? (
                      <span className="font-mono text-[10px] uppercase tracking-wide text-slate-600">
                        Placeholder — no file uploaded yet
                      </span>
                    ) : (
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-mono text-center uppercase transition border rounded bg-white/10 hover:bg-white/20 border-neutral-700 text-white"
                      >
                        Download
                      </a>
                    )}
                  </div>
                ))}
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
              placeholder="Title"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              required
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            />
            <input
              type="text"
              placeholder="SKU (e.g. POD-S1E2)"
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
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              required
              className="w-full text-xs text-slate-400 font-mono file:mr-3 file:px-3 file:py-1.5 file:rounded file:border file:border-neutral-700 file:bg-neutral-800 file:text-white file:text-xs file:font-mono file:uppercase"
            />

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

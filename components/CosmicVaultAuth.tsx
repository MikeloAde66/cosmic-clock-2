'use client';

import React, { useEffect, useState } from 'react';
import { Pencil, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  VAULT_DRAWERS,
  type VaultDrawer,
  type VaultProduct,
  type VaultProductVariant,
  type VaultVariantFulfillmentType,
  type VaultVariantProductType,
} from '@/lib/vaultRegistry';

const VARIANT_PRODUCT_TYPES: VaultVariantProductType[] = [
  'physical_original',
  'limited_print',
  'digital_download',
  'non_exclusive_license',
  'exclusive_license',
  'streaming_only',
];
const VARIANT_FULFILLMENT_TYPES: VaultVariantFulfillmentType[] = ['shipment', 'digital_delivery', 'license_grant'];

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

interface CosmicVaultAuthProps {
  // Set when arriving here via a Home globe Vault marker's "Open Drawer"
  // link — pre-selects that drawer's filter tab. Only read once, as this
  // state's initial value: the component fully remounts each time the
  // Vault tab is switched back into (see the isUnlocked reset below), so a
  // fresh mount always picks up whatever the prop currently is.
  initialDrawer?: VaultDrawer;
}

export default function CosmicVaultAuth({ initialDrawer }: CosmicVaultAuthProps = {}) {
  // Security Key 432 Lock State
  const [securityPin, setSecurityPin] = useState<string>('');
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialDrawer ?? 'ALL');

  // Real RBAC layer on top of the PIN: the PIN just gets you into the Vault
  // view (read-only browsing); Upload and Delete additionally require a
  // signed-in Supabase session whose app_metadata.role is 'admin'. That
  // field can only be set with the service-role key, so a signed-in user
  // can never grant it to themselves.
  const [isAdmin, setIsAdmin] = useState<boolean>(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setIsAdmin(data.user?.app_metadata?.role === 'admin');
    });
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAdmin(session?.user?.app_metadata?.role === 'admin');
    });
    return () => subscription.subscription.unsubscribe();
  }, []);

  // Every admin-only request needs this alongside the PIN — the PIN can't
  // prove *who* is asking, only that they know a shared string.
  const getAuthHeader = async (): Promise<HeadersInit> => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const [products, setProducts] = useState<VaultProduct[]>([]);
  const [isLoadingInventory, setIsLoadingInventory] = useState<boolean>(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [deletingPackIds, setDeletingPackIds] = useState<Set<string>>(new Set());
  const [deletingTrackKeys, setDeletingTrackKeys] = useState<Set<string>>(new Set());
  const [editingTrackKey, setEditingTrackKey] = useState<string | null>(null);
  const [editWeightValue, setEditWeightValue] = useState<string>('');
  const [trackActionError, setTrackActionError] = useState<string>('');

  const [showUploadModal, setShowUploadModal] = useState<boolean>(false);
  const [uploadTitle, setUploadTitle] = useState<string>('');
  const [uploadSku, setUploadSku] = useState<string>('');
  const [uploadDrawer, setUploadDrawer] = useState<VaultDrawer>('MUSIC');
  const [uploadDescription, setUploadDescription] = useState<string>('');
  const [uploadReadme, setUploadReadme] = useState<string>('');
  const [uploadPrice, setUploadPrice] = useState<string>('');
  const [uploadPublish, setUploadPublish] = useState<boolean>(false);
  const [uploadTags, setUploadTags] = useState<string>('');
  const [uploadMetadata, setUploadMetadata] = useState<string>('');
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [fileDurations, setFileDurations] = useState<Map<File, number>>(new Map());
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [uploadError, setUploadError] = useState<string>('');

  // Variant manager — a pack can generate several separately priced/
  // fulfilled storefront listings from the same underlying files (e.g. a
  // physical original + a digital license) instead of just one.
  const [variantEditorPack, setVariantEditorPack] = useState<VaultProduct | null>(null);
  const [editingVariants, setEditingVariants] = useState<VaultProductVariant[]>([]);
  const [variantError, setVariantError] = useState<string>('');
  const [isSavingVariants, setIsSavingVariants] = useState<boolean>(false);
  const [newVariantTitle, setNewVariantTitle] = useState<string>('');
  const [newVariantProductType, setNewVariantProductType] = useState<VaultVariantProductType>('digital_download');
  const [newVariantFulfillmentType, setNewVariantFulfillmentType] =
    useState<VaultVariantFulfillmentType>('digital_delivery');
  const [newVariantPrice, setNewVariantPrice] = useState<string>('');
  const [newVariantInventory, setNewVariantInventory] = useState<string>('');

  const openVariantEditor = (item: VaultProduct) => {
    setVariantEditorPack(item);
    setEditingVariants(item.productVariants ?? []);
    setVariantError('');
    setNewVariantTitle('');
    setNewVariantProductType('digital_download');
    setNewVariantFulfillmentType('digital_delivery');
    setNewVariantPrice('');
    setNewVariantInventory('');
  };

  const addVariantRow = () => {
    if (!newVariantTitle.trim()) {
      setVariantError('Variant title is required.');
      return;
    }
    const priceCents = Math.round(Number(newVariantPrice) * 100);
    if (!newVariantPrice.trim() || !Number.isFinite(priceCents) || priceCents <= 0) {
      setVariantError('Variant price must be greater than zero.');
      return;
    }
    const inventoryCount = newVariantInventory.trim() ? Number(newVariantInventory) : undefined;
    if (inventoryCount !== undefined && (!Number.isFinite(inventoryCount) || inventoryCount < 0)) {
      setVariantError('Inventory count must be a non-negative number.');
      return;
    }
    setVariantError('');
    setEditingVariants((prev) => [
      ...prev,
      {
        id: `${newVariantProductType}-${Date.now()}`,
        listingTitle: newVariantTitle.trim(),
        productType: newVariantProductType,
        fulfillmentType: newVariantFulfillmentType,
        priceCents,
        inventoryCount,
        isAvailable: true,
      },
    ]);
    setNewVariantTitle('');
    setNewVariantPrice('');
    setNewVariantInventory('');
  };

  const removeVariantRow = (id: string) => {
    setEditingVariants((prev) => prev.filter((v) => v.id !== id));
  };

  const saveVariants = async () => {
    if (!variantEditorPack) return;
    setIsSavingVariants(true);
    setVariantError('');
    try {
      const res = await fetch('/api/vault/product', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
        body: JSON.stringify({
          sku: variantEditorPack.sku,
          drawer: variantEditorPack.drawer,
          productVariants: editingVariants,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: { productVariants: VaultProductVariant[] } = await res.json();
      setProducts((prev) =>
        prev.map((p) => (p.id === variantEditorPack.id ? { ...p, productVariants: data.productVariants } : p))
      );
      setVariantEditorPack(null);
    } catch (err) {
      setVariantError(err instanceof Error ? err.message : 'Failed to save variants.');
    } finally {
      setIsSavingVariants(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDeletePack = async (item: VaultProduct) => {
    if (!window.confirm(`Delete "${item.title}" and all ${item.tracks?.length ?? 0} file(s) inside it? This can't be undone.`)) {
      return;
    }
    setTrackActionError('');
    setDeletingPackIds((prev) => new Set(prev).add(item.id));
    try {
      const res = await fetch('/api/vault/product', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
        body: JSON.stringify({ sku: item.sku, drawer: item.drawer }),
      });
      if (!res.ok) throw new Error(await res.text());
      setProducts((prev) => prev.filter((p) => p.id !== item.id));
    } catch (err) {
      setTrackActionError(err instanceof Error ? err.message : 'Failed to delete pack.');
    } finally {
      setDeletingPackIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  const handleDeleteTrack = async (item: VaultProduct, filename: string) => {
    if (!window.confirm(`Delete "${filename}"? This can't be undone.`)) return;
    const key = `${item.id}:${filename}`;
    setTrackActionError('');
    setDeletingTrackKeys((prev) => new Set(prev).add(key));
    try {
      const res = await fetch('/api/vault/track', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeader()) },
        body: JSON.stringify({ sku: item.sku, drawer: item.drawer, filename }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: { product: VaultProduct | null; deleted: boolean } = await res.json();
      setProducts((prev) =>
        data.product
          ? prev.map((p) => (p.id === item.id ? (data.product as VaultProduct) : p))
          : prev.filter((p) => p.id !== item.id)
      );
    } catch (err) {
      setTrackActionError(err instanceof Error ? err.message : 'Failed to delete file.');
    } finally {
      setDeletingTrackKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const startEditWeight = (item: VaultProduct, filename: string, currentWeight: number) => {
    setEditingTrackKey(`${item.id}:${filename}`);
    setEditWeightValue(String(currentWeight));
    setTrackActionError('');
  };

  const cancelEditWeight = () => {
    setEditingTrackKey(null);
    setEditWeightValue('');
  };

  const saveEditWeight = async (item: VaultProduct, filename: string) => {
    const weight = Number(editWeightValue);
    if (!Number.isFinite(weight) || weight < 0) {
      setTrackActionError('Weight must be a non-negative number.');
      return;
    }
    try {
      const res = await fetch('/api/vault/track', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: securityPin.trim(), sku: item.sku, drawer: item.drawer, filename, weight }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data: { product: VaultProduct } = await res.json();
      setProducts((prev) => prev.map((p) => (p.id === item.id ? data.product : p)));
      cancelEditWeight();
    } catch (err) {
      setTrackActionError(err instanceof Error ? err.message : 'Failed to update weight.');
    }
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
    setUploadDrawer('MUSIC');
    setUploadDescription('');
    setUploadReadme('');
    setUploadPrice('');
    setUploadPublish(false);
    setUploadTags('');
    setUploadMetadata('');
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
    if (uploadPublish && (!uploadPrice.trim() || Number(uploadPrice) <= 0)) {
      setUploadError('A price is required to publish to the public storefront.');
      return;
    }
    if (uploadMetadata.trim()) {
      try {
        JSON.parse(uploadMetadata);
      } catch {
        setUploadError('Metadata must be valid JSON.');
        return;
      }
    }
    setIsUploading(true);
    setUploadError('');

    const form = new FormData();
    uploadFiles.forEach((file) => form.append('file', file));
    form.set('title', uploadTitle);
    form.set('sku', uploadSku);
    form.set('drawer', uploadDrawer);
    form.set('description', uploadDescription);
    form.set('readmeGuide', uploadReadme);
    if (uploadPrice.trim()) form.set('priceCents', String(Math.round(Number(uploadPrice) * 100)));
    form.set('isPublished', String(uploadPublish));
    form.set('tags', uploadTags);
    if (uploadMetadata.trim()) form.set('metadata', uploadMetadata);
    form.set('durations', JSON.stringify(uploadFiles.map((f) => fileDurations.get(f) ?? null)));

    try {
      const res = await fetch('/api/vault/upload', { method: 'POST', headers: await getAuthHeader(), body: form });
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
    <div className="relative z-10 w-full h-full overflow-y-auto text-slate-100 font-sans">
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
                {isAdmin && (
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="px-3 py-1.5 text-xs font-mono uppercase bg-neutral-800 hover:bg-neutral-700 text-white border border-neutral-700 rounded transition"
                  >
                    + Upload File
                  </button>
                )}
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
                      className="flex flex-col justify-between p-5 space-y-4 border bg-slate-900/45 backdrop-blur-[10px] border-slate-800 rounded-xl"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono">
                          <span className="px-2 py-0.5 bg-neutral-800/80 border border-neutral-700 text-white rounded">
                            {item.drawer}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-500">{item.dateAdded}</span>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeletePack(item)}
                                disabled={deletingPackIds.has(item.id)}
                                title="Delete entire pack"
                                className="flex items-center justify-center w-5 h-5 text-slate-500 transition rounded hover:text-rose-400 hover:bg-white/10 disabled:opacity-40"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <h3 className="text-base font-bold text-slate-100">{item.title}</h3>
                        <p className="text-xs text-slate-400">{item.description}</p>
                        <p className="font-mono text-[10px] text-slate-600">SKU: {item.sku}</p>
                        {isAdmin && (
                          <button
                            onClick={() => openVariantEditor(item)}
                            className="font-mono text-[10px] uppercase text-white/70 hover:text-white"
                          >
                            {item.productVariants && item.productVariants.length > 0
                              ? `${item.productVariants.length} Product Variant${item.productVariants.length !== 1 ? 's' : ''} →`
                              : '+ Add Product Variants'}
                          </button>
                        )}
                        {item.tags && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 text-[9px] font-mono rounded bg-slate-800/80 text-slate-400 border border-slate-700"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
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
                            {trackActionError && (
                              <p className="font-mono text-[10px] text-rose-400">{trackActionError}</p>
                            )}
                            {tracks.map((t, i) => {
                              const trackKey = `${item.id}:${t.filename}`;
                              const isEditing = editingTrackKey === trackKey;
                              const isDeleting = deletingTrackKeys.has(trackKey);

                              return (
                                <div key={`${t.filename}-${i}`} className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-xs truncate text-slate-300">{t.filename}</span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    {isEditing ? (
                                      <>
                                        <input
                                          type="number"
                                          min={0}
                                          step={0.5}
                                          value={editWeightValue}
                                          onChange={(e) => setEditWeightValue(e.target.value)}
                                          className="w-14 px-1.5 py-0.5 text-[10px] font-mono text-right border rounded bg-slate-950 border-neutral-700 text-white focus:outline-none focus:border-white/50"
                                          autoFocus
                                        />
                                        <button
                                          onClick={() => saveEditWeight(item, t.filename)}
                                          title="Save weight"
                                          className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300"
                                        >
                                          ✓
                                        </button>
                                        <button
                                          onClick={cancelEditWeight}
                                          title="Cancel"
                                          className="text-[10px] font-mono text-slate-500 hover:text-white"
                                        >
                                          ✕
                                        </button>
                                      </>
                                    ) : (
                                      <>
                                        <span className="text-[10px] font-mono text-slate-500">
                                          {formatBytes(t.sizeBytes)}
                                          {t.durationSeconds ? ` • ${formatDuration(t.durationSeconds)}` : ''}
                                          {` • W:${t.weight ?? 1}`}
                                        </span>
                                        <a
                                          href={t.fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="font-mono text-[10px] uppercase underline text-white/70 hover:text-white"
                                        >
                                          Download
                                        </a>
                                        <button
                                          onClick={() => startEditWeight(item, t.filename, t.weight ?? 1)}
                                          title="Edit rotation weight"
                                          className="text-slate-500 hover:text-white"
                                        >
                                          <Pencil className="w-3 h-3" />
                                        </button>
                                        {isAdmin && (
                                          <button
                                            onClick={() => handleDeleteTrack(item, t.filename)}
                                            disabled={isDeleting}
                                            title="Delete file"
                                            className="text-slate-500 hover:text-rose-400 disabled:opacity-40"
                                          >
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
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
              onChange={(e) => {
                const next = e.target.value as VaultDrawer;
                setUploadDrawer(next);
                if (next === 'ADMIN') setUploadPublish(false);
              }}
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
              type="text"
              placeholder="Tags, comma-separated (for Cmd+K search)"
              value={uploadTags}
              onChange={(e) => setUploadTags(e.target.value)}
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            />
            <textarea
              placeholder={'Metadata JSON, optional — e.g. {"frequency": "432Hz", "resolution": "4K"}'}
              value={uploadMetadata}
              onChange={(e) => setUploadMetadata(e.target.value)}
              rows={2}
              className="w-full p-3 font-mono text-sm border rounded-lg resize-none bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            />
            <input
              type="number"
              min={0}
              step={0.01}
              placeholder="Retail price (USD) — required to publish"
              value={uploadPrice}
              onChange={(e) => setUploadPrice(e.target.value)}
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
            />
            {uploadDrawer === 'ADMIN' ? (
              <p className="font-mono text-[10px] text-slate-500">
                ADMIN drawer items can&apos;t be published — they&apos;re for internal credentials and system files only.
              </p>
            ) : (
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={uploadPublish}
                  onChange={(e) => setUploadPublish(e.target.checked)}
                  className="w-4 h-4 rounded accent-white"
                />
                Publish to public storefront
              </label>
            )}
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

      {variantEditorPack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 space-y-4 border shadow-2xl bg-slate-900 border-neutral-700 rounded-xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-bold text-white">Product Variants</h3>
                <p className="font-mono text-[10px] text-slate-500">
                  {variantEditorPack.title} · SKU: {variantEditorPack.sku}
                </p>
              </div>
              <button
                onClick={() => setVariantEditorPack(null)}
                className="text-slate-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Sell this same source item as several separate storefront listings — e.g. a physical original and a
              digital license — each with its own price, type, and fulfillment. Leave empty to keep selling it as one
              plain listing via the price field above instead.
            </p>

            {editingVariants.length > 0 && (
              <div className="space-y-2">
                {editingVariants.map((variant) => (
                  <div
                    key={variant.id}
                    className="flex items-center justify-between gap-2 p-2.5 border rounded-lg bg-slate-950/60 border-slate-800"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">{variant.listingTitle}</p>
                      <p className="font-mono text-[10px] text-slate-500">
                        {variant.productType.replace(/_/g, ' ')} · {variant.fulfillmentType.replace(/_/g, ' ')} · $
                        {(variant.priceCents / 100).toFixed(2)}
                        {variant.inventoryCount !== undefined ? ` · qty ${variant.inventoryCount}` : ''}
                        {!variant.isAvailable ? ' · SOLD OUT' : ''}
                      </p>
                    </div>
                    <button
                      onClick={() => removeVariantRow(variant.id)}
                      title="Remove variant"
                      className="text-slate-500 hover:text-rose-400 shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 space-y-2 border rounded-lg border-slate-800 bg-slate-950/40">
              <p className="font-mono text-[10px] uppercase tracking-wide text-slate-500">Add a variant</p>
              <input
                type="text"
                placeholder="Listing title (e.g. Original Canvas, 1-of-1)"
                value={newVariantTitle}
                onChange={(e) => setNewVariantTitle(e.target.value)}
                className="w-full p-2.5 font-mono text-xs border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={newVariantProductType}
                  onChange={(e) => setNewVariantProductType(e.target.value as VaultVariantProductType)}
                  className="w-full p-2.5 font-mono text-xs border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
                >
                  {VARIANT_PRODUCT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <select
                  value={newVariantFulfillmentType}
                  onChange={(e) => setNewVariantFulfillmentType(e.target.value as VaultVariantFulfillmentType)}
                  className="w-full p-2.5 font-mono text-xs border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
                >
                  {VARIANT_FULFILLMENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  placeholder="Price (USD)"
                  value={newVariantPrice}
                  onChange={(e) => setNewVariantPrice(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
                />
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="Qty (blank = unlimited)"
                  value={newVariantInventory}
                  onChange={(e) => setNewVariantInventory(e.target.value)}
                  className="w-full p-2.5 font-mono text-xs border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
                />
              </div>
              <button
                type="button"
                onClick={addVariantRow}
                className="w-full py-2 font-mono text-xs font-bold uppercase transition border rounded-lg text-white/80 border-neutral-700 hover:border-neutral-500 hover:text-white hover:bg-white/10"
              >
                + Add Variant
              </button>
            </div>

            {variantError && <p className="font-mono text-xs text-rose-400">{variantError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setVariantEditorPack(null)}
                className="px-4 py-2 font-mono text-xs text-slate-400 hover:text-slate-200"
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={saveVariants}
                disabled={isSavingVariants}
                className="px-4 py-2 font-mono text-xs font-bold rounded-lg bg-white text-black hover:bg-neutral-200 disabled:opacity-50"
              >
                {isSavingVariants ? 'SAVING…' : 'SAVE VARIANTS'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

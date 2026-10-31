'use client';

// Admin-only channel-folder manager — replaces the old "+" button's
// ephemeral single-track "Upload Audio" modal (file/link/Internet Archive)
// entirely, per the owner's explicit confirmation: custom-named folders,
// admin-only, bulk + single upload, delete-by-X. See
// app/api/admin/radio-channels/* for the backing routes.

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, FolderPlus, Loader2, Pencil, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface FolderTrack {
  id: string;
  filename: string;
  sizeBytes: number;
}

interface FolderSummary {
  station: { id: string; folderId: string; name: string; badge: string; badgeColor: string; tagline: string };
  tracks: FolderTrack[];
}

interface ChannelFolderManagerProps {
  glassActive: string;
  glassIdle: string;
  subpanelStyle: React.CSSProperties;
  onFoldersChanged: () => void;
}

export default function ChannelFolderManager({ glassActive, glassIdle, subpanelStyle, onFoldersChanged }: ChannelFolderManagerProps) {
  const [folders, setFolders] = useState<FolderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [creating, setCreating] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  };

  const loadFolders = () => {
    setLoading(true);
    fetch('/api/admin/radio-channels')
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.folders)) setFolders(data.folders);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFolders();
  }, []);

  const handleCreateFolder = async () => {
    const name = newFolderName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const res = await fetch('/api/admin/radio-channels', {
        method: 'POST',
        headers: await authHeaders(),
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setNewFolderName('');
        loadFolders();
        onFoldersChanged();
      }
    } finally {
      setCreating(false);
    }
  };

  const handleRename = async (folderId: string) => {
    const name = renameValue.trim();
    if (!name) {
      setRenamingId(null);
      return;
    }
    const res = await fetch('/api/admin/radio-channels', {
      method: 'PATCH',
      headers: await authHeaders(),
      body: JSON.stringify({ id: folderId, name }),
    });
    setRenamingId(null);
    if (res.ok) {
      loadFolders();
      onFoldersChanged();
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    const res = await fetch('/api/admin/radio-channels', {
      method: 'DELETE',
      headers: await authHeaders(),
      body: JSON.stringify({ id: folderId }),
    });
    if (res.ok) {
      if (openFolderId === folderId) setOpenFolderId(null);
      loadFolders();
      onFoldersChanged();
    }
  };

  const handleDeleteTrack = async (folderId: string, trackId: string) => {
    setDeletingTrackId(trackId);
    try {
      const res = await fetch('/api/admin/radio-channels/track', {
        method: 'DELETE',
        headers: await authHeaders(),
        body: JSON.stringify({ folderId, trackId }),
      });
      if (res.ok) {
        loadFolders();
        onFoldersChanged();
      }
    } finally {
      setDeletingTrackId(null);
    }
  };

  // Bulk + single upload both go through the same path: mint one signed
  // upload URL per file (POST .../upload-url), PUT each file's bytes
  // straight to Supabase Storage, then finalize the metadata in one call
  // (POST .../upload) — same two-step shape the Vault's bulk uploader
  // already uses, which is what lets this handle many files at once
  // without hitting a serverless request body size limit.
  const handleFilesSelected = async (folderId: string, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    setUploading(true);
    setUploadError('');
    try {
      const headers = await authHeaders();
      const signRes = await fetch('/api/admin/radio-channels/upload-url', {
        method: 'POST',
        headers,
        body: JSON.stringify({ folderId, files: files.map((f) => ({ filename: f.name, sizeBytes: f.size })) }),
      });
      if (!signRes.ok) {
        setUploadError(await signRes.text());
        return;
      }
      const { bucket, uploads } = await signRes.json();

      // Straight browser-to-Storage upload via the signed token — same
      // supabase.storage.from(bucket).uploadToSignedUrl(...) call
      // lib/vaultDirectUpload.ts already uses for the Vault's bulk
      // uploader, bypassing this app's own serverless function body.
      const finalizedTracks: { filename: string; storagePath: string; sizeBytes: number }[] = [];
      for (const u of uploads) {
        if (!u.ok) continue;
        const file = files[u.index];
        const { error: putError } = await supabase.storage.from(bucket).uploadToSignedUrl(u.storagePath, u.token, file);
        if (!putError) {
          finalizedTracks.push({ filename: file.name, storagePath: u.storagePath, sizeBytes: file.size });
        }
      }

      if (finalizedTracks.length === 0) {
        setUploadError('No files uploaded successfully.');
        return;
      }

      const finalizeRes = await fetch('/api/admin/radio-channels/upload', {
        method: 'POST',
        headers,
        body: JSON.stringify({ folderId, tracks: finalizedTracks }),
      });
      if (!finalizeRes.ok) {
        setUploadError(await finalizeRes.text());
        return;
      }
      loadFolders();
      onFoldersChanged();
    } catch {
      setUploadError('Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const openFolder = folders.find((f) => f.station.folderId === openFolderId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
      </div>
    );
  }

  // Inside a folder: file list + upload controls.
  if (openFolder) {
    return (
      <div className="space-y-3">
        <button
          onClick={() => setOpenFolderId(null)}
          className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-slate-400 hover:text-white"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
          All Folders
        </button>
        <h3 className="text-sm font-bold text-white truncate">{openFolder.station.name}</h3>

        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className={`${glassActive} flex items-center justify-center w-full gap-2 py-3 text-xs font-bold uppercase tracking-wide rounded-lg disabled:opacity-50`}
        >
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? 'Uploading…' : 'Add Files (single or bulk)'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,.wav,.m4a,audio/*"
          multiple
          className="hidden"
          onChange={(e) => {
            handleFilesSelected(openFolder.station.folderId, e.target.files);
            e.target.value = '';
          }}
        />
        {uploadError && <p className="text-[11px] text-red-400">{uploadError}</p>}

        <div className="space-y-1 overflow-y-auto max-h-64">
          {openFolder.tracks.length === 0 ? (
            <p className="text-[10px] text-slate-500">No files yet — add some above.</p>
          ) : (
            openFolder.tracks.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 px-3 py-2 text-xs rounded-lg" style={subpanelStyle}>
                <span className="truncate text-slate-200">{t.filename}</span>
                <button
                  onClick={() => handleDeleteTrack(openFolder.station.folderId, t.id)}
                  disabled={deletingTrackId === t.id}
                  aria-label={`Remove ${t.filename}`}
                  title="Delete file"
                  className="flex items-center justify-center w-5 h-5 rounded-full shrink-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-40"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Folder list.
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
          placeholder="New channel name (e.g. 432, Ads)..."
          className="flex-1 px-3 py-2 text-xs rounded-lg outline-none"
          style={{ ...subpanelStyle, color: '#e2e8f0' }}
        />
        <button
          onClick={handleCreateFolder}
          disabled={creating || !newFolderName.trim()}
          className={`${glassActive} flex items-center gap-1.5 px-3 py-2 text-[10px] font-bold uppercase tracking-wide rounded-lg disabled:opacity-40`}
        >
          {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FolderPlus className="w-3.5 h-3.5" />}
          Create
        </button>
      </div>

      <div className="space-y-1.5 overflow-y-auto max-h-72">
        {folders.length === 0 ? (
          <p className="text-[10px] text-slate-500">No channel folders yet — create one above.</p>
        ) : (
          folders.map((f) => (
            <div key={f.station.folderId} className={`${glassIdle} flex items-center gap-2 p-2.5 rounded-lg`}>
              <div
                className="flex items-center justify-center w-8 h-8 text-[10px] font-bold rounded shrink-0"
                style={{ backgroundColor: f.station.badgeColor }}
              >
                {f.station.badge}
              </div>
              {renamingId === f.station.folderId ? (
                <input
                  autoFocus
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRename(f.station.folderId)}
                  onBlur={() => handleRename(f.station.folderId)}
                  className="flex-1 min-w-0 px-2 py-1 text-xs rounded outline-none"
                  style={{ ...subpanelStyle, color: '#e2e8f0' }}
                />
              ) : (
                <button onClick={() => setOpenFolderId(f.station.folderId)} className="flex-1 min-w-0 text-left">
                  <p className="text-xs font-bold truncate text-white">{f.station.name}</p>
                  <p className="text-[10px] truncate text-slate-500">{f.station.tagline}</p>
                </button>
              )}
              <button
                onClick={() => {
                  setRenamingId(f.station.folderId);
                  setRenameValue(f.station.name);
                }}
                aria-label={`Rename ${f.station.name}`}
                title="Rename"
                className="flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-slate-500 hover:text-cyan-300 hover:bg-cyan-500/10"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleDeleteFolder(f.station.folderId)}
                aria-label={`Delete ${f.station.name}`}
                title="Delete folder"
                className="flex items-center justify-center w-6 h-6 rounded-full shrink-0 text-slate-500 hover:text-red-400 hover:bg-red-500/10"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

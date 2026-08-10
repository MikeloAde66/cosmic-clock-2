'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowUpDown, Camera, Trash2 } from 'lucide-react';

interface Track {
  id: string;
  title: string;
  frequency: string;
  description: string;
  src: string;
  contentToRead: string;
  playlistId: string;
  isLocal?: boolean;
  embedUrl?: string;
  watchUrl?: string;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  isCustom?: boolean;
}

type PlaybackMode = 'autoplay' | 'random' | 'loop';

const DEFAULT_PLAYLISTS: Playlist[] = [
  { id: 'all', name: 'All Tracks', description: 'Master stream feed' },
  { id: 'pods', name: 'Pods', description: 'Main Podcast & Cosmic Lore Streams' },
  { id: 'main-playlist', name: 'Playlist', description: 'User Custom Media & Audio' },
];

const INITIAL_TRACKS: Track[] = [
  {
    id: '1',
    title: 'The Art & Science of Forest Bathing',
    frequency: 'Video / Science',
    description: 'Dr Qing Li on the biology of phytoncides and shinrin-yoku forest medicine. (Penguin Books UK)',
    src: '',
    embedUrl: 'https://www.youtube.com/embed/12CCjoixpkA',
    watchUrl: 'https://www.youtube.com/watch?v=12CCjoixpkA',
    playlistId: 'pods',
    contentToRead: `### Forest Bathing & Human Immunity\n\nDr Qing Li, the world's foremost expert in forest medicine, explains how trees emit airborne organic compounds (phytoncides) that lower stress hormones and enhance human immune function.`
  },
  {
    id: '2',
    title: 'Aeon Byte: A Gnostic View of the Soul',
    frequency: 'Video / Dialogue',
    description: 'Aeon Byte Gnostic Radio on the Hymn of the Pearl and the Exegesis from the Nag Hammadi library.',
    src: '',
    embedUrl: 'https://www.youtube.com/embed/CY2P9q7bEVY',
    watchUrl: 'https://www.youtube.com/watch?v=CY2P9q7bEVY',
    playlistId: 'pods',
    contentToRead: `### Historical & Cosmological Discourse\n\nAeon Byte Gnostic Radio examines two key Nag Hammadi scriptures on the fall and redemption of the soul: the Hymn of the Pearl and the Exegesis.`
  },
  {
    id: '3',
    title: 'Anil Seth: The Mystery of Consciousness',
    frequency: 'Video / Lecture',
    description: 'The TED Interview with neuroscientist Anil Seth on perception, prediction, and machine consciousness.',
    src: '',
    embedUrl: 'https://www.youtube.com/embed/aQVedpfKt88',
    watchUrl: 'https://www.youtube.com/watch?v=aQVedpfKt88',
    playlistId: 'pods',
    contentToRead: `### Cognitive Perception & Self-Awareness\n\nNeuroscientist Anil Seth explores his theory that consciousness is a controlled hallucination — the brain constantly predicting and constructing our perceived reality.`
  },
  {
    id: '4',
    title: 'The Precession of Equinox',
    frequency: 'Video / Ambient',
    description: 'A short visual on the slow astronomical cycle behind the Great Year. (The Randall Carlson)',
    src: '',
    embedUrl: 'https://www.youtube.com/embed/jnIBFXVWZXg',
    watchUrl: 'https://www.youtube.com/watch?v=jnIBFXVWZXg',
    playlistId: 'pods',
    contentToRead: `### The Great Year & Astronomical Alignment\n\nAncient timekeeping systems tracked vast epochs through the slow movement of the equinoxes across the zodiac constellations.`
  }
];

const formatTime = (seconds: number) => {
  if (isNaN(seconds) || seconds === 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export default function PodsModule() {
  const [playlists, setPlaylists] = useState<Playlist[]>(DEFAULT_PLAYLISTS);
  const [activePlaylistId, setActivePlaylistId] = useState<string>('pods');
  const [tracks, setTracks] = useState<Track[]>(INITIAL_TRACKS);
  const [activeTrack, setActiveTrack] = useState<Track>(INITIAL_TRACKS[0]);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('autoplay');

  // Timers & Audio State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);

  // Drag & Drop / EQ Visibility
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const [showEq, setShowEq] = useState<boolean>(false);

  // Camera / Simulcast Stream State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string>('');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Custom Video/Playlist Embed State
  const [mediaUrl, setMediaUrl] = useState<string>('');
  const [activeEmbedUrl, setActiveEmbedUrl] = useState<string>('');
  const [localVideoUrl, setLocalVideoUrl] = useState<string>('');
  const mediaFileInputRef = useRef<HTMLInputElement | null>(null);

  // EQ Audio Nodes
  const [eqGains, setEqGains] = useState<{ [freq: string]: number }>({
    '60': 0,
    '250': 2,
    '1000': 0,
    '4000': 1,
    '12000': 3,
  });
  const audioCtxRef = useRef<AudioContext | null>(null);
  const filtersRef = useRef<{ [freq: string]: BiquadFilterNode }>({});

  // Output Monitor: master volume + a real DynamicsCompressorNode for
  // broadcast-style loudness mastering. No spatial/surround processing —
  // Web Audio API doesn't decode or pass through real multichannel Dolby
  // bitstreams, so this only ever claims to do what it actually does.
  const [showOutputMonitor, setShowOutputMonitor] = useState<boolean>(false);
  const [masterVolume, setMasterVolume] = useState<number>(100);
  const [masteringPreset, setMasteringPreset] = useState<'flat' | 'broadcast'>('flat');
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);

  // Modals & Notifications
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');
  const [showAddPlaylistModal, setShowAddPlaylistModal] = useState(false);
  const [addPlaylistUrl, setAddPlaylistUrl] = useState('');
  const [isImportingPlaylist, setIsImportingPlaylist] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const overflowMenuRef = useRef<HTMLDivElement | null>(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Skips the auto-save effect's own first invocation on mount, since at that
  // point it would still see default state — the restore effect's setTracks/
  // setPlaylists calls haven't applied to a render yet, only been queued.
  const isFirstAutoSaveRef = useRef(true);

  // File Processing
  const processAudioFiles = (files: FileList | File[]) => {
    const targetPlaylist = activePlaylistId === 'all' ? 'main-playlist' : activePlaylistId;
    const newTracks: Track[] = Array.from(files).map((file, idx) => ({
      id: `upload-${Date.now()}-${idx}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      frequency: 'User Stream',
      description: `Local Audio • ${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      src: URL.createObjectURL(file),
      playlistId: targetPlaylist,
      isLocal: true,
      contentToRead: `### Loaded File: ${file.name}\n\n* **Type:** ${file.type || 'Audio Media'}\n* **Size:** ${(file.size / (1024 * 1024)).toFixed(2)} MB`
    }));

    setTracks((prev) => [...newTracks, ...prev]);
    setActiveTrack(newTracks[0]);
    setIsPlaying(true);
  };

  // Drag and Drop Event Handlers
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files?.length) {
      processAudioFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  // Close the overflow menu on outside click
  useEffect(() => {
    if (!showOverflowMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(e.target as Node)) {
        setShowOverflowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showOverflowMenu]);

  // Persistence Effects (Sanitize Local Storage Blob References)
  useEffect(() => {
    const savedPlaylists = localStorage.getItem('aione_playlists_v2');
    const savedTracks = localStorage.getItem('aione_tracks_v2');
    if (savedPlaylists) {
      try { setPlaylists(JSON.parse(savedPlaylists)); } catch (err) { console.error(err); }
    }
    if (savedTracks) {
      try {
        const parsed: Track[] = JSON.parse(savedTracks);
        // Clean out invalid blobs from previous browser sessions
        const validTracks = parsed.filter(t => !t.isLocal || t.src.startsWith('http'));
        if (validTracks.length > 0) {
          setTracks(validTracks);
          setActiveTrack(validTracks[0]);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  // Keep the Broadcast Monitor in sync with the active track whenever it's video-backed
  // (covers initial mount and localStorage restore, not just clicks handled by selectTrack)
  useEffect(() => {
    if (activeTrack?.embedUrl) {
      setMediaUrl(activeTrack.watchUrl || '');
      setActiveEmbedUrl(activeTrack.embedUrl);
    }
  }, [activeTrack]);

  const triggerSave = () => {
    // Exclude ephemeral blob URLs when persisting state to localStorage
    const storableTracks = tracks.filter(t => !t.isLocal);
    localStorage.setItem('aione_playlists_v2', JSON.stringify(playlists));
    localStorage.setItem('aione_tracks_v2', JSON.stringify(storableTracks));
    setSaveStatus('SESSION SAVED');
    setTimeout(() => setSaveStatus(''), 2500);
  };

  const exportSessionFile = () => {
    const sessionData = {
      playlists,
      tracks: tracks.filter(t => !t.isLocal),
      exportDate: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aione-session-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSaveStatus('FILE DOWNLOADED');
    setTimeout(() => setSaveStatus(''), 2500);
  };

  useEffect(() => {
    // Skip the first pass — at mount time this still sees default state,
    // since the restore effect's setTracks/setPlaylists calls above are only
    // queued, not yet applied to a render, when this first runs.
    if (isFirstAutoSaveRef.current) {
      isFirstAutoSaveRef.current = false;
      return;
    }
    const storableTracks = tracks.filter(t => !t.isLocal);
    localStorage.setItem('aione_playlists_v2', JSON.stringify(playlists));
    localStorage.setItem('aione_tracks_v2', JSON.stringify(storableTracks));
  }, [playlists, tracks]);

  // Audio Context & Equalizer
  const initAudioContext = () => {
    if (!audioCtxRef.current && audioRef.current) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaElementSource(audioRef.current);
      const frequencies = ['60', '250', '1000', '4000', '12000'];
      let prevFilter: BiquadFilterNode | null = null;

      frequencies.forEach((freq, idx) => {
        const filter = ctx.createBiquadFilter();
        if (idx === 0) filter.type = 'lowshelf';
        else if (idx === frequencies.length - 1) filter.type = 'highshelf';
        else filter.type = 'peaking';

        filter.frequency.value = parseInt(freq);
        filter.gain.value = eqGains[freq] || 0;
        filtersRef.current[freq] = filter;

        if (prevFilter) {
          prevFilter.connect(filter);
        } else {
          source.connect(filter);
        }
        prevFilter = filter;
      });

      const compressor = ctx.createDynamicsCompressor();
      applyCompressorValues(compressor, masteringPreset);
      compressorRef.current = compressor;

      if (prevFilter) {
        prevFilter.connect(compressor);
      } else {
        source.connect(compressor);
      }
      compressor.connect(ctx.destination);
    }
  };

  function applyCompressorValues(compressor: DynamicsCompressorNode, mode: 'flat' | 'broadcast') {
    const t = compressor.context.currentTime;
    if (mode === 'broadcast') {
      // Dense broadcast/radio-style loudness limiting
      compressor.threshold.setValueAtTime(-24, t);
      compressor.knee.setValueAtTime(30, t);
      compressor.ratio.setValueAtTime(12, t);
      compressor.attack.setValueAtTime(0.003, t);
      compressor.release.setValueAtTime(0.25, t);
    } else {
      // Gentle safety limiting only — near-transparent
      compressor.threshold.setValueAtTime(-12, t);
      compressor.knee.setValueAtTime(6, t);
      compressor.ratio.setValueAtTime(2, t);
      compressor.attack.setValueAtTime(0.02, t);
      compressor.release.setValueAtTime(0.3, t);
    }
  }

  const applyMasteringPreset = (mode: 'flat' | 'broadcast') => {
    setMasteringPreset(mode);
    if (compressorRef.current) {
      applyCompressorValues(compressorRef.current, mode);
    }
  };

  const handleMasterVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setMasterVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val / 100;
    }
  };

  const handleEqChange = (freq: string, gain: number) => {
    setEqGains((prev) => ({ ...prev, [freq]: gain }));
    if (filtersRef.current[freq]) {
      filtersRef.current[freq].gain.value = gain;
    }
  };

  const applyPreset = (preset: 'flat' | 'warm432' | 'vocal' | 'bass') => {
    let gains = { '60': 0, '250': 0, '1000': 0, '4000': 0, '12000': 0 };
    if (preset === 'warm432') gains = { '60': 3, '250': 4, '1000': 1, '4000': -1, '12000': 2 };
    if (preset === 'vocal') gains = { '60': -2, '250': 1, '1000': 4, '4000': 3, '12000': 1 };
    if (preset === 'bass') gains = { '60': 6, '250': 4, '1000': 0, '4000': 0, '12000': -1 };

    setEqGains(gains);
    Object.keys(gains).forEach((freq) => {
      if (filtersRef.current[freq]) {
        filtersRef.current[freq].gain.value = gains[freq as keyof typeof gains];
      }
    });
  };

  // Playback Control
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume();
        }
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, activeTrack]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setDuration(audioRef.current.duration || 0);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Camera Toggle
  const toggleCamera = async () => {
    setCameraError('');
    if (isCameraActive) {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
      setIsCameraActive(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setIsCameraActive(true);
      } catch {
        setCameraError('Camera offline or blocked. Click the browser permissions icon near URL bar to unblock.');
        setIsCameraActive(false);
      }
    }
  };

  // Parse & load a custom YouTube video/playlist or direct media URL into the monitor
  const loadMedia = () => {
    const input = mediaUrl.trim();
    if (!input) return;
    if (input.includes('list=')) {
      const listId = input.split('list=')[1]?.split('&')[0];
      setActiveEmbedUrl(`https://www.youtube.com/embed/videoseries?list=${listId}`);
    } else if (input.includes('watch?v=')) {
      const videoId = input.split('v=')[1]?.split('&')[0];
      setActiveEmbedUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1`);
    } else if (input.includes('youtu.be/')) {
      const videoId = input.split('youtu.be/')[1]?.split('?')[0];
      setActiveEmbedUrl(`https://www.youtube.com/embed/${videoId}?autoplay=1`);
    } else {
      setActiveEmbedUrl(input);
    }
  };

  const clearMedia = () => {
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    setLocalVideoUrl('');
    setActiveEmbedUrl('');
    setMediaUrl('');
  };

  const handleLocalVideoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
    setActiveEmbedUrl('');
    setLocalVideoUrl(URL.createObjectURL(file));
    e.target.value = '';
  };

  // Selecting a track: routes video-backed tracks into the Broadcast Monitor,
  // and audio-backed tracks into the <audio> player, clearing the other each time.
  const selectTrack = (track: Track) => {
    setActiveTrack(track);
    if (track.embedUrl) {
      setIsPlaying(false);
      if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
      setLocalVideoUrl('');
      setMediaUrl(track.watchUrl || '');
      setActiveEmbedUrl(track.embedUrl);
    } else {
      setActiveEmbedUrl('');
      setMediaUrl('');
      if (localVideoUrl) URL.revokeObjectURL(localVideoUrl);
      setLocalVideoUrl('');
      setIsPlaying(true);
    }
  };

  const filteredTracks = activePlaylistId === 'all'
    ? tracks
    : tracks.filter(t => t.playlistId === activePlaylistId);

  const deleteTrack = (e: React.MouseEvent, trackId: string) => {
    e.stopPropagation(); // don't let this also trigger the row's selectTrack click
    const target = tracks.find(t => t.id === trackId);
    if (target?.isLocal) {
      URL.revokeObjectURL(target.src); // free the blob now that nothing will reference it
    }

    setTracks(prev => prev.filter(t => t.id !== trackId));

    if (activeTrack?.id === trackId) {
      const remaining = filteredTracks.filter(t => t.id !== trackId);
      if (remaining.length > 0) {
        selectTrack(remaining[0]);
      }
    }
  };

  const handleTrackEnd = () => {
    if (filteredTracks.length === 0) return;
    if (playbackMode === 'loop') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else if (playbackMode === 'random') {
      const randomIndex = Math.floor(Math.random() * filteredTracks.length);
      selectTrack(filteredTracks[randomIndex]);
    } else {
      const currentIndex = filteredTracks.findIndex(t => t.id === activeTrack?.id);
      const nextIndex = (currentIndex + 1) % filteredTracks.length;
      selectTrack(filteredTracks[nextIndex]);
    }
  };

  const handleNextTrack = () => {
    if (filteredTracks.length === 0) return;
    const currentIndex = filteredTracks.findIndex(t => t.id === activeTrack?.id);
    selectTrack(filteredTracks[(currentIndex + 1) % filteredTracks.length]);
  };

  const handlePrevTrack = () => {
    if (filteredTracks.length === 0) return;
    const currentIndex = filteredTracks.findIndex(t => t.id === activeTrack?.id);
    selectTrack(filteredTracks[(currentIndex - 1 + filteredTracks.length) % filteredTracks.length]);
  };

  // Bluetooth / lock-screen media controls (Web MediaSession API).
  // Only applies to real <audio> playback — video tracks play inside a
  // cross-origin YouTube iframe, which handles its own Bluetooth/lock-screen
  // integration natively; we can't and shouldn't override that from here.
  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator)) return;

    if (!activeTrack || activeTrack.embedUrl) {
      navigator.mediaSession.metadata = null;
      return;
    }

    navigator.mediaSession.metadata = new MediaMetadata({
      title: activeTrack.title,
      artist: activeTrack.frequency,
      album: 'AIONE Cosmic HUD — Pods',
    });

    navigator.mediaSession.setActionHandler('play', () => setIsPlaying(true));
    navigator.mediaSession.setActionHandler('pause', () => setIsPlaying(false));
    navigator.mediaSession.setActionHandler('previoustrack', handlePrevTrack);
    navigator.mediaSession.setActionHandler('nexttrack', handleNextTrack);

    return () => {
      navigator.mediaSession.setActionHandler('play', null);
      navigator.mediaSession.setActionHandler('pause', null);
      navigator.mediaSession.setActionHandler('previoustrack', null);
      navigator.mediaSession.setActionHandler('nexttrack', null);
    };
  }, [activeTrack, handlePrevTrack, handleNextTrack]);

  useEffect(() => {
    if (typeof window === 'undefined' || !('mediaSession' in navigator) || activeTrack?.embedUrl) return;
    navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
  }, [isPlaying, activeTrack]);

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    const newPl: Playlist = {
      id: `pl-${Date.now()}`,
      name: newPlaylistName.trim(),
      description: 'Custom user created playlist',
      isCustom: true
    };

    setPlaylists((prev) => [...prev, newPl]);
    setActivePlaylistId(newPl.id);
    setNewPlaylistName('');
    setShowCreateModal(false);
  };

  // Parse a pasted YouTube video/playlist URL (or direct media link) into a new Playlist track,
  // fetching the real title via YouTube's public oEmbed endpoint (no API key required).
  const handleImportPlaylistUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = addPlaylistUrl.trim();
    if (!url) return;
    setIsImportingPlaylist(true);

    let embedUrl = '';
    const isPlaylistOnly = url.includes('list=') && !url.includes('watch?v=') && !url.includes('youtu.be/');
    if (isPlaylistOnly) {
      const listId = url.split('list=')[1]?.split('&')[0];
      embedUrl = `https://www.youtube.com/embed/videoseries?list=${listId}`;
    } else if (url.includes('watch?v=')) {
      const videoId = url.split('v=')[1]?.split('&')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else if (url.includes('youtu.be/')) {
      const videoId = url.split('youtu.be/')[1]?.split('?')[0];
      embedUrl = `https://www.youtube.com/embed/${videoId}`;
    } else {
      embedUrl = url;
    }

    let title = isPlaylistOnly ? 'YouTube Playlist' : 'Imported Media';
    let description = url;
    try {
      const res = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`);
      if (res.ok) {
        const data = await res.json();
        if (data.title) title = data.title;
        if (data.author_name) description = data.author_name;
      }
    } catch {
      // oEmbed can fail for playlist-only URLs or network issues — keep the fallback label
    }

    const newTrack: Track = {
      id: `playlist-${Date.now()}`,
      title,
      frequency: isPlaylistOnly ? 'YouTube Playlist' : 'YouTube Video',
      description,
      src: '',
      embedUrl,
      watchUrl: url,
      playlistId: 'main-playlist',
      contentToRead: `### ${title}\n\nImported from: ${url}`,
    };

    setTracks((prev) => [newTrack, ...prev]);
    setActivePlaylistId('main-playlist');
    selectTrack(newTrack);
    setAddPlaylistUrl('');
    setIsImportingPlaylist(false);
    setShowAddPlaylistModal(false);
  };

  const handleDeletePlaylist = (idToDelete: string) => {
    if (['all', 'pods', 'main-playlist'].includes(idToDelete)) return;

    const updatedTracks = tracks.filter(t => t.playlistId !== idToDelete);
    setPlaylists((prev) => prev.filter(p => p.id !== idToDelete));
    setTracks(updatedTracks);
    setActivePlaylistId('pods');

    // Fallback if current active track belonged to deleted playlist
    if (activeTrack?.playlistId === idToDelete) {
      if (updatedTracks.length > 0) {
        setActiveTrack(updatedTracks[0]);
      }
    }
  };

  const activePlaylistObj = playlists.find(p => p.id === activePlaylistId);

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`p-8 max-w-6xl mx-auto space-y-6 relative transition ${
        isDraggingOver ? 'bg-white/10 border-2 border-dashed border-neutral-700 rounded-2xl' : ''
      }`}
    >
      <audio
        ref={audioRef}
        src={activeTrack?.src || undefined}
        onPlay={initAudioContext}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleTrackEnd}
      />

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files) {
            processAudioFiles(e.target.files);
            setShowUploadModal(false);
          }
        }}
        accept="audio/*"
        multiple
        className="hidden"
      />

      {/* Header Bar */}
      <div className="flex items-center justify-between min-h-[44px] gap-4">
        <h2 className="text-sm font-mono font-bold tracking-widest text-white uppercase whitespace-nowrap">
          AUDIO & CONTENT PODS
        </h2>

        {/* Reserved banner slot — dormant for now, activated later */}
        <div className="flex items-center justify-center flex-1 h-8 border border-dashed rounded-md border-neutral-700 bg-white/[0.03]">
          <span className="text-[10px] font-mono tracking-widest uppercase text-white/70">
            Banner Reserved
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {saveStatus && (
            <span className="text-[11px] font-mono text-emerald-400 animate-pulse bg-emerald-950/60 border border-emerald-800 px-2 py-1 rounded">
              {saveStatus}
            </span>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="h-8 px-3 text-[11px] font-mono uppercase tracking-wide transition border rounded bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
          >
            + Playlist
          </button>

          <button
            onClick={() => setShowUploadModal(true)}
            className="h-8 px-3 text-[11px] font-mono uppercase tracking-wide transition border rounded bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
          >
            + Upload
          </button>

          <button
            onClick={() => mediaFileInputRef.current?.click()}
            title="Browse a local video file for the Broadcast Monitor"
            className="flex items-center justify-center w-8 h-8 transition border rounded bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
          >
            <ArrowUpDown className="w-4 h-4" />
          </button>

          <div className="relative" ref={overflowMenuRef}>
            <button
              onClick={() => setShowOverflowMenu((v) => !v)}
              className="flex items-center justify-center w-8 h-8 font-bold transition border rounded bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
              aria-label="More options"
              title="More options"
            >
              ⋮
            </button>

            {showOverflowMenu && (
              <div className="absolute right-0 z-50 py-1 mt-2 border rounded-md shadow-lg w-40 bg-slate-900 border-neutral-700">
                {[
                  { label: 'Load Link', action: loadMedia },
                  ...(activeEmbedUrl.includes('youtube.com')
                    ? [{ label: 'Open on YouTube', action: () => window.open(mediaUrl, '_blank', 'noopener,noreferrer') }]
                    : []),
                  { label: 'Download', action: exportSessionFile },
                  { label: 'Save', action: triggerSave },
                  { label: 'Save As', action: exportSessionFile },
                  { label: 'Save Session', action: triggerSave },
                  { label: 'Help', action: () => setShowHelpModal(true) },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => {
                      item.action();
                      setShowOverflowMenu(false);
                    }}
                    className="w-full px-3 py-1.5 text-left text-[11px] font-mono text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Playlist Selector */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex gap-2 overflow-x-auto">
          {playlists.map((pl) => (
            <div key={pl.id} className="flex items-center gap-1">
              <button
                onClick={() => setActivePlaylistId(pl.id)}
                className={`px-4 py-2 rounded-lg text-xs font-mono transition whitespace-nowrap ${
                  activePlaylistId === pl.id
                    ? 'bg-white/20 text-white border border-neutral-700'
                    : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:border-slate-700'
                }`}
              >
                {pl.name}
              </button>

              {pl.id === 'main-playlist' && (
                <>
                  <button
                    onClick={() => setShowAddPlaylistModal(true)}
                    title="Add a YouTube video or playlist link"
                    className="flex items-center justify-center w-6 h-6 font-bold transition border rounded-lg bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
                  >
                    +
                  </button>
                  <button
                    onClick={triggerSave}
                    title="Save Playlist"
                    className="flex items-center justify-center w-6 h-6 text-xs transition border rounded-lg bg-slate-900/60 border-neutral-700 text-white/70 hover:border-neutral-500 hover:text-white hover:bg-white/10"
                  >
                    💾
                  </button>
                </>
              )}
            </div>
          ))}
        </div>

        {activePlaylistObj?.isCustom && (
          <button
            onClick={() => handleDeletePlaylist(activePlaylistId)}
            className="px-3 py-1 ml-2 font-mono text-xs text-red-400 transition border rounded hover:text-red-300 bg-red-950/40 border-red-900/50 whitespace-nowrap"
          >
            DELETE PLAYLIST
          </button>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        {/* Left Column: Player & EQ */}
        <div className="space-y-4 lg:col-span-5">
          {activeTrack ? (
            <div className="p-5 space-y-4 border bg-slate-900/90 border-neutral-700 rounded-xl backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-block px-2 py-0.5 bg-white/10 text-white text-xs font-mono rounded">
                  {activeTrack.frequency}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEq(!showEq)}
                    className={`px-2 py-1 border rounded text-xs font-mono transition ${
                      showEq
                        ? 'bg-white/20 border-neutral-700 text-white'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    EQ
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => setShowOutputMonitor(!showOutputMonitor)}
                      title="Output Volume & Mastering"
                      className={`px-2 py-1 border rounded text-xs font-mono transition ${
                        showOutputMonitor || masteringPreset !== 'flat'
                          ? 'bg-white/20 border-neutral-700 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      VC
                    </button>

                    {showOutputMonitor && (
                      <div className="absolute left-0 z-50 p-4 mt-2 border shadow-2xl w-64 rounded-xl bg-slate-950 border-neutral-700">
                        <div className="flex items-center justify-between mb-3">
                          <span className="font-bold text-slate-300">OUTPUT MONITOR</span>
                          <span className="text-white">{masterVolume}%</span>
                        </div>

                        <div className="mb-4">
                          <label className="block mb-1 text-slate-400">Master Volume</label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={masterVolume}
                            onChange={handleMasterVolumeChange}
                            className="w-full h-1 rounded cursor-pointer accent-white bg-slate-800"
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="block text-slate-400">Mastering</label>
                          <button
                            onClick={() => applyMasteringPreset('broadcast')}
                            className={`w-full py-1.5 px-2 rounded text-left transition ${
                              masteringPreset === 'broadcast' ? 'bg-white/20 text-white' : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            • Broadcast (dense limiting)
                          </button>
                          <button
                            onClick={() => applyMasteringPreset('flat')}
                            className={`w-full py-1.5 px-2 rounded text-left transition ${
                              masteringPreset === 'flat' ? 'bg-white/20 text-white' : 'bg-slate-900 hover:bg-slate-800 text-slate-300'
                            }`}
                          >
                            • Flat (near-transparent)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <select
                    value={playbackMode}
                    onChange={(e) => setPlaybackMode(e.target.value as PlaybackMode)}
                    className="px-2 py-1 font-mono text-xs border rounded bg-slate-950 text-slate-300 border-slate-800 focus:outline-none focus:border-white/50"
                  >
                    <option value="autoplay">Mode: Autoplay Next</option>
                    <option value="random">Mode: Random Play</option>
                    <option value="loop">Mode: Loop Track</option>
                  </select>
                </div>
              </div>

              <div>
                <h3 className="mb-1 text-xl font-bold text-white truncate">{activeTrack.title}</h3>
                <p className="text-xs truncate text-slate-400">{activeTrack.description}</p>
              </div>

              {!activeTrack.embedUrl && (
                <div className="space-y-1">
                  <input
                    type="range"
                    min={0}
                    max={duration || 100}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full accent-white bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between font-mono text-xs text-white/70">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(duration)}</span>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevTrack}
                  className="px-4 py-3 font-mono text-xs font-bold transition rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                >
                  ◀◀
                </button>

                {activeTrack.embedUrl ? (
                  <div className="flex-1 py-3 text-sm font-bold tracking-wide text-center rounded-lg bg-slate-950 border border-neutral-700 text-white">
                    ▶ PLAYING IN BROADCAST MONITOR →
                  </div>
                ) : (
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex-1 py-3 text-sm font-bold tracking-wide transition rounded-lg bg-white hover:bg-neutral-200 text-slate-950"
                  >
                    {isPlaying ? 'PAUSE STREAM' : 'PLAY STREAM'}
                  </button>
                )}

                <button
                  onClick={handleNextTrack}
                  className="px-4 py-3 font-mono text-xs font-bold transition rounded-lg bg-slate-800 hover:bg-slate-700 text-white"
                >
                  ▶▶
                </button>
              </div>

              {showEq && (
                <div className="pt-3 space-y-3 transition-all border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs tracking-wider uppercase text-white">
                      Parametric Equalizer
                    </span>
                    <div className="flex gap-1 text-[10px] font-mono">
                      <button onClick={() => applyPreset('flat')} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700">FLAT</button>
                      <button onClick={() => applyPreset('warm432')} className="px-1.5 py-0.5 bg-white/20 text-white rounded hover:bg-white/10">432Hz WARM</button>
                      <button onClick={() => applyPreset('vocal')} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700">VOCAL</button>
                      <button onClick={() => applyPreset('bass')} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700">BASS</button>
                    </div>
                  </div>

                  <div className="grid grid-cols-5 gap-2 pt-1">
                    {[
                      { freq: '60', label: '60Hz' },
                      { freq: '250', label: '250Hz' },
                      { freq: '1000', label: '1kHz' },
                      { freq: '4000', label: '4kHz' },
                      { freq: '12000', label: '12kHz' },
                    ].map((band) => (
                      <div key={band.freq} className="flex flex-col items-center space-y-1">
                        <input
                          type="range"
                          min={-12}
                          max={12}
                          step={1}
                          value={eqGains[band.freq] || 0}
                          onChange={(e) => handleEqChange(band.freq, parseFloat(e.target.value))}
                          className="h-16 accent-white bg-slate-950 rounded cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                        />
                        <span className="text-[10px] font-mono text-slate-400">{band.label}</span>
                        <span className="text-[9px] font-mono text-white">{eqGains[band.freq] > 0 ? `+${eqGains[band.freq]}` : eqGains[band.freq]}dB</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="p-6 font-mono text-xs text-center border bg-slate-900/40 border-slate-800 rounded-xl text-slate-500">
              NO TRACK SELECTED
            </div>
          )}

          <div className="space-y-2">
            <h4 className="px-1 font-mono text-xs tracking-wider uppercase text-slate-500">
              Tracks ({filteredTracks.length})
            </h4>
            <div className="pr-1 space-y-2 overflow-y-auto max-h-56">
              {filteredTracks.map((track) => (
                <div
                  key={track.id}
                  onClick={() => selectTrack(track)}
                  className={`p-3.5 rounded-lg border cursor-pointer transition flex justify-between items-center ${
                    activeTrack?.id === track.id
                      ? 'border-neutral-700 bg-white/10 text-white'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="mr-2 overflow-hidden">
                    <p className="text-xs font-semibold truncate text-slate-200">{track.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{track.description}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[10px] font-mono text-white/70">{track.frequency}</span>
                    <button
                      onClick={(e) => deleteTrack(e, track.id)}
                      title="Delete Track"
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Camera & Reader */}
        <div className="flex flex-col space-y-4 lg:col-span-7">
          {(
            <div className="p-4 space-y-3 border bg-slate-950 border-neutral-700 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-xs tracking-wider uppercase text-white">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  Podcasts & Broadcast Monitor
                </span>
                <button
                  onClick={toggleCamera}
                  className={`px-4 py-1.5 rounded-full text-xs font-mono uppercase tracking-wider transition flex items-center gap-1.5 ${
                    isCameraActive
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : 'bg-white text-black font-bold hover:bg-neutral-200'
                  }`}
                >
                  {isCameraActive ? (
                    'Stop Broadcast'
                  ) : (
                    <>
                      <Camera className="w-3.5 h-3.5" /> Pod Cam
                    </>
                  )}
                </button>
              </div>

              <input
                type="file"
                ref={mediaFileInputRef}
                onChange={handleLocalVideoSelect}
                accept="video/*"
                className="hidden"
              />

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  loadMedia();
                }}
                className="flex flex-wrap gap-2"
              >
                <input
                  type="text"
                  value={mediaUrl}
                  onChange={(e) => setMediaUrl(e.target.value)}
                  placeholder="Paste YouTube video/playlist URL or direct media link..."
                  className="flex-1 min-w-[180px] px-3 py-1.5 text-xs bg-slate-900 border border-slate-800 rounded font-mono text-slate-300 focus:outline-none focus:border-white/50"
                />
                {(activeEmbedUrl || localVideoUrl) && (
                  <button
                    onClick={clearMedia}
                    className="px-3 py-1.5 rounded text-xs font-mono transition bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200 whitespace-nowrap"
                  >
                    CLEAR
                  </button>
                )}
              </form>

              {cameraError && (
                <div className="p-2 font-mono text-xs text-red-300 border border-red-800 rounded bg-red-950/60">
                  {cameraError}
                </div>
              )}

              <div className="relative flex items-center justify-center overflow-hidden border rounded-lg aspect-video bg-slate-900 border-slate-800">
                {localVideoUrl ? (
                  <video src={localVideoUrl} controls autoPlay className="w-full h-full object-cover" />
                ) : activeEmbedUrl ? (
                  activeEmbedUrl.endsWith('.mp4') || activeEmbedUrl.endsWith('.webm') ? (
                    <video src={activeEmbedUrl} controls className="w-full h-full object-cover" />
                  ) : (
                    <iframe
                      src={activeEmbedUrl}
                      title="Broadcast Monitor Video Embed"
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  )
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className={`w-full h-full object-cover ${isCameraActive ? 'block' : 'hidden'}`}
                    />
                    {!isCameraActive && (
                      <div className="p-6 space-y-2 text-center">
                        <p className="font-mono text-xs text-slate-400">BROADCAST MONITOR STANDBY</p>
                        <p className="text-slate-600 text-[11px] max-w-sm mx-auto">
                          Click &quot;Start Camera&quot; above or paste a link to display video input.
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col justify-between flex-1 p-6 border bg-slate-900/60 border-slate-800 rounded-xl">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <span className="font-mono text-xs tracking-wider uppercase truncate text-white">
                  Reading Material • {activeTrack?.title || 'No Selection'}
                </span>
                <span className="font-mono text-xs text-slate-500">FORMAT: LORE / TEXT</span>
              </div>

              <div className="space-y-4 text-sm leading-relaxed prose prose-invert prose-amber max-w-none text-slate-300">
                <ReactMarkdown>
                  {activeTrack?.contentToRead || 'Select a track to read its synchronized notes.'}
                </ReactMarkdown>
              </div>
            </div>

            <div className="flex items-center justify-between pt-4 mt-8 font-mono text-xs border-t border-slate-800/60 text-slate-500">
              <span>AUDIO & VIDEO ENGINE: READY</span>
              <span>5-BAND EQ: {showEq ? 'VISIBLE' : 'HIDDEN'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal: Add YouTube Video/Playlist to Playlist */}
      {showAddPlaylistModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleImportPlaylistUrl} className="w-full max-w-md p-6 space-y-4 border shadow-2xl bg-slate-900 border-neutral-700 rounded-xl">
            <h3 className="text-lg font-bold text-white">Add Media / YouTube Playlist</h3>
            <p className="text-xs text-slate-400">Paste a YouTube video or playlist link to add it to your Playlist.</p>
            <input
              type="url"
              placeholder="Paste YouTube video or playlist URL..."
              value={addPlaylistUrl}
              onChange={(e) => setAddPlaylistUrl(e.target.value)}
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
              autoFocus
              required
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowAddPlaylistModal(false)}
                className="px-4 py-2 font-mono text-xs text-slate-400 hover:text-slate-200"
              >
                CANCEL
              </button>
              <button
                type="submit"
                disabled={isImportingPlaylist}
                className="px-4 py-2 font-mono text-xs font-bold rounded-lg bg-white text-black hover:bg-neutral-200 disabled:opacity-50"
              >
                {isImportingPlaylist ? 'IMPORTING…' : 'IMPORT'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Create Playlist */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleCreatePlaylist} className="w-full max-w-md p-6 space-y-4 border shadow-2xl bg-slate-900 border-neutral-700 rounded-xl">
            <h3 className="text-lg font-bold text-white">Create New Playlist</h3>
            <p className="text-xs text-slate-400">Enter a title below to organize your audio tracks and podcasts.</p>
            <input
              type="text"
              placeholder="Playlist Name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-white/50"
              autoFocus
            />
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 font-mono text-xs text-slate-400 hover:text-slate-200"
              >
                CANCEL
              </button>
              <button
                type="submit"
                className="px-4 py-2 font-mono text-xs font-bold rounded-lg bg-white text-black hover:bg-neutral-200"
              >
                CREATE & OPEN
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Upload Files Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="relative w-full max-w-md p-6 border shadow-2xl bg-slate-900 border-neutral-700 rounded-xl">
            <button
              onClick={() => setShowUploadModal(false)}
              className="absolute text-slate-500 top-4 right-4 hover:text-white"
              aria-label="Close"
            >
              ✕
            </button>

            <h3 className="mb-1 text-lg font-bold text-white">Upload Files</h3>
            <p className="mb-6 text-xs text-slate-400">
              Select local audio files to add to <span className="font-semibold text-white">{activePlaylistObj?.name || 'this playlist'}</span>.
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center w-full gap-2 p-8 mb-6 text-center transition border-2 border-dashed rounded-lg cursor-pointer border-neutral-700 bg-slate-950/50 hover:border-neutral-500 hover:bg-slate-950"
            >
              <span className="text-3xl text-slate-500">⇧</span>
              <span className="text-xs font-semibold text-slate-200">Click to browse local files</span>
              <span className="text-[10px] text-slate-500">Or drag audio files anywhere on this page</span>
            </button>

            <div className="flex justify-end">
              <button
                onClick={() => setShowUploadModal(false)}
                className="px-4 py-2 font-mono text-xs uppercase text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 space-y-4 border bg-slate-900 border-slate-800 rounded-xl">
            <h3 className="pb-2 text-lg font-bold border-b text-white border-slate-800">
              Pods Hub & Audio Studio Instructions
            </h3>
            <div className="space-y-2 font-sans text-xs leading-relaxed text-slate-300">
              <p>• <strong>Creating Playlists:</strong> Click <code>+ NEW PLAYLIST</code> to open the creation dialog.</p>
              <p>• <strong>Parametric Equalizer:</strong> Toggle the <code>EQ</code> button next to the autoplay menu to adjust audio bands.</p>
              <p>• <strong>Downloading Sessions:</strong> Click the <strong>Download Arrow (↓)</strong> button to download free session files directly to your device.</p>
            </div>
            <div className="flex justify-end pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowHelpModal(false)}
                className="px-4 py-2 font-mono text-xs font-bold rounded-lg bg-white text-black"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
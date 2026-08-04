'use client';

import React, { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface Track {
  id: string;
  title: string;
  frequency: string;
  description: string;
  src: string;
  contentToRead: string;
  playlistId: string;
  isLocal?: boolean;
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
  { id: 'main-playlist', name: 'Main Playlist', description: 'User Custom Media & Audio' },
];

const INITIAL_TRACKS: Track[] = [
  {
    id: '1',
    title: 'The Science & Biology of Forest Bathing',
    frequency: 'Spoken / Science',
    description: 'Biological physics of phytoncides, forest canopy biochemistry, and cellular grounding. Pure spoken lecture.',
    src: '/audio/forest-bathing-spoken.mp3',
    playlistId: 'pods',
    contentToRead: `### Forest Bathing & Human Immunity\n\nPure spoken breakdown on how trees emit airborne organic compounds (phytoncides) that lower stress hormones and enhance human immune function without background music.`
  },
  {
    id: '2',
    title: 'Aeon Byte: Gnostic Texts & Nag Hammadi',
    frequency: 'Spoken / Dialogue',
    description: 'In-depth interview and scholarly breakdown of ancient Nag Hammadi texts, Archons, and cosmic lore. Pure spoken dialogue.',
    src: '/audio/gnostic-spoken.mp3',
    playlistId: 'pods',
    contentToRead: `### Historical & Cosmological Discourse\n\nAnalytical conversation examining ancient time frameworks, esoteric cosmology, and historical texts presented as direct interview dialogue.`
  },
  {
    id: '3',
    title: 'Neuroscience & Consciousness with Anil Seth',
    frequency: 'Spoken / Lecture',
    description: 'Cognitive neuroscience, biological awareness vs. AI, and perception mechanics. Direct spoken podcast format.',
    src: '/audio/neuroscience-spoken.mp3',
    playlistId: 'pods',
    contentToRead: `### Cognitive Perception & Self-Awareness\n\nDetailed spoken discourse exploring biological awareness, machine perception, and human cognitive architecture.`
  },
  {
    id: '4',
    title: 'Precession Alignment',
    frequency: '432 Hz',
    description: 'Harmonic ambient weave tracking subtle earth cycles.',
    src: '/audio/precession.mp3',
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

  // Modals & Notifications
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('');

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Persistence Effects (Sanitize Local Storage Blob References)
  useEffect(() => {
    const savedPlaylists = localStorage.getItem('aione_playlists');
    const savedTracks = localStorage.getItem('aione_tracks');
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

  const triggerSave = () => {
    // Exclude ephemeral blob URLs when persisting state to localStorage
    const storableTracks = tracks.filter(t => !t.isLocal);
    localStorage.setItem('aione_playlists', JSON.stringify(playlists));
    localStorage.setItem('aione_tracks', JSON.stringify(storableTracks));
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
    const storableTracks = tracks.filter(t => !t.isLocal);
    localStorage.setItem('aione_playlists', JSON.stringify(playlists));
    localStorage.setItem('aione_tracks', JSON.stringify(storableTracks));
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

      if (prevFilter) {
        prevFilter.connect(ctx.destination);
      }
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

  const filteredTracks = activePlaylistId === 'all'
    ? tracks
    : tracks.filter(t => t.playlistId === activePlaylistId);

  const handleTrackEnd = () => {
    if (filteredTracks.length === 0) return;
    if (playbackMode === 'loop') {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else if (playbackMode === 'random') {
      const randomIndex = Math.floor(Math.random() * filteredTracks.length);
      setActiveTrack(filteredTracks[randomIndex]);
      setIsPlaying(true);
    } else {
      const currentIndex = filteredTracks.findIndex(t => t.id === activeTrack?.id);
      const nextIndex = (currentIndex + 1) % filteredTracks.length;
      setActiveTrack(filteredTracks[nextIndex]);
      setIsPlaying(true);
    }
  };

  const handleNextTrack = () => {
    if (filteredTracks.length === 0) return;
    const currentIndex = filteredTracks.findIndex(t => t.id === activeTrack?.id);
    setActiveTrack(filteredTracks[(currentIndex + 1) % filteredTracks.length]);
    setIsPlaying(true);
  };

  const handlePrevTrack = () => {
    if (filteredTracks.length === 0) return;
    const currentIndex = filteredTracks.findIndex(t => t.id === activeTrack?.id);
    setActiveTrack(filteredTracks[(currentIndex - 1 + filteredTracks.length) % filteredTracks.length]);
    setIsPlaying(true);
  };

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
        isDraggingOver ? 'bg-amber-500/10 border-2 border-dashed border-amber-500 rounded-2xl' : ''
      }`}
    >
      <audio
        ref={audioRef}
        src={activeTrack?.src}
        onPlay={initAudioContext}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleTrackEnd}
      />

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => e.target.files && processAudioFiles(e.target.files)}
        accept="audio/*"
        multiple
        className="hidden"
      />

      {/* Header Bar */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-wider text-amber-400">AUDIO & CONTENT PODS</h2>
          <p className="mt-1 text-sm text-slate-400">Custom Playlists & Synchronized Media Hub</p>
        </div>

        <div className="flex items-center gap-3">
          {saveStatus && (
            <span className="text-xs font-mono text-emerald-400 animate-pulse bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-lg">
              {saveStatus}
            </span>
          )}

          <button
            onClick={triggerSave}
            className="px-3 py-2 font-mono text-xs transition border rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700"
            title="Save Session to Browser"
          >
            💾 SAVE SESSION
          </button>

          <button
            onClick={exportSessionFile}
            className="flex items-center justify-center p-2 transition border rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border-slate-700"
            title="Download Free Session File"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
            </svg>
          </button>

          <button
            onClick={() => setShowHelpModal(true)}
            className="px-3 py-2 font-mono text-xs transition border rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700"
          >
            ? HELP
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-2 font-mono text-xs transition border rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 border-amber-500/30"
          >
            + NEW PLAYLIST
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-4 py-2 font-mono text-xs font-bold transition rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950"
          >
            + UPLOAD TRACKS
          </button>
        </div>
      </div>

      {/* Playlist Selector */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800">
        <div className="flex gap-2 overflow-x-auto">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              onClick={() => setActivePlaylistId(pl.id)}
              className={`px-4 py-2 rounded-lg text-xs font-mono transition whitespace-nowrap ${
                activePlaylistId === pl.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/50'
                  : 'bg-slate-900/60 text-slate-400 border border-slate-800 hover:border-slate-700'
              }`}
            >
              {pl.name}
            </button>
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
            <div className="p-5 space-y-4 border bg-slate-900/90 border-amber-500/30 rounded-xl backdrop-blur">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-block px-2 py-0.5 bg-amber-500/10 text-amber-400 text-xs font-mono rounded">
                  {activeTrack.frequency}
                </span>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setShowEq(!showEq)}
                    className={`px-2 py-1 border rounded text-xs font-mono transition ${
                      showEq
                        ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    EQ
                  </button>

                  <select
                    value={playbackMode}
                    onChange={(e) => setPlaybackMode(e.target.value as PlaybackMode)}
                    className="px-2 py-1 font-mono text-xs border rounded bg-slate-950 text-slate-300 border-slate-800 focus:outline-none focus:border-amber-500"
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

              <div className="space-y-1">
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  value={currentTime}
                  onChange={handleSeek}
                  className="w-full accent-amber-500 bg-slate-950 h-1.5 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between font-mono text-xs text-amber-400/90">
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePrevTrack}
                  className="px-4 py-3 font-mono text-xs font-bold transition rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400"
                >
                  ◀◀
                </button>

                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="flex-1 py-3 text-sm font-bold tracking-wide transition rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950"
                >
                  {isPlaying ? 'PAUSE STREAM' : 'PLAY STREAM'}
                </button>

                <button
                  onClick={handleNextTrack}
                  className="px-4 py-3 font-mono text-xs font-bold transition rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400"
                >
                  ▶▶
                </button>
              </div>

              {showEq && (
                <div className="pt-3 space-y-3 transition-all border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs tracking-wider uppercase text-amber-400">
                      Parametric Equalizer
                    </span>
                    <div className="flex gap-1 text-[10px] font-mono">
                      <button onClick={() => applyPreset('flat')} className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded hover:bg-slate-700">FLAT</button>
                      <button onClick={() => applyPreset('warm432')} className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 rounded hover:bg-amber-500/30">432Hz WARM</button>
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
                          className="h-16 accent-amber-400 bg-slate-950 rounded cursor-pointer [writing-mode:vertical-lr] [direction:rtl]"
                        />
                        <span className="text-[10px] font-mono text-slate-400">{band.label}</span>
                        <span className="text-[9px] font-mono text-amber-400">{eqGains[band.freq] > 0 ? `+${eqGains[band.freq]}` : eqGains[band.freq]}dB</span>
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
                  onClick={() => {
                    setActiveTrack(track);
                    setIsPlaying(true);
                  }}
                  className={`p-3.5 rounded-lg border cursor-pointer transition flex justify-between items-center ${
                    activeTrack?.id === track.id
                      ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <div className="mr-2 overflow-hidden">
                    <p className="text-xs font-semibold truncate text-slate-200">{track.title}</p>
                    <p className="text-[11px] text-slate-500 truncate">{track.description}</p>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400/80">{track.frequency}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Camera & Reader */}
        <div className="flex flex-col space-y-4 lg:col-span-7">
          {activePlaylistId === 'pods' && (
            <div className="p-4 space-y-3 border bg-slate-950 border-amber-500/30 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-xs tracking-wider uppercase text-amber-400">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  Podcasts & Broadcast Monitor
                </span>
                <button
                  onClick={toggleCamera}
                  className={`px-3 py-1 rounded text-xs font-mono transition ${
                    isCameraActive
                      ? 'bg-red-950 text-red-300 border border-red-800'
                      : 'bg-amber-500 text-slate-950 font-bold hover:bg-amber-400'
                  }`}
                >
                  {isCameraActive ? 'STOP BROADCAST' : '📷 START CAMERA'}
                </button>
              </div>

              {cameraError && (
                <div className="p-2 font-mono text-xs text-red-300 border border-red-800 rounded bg-red-950/60">
                  {cameraError}
                </div>
              )}

              <div className="relative flex items-center justify-center overflow-hidden border rounded-lg aspect-video bg-slate-900 border-slate-800">
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
                      Click &quot;Start Camera&quot; above to display live video input.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col justify-between flex-1 p-6 border bg-slate-900/60 border-slate-800 rounded-xl">
            <div>
              <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
                <span className="font-mono text-xs tracking-wider uppercase truncate text-amber-400">
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

      {/* Modal: Create Playlist */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form onSubmit={handleCreatePlaylist} className="w-full max-w-md p-6 space-y-4 border shadow-2xl bg-slate-900 border-amber-500/40 rounded-xl">
            <h3 className="text-lg font-bold text-amber-400">Create New Playlist</h3>
            <p className="text-xs text-slate-400">Enter a title below to organize your audio tracks and podcasts.</p>
            <input
              type="text"
              placeholder="Playlist Name"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              className="w-full p-3 font-mono text-sm border rounded-lg bg-slate-950 border-slate-800 text-slate-200 focus:outline-none focus:border-amber-500"
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
                className="px-4 py-2 font-mono text-xs font-bold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400"
              >
                CREATE & OPEN
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg p-6 space-y-4 border bg-slate-900 border-slate-800 rounded-xl">
            <h3 className="pb-2 text-lg font-bold border-b text-amber-400 border-slate-800">
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
                className="px-4 py-2 font-mono text-xs font-bold rounded-lg bg-amber-500 text-slate-950"
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
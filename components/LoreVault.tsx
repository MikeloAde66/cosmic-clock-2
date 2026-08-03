'use client';

import React, { useState, useRef } from 'react';

interface StreamItem {
  id: string;
  title: string;
  category: 'PODCAST' | 'TALK RADIO' | 'ARCHIVE';
  speaker: string;
  duration: string;
  url: string;
  description: string;
}

export default function LoreVault() {
  const [activeCategory, setActiveCategory] = useState<string>('ALL');
  const [currentStream, setCurrentStream] = useState<StreamItem | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // REAL SPOKEN-WORD TALK FEEDS & ARCHIVES
  const streams: StreamItem[] = [
    {
      id: 'talk-1',
      title: 'BBC World Service - 24/7 Live Spoken Radio',
      category: 'TALK RADIO',
      speaker: 'BBC Live Broadcast',
      duration: 'LIVE',
      url: 'https://stream.live.vc.bbcmedia.co.uk/bbc_world_service',
      description: 'Continuous 24/7 live spoken talk radio, world news, global interviews, and deep audio documentaries. 100% spoken dialogue.',
    },
    {
      id: 'talk-2',
      title: 'What is the Demiurge? Exit the Matrix',
      category: 'PODCAST',
      speaker: 'The Alchemist (Consciousness Channel)',
      duration: '17:02',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', // Replace with direct MP3/RSS audio link
      description: 'Deep dive into gnostic cosmology, craftsman energy, perception, and human consciousness alignment.',
    },
    {
      id: 'talk-3',
      title: 'Why You Should TOUCH a Tree Every Day — The Science',
      category: 'PODCAST',
      speaker: 'The Feynman Way (Force Series)',
      duration: '33:44',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', // Replace with direct MP3/RSS audio link
      description: 'The biological science of phytonicides, grounding, diffusion mechanics, and cellular health.',
    },
    {
      id: 'talk-4',
      title: 'NPR 24/7 Spoken Live News & Discussion',
      category: 'TALK RADIO',
      speaker: 'NPR Public Radio Feed',
      duration: 'LIVE',
      url: 'https://npr-ice.streamguys1.com/live.mp3',
      description: 'Live continuous spoken public radio, featuring long-form interviews, science analysis, and audio essays.',
    },
    {
      id: 'talk-5',
      title: 'Autophagy Triggers & Cellular Cleanup',
      category: 'ARCHIVE',
      speaker: 'Your Body Secrets (Health & Science)',
      duration: '49:45',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', // Replace with direct MP3/RSS audio link
      description: 'In-depth talk detailing cellular regeneration, metabolic signaling, and natural longevity triggers.',
    },
    {
      id: 'talk-6',
      title: 'AI, The Divine Spark & Transhumanism',
      category: 'PODCAST',
      speaker: 'The Alchemist',
      duration: '28:48',
      url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', // Replace with direct MP3/RSS audio link
      description: 'Exploration of artificial intelligence, consciousness, and technology convergence.',
    }
  ];

  const filteredStreams =
    activeCategory === 'ALL'
      ? streams
      : streams.filter((s) => s.category === activeCategory);

  const handlePlayStream = (stream: StreamItem) => {
    if (currentStream?.id === stream.id && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    } else {
      setCurrentStream(stream);
      setIsPlaying(true);
      if (audioRef.current) {
        audioRef.current.src = stream.url;
        audioRef.current.play().catch((err) => console.log('Playback error:', err));
      }
    }
  };

  const togglePlayPause = () => {
    if (!audioRef.current || !currentStream) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  return (
    <div className="flex h-full w-full flex-col gap-6 p-8 overflow-y-auto bg-[#0a0a0c] font-mono text-white">
      <audio ref={audioRef} />

      {/* HEADER BAR */}
      <div className="flex items-center justify-between border-b border-[#2a2a30] pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-widest text-[#d4af37]">
            COSMIC VAULT & SPOKEN TALK RADIO
          </h1>
          <p className="mt-1 text-xs text-gray-400">
            Pure Dialogue, Consciousness Archives, Live Talk Feeds & Grounding Science
          </p>
        </div>

        {/* CATEGORY FILTERS */}
        <div className="flex gap-2">
          {['ALL', 'PODCAST', 'TALK RADIO', 'ARCHIVE'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded px-3 py-1.5 text-xs font-bold transition-all ${
                activeCategory === cat
                  ? 'border border-[#d4af37] bg-[#d4af37]/10 text-[#d4af37]'
                  : 'border border-[#2a2a30] bg-[#121215] text-gray-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ACTIVE BROADCAST PLAYER */}
      {currentStream && (
        <div className="flex items-center justify-between rounded-lg border border-[#d4af37]/60 bg-[#16161a] p-4 shadow-[0_0_15px_rgba(212,175,55,0.1)]">
          <div className="flex items-center gap-4">
            <button
              onClick={togglePlayPause}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d4af37] text-black font-bold hover:bg-[#e6ca65]"
            >
              {isPlaying ? 'PAUSE' : 'PLAY'}
            </button>
            <div>
              <span className="text-[10px] text-[#d4af37] tracking-widest uppercase">
                NOW STREAMING • {currentStream.category}
              </span>
              <h3 className="text-sm font-bold text-white">{currentStream.title}</h3>
              <p className="text-xs text-gray-400">{currentStream.speaker}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 bg-red-500 rounded-full animate-ping" />
            <span className="text-xs font-bold text-red-400">{currentStream.duration}</span>
          </div>
        </div>
      )}

      {/* STREAM GRID */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filteredStreams.map((stream) => {
          const isSelected = currentStream?.id === stream.id && isPlaying;
          return (
            <div
              key={stream.id}
              className={`flex flex-col justify-between rounded-lg border p-5 transition-all ${
                isSelected
                  ? 'border-[#d4af37] bg-[#16161a]'
                  : 'border-[#2a2a30] bg-[#121215]/80 hover:border-[#d4af37]/50'
              }`}
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] tracking-widest text-[#d4af37] uppercase">
                    {stream.category}
                  </span>
                  <span className="text-xs text-gray-500">{stream.duration}</span>
                </div>
                <h2 className="mt-1 text-base font-bold text-white">{stream.title}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{stream.speaker}</p>
                <p className="mt-3 text-xs text-gray-500 line-clamp-2">
                  {stream.description}
                </p>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-[#2a2a30] pt-4">
                <button
                  onClick={() => handlePlayStream(stream)}
                  className="rounded border border-[#d4af37]/50 bg-[#16161a] px-4 py-1.5 text-xs font-bold text-[#d4af37] hover:bg-[#d4af37] hover:text-black transition-all"
                >
                  {isSelected ? 'PAUSE STREAM' : 'TUNE IN / PLAY'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
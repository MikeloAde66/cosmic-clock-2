'use client';

import React, { useState, useEffect } from 'react';
import CosmicCanvas from '@/components/CosmicCanvas';
import LeftNav from '@/components/LeftNav';
import LoreVault from '@/components/LoreVault';
import EpochDial from '@/components/EpochDial';
import NoaaWidget from '@/components/NoaaWidget';
import CosmicConverter from '@/components/CosmicConverter';
import PodsModule from '@/components/PodsModule';
import ISSFeedModal from '@/components/ISSFeedModal';
import { audioEngine } from '@/lib/audioEngine';

type NavTab = 'clock' | 'vault' | 'fact-checker' | 'pods';

interface ISSTelemetry {
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
}

export default function CosmicClockApp() {
  const [activeTab, setActiveTab] = useState<NavTab>('clock');
  const [isAudioActive, setIsAudioActive] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  // ISS Modal & Telemetry State
  const [isISSOpen, setIsISSOpen] = useState<boolean>(false);
  const [showISSPopup, setShowISSPopup] = useState<boolean>(false);
  const [telemetry, setTelemetry] = useState<ISSTelemetry>({
    latitude: 25.7617,
    longitude: -80.1918,
    altitude: 254.2,
    velocity: 17150,
    visibility: 'daylight',
  });

  // Typewriter Text Logic
  const [typedNarrative, setTypedNarrative] = useState<string>('');
  const [isTyping, setIsTyping] = useState<boolean>(false);

  // Fetch real-time ISS coordinates from Open Notify API
  useEffect(() => {
    const fetchISSData = async () => {
      try {
        const res = await fetch('https://api.open-notify.org/iss-now.json');
        if (res.ok) {
          const data = await res.json();
          const lat = parseFloat(data.iss_position.latitude);
          const lon = parseFloat(data.iss_position.longitude);
          setTelemetry((prev) => ({
            ...prev,
            latitude: lat,
            longitude: lon,
          }));
        }
      } catch (err) {
        // Fallback or quiet retry
      }
    };

    fetchISSData();
    const interval = setInterval(fetchISSData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleArrowClick = () => {
    setIsTyping(true);
    setTypedNarrative('');

    const fullText = `This is the ISS cruising at ${telemetry.velocity.toLocaleString()} mph at an altitude of ${telemetry.altitude} miles. Current orbital coordinates: ${telemetry.latitude.toFixed(2)}° N, ${telemetry.longitude.toFixed(2)}° E. Live observation: Clear view of low Earth orbit in real time.`;

    let i = 0;
    const speed = 25;
    const timer = setInterval(() => {
      if (i < fullText.length) {
        setTypedNarrative((prev) => prev + fullText.charAt(i));
        i++;
      } else {
        clearInterval(timer);
        setIsTyping(false);
      }
    }, speed);
  };

  const toggleAudio = () => {
    if (!audioEngine) return;
    const engine = audioEngine as { start?: () => void; stop?: () => void };

    if (isAudioActive) {
      engine.stop?.();
      setIsAudioActive(false);
    } else {
      engine.start?.();
      setIsAudioActive(true);
    }
  };

  return (
    <main className="relative flex flex-col min-h-screen overflow-hidden font-sans bg-slate-950 text-slate-100 md:flex-row">
      {/* Background Interactive Stars / Canvas */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <CosmicCanvas />
      </div>

      {/* Mobile Header Bar (Only visible on Phone/Tablet) */}
      <div className="z-30 flex items-center justify-between p-4 border-b md:hidden bg-slate-900 border-slate-800">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-amber-400"></span>
          <span className="font-mono text-sm font-bold tracking-wider">AIONE</span>
        </div>
        <button
          onClick={() => setIsMobileNavOpen(!isMobileNavOpen)}
          className="px-3 py-1 font-mono text-xs border rounded bg-slate-800 text-slate-200 border-slate-700"
        >
          {isMobileNavOpen ? '✕ CLOSE' : '☰ MENU'}
        </button>
      </div>

      {/* Left Navigation Bar (Desktop fixed, Mobile sliding drawer) */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-30 transition-transform duration-300 ease-in-out
        ${isMobileNavOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <LeftNav 
          activeTab={activeTab} 
          setActiveTab={(tab: NavTab) => {
            setActiveTab(tab);
            setIsMobileNavOpen(false);
          }} 
        />
      </div>

      {/* Main Content Viewport */}
      <div className="relative z-10 flex-1 h-screen p-4 overflow-y-auto md:p-6">
        {activeTab === 'clock' && (
          <div className="relative max-w-6xl mx-auto space-y-6">
            
            {/* Top Bar Grid: ISS Feed Button + NOAA Telemetry Widget */}
            <div className="grid items-start grid-cols-1 gap-6 md:grid-cols-12">
              
              {/* ISS Feed Button & Telemetry */}
              <div className="relative md:col-span-6">
                <div 
                  className="inline-flex items-center gap-3 px-4 py-3 transition border shadow-lg cursor-pointer bg-slate-900/80 border-amber-500/40 hover:border-amber-400 backdrop-blur rounded-xl group"
                  onMouseEnter={() => setShowISSPopup(true)}
                  onMouseLeave={() => setShowISSPopup(false)}
                >
                  <button 
                    onClick={() => setIsISSOpen(true)}
                    className="flex items-center gap-2 font-mono text-xs font-bold tracking-wider text-amber-400 group-hover:text-amber-300"
                  >
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                    ISS FEED
                  </button>

                  <button 
                    onClick={handleArrowClick}
                    className="px-1 font-mono text-sm transition text-slate-400 hover:text-amber-400"
                    title="Run Real-Time Telemetry Diagnostic"
                  >
                    &gt;
                  </button>
                </div>

                {/* Telemetry Hover Popup */}
                {showISSPopup && !typedNarrative && (
                  <div className="absolute left-0 z-50 max-w-sm p-4 space-y-1 font-mono text-xs border shadow-2xl top-14 bg-slate-900/95 border-slate-800 rounded-xl backdrop-blur">
                    <p className="pb-1 font-bold border-b text-amber-400 border-slate-800">ORBITAL TELEMETRY</p>
                    <p className="text-slate-300">Lat: {telemetry.latitude.toFixed(4)}°</p>
                    <p className="text-slate-300">Lon: {telemetry.longitude.toFixed(4)}°</p>
                    <p className="text-slate-300">Altitude: {telemetry.altitude} miles</p>
                    <p className="text-slate-300">Speed: {telemetry.velocity.toLocaleString()} mph</p>
                  </div>
                )}

                {/* CSI Typewriter Telemetry Box */}
                {typedNarrative && (
                  <div className="absolute left-0 z-50 max-w-md p-4 space-y-2 font-mono text-xs border shadow-2xl top-14 bg-slate-950/95 border-amber-500/60 rounded-xl backdrop-blur text-amber-300">
                    <div className="flex items-center justify-between pb-1 border-b border-amber-500/30">
                      <span className="font-bold text-[10px] tracking-wider text-amber-500">REAL-TIME TRANSMISSION</span>
                      <button 
                        onClick={() => setTypedNarrative('')}
                        className="text-xs text-slate-400 hover:text-slate-100"
                      >
                        ✕
                      </button>
                    </div>
                    <p className="leading-relaxed">
                      {typedNarrative}
                      {isTyping && <span className="font-bold animate-ping">|</span>}
                    </p>
                  </div>
                )}
              </div>

              {/* NOAA Telemetry Placeholder */}
              <div className="flex justify-start md:col-span-6 md:justify-end">
                <NoaaWidget />
              </div>
            </div>

{/* CENTERPIECE: Cosmic Clock Dial */}
            <div className="relative flex items-center justify-center min-h-[360px] md:min-h-[420px] p-4 md:p-6 bg-transparent border-none">
              <EpochDial />
            </div>

            {/* BOTTOM: Kali Yuga & Epoch Converter */}
            <div className="p-4 bg-transparent border-none md:p-6">
              <CosmicConverter />
            </div>          </div>
        )}

        {activeTab === 'pods' && (
          <div className="max-w-6xl mx-auto">
            <PodsModule />
          </div>
        )}

        {activeTab === 'fact-checker' && (
          <div className="max-w-4xl p-6 mx-auto space-y-4 text-center border md:p-8 bg-slate-900/60 border-slate-800 backdrop-blur rounded-2xl">
            <h2 className="text-xl font-bold md:text-2xl text-amber-400">COSMIC FACT CHECKER</h2>
            <p className="text-sm text-slate-400">
              Cross-referencing historical epochs, astronomical datasets, and natural frequency harmonics.
            </p>
          </div>
        )}
      </div>

      {/* ISS Stream Modal */}
      {isISSOpen && (
        <ISSFeedModal onClose={() => setIsISSOpen(false)} />
      )}
    </main>
  );
}
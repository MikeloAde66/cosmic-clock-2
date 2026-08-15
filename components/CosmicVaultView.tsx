import React, { useState } from 'react';

export default function CosmicApp() {
  const [activeTab, setActiveTab] = useState('AiOne');
  const [isPlaying, setIsPlaying] = useState(false);
  const [vaultLocked, setVaultLocked] = useState(true);
  const [combinationInput, setCombinationInput] = useState('');

  // Stored PNG assets for Cosmic Vault
  const vaultAssets = [
    { id: 1, name: 'Flammarion Woodcut', src: '/assets/image_2.png' },
    { id: 2, name: 'Sacred Geometry', src: '/assets/image.png' },
    { id: 3, name: 'Yuga Cycle Diagram', src: '/assets/image_1.png' },
    { id: 4, name: 'Cosmic Meditation (Hero Candidate)', src: '/assets/image_7.png' },
    { id: 5, name: 'Heavenly Rays', src: '/assets/image_6.png' },
    { id: 6, name: 'Keyhole Portal', src: '/assets/image_4.png' },
  ];

  const handleVaultUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    // Vault unlock logic placeholder
    if (combinationInput === '432') {
      setVaultLocked(false);
    } else {
      alert('Invalid Vault Combination');
    }
  };

  return (
    <div className="flex flex-col h-screen font-sans bg-slate-950 text-slate-100">
      {/* Dynamic Header / Hero Area using Image 7 */}
      <header className="relative flex items-center justify-center w-full h-64 overflow-hidden border-b border-slate-800">
        <img 
          src="/assets/image_7.png" 
          alt="Cosmic Creation Hero" 
          className="absolute inset-0 object-cover w-full h-full opacity-60"
        />
        <div className="relative z-10 text-center">
          <h1 className="text-4xl font-bold tracking-widest uppercase text-amber-200">Ai One</h1>
          <p className="mt-1 text-sm text-slate-300">Cosmic Creation & Broadcast Hub</p>
        </div>
      </header>

      {/* Navigation Bar */}
      <nav className="flex justify-center gap-6 py-3 border-b bg-slate-900 border-slate-800">
        <button 
          onClick={() => setActiveTab('AiOne')}
          className={`px-4 py-2 rounded text-sm font-semibold transition ${activeTab === 'AiOne' ? 'bg-amber-500 text-slate-950' : 'hover:bg-slate-800 text-slate-300'}`}
        >
          Ai One (Live PODS)
        </button>
        <button 
          onClick={() => setActiveTab('Radio')}
          className={`px-4 py-2 rounded text-sm font-semibold transition ${activeTab === 'Radio' ? 'bg-amber-500 text-slate-950' : 'hover:bg-slate-800 text-slate-300'}`}
        >
          Radio
        </button>
        <button 
          onClick={() => setActiveTab('CosmicVault')}
          className={`px-4 py-2 rounded text-sm font-semibold transition ${activeTab === 'CosmicVault' ? 'bg-amber-500 text-slate-950' : 'hover:bg-slate-800 text-slate-300'}`}
        >
          Cosmic Vault
        </button>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 p-6 overflow-y-auto">
        {/* Ai One / Live Content View */}
        {activeTab === 'AiOne' && (
          <section className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-xl font-semibold text-amber-400">Live Broadcast Monitor</h2>
            <div className="relative flex items-center justify-center overflow-hidden bg-black border aspect-video rounded-xl border-slate-800">
              {isPlaying ? (
                <video controls autoPlay className="object-cover w-full h-full">
                  <source src="/assets/videos/ai-hub-cinematic.mp4" type="video/mp4" />
                </video>
              ) : (
                <div className="text-center cursor-pointer" onClick={() => setIsPlaying(true)}>
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 text-2xl font-bold rounded-full bg-amber-500 text-slate-950">▶</div>
                  <p className="text-slate-300">Click to start broadcast monitor stream</p>
                </div>
              )}
            </div>

            {/* Bottom POD Container */}
            <div className="p-4 mt-8 border rounded-lg bg-slate-900 border-slate-800">
              <h3 className="mb-2 font-bold text-md text-slate-200">Active Live POD</h3>
              <p className="text-sm text-slate-400">Streaming engine node active. Signal synced to core broadcast.</p>
            </div>
          </section>
        )}

        {/* Radio Tab View */}
        {activeTab === 'Radio' && (
          <section className="max-w-4xl py-12 mx-auto text-center">
            <h2 className="mb-2 text-2xl font-bold text-amber-400">Cosmic Radio Stream</h2>
            <p className="text-slate-400">Live broadcast frequency output and audio streams feed here.</p>
          </section>
        )}

        {/* Cosmic Vault Static View */}
        {activeTab === 'CosmicVault' && (
          <section className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h2 className="text-2xl font-bold text-amber-400">Cosmic Vault</h2>
                <p className="text-sm text-slate-400">Static Storage & Master File Security</p>
              </div>
              <span className={`px-3 py-1 rounded text-xs font-mono uppercase ${vaultLocked ? 'bg-red-900/50 text-red-400 border border-red-700' : 'bg-emerald-900/50 text-emerald-400 border border-emerald-700'}`}>
                {vaultLocked ? 'Vault Locked' : 'Vault Access Granted'}
              </span>
            </div>

            {vaultLocked ? (
              <div className="max-w-md p-8 mx-auto space-y-4 text-center border bg-slate-900 rounded-xl border-slate-800">
                <div className="text-4xl">🔐</div>
                <h3 className="text-lg font-bold text-slate-200">Bank Vault Security Dial</h3>
                <p className="text-xs text-slate-400">Enter combination to access Master Backups, Blueprints, Data Sheets, and System Keys.</p>
                <form onSubmit={handleVaultUnlock} className="flex gap-2">
                  <input 
                    type="password" 
                    placeholder="Enter Combination..." 
                    value={combinationInput}
                    onChange={(e) => setCombinationInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border rounded bg-slate-950 border-slate-700 text-slate-100 focus:outline-none focus:border-amber-500"
                  />
                  <button type="submit" className="px-4 py-2 text-sm font-bold rounded bg-amber-500 text-slate-950 hover:bg-amber-400">Unlock</button>
                </form>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                  {vaultAssets.map((asset) => (
                    <div key={asset.id} className="overflow-hidden border rounded-lg bg-slate-900 border-slate-800 group">
                      <div className="h-40 overflow-hidden bg-slate-950">
                        <img src={asset.src} alt={asset.name} className="object-cover w-full h-full transition duration-300 group-hover:scale-105" />
                      </div>
                      <div className="p-3">
                        <p className="text-xs font-semibold text-slate-200">{asset.name}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Master System Files Section */}
                <div className="p-6 border bg-slate-900 rounded-xl border-slate-800">
                  <h3 className="mb-3 text-sm font-bold tracking-wider uppercase text-amber-400">Locked Master Archives</h3>
                  <ul className="space-y-2 font-mono text-xs text-slate-300">
                    <li className="flex justify-between py-1 border-b border-slate-800"><span>[FILE] SYSTEM_BACKUP_MASTER.tar.gz</span> <span className="text-slate-500">READY</span></li>
                    <li className="flex justify-between py-1 border-b border-slate-800"><span>[KEY] MASTER_API_CREDENTIALS.env</span> <span className="text-slate-500">ENCRYPTED</span></li>
                    <li className="flex justify-between py-1 border-b border-slate-800"><span>[SPEC] APP_BLUEPRINTS_PROTOTYPE.pdf</span> <span className="text-slate-500">RESTRICTED</span></li>
                  </ul>
                </div>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
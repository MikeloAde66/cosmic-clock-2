'use client';

import React from 'react';

export default function RadioStreams() {
  return (
    <div className="w-full h-full p-8 overflow-y-auto bg-[#0a0a0c]">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="pb-4 border-b border-slate-800">
          <h2 className="text-2xl font-bold text-amber-400">Radio</h2>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* BBC WORLD SERVICE */}
          <div className="p-6 space-y-4 border bg-slate-900/80 border-slate-800 rounded-xl">
            <h3 className="text-xl font-bold text-slate-100">BBC World Service</h3>
            <audio controls className="w-full">
              <source src="https://stream.live.vc.bbcmedia.co.uk/bbc_world_service" type="audio/mpeg" />
            </audio>
          </div>

          {/* NPR */}
          <div className="p-6 space-y-4 border bg-slate-900/80 border-slate-800 rounded-xl">
            <h3 className="text-xl font-bold text-slate-100">NPR News</h3>
            <audio controls className="w-full">
              <source src="https://npr-ice.streamguys1.com/live.mp3" type="audio/mpeg" />
            </audio>
          </div>
        </div>
      </div>
    </div>
  );
}

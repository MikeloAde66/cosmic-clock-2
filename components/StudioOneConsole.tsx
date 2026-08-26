import React from 'react';

export default function StudioOneConsole({ children }: { children?: React.ReactNode }) {
  return (
    <div className="w-full min-h-screen bg-[#07080a] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none font-mono">

      {/* 2. MAIN STAINLESS STEEL WALL FRAME WITH NEON TUBE RIM */}
      <div className="w-full max-w-[1400px] relative z-10 rounded-sm p-[3px] bg-gradient-to-b from-white via-slate-300 to-slate-500 shadow-[0_0_80px_rgba(255,255,255,0.85),0_0_30px_rgba(255,255,255,0.4)]">

        {/* INNER METALLIC CONTAINER */}
        <div
          className="w-full p-8 relative overflow-hidden rounded-sm"
          style={{
            background: `
              linear-gradient(180deg,
                #646c7c 0%,
                #414856 25%,
                #282d37 55%,
                #181b22 80%,
                #0f1116 100%
              )
            `,
          }}
        >
          {/* BRUSHED METAL GRAIN OVERLAY */}
          <div
            className="absolute inset-0 pointer-events-none opacity-25 z-0"
            style={{
              backgroundImage: `repeating-linear-gradient(
                0deg,
                rgba(255, 255, 255, 0.15) 0px,
                rgba(255, 255, 255, 0.15) 1px,
                transparent 1px,
                transparent 2px
              )`,
            }}
          />

          {/* VERTICAL SPECULAR LIGHT REFLECTION REFRACTOR */}
          <div className="absolute top-0 left-0 right-0 bottom-0 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none z-0"></div>

          {/* 3. PHYSICAL 3D ASYMMETRIC METAL PANEL SEAMS */}
          <div className="absolute inset-0 pointer-events-none z-0">
            {/* Horizontal Beveled Seams */}
            <div className="absolute top-[28%] left-0 right-0 h-[3px] bg-black/90 shadow-[0_1px_0_rgba(255,255,255,0.2)]"></div>
            <div className="absolute top-[64%] left-0 right-0 h-[3px] bg-black/90 shadow-[0_1px_0_rgba(255,255,255,0.2)]"></div>

            {/* Vertical Beveled Seams */}
            <div className="absolute top-0 bottom-[72%] left-[29.5%] w-[3px] bg-black/90 shadow-[1px_0_0_rgba(255,255,255,0.2)]"></div>
            <div className="absolute top-0 bottom-[72%] left-[67%] w-[3px] bg-black/90 shadow-[1px_0_0_rgba(255,255,255,0.2)]"></div>

            <div className="absolute top-[28%] bottom-[36%] left-[50%] w-[3px] bg-black/90 shadow-[1px_0_0_rgba(255,255,255,0.2)]"></div>

            <div className="absolute top-[64%] bottom-0 left-[35%] w-[3px] bg-black/90 shadow-[1px_0_0_rgba(255,255,255,0.2)]"></div>
            <div className="absolute top-[64%] bottom-0 left-[76%] w-[3px] bg-black/90 shadow-[1px_0_0_rgba(255,255,255,0.2)]"></div>
          </div>

          {/* DASHBOARD INNER CONTENT SLOT */}
          <div className="relative z-10">
            {children}
          </div>

        </div>
      </div>

    </div>
  );
}

import React from 'react';

// The real Proto Labs Global chrome pyramid mark — a real CSS 3D
// tetrahedron (4 clip-path faces, GPU-composited rotateY/rotateX, no SVG
// path, no image), same construction as protolabsglobal-main-shell's own
// logo. Both the ring and the pyramid spin continuously now (ring: 12s,
// pyramid: 3s, independent rates) — see .spinning-chrome-ring/.ptlg-pyramid
// in app/globals.css.
export default function ProtoLabsLogo() {
  return (
    <div className="logo-container">
      <div className="spinning-chrome-ring" aria-hidden="true">
        <svg viewBox="0 0 100 100" width="40" height="40">
          <defs>
            <linearGradient id="ptlgChrome" x1="15%" y1="10%" x2="85%" y2="90%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#94A3B8" />
              <stop offset="100%" stopColor="#FFFFFF" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="43" fill="none" stroke="url(#ptlgChrome)" strokeWidth="9" />
          <circle cx="50" cy="50" r="43" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1" />
        </svg>
      </div>
      <div className="static-pyramid-icon">
        <span className="ptlg-pyramid">
          <span className="ptlg-face" />
          <span className="ptlg-face" />
          <span className="ptlg-face" />
          <span className="ptlg-face" />
        </span>
      </div>
    </div>
  );
}

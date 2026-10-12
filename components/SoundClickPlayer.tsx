export default function SoundClickPlayer() {
  return (
    <div className="relative w-full overflow-hidden rounded-xl bg-black/40 p-4 border border-white/10 flex flex-col h-full">
      <div className="text-sm font-bold text-white mb-3">SoundClick Player</div>
      <div className="relative w-full flex-1 min-h-[450px]">
        <iframe 
          src="https://www.soundclick.com/artist/external/standalone.cfm?bandID=465834&instructions=25" 
          width="100%" 
          height="100%" 
          style={{ border: 'none', minHeight: '450px' }}
          allow="autoplay"
          title="SoundClick Music Player"
        />
      </div>
    </div>
  );
}

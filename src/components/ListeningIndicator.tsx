'use client';

interface ListeningIndicatorProps {
  isActive: boolean;
}

export function ListeningIndicator({ isActive }: ListeningIndicatorProps) {
  if (!isActive) return null;

  return (
    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-full backdrop-blur-sm">
      {/* Animated bars */}
      <div className="flex items-end gap-0.5 h-4">
        <span className="w-1 bg-emerald-500 rounded-full animate-sound-bar-1" />
        <span className="w-1 bg-emerald-500 rounded-full animate-sound-bar-2" />
        <span className="w-1 bg-emerald-500 rounded-full animate-sound-bar-3" />
        <span className="w-1 bg-emerald-500 rounded-full animate-sound-bar-4" />
      </div>
      <span className="text-emerald-600 text-sm font-medium">Listening</span>
    </div>
  );
}

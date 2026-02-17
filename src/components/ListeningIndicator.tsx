'use client';

interface ListeningIndicatorProps {
  isActive: boolean;
  audioLevels?: number[];
}

export function ListeningIndicator({ isActive, audioLevels = [0, 0, 0, 0] }: ListeningIndicatorProps) {
  if (!isActive) return null;

  // Calculate bar heights based on audio levels (min 4px, max 16px)
  const getBarHeight = (level: number) => {
    const minHeight = 4;
    const maxHeight = 18;
    return minHeight + (level * (maxHeight - minHeight));
  };

  return (
    <div className="flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 px-4 py-2 rounded-full backdrop-blur-sm">
      {/* Reactive audio bars */}
      <div className="flex items-center gap-0.5 h-5">
        {audioLevels.map((level, i) => (
          <span
            key={i}
            className="w-1 bg-emerald-500 rounded-full transition-all duration-75"
            style={{ 
              height: `${getBarHeight(level)}px`,
            }}
          />
        ))}
      </div>
      <span className="text-emerald-600 text-sm font-medium">Listening</span>
    </div>
  );
}

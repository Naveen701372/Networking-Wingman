'use client';

interface SessionButtonProps {
  isActive: boolean;
  onStart: () => void;
  onEnd: () => void;
}

export function SessionButton({ isActive, onStart, onEnd }: SessionButtonProps) {
  return (
    <button
      onClick={isActive ? onEnd : onStart}
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        min-w-[180px] min-h-[56px] px-8 py-4
        rounded-full font-semibold text-base
        shadow-lg transition-all duration-300
        active:scale-95 backdrop-blur-sm
        ${isActive 
          ? 'bg-red-500/90 hover:bg-red-600 text-white shadow-red-200' 
          : 'bg-emerald-500/90 hover:bg-emerald-600 text-white shadow-emerald-200'
        }
      `}
      style={{ touchAction: 'manipulation' }}
      aria-label={isActive ? 'End listening session' : 'Start listening session'}
    >
      <span className="flex items-center justify-center gap-2">
        {isActive ? (
          <>
            <StopIcon />
            End Session
          </>
        ) : (
          <>
            <MicIcon />
            Start Listening
          </>
        )}
      </span>
    </button>
  );
}

function MicIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

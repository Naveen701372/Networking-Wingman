'use client';

interface SessionButtonProps {
  isActive: boolean;
  isConnecting?: boolean;
  onStart: () => void;
  onEnd: () => void;
}

export function SessionButton({ isActive, isConnecting, onStart, onEnd }: SessionButtonProps) {
  const handleClick = () => {
    if (isConnecting) return;
    if (isActive) {
      onEnd();
    } else {
      onStart();
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={isConnecting}
      className={`
        fixed bottom-6 left-1/2 -translate-x-1/2 z-50
        min-w-[180px] min-h-[56px] px-8 py-4
        rounded-full font-semibold text-base
        shadow-lg transition-all duration-300
        active:scale-95 backdrop-blur-sm
        disabled:opacity-70 disabled:cursor-not-allowed
        ${isActive 
          ? 'bg-red-500/90 hover:bg-red-600 text-white shadow-red-200' 
          : isConnecting
            ? 'bg-amber-500/90 text-white shadow-amber-200'
            : 'bg-emerald-500/90 hover:bg-emerald-600 text-white shadow-emerald-200'
        }
      `}
      style={{ touchAction: 'manipulation' }}
      aria-label={isConnecting ? 'Connecting...' : isActive ? 'End listening session' : 'Start listening session'}
    >
      <span className="flex items-center justify-center gap-2">
        {isConnecting ? (
          <>
            <LoadingSpinner />
            Connecting...
          </>
        ) : isActive ? (
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

function LoadingSpinner() {
  return (
    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

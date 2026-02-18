'use client';

interface LoginCardProps {
  onGoogleSignIn: () => void;
}

export function LoginCard({ onGoogleSignIn }: LoginCardProps) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Subtle animated gradient orbs */}
      <div className="absolute top-1/4 -left-32 w-64 h-64 bg-blue-200/40 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 -right-32 w-80 h-80 bg-teal-200/30 rounded-full blur-3xl animate-pulse delay-1000" />
      
      {/* Glass card */}
      <div className="relative z-10 bg-white/70 backdrop-blur-xl rounded-2xl shadow-xl border border-gray-200/50 p-8 max-w-sm w-full">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <img 
            src="/Recall_logo.png" 
            alt="Recall" 
            className="h-12 w-auto"
          />
        </div>

        {/* Description */}
        <p className="text-gray-600 text-center mb-8 text-sm">
          Never forget who you met. Turn networking chaos into structured contacts.
        </p>

        {/* Google Sign In Button */}
        <button
          onClick={onGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3.5 text-gray-700 font-medium hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm hover:shadow"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          Continue with Google
        </button>

        {/* Footer */}
        <p className="text-gray-400 text-xs text-center mt-6">
          Your data is private and secure
        </p>
      </div>
    </div>
  );
}

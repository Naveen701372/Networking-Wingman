'use client';

interface ErrorModalProps {
  message: string;
  onClose: () => void;
  onRetry?: () => void;
}

export function ErrorModal({ message, onClose, onRetry }: ErrorModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-fadeIn">
        {/* Icon */}
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>

        {/* Message */}
        <h3 className="text-lg font-semibold text-gray-900 text-center mb-2">
          Microphone Access Required
        </h3>
        <p className="text-gray-600 text-center text-sm mb-6">
          {message}
        </p>

        {/* Buttons */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-4 rounded-xl border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          {onRetry && (
            <button
              onClick={onRetry}
              className="flex-1 py-3 px-4 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
            >
              Try Again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

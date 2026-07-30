// Sign-in prompt modal — shown when a guest tries to perform an authenticated action
import { LogIn, X } from 'lucide-react';

type Props = {
  onClose: () => void;
  message?: string;
};

export default function SignInPromptModal({ onClose, message }: Props) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-surface-container-lowest rounded-3xl p-6 shadow-2xl border border-outline-variant/40 w-full max-w-sm text-center">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center"
        >
          <X size={16} className="text-outline" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <LogIn size={28} className="text-primary" />
        </div>

        <h3 className="text-lg font-bold text-on-surface mb-2">Sign In Required</h3>
        <p className="text-sm text-on-surface-variant leading-relaxed mb-6">
          {message || 'Please sign in to save your data and access all features. Your progress will be preserved.'}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-surface-container-high text-on-surface font-medium py-2.5 rounded-full text-sm hover:bg-surface-container transition-colors"
          >
            Later
          </button>
          <button
            onClick={() => {
              // Reload page to show auth screen (clears guest state)
              window.location.reload();
            }}
            className="flex-1 bg-primary text-on-primary font-semibold py-2.5 rounded-full text-sm hover:bg-primary-container transition-colors flex items-center justify-center gap-2"
          >
            <LogIn size={14} />
            Sign In
          </button>
        </div>
      </div>
    </div>
  );
}

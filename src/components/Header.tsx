import { useState } from 'react';
import { Keyboard, X, Sparkles } from 'lucide-react';

export const Header = () => {
  const [showKeys, setShowKeys] = useState(false);

  return (
    <>
      <header className="h-12 bg-[var(--background)]/80 backdrop-blur-xl border-b border-[var(--border-subtle)] px-4 flex items-center justify-between shrink-0 z-50">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-bold text-[var(--foreground)] tracking-tight">soup</span>
            <span className="text-[var(--dim)]">/</span>
            <span className="text-[13px] text-[var(--muted)] font-medium">monitor</span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full border border-[#00d294]/15 bg-[#00d294]/5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00d294]" />
            <span className="text-[11px] font-medium text-[#00d294]">20 runs</span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowKeys(true)}
            className="flex items-center gap-1.5 px-2 py-1 text-[11px] text-[var(--dim)] hover:text-[var(--muted)] border border-[var(--border)] rounded-lg transition-colors cursor-pointer"
          >
            <Keyboard className="w-3 h-3" />
            <kbd className="text-[10px] font-[var(--font-mono)] text-[var(--dim)]">?</kbd>
          </button>

          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 text-[11px] text-[var(--dim)] border border-[var(--border)] rounded-lg">
            <Sparkles className="w-3 h-3" />
            <span className="font-medium">min-max truthful</span>
          </div>
        </div>
      </header>

      {/* Modal */}
      {showKeys && (
        <div className="fixed inset-0 z-[100] bg-black/60 flex items-center justify-center p-4" onClick={() => setShowKeys(false)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-xl max-w-sm w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
              <span className="text-[13px] font-semibold text-[var(--foreground)]">Keyboard shortcuts</span>
              <button type="button" onClick={() => setShowKeys(false)} className="text-[var(--dim)] hover:text-[var(--muted)] cursor-pointer"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-4 space-y-2">
              {[
                ['↑ ↓', 'Navigate runs'],
                ['R', 'Reset zoom'],
                ['Drag', 'Pan & zoom chart'],
              ].map(([key, label]) => (
                <div key={key} className="flex items-center justify-between text-[12px]">
                  <span className="text-[var(--muted)]">{label}</span>
                  <kbd className="font-[family-name:var(--font-mono)] text-[11px] bg-[var(--surface-raised)] px-2 py-0.5 rounded border border-[var(--border)] text-[var(--dim)]">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

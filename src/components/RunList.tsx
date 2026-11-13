import { useState, useMemo } from 'react';
import { Search, ArrowUpDown } from 'lucide-react';
import type { TrainingRunSummary, RunStatus } from '../types';

interface RunListProps {
  runs: TrainingRunSummary[];
  selectedRunId: string;
  onSelectRun: (id: string) => void;
}

const statusBadge: Record<RunStatus, { text: string; style: string }> = {
  healthy: {
    text: 'healthy',
    style: 'border border-[#00d294]/30 bg-[#00d294]/10 text-[#00d294]',
  },
  diverged: {
    text: 'diverged',
    style: 'border border-[var(--amber)]/30 bg-[var(--amber)]/10 text-[var(--amber)]',
  },
  broken: {
    text: 'broken',
    style: 'border border-[var(--rose)]/30 bg-[var(--rose)]/10 text-[var(--rose)]',
  },
  irregular: {
    text: 'irregular',
    style: 'border border-[var(--border)] bg-[#161616] text-[var(--muted)]',
  },
};

export const RunList: React.FC<RunListProps> = ({ runs, selectedRunId, onSelectRun }) => {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'healthy' | 'issues'>('all');
  const [sortDesc, setSortDesc] = useState(true);

  const filtered = useMemo(() => {
    return runs
      .filter((r) => {
        const q = search.toLowerCase();
        if (q && !r.name.toLowerCase().includes(q) && !r.id.includes(q)) return false;
        if (filter === 'healthy') return r.status === 'healthy';
        if (filter === 'issues') return r.status !== 'healthy';
        return true;
      })
      .sort((a, b) => (sortDesc ? b.totalSteps - a.totalSteps : a.totalSteps - b.totalSteps));
  }, [runs, search, filter, sortDesc]);

  const counts = useMemo(() => {
    return {
      all: runs.length,
      healthy: runs.filter((r) => r.status === 'healthy').length,
      issues: runs.filter((r) => r.status !== 'healthy').length,
    };
  }, [runs]);

  return (
    <aside className="w-full md:w-[280px] lg:w-[310px] flex flex-col bg-[var(--background)] border-r border-[var(--border-subtle)] h-full shrink-0">
      {/* Controls */}
      <div className="p-3 space-y-2.5 border-b border-[var(--border-subtle)]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--dim)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter runs (e.g. llama, 1M)..."
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-[var(--surface)] border border-[var(--border)] rounded-lg text-[var(--foreground)] placeholder-[var(--dim)] focus:outline-none focus:border-[var(--accent)] transition-colors font-mono"
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1 text-[11px] font-mono">
            {(['all', 'healthy', 'issues'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-2 py-0.5 rounded-md font-medium capitalize transition-colors cursor-pointer ${
                  filter === f
                    ? 'bg-[#222222] text-[var(--foreground)] border border-[var(--border)]'
                    : 'text-[var(--dim)] hover:text-[var(--muted)]'
                }`}
              >
                {f} ({counts[f]})
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setSortDesc(!sortDesc)}
            className="flex items-center gap-1 text-[11px] font-mono text-[var(--dim)] hover:text-[var(--muted)] transition-colors cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#161616]"
            title="Toggle sort direction"
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>{sortDesc ? 'Steps ↓' : 'Steps ↑'}</span>
          </button>
        </div>
      </div>

      {/* Run List Scroll Container */}
      <div className="flex-1 overflow-y-auto" role="listbox">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-[12px] font-mono text-[var(--dim)]">No runs matched.</div>
        ) : (
          filtered.map((run) => {
            const isSelected = run.id === selectedRunId;
            const badge = statusBadge[run.status];
            const is1MSpike = run.id === 'run-20';

            return (
              <button
                key={run.id}
                type="button"
                onClick={() => onSelectRun(run.id)}
                className={`w-full text-left px-3.5 py-2.5 border-b border-[var(--border-subtle)] transition-all cursor-pointer group flex flex-col gap-1 ${
                  isSelected
                    ? 'bg-[#141414] border-l-2 border-l-[var(--accent)]'
                    : 'hover:bg-[#111111]/70'
                }`}
                role="option"
                aria-selected={isSelected}
              >
                {/* Title & Badge */}
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`text-[12px] font-medium truncate ${
                      isSelected ? 'text-[var(--foreground)] font-semibold' : 'text-[var(--muted)] group-hover:text-[var(--foreground)]'
                    } transition-colors`}
                  >
                    {run.name}
                  </span>
                  <span
                    className={`text-[10px] font-mono font-medium px-1.5 py-0.2 rounded-full shrink-0 ${
                      is1MSpike
                        ? 'border border-[var(--accent)]/40 bg-[var(--accent)]/15 text-[var(--accent-hover)] font-semibold'
                        : badge.style
                    }`}
                  >
                    {is1MSpike ? '1M Spike' : badge.text}
                  </span>
                </div>

                {/* Sub info */}
                <div className="flex items-center justify-between text-[11px] font-mono text-[var(--dim)]">
                  <span>
                    {run.totalSteps >= 1000000
                      ? '1,000,000 steps'
                      : run.totalSteps >= 1000
                      ? `${(run.totalSteps / 1000).toFixed(0)}k steps`
                      : `${run.totalSteps} steps`}
                  </span>
                  <span>
                    loss:{' '}
                    <strong className={run.finalLoss === null ? 'text-[var(--rose)]' : 'text-[var(--muted)]'}>
                      {run.finalLoss !== null ? run.finalLoss.toFixed(3) : 'NaN'}
                    </strong>
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

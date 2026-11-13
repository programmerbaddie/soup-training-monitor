import { useState, useEffect, useRef, useCallback } from 'react';
import { getAllRunSummaries, getRunDetails } from './lib/data-generator';
import type { TrainingRunSummary, TrainingRunDetails } from './types';
import { Header } from './components/Header';
import { RunList } from './components/RunList';
import { RunDetails } from './components/RunDetails';

export default function App() {
  const [runs, setRuns] = useState<TrainingRunSummary[]>([]);
  const [selectedRunId, setSelectedRunId] = useState('run-20');
  const [activeRun, setActiveRun] = useState<TrainingRunDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Monotonic request token — guards against race conditions
  // when clicking through runs faster than 1M-point computation resolves
  const requestTokenRef = useRef(0);

  useEffect(() => {
    setRuns(getAllRunSummaries());
  }, []);

  const loadRun = useCallback((id: string) => {
    const token = ++requestTokenRef.current;
    setIsLoading(true);
    setSelectedRunId(id);

    // Yield a tick so loading spinner renders immediately before heavy computation
    setTimeout(() => {
      if (token !== requestTokenRef.current) return; // STALE — discard
      try {
        const details = getRunDetails(id, 'truthful_minmax');
        if (token === requestTokenRef.current) {
          setActiveRun(details);
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Telemetry load failed:', err);
        if (token === requestTokenRef.current) setIsLoading(false);
      }
    }, 10);
  }, []);

  // Initial load
  useEffect(() => { loadRun(selectedRunId); }, [loadRun, selectedRunId]);

  // Keyboard navigation: ↑ / ↓ to switch runs
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const idx = runs.findIndex((r) => r.id === selectedRunId);
        if (idx < runs.length - 1) loadRun(runs[idx + 1].id);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const idx = runs.findIndex((r) => r.id === selectedRunId);
        if (idx > 0) loadRun(runs[idx - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedRunId, runs, loadRun]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[var(--background)] text-[var(--foreground)] antialiased font-[family-name:var(--font-sans)]">
      <Header />

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <RunList
          runs={runs}
          selectedRunId={selectedRunId}
          onSelectRun={loadRun}
        />
        {activeRun ? (
          <RunDetails run={activeRun} isLoading={isLoading} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-[var(--text-dim)] text-sm">
            Select a run to inspect
          </div>
        )}
      </div>
    </div>
  );
}

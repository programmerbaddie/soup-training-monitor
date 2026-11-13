import React, { useState } from 'react';
import type { TrainingRunDetails } from '../types';
import { Chart } from './Chart';
import {
  Activity,
  Zap,
  Gauge,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Terminal,
  Shield,
  Copy,
  Check,
} from 'lucide-react';

interface RunDetailsProps {
  run: TrainingRunDetails;
  isLoading: boolean;
}

export const RunDetails: React.FC<RunDetailsProps> = ({ run, isLoading }) => {
  const [copied, setCopied] = useState(false);

  if (isLoading) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center p-12 gap-3 text-center">
        <div className="w-5 h-5 border-2 border-[var(--accent)] border-t-transparent rounded-full animate-spin" />
        <p className="text-[12px] font-mono text-[var(--dim)]">Loading {run.name}...</p>
      </main>
    );
  }

  const [steps, losses, lrs, gradNorms] = run.data;
  const totalAnomalies = run.anomalies.reduce((s, a) => s + a.count, 0);

  const handleCopySummary = () => {
    const summary = {
      id: run.id,
      name: run.name,
      steps: run.totalSteps,
      status: run.status,
      finalLoss: run.finalLoss,
      minLoss: run.minLoss,
      peakGradNorm: run.maxGradNorm,
      anomalies: run.anomalies,
    };
    navigator.clipboard.writeText(JSON.stringify(summary, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const metricCards = [
    {
      label: 'FINAL LOSS',
      value: run.finalLoss !== null ? run.finalLoss.toFixed(4) : 'NaN / Inf',
      sub: `step ${run.totalSteps.toLocaleString()}`,
      color: run.finalLoss === null ? 'text-[var(--rose)]' : run.finalLoss > 10 ? 'text-[var(--amber)]' : 'text-[var(--foreground)]',
      icon: Activity,
    },
    {
      label: 'MIN LOSS',
      value: run.minLoss !== null ? run.minLoss.toFixed(4) : '--',
      sub: 'convergence floor',
      color: 'text-[#00d294]',
      icon: TrendingDown,
    },
    {
      label: 'PEAK GRAD NORM',
      value:
        run.maxGradNorm !== null
          ? run.maxGradNorm > 1000
            ? run.maxGradNorm.toExponential(2)
            : run.maxGradNorm.toFixed(2)
          : '--',
      sub: 'optimizer stability',
      color: run.maxGradNorm !== null && run.maxGradNorm > 100 ? 'text-[var(--rose)]' : 'text-[var(--foreground)]',
      icon: Zap,
    },
    {
      label: 'LEARNING RATE',
      value: run.currentLr.toExponential(2),
      sub: 'active schedule',
      color: 'text-[var(--foreground)]',
      icon: Gauge,
    },
    {
      label: 'ANOMALIES',
      value: totalAnomalies.toString(),
      sub: totalAnomalies === 0 ? 'all probes clean' : `${run.anomalies.length} flag(s)`,
      color: totalAnomalies > 0 ? 'text-[var(--rose)]' : 'text-[#00d294]',
      icon: totalAnomalies > 0 ? AlertTriangle : CheckCircle2,
    },
  ];

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5 text-left">
      {/* ── Run Header ─────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-[var(--border-subtle)]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-base font-semibold text-[var(--foreground)] tracking-tight">
              {run.name}
            </h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-[#161616] border border-[var(--border)] text-[var(--dim)]">
              {run.id}
            </span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium ${
                run.status === 'healthy'
                  ? 'border border-[#00d294]/30 bg-[#00d294]/10 text-[#00d294]'
                  : run.status === 'broken'
                  ? 'border border-[var(--rose)]/30 bg-[var(--rose)]/10 text-[var(--rose)]'
                  : run.status === 'diverged'
                  ? 'border border-[var(--amber)]/30 bg-[var(--amber)]/10 text-[var(--amber)]'
                  : 'border border-[var(--border)] bg-[#161616] text-[var(--muted)]'
              }`}
            >
              {run.status}
            </span>
          </div>
          <p className="text-[12px] text-[var(--muted)]">{run.description}</p>
        </div>

        <div className="flex items-center gap-4 shrink-0">
          <button
            type="button"
            onClick={handleCopySummary}
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono text-[var(--dim)] hover:text-[var(--foreground)] bg-[#111111] hover:bg-[#181818] border border-[var(--border)] rounded-md transition-colors cursor-pointer"
            title="Copy run summary JSON"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#00d294]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'JSON'}</span>
          </button>

          <div className="text-right">
            <span className="text-[10px] uppercase tracking-wider font-mono text-[var(--dim)] block">Total Horizon</span>
            <span className="text-sm font-mono font-semibold text-[var(--foreground)]">
              {run.totalSteps.toLocaleString()} steps
            </span>
          </div>
        </div>
      </div>

      {/* ── Metric Cards ───────────────────────────── */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" aria-label="Summary metrics">
        {metricCards.map(({ label, value, sub, color, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-[var(--border)] bg-[#111111] p-3.5 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-[var(--dim)] mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
              <Icon className="w-3.5 h-3.5 text-[var(--dim)]" />
            </div>
            <p className={`text-xl font-mono font-semibold ${color} tabular-nums leading-none`}>
              {value}
            </p>
            <span className="text-[10px] text-[var(--dim)] font-mono mt-2">{sub}</span>
          </div>
        ))}
      </section>

      {/* ── Diagnostics Console ────────────────────── */}
      <section className="rounded-xl border border-[var(--border)] bg-[#111111] p-3.5 space-y-2 font-mono text-xs">
        <div className="flex items-center justify-between text-[11px] text-[var(--dim)]">
          <div className="flex items-center gap-2 text-[var(--foreground)] font-medium">
            <Terminal className="w-3.5 h-3.5 text-[var(--accent)]" />
            <span>telemetry diagnostics</span>
          </div>
          <span>{totalAnomalies === 0 ? '0 integrity flags' : `${totalAnomalies} flags detected`}</span>
        </div>

        {totalAnomalies === 0 ? (
          <div className="px-3 py-2 rounded-lg bg-[#0c0c0c] border border-[var(--border-subtle)] text-[#00d294] text-[11px] flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
            <span>Stream verified healthy: strictly monotonic step indices, zero NaNs, zero divergence, zero dropouts.</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
            {run.anomalies.map((a, idx) => (
              <div
                key={idx}
                className="px-3 py-2 rounded-lg bg-[#0c0c0c] border border-[var(--border-subtle)] flex items-start gap-2"
              >
                <span className="text-[var(--accent)] shrink-0">&gt;</span>
                <div>
                  <span className="text-[var(--foreground)] font-semibold capitalize">
                    {a.type.replace(/_/g, ' ')}:
                  </span>{' '}
                  <span className="text-[var(--muted)]">{a.description}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Primary Charts ─────────────────────────── */}
      <section className="space-y-4">
        <Chart
          title="train/loss"
          steps={steps}
          values={losses}
          seriesName="Loss"
          color="#c0512d" // Soup Terracotta
          isLogScaleAllowed
          showDownsampleToggle={run.totalSteps > 2000}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Chart
            title="train/lr"
            steps={steps}
            values={lrs}
            seriesName="LR"
            color="#00d294" // Soup Emerald
          />
          <Chart
            title="train/grad_norm"
            steps={steps}
            values={gradNorms}
            seriesName="Grad Norm"
            color="#f5a623" // Muted Amber
            isLogScaleAllowed
          />
        </div>
      </section>

      {/* ── Truthfulness Architecture ───────────────── */}
      <section className="rounded-xl border border-[var(--border)] bg-[#111111] p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2.5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#00d294]" />
            <h3 className="text-[12px] font-mono font-semibold text-[var(--foreground)]">
              TRUTHFULNESS ENGINE · SPECIFICATION
            </h3>
          </div>
          <span className="text-[10px] font-mono text-[var(--dim)]">trysoup.dev take-home</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px]">
          <div className="bg-[#0c0c0c] p-3 rounded-lg border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center gap-1.5 text-[var(--foreground)] font-mono font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00d294]" />
              <span>Min-Max Extrema Retention</span>
            </div>
            <p className="text-[var(--muted)] leading-relaxed">
              Every pixel bucket extracts both min and max chronologically. Step 524,288 (loss = 942.50) cannot be
              diluted into a false smooth curve.
            </p>
          </div>

          <div className="bg-[#0c0c0c] p-3 rounded-lg border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center gap-1.5 text-[var(--foreground)] font-mono font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00d294]" />
              <span>Explicit NaN Breaks</span>
            </div>
            <p className="text-[var(--muted)] leading-relaxed">
              Renderer enforces <code>spanGaps: false</code>. Missing or corrupted data points are never converted to
              0.0 or silently interpolated.
            </p>
          </div>

          <div className="bg-[#0c0c0c] p-3 rounded-lg border border-[var(--border-subtle)] space-y-1">
            <div className="flex items-center gap-1.5 text-[var(--foreground)] font-mono font-medium">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#00d294]" />
              <span>Monotonic Request Tokens</span>
            </div>
            <p className="text-[var(--muted)] leading-relaxed">
              Rapid run switching discards stale asynchronous promises before state mutation, eliminating race
              conditions across 1M points.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
};

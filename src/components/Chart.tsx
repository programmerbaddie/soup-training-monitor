import React, { useEffect, useRef, useState, useMemo } from 'react';
import uPlot from 'uplot';
import { RotateCcw, AlertTriangle, Eye, ShieldAlert } from 'lucide-react';
import { downsampleMinMax, downsampleNaiveStride } from '../lib/downsample';

interface ChartProps {
  title: string;
  steps: number[];
  values: (number | null)[];
  seriesName: string;
  color?: string;
  isLogScaleAllowed?: boolean;
  unit?: string;
  showDownsampleToggle?: boolean;
}

export const Chart: React.FC<ChartProps> = ({
  title,
  steps,
  values,
  seriesName,
  color = '#c0512d', // Default to Soup Terracotta
  isLogScaleAllowed = false,
  unit = '',
  showDownsampleToggle = false,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const uplotRef = useRef<uPlot | null>(null);

  const [isLogScale, setIsLogScale] = useState(false);
  const [downsampleMode, setDownsampleMode] = useState<'minmax' | 'stride'>('minmax');
  const [clampedCount, setClampedCount] = useState(0);

  const preparedData = useMemo(() => {
    let ds = steps;
    let dv = values;

    if (showDownsampleToggle && steps.length > 3000) {
      if (downsampleMode === 'minmax') {
        const r = downsampleMinMax(steps, values, 2000);
        ds = r.steps;
        dv = r.values;
      } else {
        const r = downsampleNaiveStride(steps, values, 2000);
        ds = r.steps;
        dv = r.values;
      }
    }

    let np = 0;
    const tv: (number | null)[] = [];
    for (const v of dv) {
      if (v === null) {
        tv.push(null);
        continue;
      }
      if (isLogScale && v <= 0) {
        np++;
        tv.push(1e-6);
      } else {
        tv.push(v);
      }
    }
    setClampedCount(np);
    return [ds, tv] as [number[], (number | null)[]];
  }, [steps, values, downsampleMode, isLogScale, showDownsampleToggle]);

  useEffect(() => {
    if (!chartRef.current) return;
    if (uplotRef.current) {
      uplotRef.current.destroy();
      uplotRef.current = null;
    }

    const width = chartRef.current.clientWidth || 600;
    const height = 230;
    const lineColor = color;

    const opts: uPlot.Options = {
      width,
      height,
      padding: [10, 14, 0, 0],
      cursor: {
        drag: { x: true, y: true },
        sync: { key: 'soup-sync' },
        points: { size: 6, fill: lineColor, stroke: '#ffffff', width: 1.5 },
      },
      scales: {
        x: { time: false },
        y: { distr: isLogScale ? 3 : 1 },
      },
      axes: [
        {
          stroke: '#666666',
          grid: { stroke: 'rgba(255, 255, 255, 0.04)', width: 1 },
          ticks: { stroke: '#333333', width: 1, size: 4 },
          font: '10px "Geist Mono", monospace',
          values: (_u, vals) =>
            vals.map((v) =>
              v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
            ),
        },
        {
          stroke: '#666666',
          grid: { stroke: 'rgba(255, 255, 255, 0.04)', width: 1 },
          ticks: { stroke: '#333333', width: 1, size: 4 },
          font: '10px "Geist Mono", monospace',
          size: 56,
          values: (_u, vals) =>
            vals.map((v) => {
              if (v == null) return '';
              if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
              if (Math.abs(v) < 0.001 && v !== 0) return v.toExponential(1);
              return v < 1 ? v.toFixed(3) : v.toFixed(2);
            }),
        },
      ],
      series: [
        {
          label: 'Step',
          value: (_u, v) => (v == null ? '--' : `Step ${v.toLocaleString()}`),
        },
        {
          label: seriesName,
          stroke: lineColor,
          width: 1.5,
          spanGaps: false,
          points: { show: preparedData[0].length < 80, size: 3 },
          fill: (u: uPlot) => {
            const ctx = u.ctx;
            const top = u.bbox?.top;
            const h = u.bbox?.height;
            if (!Number.isFinite(top) || !Number.isFinite(h) || !h || h <= 0) {
              return 'transparent';
            }
            const grd = ctx.createLinearGradient(0, top, 0, top + h);
            grd.addColorStop(0, `${lineColor}15`);
            grd.addColorStop(1, 'transparent');
            return grd;
          },
          value: (_u, v) => (v == null ? 'NaN / Missing' : `${v.toFixed(4)} ${unit}`),
        },
      ],
    };

    const u = new uPlot(opts, preparedData as uPlot.AlignedData, chartRef.current);
    uplotRef.current = u;

    const ro = new ResizeObserver(() => {
      if (chartRef.current && uplotRef.current) {
        uplotRef.current.setSize({ width: chartRef.current.clientWidth, height: 230 });
      }
    });
    ro.observe(chartRef.current);

    return () => {
      ro.disconnect();
      if (uplotRef.current) {
        uplotRef.current.destroy();
        uplotRef.current = null;
      }
    };
  }, [preparedData, color, isLogScale, seriesName, unit]);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[#0c0c0c] overflow-hidden text-left shadow-[0_0_40px_rgba(0,0,0,0.6)]">
      {/* Title bar with terminal dots */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 border-b border-[var(--border-subtle)] bg-[#111111]/80">
        <div className="flex items-center gap-2.5">
          {/* Traffic light window controls */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]/80" />
          </div>

          <div className="h-3 w-px bg-[var(--border)] mx-1" />

          <span className="text-[12px] font-mono font-medium text-[var(--foreground)]">{title}</span>
          <span className="text-[10px] text-[var(--dim)] font-mono">
            [{preparedData[0].length.toLocaleString()} pts]
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          {/* Downsample Toggle */}
          {showDownsampleToggle && steps.length > 3000 && (
            <div className="flex items-center bg-[#161616] border border-[var(--border)] rounded-md p-0.5">
              <button
                type="button"
                onClick={() => setDownsampleMode('minmax')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  downsampleMode === 'minmax'
                    ? 'bg-[#222222] text-[#00d294] font-semibold'
                    : 'text-[var(--dim)] hover:text-[var(--muted)]'
                }`}
                title="Min-Max Extrema: Preserves outlier spikes"
              >
                <Eye className="w-3 h-3" /> Min-Max
              </button>
              <button
                type="button"
                onClick={() => setDownsampleMode('stride')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1 ${
                  downsampleMode === 'stride'
                    ? 'bg-[#222222] text-[var(--rose)] font-semibold'
                    : 'text-[var(--dim)] hover:text-[var(--muted)]'
                }`}
                title="Naive Stride: Skips points (hides spikes)"
              >
                <ShieldAlert className="w-3 h-3" /> Naive
              </button>
            </div>
          )}

          {/* Log Scale Toggle */}
          {isLogScaleAllowed && (
            <button
              type="button"
              onClick={() => setIsLogScale(!isLogScale)}
              className={`px-2 py-0.5 rounded-md border text-[11px] font-medium transition-colors cursor-pointer ${
                isLogScale
                  ? 'bg-[#222222] border-[var(--accent)] text-[var(--accent-hover)]'
                  : 'bg-[#161616] border-[var(--border)] text-[var(--dim)] hover:text-[var(--muted)]'
              }`}
            >
              {isLogScale ? 'Log' : 'Linear'}
            </button>
          )}

          {/* Reset Zoom */}
          <button
            type="button"
            onClick={() => uplotRef.current?.setData(preparedData as uPlot.AlignedData, true)}
            className="p-1 rounded-md bg-[#161616] border border-[var(--border)] text-[var(--dim)] hover:text-[var(--foreground)] transition-colors cursor-pointer"
            title="Reset Zoom (R)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Warnings */}
      {isLogScale && clampedCount > 0 && (
        <div className="mx-3 mt-2 px-2.5 py-1.5 rounded-md bg-[#f5a623]/8 border border-[#f5a623]/25 text-[#f5a623] text-[11px] font-mono flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>Warning:</strong> {clampedCount} non-positive value(s) clamped to 1e-6 (log(0) is -Infinity).
          </span>
        </div>
      )}

      {downsampleMode === 'stride' && steps.length > 50000 && (
        <div className="mx-3 mt-2 px-2.5 py-1.5 rounded-md bg-[var(--rose)]/10 border border-[var(--rose)]/30 text-[var(--rose)] text-[11px] font-mono flex items-center gap-2">
          <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
          <span>
            <strong>Silent Failure active:</strong> Naive Stride filtered out the 942.5 spike at step 524,288. Switch to <strong>Min-Max</strong> to see reality.
          </span>
        </div>
      )}

      {/* Chart Canvas */}
      <div ref={chartRef} className="w-full px-2 py-1 cursor-crosshair" />
    </div>
  );
};

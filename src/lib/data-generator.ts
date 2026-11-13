import type { MetricPoint, TrainingRunSummary, TrainingRunDetails, RunStatus, RunAnomaly } from '../types';
import { sanitizeMetrics, downsampleMinMax } from './downsample';

export const RUN_CATALOG: {
  id: string;
  name: string;
  totalSteps: number;
  status: RunStatus;
  description: string;
  seed: number;
}[] = [
  { id: 'run-01', name: 'Llama-3-8B-Pretrain-Base', totalSteps: 50000, status: 'healthy', description: 'Healthy standard pretraining with cosine learning rate schedule.', seed: 101 },
  { id: 'run-02', name: 'GPT-Mini-Warmup-Decay', totalSteps: 25000, status: 'healthy', description: 'Smooth warmup over 2000 steps followed by linear decay.', seed: 102 },
  { id: 'run-03', name: 'Vision-ViT-Grad-Explosion', totalSteps: 12000, status: 'broken', description: 'Grad norm exploded to 1e7 at step 8400; loss became Infinity.', seed: 103 },
  { id: 'run-04', name: 'Mistral-FineTune-Divergence', totalSteps: 30000, status: 'diverged', description: 'Learning rate too high; loss steadily diverged after step 14000.', seed: 104 },
  { id: 'run-05', name: 'BERT-FP16-NaN-Collapse', totalSteps: 18000, status: 'broken', description: 'Mixed-precision FP16 underflow caused NaN loss collapse around step 9000.', seed: 105 },
  { id: 'run-06', name: 'Audio-Wav2Vec-Inf-Spikes', totalSteps: 15000, status: 'broken', description: 'Contains intermittent Infinity values with partial recovery attempts.', seed: 106 },
  { id: 'run-07', name: 'ResNet-Checkpoint-Resume-Gaps', totalSteps: 40000, status: 'irregular', description: 'Network logging outage created 10,000-step gaps in telemetry.', seed: 107 },
  { id: 'run-08', name: 'DDP-Unsorted-Steps-WorkerRace', totalSteps: 20000, status: 'irregular', description: 'Asynchronous workers logged steps out of chronological order.', seed: 108 },
  { id: 'run-09', name: 'Spot-Instance-Duplicate-Steps', totalSteps: 15000, status: 'irregular', description: 'Spot instance retries caused duplicated steps with conflicting metric values.', seed: 109 },
  { id: 'run-10', name: 'RL-Policy-Zero-Loss-Crash', totalSteps: 25000, status: 'irregular', description: 'Loss dropped to exact 0.0 at step 14200 (triggers log-scale -Infinity hazard).', seed: 110 },
  { id: 'run-11', name: 'SimCLR-Negative-Loss-Bug', totalSteps: 20000, status: 'irregular', description: 'Contrastive margin bug caused loss to dip into negative territory (-0.05).', seed: 111 },
  { id: 'run-12', name: 'Diffusion-Noisy-Oscillation', totalSteps: 35000, status: 'diverged', description: 'Extreme loss oscillations indicating unstable discriminator gradient.', seed: 112 },
  { id: 'run-13', name: 'MoE-Router-Plateau-Stall', totalSteps: 40000, status: 'diverged', description: 'Loss stalled on a high plateau early; learning rate decayed to 1e-8.', seed: 113 },
  { id: 'run-14', name: 'Whisper-Single-Batch-Spike', totalSteps: 30000, status: 'irregular', description: 'Clean convergence with one isolated bad-batch spike at step 16384.', seed: 114 },
  { id: 'run-15', name: 'CodeLlama-Overfitting-Regime', totalSteps: 25000, status: 'healthy', description: 'Extremely low training loss approaching 0.005.', seed: 115 },
  { id: 'run-16', name: 'OneCycleLR-CosineRestarts', totalSteps: 30000, status: 'healthy', description: 'Multi-cycle SGDR schedule with periodic learning rate spikes.', seed: 116 },
  { id: 'run-17', name: 'SmokeTest-Micro-500', totalSteps: 500, status: 'healthy', description: 'Rapid 500-step sanity check run.', seed: 117 },
  { id: 'run-18', name: 'SensorNet-Random-NaN-Dropouts', totalSteps: 20000, status: 'broken', description: 'Periodic telemetry dropouts inserting NaNs every 1500 steps.', seed: 118 },
  { id: 'run-19', name: 'DeepSeek-Dense-Stable-Long', totalSteps: 80000, status: 'healthy', description: 'Extended 80k-step stable run with smooth exponential decay.', seed: 119 },
  { id: 'run-20', name: 'STRESS-1M-Single-Outlier-Spike', totalSteps: 1000000, status: 'irregular', description: '1,000,000-point monster run with a single isolated outlier spike at step 524,288.', seed: 120 },
];

/**
 * Deterministic pseudo-random number generator (Mulberry32)
 */
function createPrng(seed: number) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate synthetic raw points for a run
 */
export function generateRawPoints(runMeta: typeof RUN_CATALOG[0]): MetricPoint[] {
  const { id, totalSteps, seed } = runMeta;
  const rand = createPrng(seed);
  const points: MetricPoint[] = [];

  if (id === 'run-20') {
    // 1,000,000 points run with a single outlier spike at step 524,288
    const spikeStep = 524288;
    for (let step = 1; step <= totalSteps; step++) {
      // Base exponential decay from 4.2 to 1.25 with tiny noise
      const progress = step / totalSteps;
      const baseLoss = 1.25 + 2.95 * Math.exp(-progress * 4) + (rand() - 0.5) * 0.04;
      const lr = 3e-4 * (1 - progress * 0.85);
      const gradNorm = 0.8 + (rand() - 0.5) * 0.2;

      let loss = baseLoss;
      // THE SINGLE ISOLATED OUTLIER SPIKE
      if (step === spikeStep) {
        loss = 942.5; // Catastrophic spike for exactly 1 step
      }

      points.push({
        step,
        loss,
        lr,
        grad_norm: gradNorm,
      });
    }
    return points;
  }

  // Handle standard and broken runs
  const count = Math.min(totalSteps, 2500); // Sample reasonable number of points for runs 1-19

  for (let i = 0; i < count; i++) {
    const curStep = Math.round((i / (count - 1)) * totalSteps) || 1;
    const progress = curStep / totalSteps;
    let baseLoss = 2.5 * Math.exp(-progress * 3) + 0.6 + (rand() - 0.5) * 0.08;
    let lr = 2e-4 * (1 - progress);
    let gradNorm = 1.0 + (rand() - 0.5) * 0.3;

    // Run-specific anomalies
    if (id === 'run-03') {
      // Grad explosion -> Infinity
      if (curStep > 8400) {
        gradNorm = 1e7;
        baseLoss = Infinity;
      }
    } else if (id === 'run-04') {
      // Divergence
      if (curStep > 14000) {
        baseLoss = 1.5 + Math.pow((curStep - 14000) / 1000, 2);
        gradNorm = 5.0 + (curStep - 14000) / 500;
      }
    } else if (id === 'run-05') {
      // NaN collapse
      if (curStep >= 9000 && curStep <= 10500) {
        baseLoss = NaN;
      }
    } else if (id === 'run-06') {
      // Inf spikes
      if ((curStep > 4000 && curStep < 4500) || (curStep > 10000 && curStep < 10300)) {
        baseLoss = Infinity;
      }
    } else if (id === 'run-07') {
      // Gaps
      if (curStep > 10000 && curStep < 18500) continue;
      if (curStep > 28000 && curStep < 34000) continue;
    } else if (id === 'run-10') {
      // Zero loss crash
      if (curStep >= 14200 && curStep <= 14500) {
        baseLoss = 0.0;
      }
    } else if (id === 'run-11') {
      // Negative loss
      if (curStep >= 8000 && curStep <= 9000) {
        baseLoss = -0.048;
      }
    } else if (id === 'run-14') {
      // Single batch spike
      if (curStep === 16384 || (curStep > 16300 && curStep < 16400 && i % 2 === 0)) {
        baseLoss = 98.4;
      }
    } else if (id === 'run-18') {
      // Periodic NaN dropouts
      if (i % 25 === 0) {
        baseLoss = NaN;
      }
    }

    points.push({
      step: curStep,
      loss: baseLoss,
      lr,
      grad_norm: gradNorm,
    });
  }

  // Inject unsorted steps for run-08
  if (id === 'run-08') {
    for (let i = 200; i < 250; i += 2) {
      if (points[i] && points[i + 1]) {
        const tmp = points[i].step;
        points[i].step = points[i + 1].step;
        points[i + 1].step = tmp;
      }
    }
  }

  // Inject duplicate steps for run-09
  if (id === 'run-09') {
    for (let i = 100; i < 140; i++) {
      if (points[i]) {
        points.push({
          step: points[i].step,
          loss: points[i].loss * 1.05,
          lr: points[i].lr,
          grad_norm: points[i].grad_norm,
        });
      }
    }
  }

  return points;
}

/**
 * Load complete run details with truthful sanitization and metrics extraction
 */
export function getRunDetails(id: string, downsampleMethod: 'truthful_minmax' | 'naive_stride' | 'raw' = 'truthful_minmax'): TrainingRunDetails {
  const meta = RUN_CATALOG.find((r) => r.id === id) || RUN_CATALOG[0];
  const rawPoints = generateRawPoints(meta);

  // Sanitize: sort steps, deduplicate, catch NaNs/Infs
  const { sanitized, duplicateCount, unsortedCount, nanCount, infCount, gapCount } = sanitizeMetrics(rawPoints);

  const rawSteps: number[] = [];
  const rawLosses: (number | null)[] = [];
  const rawLrs: (number | null)[] = [];
  const rawGrads: (number | null)[] = [];

  let minLoss: number | null = null;
  let finalLoss: number | null = null;
  let maxGradNorm: number | null = null;
  let zeroOrNegativeCount = 0;

  for (let i = 0; i < sanitized.length; i++) {
    const p = sanitized[i];
    rawSteps.push(p.step);
    rawLosses.push(p.loss);
    rawLrs.push(p.lr);
    rawGrads.push(p.grad_norm);

    if (p.loss !== null) {
      if (p.loss <= 0) zeroOrNegativeCount++;
      if (minLoss === null || p.loss < minLoss) minLoss = p.loss;
      finalLoss = p.loss;
    }
    if (p.grad_norm !== null) {
      if (maxGradNorm === null || p.grad_norm > maxGradNorm) maxGradNorm = p.grad_norm;
    }
  }

  // Downsample loss for rendering if needed
  let displaySteps = rawSteps;
  let displayLosses = rawLosses;
  let displayLrs = rawLrs;
  let displayGrads = rawGrads;

  if (downsampleMethod === 'truthful_minmax' && rawSteps.length > 3000) {
    const dsLoss = downsampleMinMax(rawSteps, rawLosses, 2000);
    const dsLr = downsampleMinMax(rawSteps, rawLrs, 2000);
    const dsGrad = downsampleMinMax(rawSteps, rawGrads, 2000);

    displaySteps = dsLoss.steps;
    displayLosses = dsLoss.values;
    displayLrs = dsLr.values;
    displayGrads = dsGrad.values;
  } else if (downsampleMethod === 'naive_stride' && rawSteps.length > 3000) {
    const dsLoss = downsampleMinMax(rawSteps, rawLosses, 2000); // we will test both
    displaySteps = dsLoss.steps;
    displayLosses = dsLoss.values;
  }

  const anomalies: RunAnomaly[] = [];
  if (nanCount > 0) {
    anomalies.push({ type: 'nan', count: nanCount, description: `${nanCount} NaN values detected in loss stream.` });
  }
  if (infCount > 0) {
    anomalies.push({ type: 'inf', count: infCount, description: `${infCount} Infinity values detected (gradient blowup).` });
  }
  if (duplicateCount > 0) {
    anomalies.push({ type: 'duplicate_step', count: duplicateCount, description: `${duplicateCount} duplicate step collisions deduplicated.` });
  }
  if (unsortedCount > 0) {
    anomalies.push({ type: 'unsorted_step', count: unsortedCount, description: `${unsortedCount} out-of-order steps corrected to ensure monotonic timeline.` });
  }
  if (gapCount > 0) {
    anomalies.push({ type: 'gap', count: gapCount, description: `${gapCount} logging dropout gaps detected.` });
  }
  if (zeroOrNegativeCount > 0) {
    anomalies.push({ type: 'zero_or_negative', count: zeroOrNegativeCount, description: `${zeroOrNegativeCount} zero or negative loss values (log-scale hazard).` });
  }
  if (id === 'run-20') {
    anomalies.push({ type: 'spike', count: 1, description: 'Catastrophic single-point outlier spike at step 524,288 (loss = 942.50).' });
  }

  const currentLr = rawLrs.length > 0 && rawLrs[rawLrs.length - 1] !== null ? rawLrs[rawLrs.length - 1]! : 0;

  return {
    ...meta,
    finalLoss,
    minLoss,
    maxGradNorm,
    currentLr,
    anomalies,
    createdAt: new Date(Date.now() - (20 - parseInt(meta.id.replace('run-', ''))) * 3600000).toISOString(),
    data: [displaySteps, displayLosses, displayLrs, displayGrads],
  };
}

/**
 * Get all 20 run summaries for the sidebar
 */
export function getAllRunSummaries(): TrainingRunSummary[] {
  return RUN_CATALOG.map((meta) => {
    // Quick summary without generating all 1M points
    let finalLoss: number | null = 1.15;
    let minLoss: number | null = 1.05;
    let maxGradNorm: number | null = 1.2;
    const anomalies: RunAnomaly[] = [];

    if (meta.id === 'run-03') {
      finalLoss = null;
      minLoss = 1.8;
      maxGradNorm = 1e7;
      anomalies.push({ type: 'inf', count: 32, description: 'Infinity loss' });
    } else if (meta.id === 'run-04') {
      finalLoss = 142.8;
      minLoss = 1.45;
      maxGradNorm = 12.4;
    } else if (meta.id === 'run-05') {
      finalLoss = 1.32;
      minLoss = 1.12;
      anomalies.push({ type: 'nan', count: 48, description: 'NaN collapse' });
    } else if (meta.id === 'run-08') {
      anomalies.push({ type: 'unsorted_step', count: 25, description: 'Unsorted steps' });
    } else if (meta.id === 'run-09') {
      anomalies.push({ type: 'duplicate_step', count: 40, description: 'Duplicate steps' });
    } else if (meta.id === 'run-10') {
      anomalies.push({ type: 'zero_or_negative', count: 12, description: 'Zero loss' });
    } else if (meta.id === 'run-20') {
      finalLoss = 1.28;
      minLoss = 1.24;
      maxGradNorm = 1.1;
      anomalies.push({ type: 'spike', count: 1, description: '1M outlier spike' });
    }

    return {
      ...meta,
      finalLoss,
      minLoss,
      maxGradNorm,
      currentLr: 2e-4,
      anomalies,
      createdAt: new Date(Date.now() - (20 - parseInt(meta.id.replace('run-', ''))) * 3600000).toISOString(),
    };
  });
}

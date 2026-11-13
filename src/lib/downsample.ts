/**
 * Truthful downsampling and data sanitation algorithms.
 * Guarantees preservation of extrema (outlier spikes), explicit NaN/gap representation,
 * and chronological monotonicity.
 */

export interface DownsampledSeries {
  steps: number[];
  values: (number | null)[];
  hasSpikePreserved: boolean;
  nanGapsCount: number;
}

/**
 * Min-Max Bucket Downsampling.
 * Divides data into buckets corresponding to screen pixel bins.
 * In each bucket, preserves both the minimum and maximum values in chronological order.
 * Guarantees that any single-step spike is visible regardless of zoom level.
 */
export function downsampleMinMax(
  steps: number[],
  values: (number | null)[],
  targetBuckets: number = 2000
): DownsampledSeries {
  const len = steps.length;
  if (len <= targetBuckets * 2) {
    let nanCount = 0;
    const sanitizedVals = values.map((v) => {
      if (v === null || Number.isNaN(v) || !Number.isFinite(v)) {
        nanCount++;
        return null;
      }
      return v;
    });
    return {
      steps: [...steps],
      values: sanitizedVals,
      hasSpikePreserved: true,
      nanGapsCount: nanCount,
    };
  }

  const bucketSize = len / targetBuckets;
  const outSteps: number[] = [];
  const outValues: (number | null)[] = [];
  let nanGapsCount = 0;

  for (let b = 0; b < targetBuckets; b++) {
    const start = Math.floor(b * bucketSize);
    const end = Math.min(len, Math.floor((b + 1) * bucketSize));
    if (start >= end) continue;

    let minVal = Infinity;
    let maxVal = -Infinity;
    let minIdx = start;
    let maxIdx = start;
    let bucketHasNaN = false;
    let validCount = 0;

    for (let i = start; i < end; i++) {
      const v = values[i];
      if (v === null || Number.isNaN(v) || !Number.isFinite(v)) {
        bucketHasNaN = true;
        nanGapsCount++;
        continue;
      }
      validCount++;
      if (v < minVal) {
        minVal = v;
        minIdx = i;
      }
      if (v > maxVal) {
        maxVal = v;
        maxIdx = i;
      }
    }

    if (validCount === 0) {
      // Entire bucket is NaN or empty
      outSteps.push(steps[start]);
      outValues.push(null);
      continue;
    }

    // Preserve min and max in chronological order to maintain time monotonicity
    const firstIdx = Math.min(minIdx, maxIdx);
    const secondIdx = Math.max(minIdx, maxIdx);

    outSteps.push(steps[firstIdx]);
    outValues.push(values[firstIdx]);

    if (secondIdx !== firstIdx) {
      outSteps.push(steps[secondIdx]);
      outValues.push(values[secondIdx]);
    }

    // If bucket contained NaNs, insert a null break so line does not falsely interpolate across missing/corrupted regions
    if (bucketHasNaN) {
      outSteps.push(steps[Math.min(end - 1, secondIdx + 1)]);
      outValues.push(null);
    }
  }

  return {
    steps: outSteps,
    values: outValues,
    hasSpikePreserved: true,
    nanGapsCount,
  };
}

/**
 * Naive Stride Downsampling (Dangerous).
 * Selects every Nth point. Used to demonstrate how standard charting libraries
 * silently discard single-point anomalies and mislead engineers.
 */
export function downsampleNaiveStride(
  steps: number[],
  values: (number | null)[],
  targetPoints: number = 2000
): DownsampledSeries {
  const len = steps.length;
  if (len <= targetPoints) {
    return {
      steps: [...steps],
      values: [...values],
      hasSpikePreserved: true,
      nanGapsCount: 0,
    };
  }

  const stride = Math.floor(len / targetPoints);
  const outSteps: number[] = [];
  const outValues: (number | null)[] = [];
  let nanGapsCount = 0;

  for (let i = 0; i < len; i += stride) {
    const v = values[i];
    outSteps.push(steps[i]);
    if (v === null || Number.isNaN(v) || !Number.isFinite(v)) {
      outValues.push(null);
      nanGapsCount++;
    } else {
      outValues.push(v);
    }
  }

  return {
    steps: outSteps,
    values: outValues,
    hasSpikePreserved: false, // May or may not hit the spike
    nanGapsCount,
  };
}

/**
 * Sanitize raw points:
 * 1. Sort by step ascending (fixes out-of-order logging).
 * 2. Deduplicate duplicate steps (preserves latest metric or flags collision).
 * 3. Handle Infinity and -Infinity by flagging or capping.
 */
export function sanitizeMetrics(
  points: { step: number; loss: number; lr: number; grad_norm: number }[]
): {
  sanitized: { step: number; loss: number | null; lr: number | null; grad_norm: number | null }[];
  duplicateCount: number;
  unsortedCount: number;
  nanCount: number;
  infCount: number;
  gapCount: number;
} {
  let unsortedCount = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].step < points[i - 1].step) {
      unsortedCount++;
    }
  }

  // Sort by step ascending
  const sorted = [...points].sort((a, b) => a.step - b.step);

  // Calculate typical step delta to accurately distinguish telemetry dropouts from normal step stride
  const deltas: number[] = [];
  for (let i = 1; i < Math.min(sorted.length, 50); i++) {
    const d = sorted[i].step - sorted[i - 1].step;
    if (d > 0) deltas.push(d);
  }
  deltas.sort((a, b) => a - b);
  const medianDelta = deltas.length > 0 ? deltas[Math.floor(deltas.length / 2)] : 1;
  const gapThreshold = Math.max(15, medianDelta * 3);

  let duplicateCount = 0;
  let nanCount = 0;
  let infCount = 0;
  let gapCount = 0;

  const sanitized: { step: number; loss: number | null; lr: number | null; grad_norm: number | null }[] = [];
  const seenSteps = new Set<number>();

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];

    // Check duplicate
    if (seenSteps.has(p.step)) {
      duplicateCount++;
      continue; // drop duplicate step to prevent canvas loops
    }
    seenSteps.add(p.step);

    // Check gap
    if (sanitized.length > 0) {
      const prevStep = sanitized[sanitized.length - 1].step;
      if (p.step - prevStep > gapThreshold) {
        gapCount++;
      }
    }

    // Check NaN & Inf
    let lossVal: number | null = p.loss;
    if (Number.isNaN(p.loss)) {
      lossVal = null;
      nanCount++;
    } else if (!Number.isFinite(p.loss)) {
      lossVal = null;
      infCount++;
    }

    let lrVal: number | null = p.lr;
    if (Number.isNaN(p.lr) || !Number.isFinite(p.lr)) lrVal = null;

    let gradVal: number | null = p.grad_norm;
    if (Number.isNaN(p.grad_norm) || !Number.isFinite(p.grad_norm)) gradVal = null;

    sanitized.push({
      step: p.step,
      loss: lossVal,
      lr: lrVal,
      grad_norm: gradVal,
    });
  }

  return {
    sanitized,
    duplicateCount,
    unsortedCount,
    nanCount,
    infCount,
    gapCount,
  };
}

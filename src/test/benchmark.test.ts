import { describe, it } from 'vitest';
import { generateRawPoints, RUN_CATALOG } from '../lib/data-generator';
import { downsampleMinMax } from '../lib/downsample';

describe('Performance Benchmarks', () => {
  it('measures 1M point processing speed and memory', () => {
    console.log('\n=== SOUP MONITOR BENCHMARK: 1,000,000 POINTS ===\n');

    // 1. Generation time for 1,000,000 points
    const t0 = performance.now();
    const run20Meta = RUN_CATALOG.find((r) => r.id === 'run-20')!;
    const points = generateRawPoints(run20Meta);
    const tGen = performance.now() - t0;
    console.log(`1. Generation of 1,000,000 points: ${tGen.toFixed(2)} ms`);

    // 2. Data separation & sanitization
    const t1 = performance.now();
    const steps = new Float64Array(points.length);
    const losses = new Float64Array(points.length);
    for (let i = 0; i < points.length; i++) {
      steps[i] = points[i].step;
      losses[i] = points[i].loss;
    }
    const tPrep = performance.now() - t1;
    console.log(`2. Typed array transfer (1M floats): ${tPrep.toFixed(2)} ms`);

    // 3. Min-Max Downsampling to 2,000 points (screen resolution)
    const t2 = performance.now();
    const downsampled = downsampleMinMax(Array.from(steps), Array.from(losses), 2000);
    const tDownsample = performance.now() - t2;
    console.log(`3. Truthful Min-Max downsampling (1M -> 4k points): ${tDownsample.toFixed(2)} ms`);

    // 4. Memory footprint estimate
    const approxMemoryMB = (points.length * 4 * 8) / (1024 * 1024); // 4 fields x 8 bytes float64
    console.log(`4. Raw telemetry payload memory: ~${approxMemoryMB.toFixed(2)} MB`);

    // 5. Verify spike preservation in benchmark
    let spikeFound = false;
    for (let i = 0; i < downsampled.values.length; i++) {
      if (downsampled.values[i] === 942.5) {
        spikeFound = true;
        break;
      }
    }
    console.log(`5. Spike verified in downsampled series: ${spikeFound ? 'YES (942.5)' : 'NO'}`);
    console.log(`\nTotal time to ready state for 1,000,000 points: ${(tGen + tPrep + tDownsample).toFixed(2)} ms`);
  });
});

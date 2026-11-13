export interface MetricPoint {
  step: number;
  loss: number;
  lr: number;
  grad_norm: number;
}

export type RunStatus = 'healthy' | 'diverged' | 'broken' | 'irregular';

export interface RunAnomaly {
  type: 'nan' | 'inf' | 'duplicate_step' | 'unsorted_step' | 'gap' | 'spike' | 'zero_or_negative';
  count: number;
  description: string;
  firstStep?: number;
}

export interface TrainingRunSummary {
  id: string;
  name: string;
  totalSteps: number;
  status: RunStatus;
  finalLoss: number | null;
  minLoss: number | null;
  maxGradNorm: number | null;
  currentLr: number;
  anomalies: RunAnomaly[];
  description: string;
  createdAt: string;
}

export interface TrainingRunDetails extends TrainingRunSummary {
  rawPoints?: MetricPoint[];
  // uPlot arrays for high speed: [steps, losses, lrs, grad_norms]
  data: [number[], (number | null)[], (number | null)[], (number | null)[]];
}

export type DownsampleMethod = 'truthful_minmax' | 'naive_stride' | 'raw';

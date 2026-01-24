// =====================================================
// TIS TIS PLATFORM - DRIFT DETECTION MODULE
// Monitors AI quality and detects distribution shifts
// =====================================================

export { BaselineService, baselineService } from './baseline.service';
export { MetricsCollectorService, metricsCollectorService } from './metrics-collector.service';
export { DriftDetectorService, driftDetectorService } from './drift-detector.service';
export { AlertService, alertService } from './alert.service';

// Re-export types
export type {
  DriftBaseline,
  DriftMetric,
  DriftAlert,
} from '../types';

// =====================================================
// TIS TIS PLATFORM - DRIFT DETECTOR SERVICE
// Detects distribution shifts using statistical tests
// =====================================================

import type { DriftBaseline } from '../types';
import { baselineService } from './baseline.service';
import { metricsCollectorService } from './metrics-collector.service';
import { alertService } from './alert.service';

type MetricType = DriftBaseline['metricType'];

interface DriftResult {
  metricName: string;
  metricType: MetricType;
  isDrift: boolean;
  driftScore: number;
  testUsed: 'ks' | 'chi_square' | 'psi' | 'cusum' | 'z_score';
  pValue?: number;
  threshold: number;
  details: {
    baselineMean?: number;
    currentMean?: number;
    baselineStd?: number;
    currentStd?: number;
    sampleSize: number;
    message: string;
  };
}

interface DetectionConfig {
  ksThreshold?: number;
  psiThreshold?: number;
  zScoreThreshold?: number;
  minSamples?: number;
  autoAlert?: boolean;
}

export class DriftDetectorService {
  private readonly DEFAULT_CONFIG: Required<DetectionConfig> = {
    ksThreshold: 0.05,
    psiThreshold: 0.2,
    zScoreThreshold: 3,
    minSamples: 30,
    autoAlert: true,
  };

  /**
   * Detect drift for a specific metric
   */
  async detectDrift(
    tenantId: string,
    metricType: MetricType,
    metricName: string,
    config?: DetectionConfig
  ): Promise<DriftResult> {
    const cfg = { ...this.DEFAULT_CONFIG, ...config };

    // Get baseline
    const baseline = await baselineService.getBaseline(tenantId, metricType, metricName);

    if (!baseline) {
      return {
        metricName,
        metricType,
        isDrift: false,
        driftScore: 0,
        testUsed: 'z_score',
        threshold: cfg.zScoreThreshold,
        details: {
          sampleSize: 0,
          message: 'No baseline found for this metric',
        },
      };
    }

    // Get recent values
    const recentValues = await metricsCollectorService.getRecentValues(
      tenantId,
      metricType,
      metricName,
      24
    );

    if (recentValues.length < cfg.minSamples) {
      return {
        metricName,
        metricType,
        isDrift: false,
        driftScore: 0,
        testUsed: 'z_score',
        threshold: cfg.zScoreThreshold,
        details: {
          sampleSize: recentValues.length,
          message: `Insufficient samples (${recentValues.length}/${cfg.minSamples})`,
        },
      };
    }

    // Run appropriate test based on metric type
    let result: DriftResult;

    if (metricType === 'performance' || metricType === 'quality') {
      // For continuous metrics, use Z-Score or KS test
      result = this.detectWithZScore(baseline, recentValues, cfg.zScoreThreshold);
    } else {
      // For distribution metrics, use PSI
      result = this.detectWithPSI(baseline, recentValues, cfg.psiThreshold);
    }

    result.metricName = metricName;
    result.metricType = metricType;

    // Create alert if drift detected and autoAlert enabled
    if (result.isDrift && cfg.autoAlert) {
      await alertService.createAlert({
        tenantId,
        alertType: 'drift',
        severity: result.driftScore > 0.5 ? 'high' : 'medium',
        metricName,
        metricType,
        currentValue: result.details.currentMean || 0,
        baselineValue: result.details.baselineMean || 0,
        threshold: result.threshold,
        driftScore: result.driftScore,
        message: result.details.message,
      });
    }

    return result;
  }

  /**
   * Detect drift for all active baselines of a tenant
   */
  async detectAllDrift(
    tenantId: string,
    config?: DetectionConfig
  ): Promise<DriftResult[]> {
    const baselines = await baselineService.getBaselines(tenantId, { status: 'active' });
    const results: DriftResult[] = [];

    for (const baseline of baselines) {
      try {
        const result = await this.detectDrift(
          tenantId,
          baseline.metricType,
          baseline.metricName,
          config
        );
        results.push(result);
      } catch (error) {
        console.error(
          `[DriftDetectorService] Error detecting drift for ${baseline.metricName}:`,
          error
        );
      }
    }

    return results;
  }

  /**
   * Calculate Population Stability Index (PSI)
   */
  calculatePSI(
    baselineDistribution: Record<string, number>,
    currentDistribution: Record<string, number>
  ): number {
    let psi = 0;

    const allBins = new Set([
      ...Object.keys(baselineDistribution),
      ...Object.keys(currentDistribution),
    ]);

    for (const bin of allBins) {
      const baseline = Math.max(baselineDistribution[bin] || 0.0001, 0.0001);
      const current = Math.max(currentDistribution[bin] || 0.0001, 0.0001);

      psi += (current - baseline) * Math.log(current / baseline);
    }

    return psi;
  }

  /**
   * Kolmogorov-Smirnov test statistic
   */
  calculateKSStatistic(baseline: number[], current: number[]): number {
    const sortedBaseline = [...baseline].sort((a, b) => a - b);
    const sortedCurrent = [...current].sort((a, b) => a - b);

    const n1 = sortedBaseline.length;
    const n2 = sortedCurrent.length;

    // Combine and sort all values
    const allValues = [...new Set([...sortedBaseline, ...sortedCurrent])].sort((a, b) => a - b);

    let maxDiff = 0;

    for (const value of allValues) {
      // CDF of baseline
      const baselineCdf = sortedBaseline.filter((v) => v <= value).length / n1;
      // CDF of current
      const currentCdf = sortedCurrent.filter((v) => v <= value).length / n2;

      maxDiff = Math.max(maxDiff, Math.abs(baselineCdf - currentCdf));
    }

    return maxDiff;
  }

  /**
   * CUSUM (Cumulative Sum) for sequential monitoring
   */
  calculateCUSUM(
    values: number[],
    targetMean: number,
    threshold: number = 5
  ): { upper: number; lower: number; changePoint?: number } {
    let upperSum = 0;
    let lowerSum = 0;
    let changePoint: number | undefined;

    const k = targetMean * 0.5; // Slack parameter

    for (let i = 0; i < values.length; i++) {
      const x = values[i];

      upperSum = Math.max(0, upperSum + (x - targetMean - k));
      lowerSum = Math.max(0, lowerSum - (x - targetMean + k));

      if ((upperSum > threshold || lowerSum > threshold) && !changePoint) {
        changePoint = i;
      }
    }

    return { upper: upperSum, lower: lowerSum, changePoint };
  }

  // Private detection methods

  private detectWithZScore(
    baseline: DriftBaseline,
    currentValues: number[],
    threshold: number
  ): DriftResult {
    const currentMean = currentValues.reduce((a, b) => a + b, 0) / currentValues.length;
    const currentVariance =
      currentValues.reduce((acc, val) => acc + Math.pow(val - currentMean, 2), 0) /
      currentValues.length;
    const currentStd = Math.sqrt(currentVariance);

    // Calculate Z-score of the mean difference
    const se = baseline.baselineStd / Math.sqrt(currentValues.length);
    const zScore = se > 0 ? Math.abs(currentMean - baseline.baselineMean) / se : 0;

    const isDrift = zScore > threshold;

    return {
      metricName: '',
      metricType: baseline.metricType,
      isDrift,
      driftScore: Math.min(zScore / (threshold * 2), 1), // Normalize to 0-1
      testUsed: 'z_score',
      pValue: this.zScoreToPValue(zScore),
      threshold,
      details: {
        baselineMean: baseline.baselineMean,
        currentMean,
        baselineStd: baseline.baselineStd,
        currentStd,
        sampleSize: currentValues.length,
        message: isDrift
          ? `Mean shifted from ${baseline.baselineMean.toFixed(2)} to ${currentMean.toFixed(2)} (z=${zScore.toFixed(2)})`
          : `No significant drift detected (z=${zScore.toFixed(2)})`,
      },
    };
  }

  private detectWithPSI(
    baseline: DriftBaseline,
    currentValues: number[],
    threshold: number
  ): DriftResult {
    // Calculate current distribution
    const currentDistribution = this.calculateDistribution(currentValues);
    const psi = this.calculatePSI(baseline.baselineDistribution, currentDistribution);

    const isDrift = psi > threshold;
    const currentMean = currentValues.reduce((a, b) => a + b, 0) / currentValues.length;

    return {
      metricName: '',
      metricType: baseline.metricType,
      isDrift,
      driftScore: Math.min(psi / (threshold * 2), 1),
      testUsed: 'psi',
      threshold,
      details: {
        baselineMean: baseline.baselineMean,
        currentMean,
        sampleSize: currentValues.length,
        message: isDrift
          ? `Distribution shift detected (PSI=${psi.toFixed(3)})`
          : `No significant distribution shift (PSI=${psi.toFixed(3)})`,
      },
    };
  }

  private calculateDistribution(values: number[]): Record<string, number> {
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const binSize = range / 10;

    const bins: Record<string, number> = {};
    for (let i = 0; i < 10; i++) {
      const binStart = min + i * binSize;
      const binEnd = min + (i + 1) * binSize;
      const binKey = `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`;
      bins[binKey] = 0;
    }

    for (const value of values) {
      const binIndex = Math.min(Math.floor((value - min) / binSize), 9);
      const binStart = min + binIndex * binSize;
      const binEnd = min + (binIndex + 1) * binSize;
      const binKey = `${binStart.toFixed(2)}-${binEnd.toFixed(2)}`;
      bins[binKey]++;
    }

    const total = values.length;
    for (const key of Object.keys(bins)) {
      bins[key] = bins[key] / total;
    }

    return bins;
  }

  private zScoreToPValue(z: number): number {
    // Approximate p-value from z-score (two-tailed)
    const absZ = Math.abs(z);
    // Using a simple approximation
    const p = Math.exp(-0.5 * absZ * absZ) / Math.sqrt(2 * Math.PI);
    return 2 * p; // Two-tailed
  }
}

// Export singleton instance
export const driftDetectorService = new DriftDetectorService();

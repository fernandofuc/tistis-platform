// =====================================================
// TIS TIS PLATFORM - Metrics Collector Service
// FASE 7: Collects, aggregates, and exports agent metrics
// =====================================================

using System.Collections.Concurrent;
using System.Diagnostics;
using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Monitoring.Types;

namespace TisTis.Agent.Core.Monitoring.Metrics;

/// <summary>
/// Interface for metrics collection.
/// </summary>
public interface IMetricsCollector : IDisposable
{
    /// <summary>
    /// Records a counter increment.
    /// </summary>
    void IncrementCounter(string name, long value = 1, Dictionary<string, string>? tags = null);

    /// <summary>
    /// Records a gauge value.
    /// </summary>
    void RecordGauge(string name, double value, string? unit = null, Dictionary<string, string>? tags = null);

    /// <summary>
    /// Records a value for histogram distribution.
    /// </summary>
    void RecordHistogram(string name, double value, string? unit = null, Dictionary<string, string>? tags = null);

    /// <summary>
    /// Starts a timer and returns a disposable that records the duration on dispose.
    /// </summary>
    IDisposable StartTimer(string metricName, Dictionary<string, string>? tags = null);

    /// <summary>
    /// Gets all current metric data points.
    /// </summary>
    IReadOnlyList<MetricDataPoint> GetMetrics();

    /// <summary>
    /// Gets histogram statistics for a specific metric.
    /// </summary>
    HistogramMetric? GetHistogram(string name);

    /// <summary>
    /// Gets all histogram metrics.
    /// </summary>
    IReadOnlyList<HistogramMetric> GetAllHistograms();

    /// <summary>
    /// Resets all metrics (useful for testing or periodic cleanup).
    /// </summary>
    void Reset();

    /// <summary>
    /// Gets metrics summary for reporting.
    /// </summary>
    MetricsSummary GetSummary();
}

/// <summary>
/// Summary of collected metrics.
/// </summary>
public class MetricsSummary
{
    public DateTime GeneratedAt { get; init; } = DateTime.UtcNow;
    public int TotalMetrics { get; init; }
    public int CounterCount { get; init; }
    public int GaugeCount { get; init; }
    public int HistogramCount { get; init; }
    public TimeSpan CollectionPeriod { get; init; }
    public Dictionary<string, double> KeyMetrics { get; init; } = new();
}

/// <summary>
/// Collects and aggregates metrics for the TIS TIS Agent.
/// Thread-safe implementation using concurrent collections.
/// </summary>
public class MetricsCollector : IMetricsCollector
{
    private readonly ILogger<MetricsCollector> _logger;
    private readonly ConcurrentDictionary<string, CounterMetricState> _counters = new();
    private readonly ConcurrentDictionary<string, GaugeMetricState> _gauges = new();
    private readonly ConcurrentDictionary<string, HistogramMetricState> _histograms = new();

    private readonly DateTime _startTime = DateTime.UtcNow;
    private bool _disposed;

    /// <summary>
    /// FIX ITER2-B1: Maximum number of unique metrics per type to prevent cardinality explosion.
    /// </summary>
    private const int MaxMetricsPerType = 200;

    /// <summary>
    /// FIX ITER2-B2: Flag to log cardinality warnings only once.
    /// FIX ITER3-A1: Use int with Interlocked for atomic compare-and-swap.
    /// </summary>
    private int _cardinalityWarningLogged;

    // Well-known metric names
    public static class MetricNames
    {
        public const string SyncTotal = "agent.sync.total";
        public const string SyncSuccessful = "agent.sync.successful";
        public const string SyncFailed = "agent.sync.failed";
        public const string SyncDurationMs = "agent.sync.duration_ms";
        public const string RecordsSynced = "agent.sync.records_synced";

        public const string ApiRequestsTotal = "agent.api.requests_total";
        public const string ApiRequestDurationMs = "agent.api.request_duration_ms";
        public const string ApiErrors = "agent.api.errors";

        public const string DbQueriesTotal = "agent.db.queries_total";
        public const string DbQueryDurationMs = "agent.db.query_duration_ms";
        public const string DbErrors = "agent.db.errors";

        public const string HeartbeatsTotal = "agent.heartbeat.total";
        public const string HeartbeatDurationMs = "agent.heartbeat.duration_ms";

        public const string MemoryUsageMb = "agent.process.memory_mb";
        public const string ThreadCount = "agent.process.thread_count";
        public const string UptimeSeconds = "agent.process.uptime_seconds";

        public const string ErrorsTotal = "agent.errors.total";
        public const string ConsecutiveErrors = "agent.errors.consecutive";
    }

    public MetricsCollector(ILogger<MetricsCollector> logger)
    {
        _logger = logger ?? throw new ArgumentNullException(nameof(logger));
    }

    /// <inheritdoc />
    public void IncrementCounter(string name, long value = 1, Dictionary<string, string>? tags = null)
    {
        ThrowIfDisposed();

        var key = GenerateKey(name, tags);

        // FIX ITER2-B3: Check cardinality limit before adding new metrics
        if (!_counters.ContainsKey(key) && _counters.Count >= MaxMetricsPerType)
        {
            LogCardinalityWarning("counters");
            return;
        }

        _counters.AddOrUpdate(
            key,
            _ => new CounterMetricState
            {
                Name = name,
                _value = value,  // FIX: Use _value field directly, Value is computed property
                Tags = tags,
                FirstRecordedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            },
            (_, existing) =>
            {
                // FIX ITER2-B4: Use Interlocked for atomic counter increment
                Interlocked.Add(ref existing._value, value);
                existing.LastUpdatedAt = DateTime.UtcNow;
                return existing;
            });
    }

    /// <inheritdoc />
    public void RecordGauge(string name, double value, string? unit = null, Dictionary<string, string>? tags = null)
    {
        ThrowIfDisposed();

        var key = GenerateKey(name, tags);

        // FIX ITER2-B5: Check cardinality limit before adding new metrics
        if (!_gauges.ContainsKey(key) && _gauges.Count >= MaxMetricsPerType)
        {
            LogCardinalityWarning("gauges");
            return;
        }

        _gauges.AddOrUpdate(
            key,
            _ => new GaugeMetricState
            {
                Name = name,
                Value = value,
                Unit = unit,
                Tags = tags,
                FirstRecordedAt = DateTime.UtcNow,
                LastUpdatedAt = DateTime.UtcNow
            },
            (_, existing) =>
            {
                existing.Value = value;
                existing.LastUpdatedAt = DateTime.UtcNow;
                return existing;
            });
    }

    /// <inheritdoc />
    /// FIX ITER1-B2: Use optimized circular buffer via AddValue method
    public void RecordHistogram(string name, double value, string? unit = null, Dictionary<string, string>? tags = null)
    {
        ThrowIfDisposed();

        var key = GenerateKey(name, tags);

        // FIX ITER2-B6: Check cardinality limit before adding new metrics
        if (!_histograms.ContainsKey(key) && _histograms.Count >= MaxMetricsPerType)
        {
            LogCardinalityWarning("histograms");
            return;
        }

        _histograms.AddOrUpdate(
            key,
            _ =>
            {
                var state = new HistogramMetricState
                {
                    Name = name,
                    Unit = unit,
                    Tags = tags,
                    FirstRecordedAt = DateTime.UtcNow,
                    LastUpdatedAt = DateTime.UtcNow
                };
                state.AddValue(value);
                return state;
            },
            (_, existing) =>
            {
                existing.AddValue(value);
                existing.LastUpdatedAt = DateTime.UtcNow;
                return existing;
            });
    }

    /// <inheritdoc />
    public IDisposable StartTimer(string metricName, Dictionary<string, string>? tags = null)
    {
        ThrowIfDisposed();
        return new TimerScope(this, metricName, tags);
    }

    /// <inheritdoc />
    public IReadOnlyList<MetricDataPoint> GetMetrics()
    {
        ThrowIfDisposed();

        var results = new List<MetricDataPoint>();

        // Add counters
        foreach (var counter in _counters.Values)
        {
            results.Add(new MetricDataPoint
            {
                Name = counter.Name,
                Type = MetricType.Counter,
                Value = counter.Value,
                RecordedAt = counter.LastUpdatedAt,
                Tags = counter.Tags
            });
        }

        // Add gauges
        foreach (var gauge in _gauges.Values)
        {
            results.Add(new MetricDataPoint
            {
                Name = gauge.Name,
                Type = MetricType.Gauge,
                Value = gauge.Value,
                Unit = gauge.Unit,
                RecordedAt = gauge.LastUpdatedAt,
                Tags = gauge.Tags
            });
        }

        // Add histogram means
        foreach (var histogram in _histograms.Values)
        {
            var stats = CalculateHistogramStats(histogram);
            results.Add(new MetricDataPoint
            {
                Name = histogram.Name,
                Type = MetricType.Histogram,
                Value = stats.Mean,
                Unit = histogram.Unit,
                RecordedAt = histogram.LastUpdatedAt,
                Tags = histogram.Tags
            });
        }

        return results;
    }

    /// <inheritdoc />
    public HistogramMetric? GetHistogram(string name)
    {
        ThrowIfDisposed();

        var histogram = _histograms.Values.FirstOrDefault(h => h.Name == name);
        if (histogram == null) return null;

        return CalculateHistogramStats(histogram);
    }

    /// <inheritdoc />
    public IReadOnlyList<HistogramMetric> GetAllHistograms()
    {
        ThrowIfDisposed();

        return _histograms.Values
            .Select(CalculateHistogramStats)
            .ToList();
    }

    /// <inheritdoc />
    public void Reset()
    {
        ThrowIfDisposed();

        _counters.Clear();
        _gauges.Clear();
        _histograms.Clear();

        _logger.LogDebug("Metrics collector reset");
    }

    /// <inheritdoc />
    public MetricsSummary GetSummary()
    {
        ThrowIfDisposed();

        var keyMetrics = new Dictionary<string, double>();

        // Add key counters
        foreach (var counter in _counters.Values.Where(c =>
            c.Name == MetricNames.SyncTotal ||
            c.Name == MetricNames.SyncSuccessful ||
            c.Name == MetricNames.SyncFailed ||
            c.Name == MetricNames.ErrorsTotal))
        {
            keyMetrics[counter.Name] = counter.Value;
        }

        // Add key gauges
        foreach (var gauge in _gauges.Values.Where(g =>
            g.Name == MetricNames.ConsecutiveErrors ||
            g.Name == MetricNames.MemoryUsageMb))
        {
            keyMetrics[gauge.Name] = gauge.Value;
        }

        // Add histogram means for key metrics
        foreach (var histogram in _histograms.Values.Where(h =>
            h.Name == MetricNames.SyncDurationMs ||
            h.Name == MetricNames.ApiRequestDurationMs))
        {
            var stats = CalculateHistogramStats(histogram);
            keyMetrics[$"{histogram.Name}.mean"] = stats.Mean;
            keyMetrics[$"{histogram.Name}.p99"] = stats.P99;
        }

        return new MetricsSummary
        {
            TotalMetrics = _counters.Count + _gauges.Count + _histograms.Count,
            CounterCount = _counters.Count,
            GaugeCount = _gauges.Count,
            HistogramCount = _histograms.Count,
            CollectionPeriod = DateTime.UtcNow - _startTime,
            KeyMetrics = keyMetrics
        };
    }

    #region Helper Classes

    private class CounterMetricState
    {
        public string Name { get; init; } = string.Empty;
        // FIX ITER2-B4: Use field instead of property for Interlocked operations
        internal long _value;
        public long Value => Interlocked.Read(ref _value);
        public Dictionary<string, string>? Tags { get; init; }
        public DateTime FirstRecordedAt { get; init; }
        public DateTime LastUpdatedAt { get; set; }
    }

    private class GaugeMetricState
    {
        public string Name { get; init; } = string.Empty;
        public double Value { get; set; }
        public string? Unit { get; init; }
        public Dictionary<string, string>? Tags { get; init; }
        public DateTime FirstRecordedAt { get; init; }
        public DateTime LastUpdatedAt { get; set; }
    }

    /// FIX ITER1-B1: Use dedicated lock object and optimized circular buffer
    private class HistogramMetricState
    {
        public string Name { get; init; } = string.Empty;
        public string? Unit { get; init; }
        public Dictionary<string, string>? Tags { get; init; }
        public DateTime FirstRecordedAt { get; init; }
        public DateTime LastUpdatedAt { get; set; }

        // FIX ITER1-B1: Dedicated lock object (never lock on mutable collection)
        private readonly object _valuesLock = new();
        private readonly double[] _buffer = new double[MaxHistogramValues];
        private int _head;
        private int _count;

        private const int MaxHistogramValues = 1000;

        public void AddValue(double value)
        {
            lock (_valuesLock)
            {
                _buffer[_head] = value;
                _head = (_head + 1) % MaxHistogramValues;
                if (_count < MaxHistogramValues)
                    _count++;
            }
        }

        public List<double> GetValuesCopy()
        {
            lock (_valuesLock)
            {
                if (_count == 0)
                    return new List<double>();

                var result = new List<double>(_count);
                var start = _count == MaxHistogramValues ? _head : 0;

                for (int i = 0; i < _count; i++)
                {
                    var index = (start + i) % MaxHistogramValues;
                    result.Add(_buffer[index]);
                }

                return result;
            }
        }

        public int Count
        {
            get
            {
                lock (_valuesLock)
                {
                    return _count;
                }
            }
        }
    }

    private class TimerScope : IDisposable
    {
        private readonly MetricsCollector _collector;
        private readonly string _metricName;
        private readonly Dictionary<string, string>? _tags;
        private readonly Stopwatch _stopwatch;
        private bool _disposed;

        public TimerScope(MetricsCollector collector, string metricName, Dictionary<string, string>? tags)
        {
            _collector = collector;
            _metricName = metricName;
            _tags = tags;
            _stopwatch = Stopwatch.StartNew();
        }

        public void Dispose()
        {
            if (_disposed) return;
            _disposed = true;

            _stopwatch.Stop();
            _collector.RecordHistogram(_metricName, _stopwatch.Elapsed.TotalMilliseconds, "ms", _tags);
        }
    }

    #endregion

    #region Private Methods

    private static string GenerateKey(string name, Dictionary<string, string>? tags)
    {
        if (tags == null || tags.Count == 0)
            return name;

        var tagStr = string.Join(",", tags.OrderBy(t => t.Key).Select(t => $"{t.Key}={t.Value}"));
        return $"{name}:{tagStr}";
    }

    /// FIX ITER1-B3: Use GetValuesCopy to minimize lock duration
    private static HistogramMetric CalculateHistogramStats(HistogramMetricState state)
    {
        // Get a thread-safe copy of values (lock is held only during copy)
        var values = state.GetValuesCopy();

        if (values.Count == 0)
        {
            return new HistogramMetric
            {
                Name = state.Name,
                Count = 0,
                Sum = 0,
                Min = 0,
                Max = 0,
                P50 = 0,
                P90 = 0,
                P99 = 0,
                StdDev = 0
            };
        }

        // Sort outside the lock (expensive operation)
        values.Sort();

        var count = values.Count;
        var sum = values.Sum();
        var mean = sum / count;

        // Calculate standard deviation
        var squaredDiffs = values.Sum(v => Math.Pow(v - mean, 2));
        var stdDev = Math.Sqrt(squaredDiffs / count);

        return new HistogramMetric
        {
            Name = state.Name,
            Count = count,
            Sum = sum,
            Min = values[0],
            Max = values[^1],
            P50 = GetPercentile(values, 50),
            P90 = GetPercentile(values, 90),
            P99 = GetPercentile(values, 99),
            StdDev = stdDev
        };
    }

    private static double GetPercentile(List<double> sortedValues, int percentile)
    {
        if (sortedValues.Count == 0) return 0;
        if (sortedValues.Count == 1) return sortedValues[0];

        // FIX ITER2-B7: Validate percentile range to prevent IndexOutOfRange
        var clampedPercentile = Math.Clamp(percentile, 0, 100);

        var index = (clampedPercentile / 100.0) * (sortedValues.Count - 1);
        var lower = (int)Math.Floor(index);
        var upper = (int)Math.Ceiling(index);

        // Ensure bounds (defensive)
        lower = Math.Clamp(lower, 0, sortedValues.Count - 1);
        upper = Math.Clamp(upper, 0, sortedValues.Count - 1);

        if (lower == upper)
            return sortedValues[lower];

        var weight = index - lower;
        return sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight;
    }

    /// <summary>
    /// FIX ITER2-B8: Log cardinality warning only once to avoid log spam.
    /// FIX ITER3-A2: Use Interlocked.CompareExchange for thread-safe check-then-act.
    /// </summary>
    private void LogCardinalityWarning(string metricType)
    {
        // Atomic compare-and-swap: only proceed if we're the first to set the flag
        if (Interlocked.CompareExchange(ref _cardinalityWarningLogged, 1, 0) != 0)
            return; // Another thread already logged

        _logger.LogWarning(
            "Metric cardinality limit reached for {MetricType}. " +
            "Maximum {Max} unique metrics allowed. " +
            "New metrics with unique tag combinations will be dropped. " +
            "Consider reducing tag cardinality (avoid dynamic values like timestamps or IDs).",
            metricType,
            MaxMetricsPerType);
    }

    private void ThrowIfDisposed()
    {
        if (_disposed)
            throw new ObjectDisposedException(nameof(MetricsCollector));
    }

    #endregion

    #region IDisposable

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed) return;

        if (disposing)
        {
            _counters.Clear();
            _gauges.Clear();
            _histograms.Clear();
            _logger.LogDebug("MetricsCollector disposed");
        }

        _disposed = true;
    }

    #endregion
}

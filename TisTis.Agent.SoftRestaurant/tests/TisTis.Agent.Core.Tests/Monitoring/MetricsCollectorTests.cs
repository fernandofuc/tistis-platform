// =====================================================
// TIS TIS PLATFORM - MetricsCollector Unit Tests
// Comprehensive tests for metrics collection
// =====================================================

using FluentAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using TisTis.Agent.Core.Monitoring.Metrics;
using TisTis.Agent.Core.Monitoring.Types;
using Xunit;

namespace TisTis.Agent.Core.Tests.Monitoring;

/// <summary>
/// Unit tests for MetricsCollector class.
/// Tests counters, gauges, histograms, timers, and thread safety.
/// </summary>
public class MetricsCollectorTests : IDisposable
{
    private readonly Mock<ILogger<MetricsCollector>> _mockLogger;
    private MetricsCollector? _collector;

    public MetricsCollectorTests()
    {
        _mockLogger = new Mock<ILogger<MetricsCollector>>();
    }

    public void Dispose()
    {
        _collector?.Dispose();
    }

    private MetricsCollector CreateCollector()
    {
        _collector = new MetricsCollector(_mockLogger.Object);
        return _collector;
    }

    #region Constructor Tests

    [Fact]
    public void Constructor_NullLogger_ThrowsArgumentNullException()
    {
        // Act & Assert
        var action = () => new MetricsCollector(null!);
        action.Should().Throw<ArgumentNullException>()
            .WithParameterName("logger");
    }

    [Fact]
    public void Constructor_ValidLogger_CreatesInstance()
    {
        // Act
        using var collector = CreateCollector();

        // Assert
        collector.Should().NotBeNull();
    }

    #endregion

    #region IncrementCounter Tests

    [Fact]
    public void IncrementCounter_SingleIncrement_RecordsValue()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        collector.IncrementCounter("test.counter");

        // Assert
        var metrics = collector.GetMetrics();
        metrics.Should().ContainSingle(m =>
            m.Name == "test.counter" &&
            m.Value == 1 &&
            m.Type == MetricType.Counter);
    }

    [Fact]
    public void IncrementCounter_MultipleIncrements_AccumulatesValue()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        collector.IncrementCounter("test.counter", 5);
        collector.IncrementCounter("test.counter", 3);
        collector.IncrementCounter("test.counter", 2);

        // Assert
        var metrics = collector.GetMetrics();
        metrics.Should().ContainSingle(m =>
            m.Name == "test.counter" &&
            m.Value == 10);
    }

    [Fact]
    public void IncrementCounter_WithTags_CreatesSeparateMetrics()
    {
        // Arrange
        using var collector = CreateCollector();
        var tags1 = new Dictionary<string, string> { ["env"] = "prod" };
        var tags2 = new Dictionary<string, string> { ["env"] = "staging" };

        // Act
        collector.IncrementCounter("test.counter", 1, tags1);
        collector.IncrementCounter("test.counter", 1, tags2);

        // Assert
        var metrics = collector.GetMetrics();
        metrics.Where(m => m.Name == "test.counter").Should().HaveCount(2);
    }

    [Fact]
    public void IncrementCounter_DefaultValue_IncrementsBy1()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        collector.IncrementCounter("test.counter");
        collector.IncrementCounter("test.counter");
        collector.IncrementCounter("test.counter");

        // Assert
        var metrics = collector.GetMetrics();
        metrics.Should().ContainSingle(m =>
            m.Name == "test.counter" &&
            m.Value == 3);
    }

    [Fact]
    public void IncrementCounter_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var collector = CreateCollector();
        collector.Dispose();

        // Act & Assert
        var action = () => collector.IncrementCounter("test.counter");
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region RecordGauge Tests

    [Fact]
    public void RecordGauge_SingleValue_RecordsCorrectly()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        collector.RecordGauge("test.gauge", 42.5);

        // Assert
        var metrics = collector.GetMetrics();
        metrics.Should().ContainSingle(m =>
            m.Name == "test.gauge" &&
            m.Value == 42.5 &&
            m.Type == MetricType.Gauge);
    }

    [Fact]
    public void RecordGauge_MultipleValues_ReplacesValue()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        collector.RecordGauge("test.gauge", 10.0);
        collector.RecordGauge("test.gauge", 20.0);
        collector.RecordGauge("test.gauge", 30.0);

        // Assert - Gauge should have latest value
        var metrics = collector.GetMetrics();
        metrics.Should().ContainSingle(m =>
            m.Name == "test.gauge" &&
            m.Value == 30.0);
    }

    [Fact]
    public void RecordGauge_WithUnit_RecordsUnit()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        collector.RecordGauge("memory.usage", 1024.0, "MB");

        // Assert
        var metrics = collector.GetMetrics();
        metrics.Should().ContainSingle(m =>
            m.Name == "memory.usage" &&
            m.Unit == "MB");
    }

    [Fact]
    public void RecordGauge_WithTags_RecordsTags()
    {
        // Arrange
        using var collector = CreateCollector();
        var tags = new Dictionary<string, string>
        {
            ["host"] = "server1",
            ["region"] = "us-east"
        };

        // Act
        collector.RecordGauge("cpu.usage", 75.5, "%", tags);

        // Assert
        var metrics = collector.GetMetrics();
        var metric = metrics.FirstOrDefault(m => m.Name == "cpu.usage");
        metric.Should().NotBeNull();
        metric!.Tags.Should().ContainKey("host").WhoseValue.Should().Be("server1");
        metric.Tags.Should().ContainKey("region").WhoseValue.Should().Be("us-east");
    }

    [Fact]
    public void RecordGauge_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var collector = CreateCollector();
        collector.Dispose();

        // Act & Assert
        var action = () => collector.RecordGauge("test.gauge", 100);
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region RecordHistogram Tests

    [Fact]
    public void RecordHistogram_SingleValue_RecordsCorrectly()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        collector.RecordHistogram("request.duration", 150.5);

        // Assert
        var histogram = collector.GetHistogram("request.duration");
        histogram.Should().NotBeNull();
        histogram!.Count.Should().Be(1);
        histogram.Sum.Should().Be(150.5);
    }

    [Fact]
    public void RecordHistogram_MultipleValues_CalculatesStatistics()
    {
        // Arrange
        using var collector = CreateCollector();
        var values = new[] { 100.0, 150.0, 200.0, 250.0, 300.0 };

        // Act
        foreach (var value in values)
        {
            collector.RecordHistogram("request.duration", value);
        }

        // Assert
        var histogram = collector.GetHistogram("request.duration");
        histogram.Should().NotBeNull();
        histogram!.Count.Should().Be(5);
        histogram.Sum.Should().Be(1000.0);
        histogram.Min.Should().Be(100.0);
        histogram.Max.Should().Be(300.0);
        histogram.Mean.Should().BeApproximately(200.0, 0.01);
    }

    [Fact]
    public void RecordHistogram_WithUnit_RecordsCorrectly()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        collector.RecordHistogram("response.time", 50.0, "ms");

        // Assert
        var histogram = collector.GetHistogram("response.time");
        histogram.Should().NotBeNull();
        histogram!.Name.Should().Be("response.time");
        histogram.Count.Should().Be(1);
        histogram.Sum.Should().Be(50.0);
    }

    [Fact]
    public void RecordHistogram_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var collector = CreateCollector();
        collector.Dispose();

        // Act & Assert
        var action = () => collector.RecordHistogram("test.histogram", 100);
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region GetHistogram Tests

    [Fact]
    public void GetHistogram_NonExistent_ReturnsNull()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        var histogram = collector.GetHistogram("non.existent");

        // Assert
        histogram.Should().BeNull();
    }

    [Fact]
    public void GetHistogram_Existing_ReturnsCorrectData()
    {
        // Arrange
        using var collector = CreateCollector();
        collector.RecordHistogram("test.histogram", 10);
        collector.RecordHistogram("test.histogram", 20);
        collector.RecordHistogram("test.histogram", 30);

        // Act
        var histogram = collector.GetHistogram("test.histogram");

        // Assert
        histogram.Should().NotBeNull();
        histogram!.Name.Should().Be("test.histogram");
        histogram.Count.Should().Be(3);
    }

    #endregion

    #region GetAllHistograms Tests

    [Fact]
    public void GetAllHistograms_Empty_ReturnsEmptyList()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        var histograms = collector.GetAllHistograms();

        // Assert
        histograms.Should().BeEmpty();
    }

    [Fact]
    public void GetAllHistograms_WithData_ReturnsAllHistograms()
    {
        // Arrange
        using var collector = CreateCollector();
        collector.RecordHistogram("histogram1", 100);
        collector.RecordHistogram("histogram2", 200);
        collector.RecordHistogram("histogram3", 300);

        // Act
        var histograms = collector.GetAllHistograms();

        // Assert
        histograms.Should().HaveCount(3);
        histograms.Select(h => h.Name).Should().Contain(new[] { "histogram1", "histogram2", "histogram3" });
    }

    #endregion

    #region StartTimer Tests

    [Fact]
    public void StartTimer_DisposesCorrectly_RecordsDuration()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        using (collector.StartTimer("operation.duration"))
        {
            Thread.Sleep(50); // Small delay
        }

        // Assert
        var histogram = collector.GetHistogram("operation.duration");
        histogram.Should().NotBeNull();
        histogram!.Count.Should().Be(1);
        histogram.Min.Should().BeGreaterThanOrEqualTo(40); // Allow some variance
    }

    [Fact]
    public void StartTimer_WithTags_RecordsWithTags()
    {
        // Arrange
        using var collector = CreateCollector();
        var tags = new Dictionary<string, string> { ["operation"] = "sync" };

        // Act
        using (collector.StartTimer("operation.duration", tags))
        {
            // Minimal work
        }

        // Assert
        var histograms = collector.GetAllHistograms();
        histograms.Should().ContainSingle();
    }

    [Fact]
    public void StartTimer_AfterDispose_ThrowsObjectDisposedException()
    {
        // Arrange
        var collector = CreateCollector();
        collector.Dispose();

        // Act & Assert
        var action = () => collector.StartTimer("test.timer");
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region GetMetrics Tests

    [Fact]
    public void GetMetrics_Empty_ReturnsEmptyList()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        var metrics = collector.GetMetrics();

        // Assert
        metrics.Should().BeEmpty();
    }

    [Fact]
    public void GetMetrics_MixedTypes_ReturnsAll()
    {
        // Arrange
        using var collector = CreateCollector();
        collector.IncrementCounter("counter1", 5);
        collector.RecordGauge("gauge1", 10.5);

        // Act
        var metrics = collector.GetMetrics();

        // Assert
        metrics.Should().HaveCount(2);
        metrics.Should().Contain(m => m.Type == MetricType.Counter);
        metrics.Should().Contain(m => m.Type == MetricType.Gauge);
    }

    [Fact]
    public void GetMetrics_ReturnsSnapshot()
    {
        // Arrange
        using var collector = CreateCollector();
        collector.IncrementCounter("counter1", 5);

        // Act
        var metrics1 = collector.GetMetrics();
        collector.IncrementCounter("counter1", 5);
        var metrics2 = collector.GetMetrics();

        // Assert - First snapshot should not be affected
        metrics1.First(m => m.Name == "counter1").Value.Should().Be(5);
        metrics2.First(m => m.Name == "counter1").Value.Should().Be(10);
    }

    #endregion

    #region Reset Tests

    [Fact]
    public void Reset_ClearsAllMetrics()
    {
        // Arrange
        using var collector = CreateCollector();
        collector.IncrementCounter("counter1", 10);
        collector.RecordGauge("gauge1", 50);
        collector.RecordHistogram("histogram1", 100);

        // Act
        collector.Reset();

        // Assert
        collector.GetMetrics().Should().BeEmpty();
        collector.GetAllHistograms().Should().BeEmpty();
    }

    [Fact]
    public void Reset_AllowsNewMetricsAfterReset()
    {
        // Arrange
        using var collector = CreateCollector();
        collector.IncrementCounter("counter1", 100);
        collector.Reset();

        // Act
        collector.IncrementCounter("counter1", 5);

        // Assert
        var metrics = collector.GetMetrics();
        metrics.Should().ContainSingle(m => m.Name == "counter1" && m.Value == 5);
    }

    #endregion

    #region GetSummary Tests

    [Fact]
    public void GetSummary_Empty_ReturnsValidSummary()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act
        var summary = collector.GetSummary();

        // Assert
        summary.Should().NotBeNull();
        summary.TotalMetrics.Should().Be(0);
        summary.CounterCount.Should().Be(0);
        summary.GaugeCount.Should().Be(0);
        summary.HistogramCount.Should().Be(0);
        summary.GeneratedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void GetSummary_WithData_ReturnsCorrectCounts()
    {
        // Arrange
        using var collector = CreateCollector();
        collector.IncrementCounter("counter1");
        collector.IncrementCounter("counter2");
        collector.RecordGauge("gauge1", 10);
        collector.RecordHistogram("histogram1", 100);
        collector.RecordHistogram("histogram2", 200);

        // Act
        var summary = collector.GetSummary();

        // Assert
        summary.CounterCount.Should().Be(2);
        summary.GaugeCount.Should().Be(1);
        summary.HistogramCount.Should().Be(2);
        summary.TotalMetrics.Should().Be(5);
    }

    [Fact]
    public void GetSummary_CollectionPeriod_CalculatedCorrectly()
    {
        // Arrange
        using var collector = CreateCollector();
        Thread.Sleep(100); // Small delay to have measurable period

        // Act
        var summary = collector.GetSummary();

        // Assert
        summary.CollectionPeriod.TotalMilliseconds.Should().BeGreaterThanOrEqualTo(90);
    }

    #endregion

    #region Metric Names Constants Tests

    [Fact]
    public void MetricNames_ContainsExpectedNames()
    {
        // Assert
        MetricsCollector.MetricNames.SyncTotal.Should().Be("agent.sync.total");
        MetricsCollector.MetricNames.SyncSuccessful.Should().Be("agent.sync.successful");
        MetricsCollector.MetricNames.SyncFailed.Should().Be("agent.sync.failed");
        MetricsCollector.MetricNames.ApiRequestsTotal.Should().Be("agent.api.requests_total");
        MetricsCollector.MetricNames.DbQueriesTotal.Should().Be("agent.db.queries_total");
        MetricsCollector.MetricNames.HeartbeatsTotal.Should().Be("agent.heartbeat.total");
        MetricsCollector.MetricNames.MemoryUsageMb.Should().Be("agent.process.memory_mb");
        MetricsCollector.MetricNames.ErrorsTotal.Should().Be("agent.errors.total");
    }

    #endregion

    #region Thread Safety Tests

    [Fact]
    public async Task IncrementCounter_ConcurrentAccess_ThreadSafe()
    {
        // Arrange
        using var collector = CreateCollector();
        var tasks = new Task[100];

        // Act
        for (int i = 0; i < 100; i++)
        {
            tasks[i] = Task.Run(() => collector.IncrementCounter("concurrent.counter"));
        }

        await Task.WhenAll(tasks);

        // Assert
        var metrics = collector.GetMetrics();
        metrics.Should().ContainSingle(m =>
            m.Name == "concurrent.counter" &&
            m.Value == 100);
    }

    [Fact]
    public async Task RecordGauge_ConcurrentAccess_ThreadSafe()
    {
        // Arrange
        using var collector = CreateCollector();
        var exceptions = new List<Exception>();
        var tasks = new Task[50];

        // Act
        for (int i = 0; i < 50; i++)
        {
            int index = i;
            tasks[i] = Task.Run(() =>
            {
                try
                {
                    collector.RecordGauge("concurrent.gauge", index);
                }
                catch (Exception ex)
                {
                    lock (exceptions)
                    {
                        exceptions.Add(ex);
                    }
                }
            });
        }

        await Task.WhenAll(tasks);

        // Assert
        exceptions.Should().BeEmpty();
        var metrics = collector.GetMetrics();
        metrics.Should().ContainSingle(m => m.Name == "concurrent.gauge");
    }

    [Fact]
    public async Task RecordHistogram_ConcurrentAccess_ThreadSafe()
    {
        // Arrange
        using var collector = CreateCollector();
        var tasks = new Task[100];

        // Act
        for (int i = 0; i < 100; i++)
        {
            int index = i;
            tasks[i] = Task.Run(() => collector.RecordHistogram("concurrent.histogram", index));
        }

        await Task.WhenAll(tasks);

        // Assert
        var histogram = collector.GetHistogram("concurrent.histogram");
        histogram.Should().NotBeNull();
        histogram!.Count.Should().Be(100);
    }

    [Fact]
    public async Task MixedOperations_ConcurrentAccess_ThreadSafe()
    {
        // Arrange
        using var collector = CreateCollector();
        var exceptions = new List<Exception>();
        var tasks = new Task[100];

        // Act - Mix of all operations
        for (int i = 0; i < 100; i++)
        {
            int index = i;
            tasks[i] = Task.Run(() =>
            {
                try
                {
                    switch (index % 4)
                    {
                        case 0:
                            collector.IncrementCounter("mixed.counter");
                            break;
                        case 1:
                            collector.RecordGauge("mixed.gauge", index);
                            break;
                        case 2:
                            collector.RecordHistogram("mixed.histogram", index);
                            break;
                        case 3:
                            _ = collector.GetMetrics();
                            break;
                    }
                }
                catch (Exception ex)
                {
                    lock (exceptions)
                    {
                        exceptions.Add(ex);
                    }
                }
            });
        }

        await Task.WhenAll(tasks);

        // Assert
        exceptions.Should().BeEmpty();
    }

    #endregion

    #region Dispose Tests

    [Fact]
    public void Dispose_CalledMultipleTimes_DoesNotThrow()
    {
        // Arrange
        var collector = CreateCollector();

        // Act & Assert
        var action = () =>
        {
            collector.Dispose();
            collector.Dispose();
            collector.Dispose();
        };
        action.Should().NotThrow();
    }

    [Fact]
    public void Dispose_ClearsMetrics()
    {
        // Arrange
        var collector = CreateCollector();
        collector.IncrementCounter("test.counter", 100);
        collector.RecordGauge("test.gauge", 50);

        // Act
        collector.Dispose();

        // Assert - Should throw on access attempts
        var action = () => collector.GetMetrics();
        action.Should().Throw<ObjectDisposedException>();
    }

    #endregion

    #region Cardinality Limit Tests

    [Fact]
    public void IncrementCounter_ExceedsCardinalityLimit_DropsNewMetrics()
    {
        // Arrange
        using var collector = CreateCollector();
        const int maxMetrics = 200; // MaxMetricsPerType from MetricsCollector

        // Act - Create max metrics with unique tags
        for (int i = 0; i < maxMetrics; i++)
        {
            collector.IncrementCounter("counter.cardinality.test", 1,
                new Dictionary<string, string> { ["id"] = i.ToString() });
        }

        // Try to add one more with a new unique tag
        collector.IncrementCounter("counter.cardinality.test", 1,
            new Dictionary<string, string> { ["id"] = "overflow" });

        // Assert - Should have exactly maxMetrics, not maxMetrics + 1
        var metrics = collector.GetMetrics();
        metrics.Where(m => m.Name == "counter.cardinality.test").Should().HaveCount(maxMetrics);
    }

    [Fact]
    public void RecordGauge_ExceedsCardinalityLimit_DropsNewMetrics()
    {
        // Arrange
        using var collector = CreateCollector();
        const int maxMetrics = 200;

        // Act - Create max metrics with unique tags
        for (int i = 0; i < maxMetrics; i++)
        {
            collector.RecordGauge("gauge.cardinality.test", i,
                tags: new Dictionary<string, string> { ["id"] = i.ToString() });
        }

        // Try to add one more with a new unique tag
        collector.RecordGauge("gauge.cardinality.test", 999,
            tags: new Dictionary<string, string> { ["id"] = "overflow" });

        // Assert - Should have exactly maxMetrics
        var metrics = collector.GetMetrics();
        metrics.Where(m => m.Name == "gauge.cardinality.test").Should().HaveCount(maxMetrics);
    }

    [Fact]
    public void RecordHistogram_ExceedsCardinalityLimit_DropsNewMetrics()
    {
        // Arrange
        using var collector = CreateCollector();
        const int maxMetrics = 200;

        // Act - Create max metrics with unique tags
        for (int i = 0; i < maxMetrics; i++)
        {
            collector.RecordHistogram("histogram.cardinality.test", i,
                tags: new Dictionary<string, string> { ["id"] = i.ToString() });
        }

        // Try to add one more with a new unique tag
        collector.RecordHistogram("histogram.cardinality.test", 999,
            tags: new Dictionary<string, string> { ["id"] = "overflow" });

        // Assert - Should have exactly maxMetrics
        var histograms = collector.GetAllHistograms();
        histograms.Where(h => h.Name == "histogram.cardinality.test").Should().HaveCount(maxMetrics);
    }

    [Fact]
    public void IncrementCounter_ExistingMetric_DoesNotCountTowardLimit()
    {
        // Arrange
        using var collector = CreateCollector();
        const int maxMetrics = 200;

        // Act - Create max metrics
        for (int i = 0; i < maxMetrics; i++)
        {
            collector.IncrementCounter("counter.existing.test", 1,
                new Dictionary<string, string> { ["id"] = i.ToString() });
        }

        // Increment an existing metric (should work, not count toward limit)
        collector.IncrementCounter("counter.existing.test", 5,
            new Dictionary<string, string> { ["id"] = "0" });

        // Assert - Existing metric should be updated
        var metrics = collector.GetMetrics();
        var existingMetric = metrics.FirstOrDefault(m =>
            m.Name == "counter.existing.test" &&
            m.Tags != null && m.Tags.ContainsKey("id") && m.Tags["id"] == "0");
        existingMetric.Should().NotBeNull();
        existingMetric!.Value.Should().Be(6); // 1 + 5
    }

    #endregion

    #region Timer Edge Cases

    [Fact]
    public void StartTimer_RecordsZeroOrPositiveDuration()
    {
        // Arrange
        using var collector = CreateCollector();

        // Act - Immediately dispose timer
        using (collector.StartTimer("instant.timer"))
        {
            // No delay
        }

        // Assert
        var histogram = collector.GetHistogram("instant.timer");
        histogram.Should().NotBeNull();
        histogram!.Count.Should().Be(1);
        histogram.Min.Should().BeGreaterThanOrEqualTo(0);
    }

    #endregion
}

/// <summary>
/// Tests for MetricsSummary class
/// </summary>
public class MetricsSummaryTests
{
    [Fact]
    public void DefaultValues_AreCorrect()
    {
        // Act
        var summary = new MetricsSummary();

        // Assert
        summary.TotalMetrics.Should().Be(0);
        summary.CounterCount.Should().Be(0);
        summary.GaugeCount.Should().Be(0);
        summary.HistogramCount.Should().Be(0);
        summary.GeneratedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        summary.KeyMetrics.Should().BeEmpty();
        summary.CollectionPeriod.Should().Be(TimeSpan.Zero);
    }

    [Fact]
    public void InitSyntax_SetsValuesCorrectly()
    {
        // Act
        var summary = new MetricsSummary
        {
            TotalMetrics = 10,
            CounterCount = 5,
            GaugeCount = 3,
            HistogramCount = 2,
            CollectionPeriod = TimeSpan.FromMinutes(5),
            KeyMetrics = new Dictionary<string, double> { ["cpu"] = 75.5 }
        };

        // Assert
        summary.TotalMetrics.Should().Be(10);
        summary.CounterCount.Should().Be(5);
        summary.GaugeCount.Should().Be(3);
        summary.HistogramCount.Should().Be(2);
        summary.CollectionPeriod.Should().Be(TimeSpan.FromMinutes(5));
        summary.KeyMetrics.Should().ContainKey("cpu").WhoseValue.Should().Be(75.5);
    }
}

// =====================================================
// TIS TIS PLATFORM - Monitoring Service Extensions
// FASE 7: DI registration for monitoring services
// =====================================================

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Configuration;
using TisTis.Agent.Core.Monitoring.Alerting;
using TisTis.Agent.Core.Monitoring.Diagnostics;
using TisTis.Agent.Core.Monitoring.HealthCheck;
using TisTis.Agent.Core.Monitoring.Metrics;
using TisTis.Agent.Core.Monitoring.Types;

namespace TisTis.Agent.Core.Monitoring;

/// <summary>
/// Extension methods for registering monitoring services.
/// </summary>
public static class MonitoringServiceExtensions
{
    /// <summary>
    /// Adds all monitoring services to the service collection.
    /// Includes health checks, metrics, alerting, diagnostics, and orchestrator.
    /// </summary>
    /// <param name="services">The service collection</param>
    /// <param name="configureThresholds">Optional action to configure monitoring thresholds</param>
    /// <returns>The service collection for chaining</returns>
    public static IServiceCollection AddTisTisMonitoring(
        this IServiceCollection services,
        Action<MonitoringThresholds>? configureThresholds = null)
    {
        // Register thresholds with optional configuration
        var thresholds = new MonitoringThresholds();
        configureThresholds?.Invoke(thresholds);

        // FIX ITER2-C1: Validate thresholds after configuration
        ValidateThresholds(thresholds);

        services.AddSingleton(thresholds);

        // Register metrics collector (singleton - shared state)
        services.AddSingleton<IMetricsCollector, MetricsCollector>();

        // Register health check service (needs config and repository access)
        services.AddSingleton<IHealthCheckService>(sp =>
        {
            var logger = sp.GetRequiredService<ILogger<HealthCheckService>>();
            var config = sp.GetRequiredService<AgentConfiguration>();
            var thresholdsInstance = sp.GetRequiredService<MonitoringThresholds>();

            // Get optional services that may or may not be registered
            var syncEngine = sp.GetService<Sync.ISyncEngine>();
            var apiClient = sp.GetService<Api.ITisTisApiClient>();
            var repository = sp.GetService<Database.ISoftRestaurantRepository>();
            var credentialStore = sp.GetService<Security.CredentialStore>();

            return new HealthCheckService(
                logger,
                config,
                thresholdsInstance,
                syncEngine,
                apiClient,
                repository,
                credentialStore);
        });

        // Register alerting service
        services.AddSingleton<IAlertingService>(sp =>
        {
            var metricsCollector = sp.GetRequiredService<IMetricsCollector>();
            var thresholdsInstance = sp.GetRequiredService<MonitoringThresholds>();
            var logger = sp.GetRequiredService<ILogger<AlertingService>>();
            return new AlertingService(metricsCollector, thresholdsInstance, logger);
        });

        // Register diagnostics service
        services.AddSingleton<IDiagnosticsService>(sp =>
        {
            var config = sp.GetRequiredService<AgentConfiguration>();
            var healthCheckService = sp.GetRequiredService<IHealthCheckService>();
            var metricsCollector = sp.GetRequiredService<IMetricsCollector>();
            var alertingService = sp.GetRequiredService<IAlertingService>();
            var logger = sp.GetRequiredService<ILogger<DiagnosticsService>>();

            return new DiagnosticsService(
                config,
                healthCheckService,
                metricsCollector,
                alertingService,
                logger);
        });

        // FIX ITER2-C2: Register orchestrator as singleton and forward to IHostedService
        // This ensures the same instance is used for both interface resolution and background service
        services.AddSingleton<MonitoringOrchestrator>(sp =>
        {
            var healthCheckService = sp.GetRequiredService<IHealthCheckService>();
            var metricsCollector = sp.GetRequiredService<IMetricsCollector>();
            var alertingService = sp.GetRequiredService<IAlertingService>();
            var diagnosticsService = sp.GetRequiredService<IDiagnosticsService>();
            var logger = sp.GetRequiredService<ILogger<MonitoringOrchestrator>>();

            return new MonitoringOrchestrator(
                healthCheckService,
                metricsCollector,
                alertingService,
                diagnosticsService,
                logger);
        });

        // Forward concrete registration to interface
        services.AddSingleton<IMonitoringOrchestrator>(sp => sp.GetRequiredService<MonitoringOrchestrator>());

        // Forward to IHostedService for background service startup
        services.AddSingleton<IHostedService>(sp => sp.GetRequiredService<MonitoringOrchestrator>());

        return services;
    }

    /// <summary>
    /// Adds minimal monitoring services (metrics and basic health checks only).
    /// Useful for testing or lightweight deployments.
    /// </summary>
    /// <param name="services">The service collection</param>
    /// <returns>The service collection for chaining</returns>
    public static IServiceCollection AddTisTisMonitoringMinimal(this IServiceCollection services)
    {
        services.AddSingleton<MonitoringThresholds>();
        services.AddSingleton<IMetricsCollector, MetricsCollector>();

        return services;
    }

    /// <summary>
    /// FIX ITER2-C3: Validates monitoring thresholds to prevent invalid configuration.
    /// </summary>
    private static void ValidateThresholds(MonitoringThresholds thresholds)
    {
        if (thresholds.MaxConsecutiveErrors <= 0)
            throw new ArgumentException(
                $"MaxConsecutiveErrors must be positive. Got: {thresholds.MaxConsecutiveErrors}",
                nameof(thresholds));

        if (thresholds.MaxSyncDurationSeconds <= 0)
            throw new ArgumentException(
                $"MaxSyncDurationSeconds must be positive. Got: {thresholds.MaxSyncDurationSeconds}",
                nameof(thresholds));

        if (thresholds.MaxApiResponseTimeMs <= 0)
            throw new ArgumentException(
                $"MaxApiResponseTimeMs must be positive. Got: {thresholds.MaxApiResponseTimeMs}",
                nameof(thresholds));

        if (thresholds.MaxDbQueryTimeMs <= 0)
            throw new ArgumentException(
                $"MaxDbQueryTimeMs must be positive. Got: {thresholds.MaxDbQueryTimeMs}",
                nameof(thresholds));

        if (thresholds.MaxMemoryUsageMb <= 0)
            throw new ArgumentException(
                $"MaxMemoryUsageMb must be positive. Got: {thresholds.MaxMemoryUsageMb}",
                nameof(thresholds));

        if (thresholds.MaxTimeSinceLastSyncMinutes <= 0)
            throw new ArgumentException(
                $"MaxTimeSinceLastSyncMinutes must be positive. Got: {thresholds.MaxTimeSinceLastSyncMinutes}",
                nameof(thresholds));
    }
}

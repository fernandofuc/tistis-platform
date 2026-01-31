// =====================================================
// TIS TIS PLATFORM - Agent Logger
// Logging utilities for the agent
// FIX SEC-02: Added secure data redaction
// =====================================================

using Serilog;
using Serilog.Events;
using TisTis.Agent.Core.Configuration;
using TisTis.Agent.Core.Security;

namespace TisTis.Agent.Core.Logging;

/// <summary>
/// Factory for creating configured Serilog loggers.
/// FIX SEC-02: Includes secure data redaction enricher.
/// </summary>
public static class AgentLogger
{
    /// <summary>
    /// Create a configured Serilog logger with security features.
    /// </summary>
    public static ILogger CreateLogger(LoggingOptions options)
    {
        var logLevel = ParseLogLevel(options.MinimumLevel);
        var logPath = Path.Combine(options.LogDirectory, "agent-.log");

        // Ensure log directory exists
        if (!Directory.Exists(options.LogDirectory))
        {
            Directory.CreateDirectory(options.LogDirectory);
        }

        var loggerConfig = new LoggerConfiguration()
            .MinimumLevel.Is(logLevel)
            .MinimumLevel.Override("Microsoft", LogEventLevel.Warning)
            .MinimumLevel.Override("System", LogEventLevel.Warning)
            .Enrich.FromLogContext()
            .Enrich.WithMachineName()
            .Enrich.WithProcessId()
            .Enrich.WithThreadId()
            // FIX SEC-02: Add secure data redaction enricher
            .Enrich.WithSecureDataRedaction()
            .WriteTo.File(
                logPath,
                rollingInterval: RollingInterval.Day,
                retainedFileCountLimit: options.RetainDays,
                fileSizeLimitBytes: options.MaxFileSizeMb * 1024 * 1024,
                rollOnFileSizeLimit: true,
                outputTemplate: "{Timestamp:yyyy-MM-dd HH:mm:ss.fff zzz} [{Level:u3}] {SourceContext}: {Message:lj}{NewLine}{Exception}")
            .WriteTo.Console(
                outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}");

        // Add Windows Event Log if enabled
        if (options.WriteToEventLog)
        {
            loggerConfig.WriteTo.EventLog(
                options.EventLogSource,
                manageEventSource: true,
                restrictedToMinimumLevel: LogEventLevel.Warning);
        }

        return loggerConfig.CreateLogger();
    }

    private static LogEventLevel ParseLogLevel(string level)
    {
        return level.ToLowerInvariant() switch
        {
            "verbose" => LogEventLevel.Verbose,
            "debug" => LogEventLevel.Debug,
            "information" or "info" => LogEventLevel.Information,
            "warning" or "warn" => LogEventLevel.Warning,
            "error" => LogEventLevel.Error,
            "fatal" => LogEventLevel.Fatal,
            _ => LogEventLevel.Information
        };
    }
}

/// <summary>
/// Extension methods for logging specific agent events.
/// FIX SEC-02: Uses secure data redaction for sensitive values.
/// </summary>
public static class LoggerExtensions
{
    public static void LogSyncStarted(this Serilog.ILogger logger, string syncType, int recordCount)
    {
        logger.Information("Starting {SyncType} sync with {RecordCount} records", syncType, recordCount);
    }

    public static void LogSyncCompleted(this Serilog.ILogger logger, string syncType, int processed, int created, int updated, TimeSpan duration)
    {
        logger.Information(
            "Completed {SyncType} sync. Processed: {Processed}, Created: {Created}, Updated: {Updated}, Duration: {Duration}ms",
            syncType, processed, created, updated, duration.TotalMilliseconds);
    }

    public static void LogSyncFailed(this Serilog.ILogger logger, string syncType, Exception exception)
    {
        // FIX SEC-02: Sanitize exception message for potential sensitive data
        var sanitizedMessage = SanitizeExceptionMessage(exception);
        logger.Error(exception, "Failed {SyncType} sync: {Message}", syncType, sanitizedMessage);
    }

    /// <summary>
    /// FIX SEC-02: Uses redacted agent ID.
    /// </summary>
    public static void LogAgentRegistered(this Serilog.ILogger logger, string agentId, string tenantName)
    {
        logger.Information(
            "Agent {AgentId} registered successfully with tenant: {TenantName}",
            SecureUtilities.Redact(agentId, 8),
            SecureUtilities.Redact(tenantName, 10));
    }

    public static void LogConnectionError(this Serilog.ILogger logger, string target, Exception exception)
    {
        // FIX SEC-02: Sanitize target (might contain connection strings)
        var safeTarget = SanitizeConnectionTarget(target);
        var sanitizedMessage = SanitizeExceptionMessage(exception);
        logger.Error(exception, "Connection failed to {Target}: {Message}", safeTarget, sanitizedMessage);
    }

    /// <summary>
    /// FIX SEC-02: Sanitizes exception messages to remove potential sensitive data.
    /// FIX ITER1-B3: More precise token detection to avoid false positives.
    /// </summary>
    private static string SanitizeExceptionMessage(Exception exception)
    {
        var message = exception.Message;

        // Remove potential connection strings
        if (message.Contains("Data Source=", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("Server=", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("Password=", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("User Id=", StringComparison.OrdinalIgnoreCase) ||
            message.Contains("Integrated Security=", StringComparison.OrdinalIgnoreCase))
        {
            return "[Connection details redacted]";
        }

        // FIX ITER1-B3: More precise token detection patterns
        // Only redact if it looks like an actual token value is present
        var sensitivePatterns = new[]
        {
            "Bearer ",           // OAuth Bearer token prefix
            "Authorization:",    // Auth header
            "auth_token=",       // Token query param
            "authToken=",        // Token query param (camelCase)
            "access_token=",     // OAuth access token
            "refresh_token=",    // OAuth refresh token
            "api_key=",          // API key
            "apiKey=",           // API key (camelCase)
            "secret=",           // Generic secret
            "password=",         // Password in URL/query
        };

        foreach (var pattern in sensitivePatterns)
        {
            if (message.Contains(pattern, StringComparison.OrdinalIgnoreCase))
            {
                return SecureUtilities.Redact(message, 20);
            }
        }

        // Truncate long messages
        return message.Length > 200 ? message[..200] + "...[truncated]" : message;
    }

    /// <summary>
    /// FIX SEC-02: Sanitizes connection targets to hide server details.
    /// </summary>
    private static string SanitizeConnectionTarget(string target)
    {
        // If it looks like a connection string or URL, redact it
        if (target.Contains("://") || target.Contains("Data Source") || target.Contains(";"))
        {
            return SecureUtilities.Redact(target, 15);
        }

        return target;
    }
}

// =====================================================
// TIS TIS PLATFORM - Agent Configuration
// Core configuration model for the local agent
// =====================================================

namespace TisTis.Agent.Core.Configuration;

/// <summary>
/// Main configuration for TIS TIS Local Agent.
/// Loaded from appsettings.json and optionally overridden by environment variables.
/// </summary>
public class AgentConfiguration
{
    /// <summary>
    /// Configuration section name in appsettings.json
    /// </summary>
    public const string SectionName = "TisTisAgent";

    /// <summary>
    /// Unique identifier for this agent instance (generated during installation)
    /// </summary>
    public string AgentId { get; set; } = string.Empty;

    /// <summary>
    /// Authentication token for TIS TIS API (stored encrypted with DPAPI)
    /// </summary>
    public string AuthToken { get; set; } = string.Empty;

    /// <summary>
    /// TIS TIS Tenant ID this agent belongs to
    /// </summary>
    public string TenantId { get; set; } = string.Empty;

    /// <summary>
    /// TIS TIS Integration ID this agent is associated with
    /// </summary>
    public string IntegrationId { get; set; } = string.Empty;

    /// <summary>
    /// Optional Branch ID for multi-branch restaurants.
    /// Links this agent to a specific TIS TIS branch.
    /// </summary>
    public string? BranchId { get; set; }

    /// <summary>
    /// Soft Restaurant store code (CodigoTienda) for multi-branch filtering.
    /// Used to filter SQL queries to only return data for this specific store.
    /// Must match the CodigoTienda/Almacen field in SR database.
    /// </summary>
    public string? StoreCode { get; set; }

    /// <summary>
    /// TIS TIS API configuration
    /// </summary>
    public ApiOptions Api { get; set; } = new();

    /// <summary>
    /// Soft Restaurant connection configuration
    /// </summary>
    public SoftRestaurantOptions SoftRestaurant { get; set; } = new();

    /// <summary>
    /// Sync engine configuration
    /// </summary>
    public SyncOptions Sync { get; set; } = new();

    /// <summary>
    /// Logging configuration
    /// </summary>
    public LoggingOptions Logging { get; set; } = new();

    /// <summary>
    /// Security configuration
    /// </summary>
    public SecurityOptions Security { get; set; } = new();

    /// <summary>
    /// Agent version (set at build time)
    /// </summary>
    public string Version { get; set; } = "1.0.0";

    /// <summary>
    /// Validate the configuration
    /// </summary>
    public ValidationResult Validate()
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(AgentId))
            errors.Add("AgentId is required");

        if (string.IsNullOrWhiteSpace(TenantId))
            errors.Add("TenantId is required");

        if (string.IsNullOrWhiteSpace(IntegrationId))
            errors.Add("IntegrationId is required");

        if (string.IsNullOrWhiteSpace(Api.BaseUrl))
            errors.Add("Api.BaseUrl is required");

        // Validate nested options
        var apiValidation = Api.Validate();
        errors.AddRange(apiValidation.Errors);

        var syncValidation = Sync.Validate();
        errors.AddRange(syncValidation.Errors);

        return new ValidationResult(errors.Count == 0, errors);
    }
}

/// <summary>
/// TIS TIS API connection options
/// </summary>
public class ApiOptions
{
    /// <summary>
    /// Base URL for TIS TIS API (e.g., https://app.tistis.com)
    /// </summary>
    public string BaseUrl { get; set; } = "https://app.tistis.com";

    /// <summary>
    /// Endpoint for agent registration
    /// </summary>
    public string RegisterEndpoint { get; set; } = "/api/agent/register";

    /// <summary>
    /// Endpoint for heartbeat
    /// </summary>
    public string HeartbeatEndpoint { get; set; } = "/api/agent/heartbeat";

    /// <summary>
    /// Endpoint for sync data
    /// </summary>
    public string SyncEndpoint { get; set; } = "/api/agent/sync";

    /// <summary>
    /// HTTP request timeout in seconds
    /// </summary>
    public int TimeoutSeconds { get; set; } = 30;

    /// <summary>
    /// Maximum retry attempts for failed requests
    /// </summary>
    public int MaxRetries { get; set; } = 3;

    /// <summary>
    /// Base delay between retries in milliseconds (exponential backoff)
    /// </summary>
    public int RetryDelayMs { get; set; } = 1000;

    /// <summary>
    /// Whether to validate SSL certificates (always true in production)
    /// </summary>
    public bool ValidateSsl { get; set; } = true;

    public ValidationResult Validate()
    {
        var errors = new List<string>();

        if (string.IsNullOrWhiteSpace(BaseUrl))
            errors.Add("Api.BaseUrl is required");

        if (!Uri.TryCreate(BaseUrl, UriKind.Absolute, out var uri) ||
            (uri.Scheme != "http" && uri.Scheme != "https"))
            errors.Add("Api.BaseUrl must be a valid HTTP(S) URL");

        if (TimeoutSeconds < 5 || TimeoutSeconds > 120)
            errors.Add("Api.TimeoutSeconds must be between 5 and 120");

        if (MaxRetries < 0 || MaxRetries > 10)
            errors.Add("Api.MaxRetries must be between 0 and 10");

        return new ValidationResult(errors.Count == 0, errors);
    }
}

/// <summary>
/// Soft Restaurant database connection options
/// </summary>
public class SoftRestaurantOptions
{
    /// <summary>
    /// SQL Server connection string (set during detection/installation)
    /// </summary>
    public string ConnectionString { get; set; } = string.Empty;

    /// <summary>
    /// SQL Server instance name (e.g., DVSOFT, SQLEXPRESS)
    /// </summary>
    public string SqlInstance { get; set; } = string.Empty;

    /// <summary>
    /// Database name (e.g., DVSOFT, SOFTRESTAURANT)
    /// </summary>
    public string DatabaseName { get; set; } = string.Empty;

    /// <summary>
    /// Detected Soft Restaurant version
    /// </summary>
    public string Version { get; set; } = string.Empty;

    /// <summary>
    /// Empresa ID from SR configuration
    /// </summary>
    public string EmpresaId { get; set; } = string.Empty;

    /// <summary>
    /// Store code (CodigoTienda/Almacen) for filtering multi-branch data.
    /// When set, all queries filter by this store code.
    /// Leave empty for single-store restaurants.
    /// </summary>
    public string StoreCode { get; set; } = string.Empty;

    /// <summary>
    /// SQL query timeout in seconds
    /// </summary>
    public int QueryTimeoutSeconds { get; set; } = 60;

    /// <summary>
    /// Connection pool minimum size
    /// </summary>
    public int MinPoolSize { get; set; } = 1;

    /// <summary>
    /// Connection pool maximum size
    /// </summary>
    public int MaxPoolSize { get; set; } = 10;
}

/// <summary>
/// Sync engine options
/// </summary>
public class SyncOptions
{
    /// <summary>
    /// Interval between sync cycles in seconds
    /// </summary>
    public int IntervalSeconds { get; set; } = 30;

    /// <summary>
    /// Whether to sync sales data
    /// </summary>
    public bool SyncSales { get; set; } = true;

    /// <summary>
    /// Whether to sync menu/products
    /// </summary>
    public bool SyncMenu { get; set; } = true;

    /// <summary>
    /// Whether to sync inventory
    /// </summary>
    public bool SyncInventory { get; set; } = true;

    /// <summary>
    /// Whether to sync table status
    /// </summary>
    public bool SyncTables { get; set; } = false;

    /// <summary>
    /// Maximum records per batch
    /// </summary>
    public int BatchSize { get; set; } = 100;

    /// <summary>
    /// Maximum records to fetch per query
    /// </summary>
    public int MaxRecordsPerQuery { get; set; } = 1000;

    /// <summary>
    /// Heartbeat interval in seconds
    /// </summary>
    public int HeartbeatIntervalSeconds { get; set; } = 60;

    /// <summary>
    /// Interval for full menu/inventory sync in minutes (0 = disabled)
    /// </summary>
    public int FullSyncIntervalMinutes { get; set; } = 60;

    /// <summary>
    /// Maximum consecutive errors before pausing sync
    /// </summary>
    public int MaxConsecutiveErrors { get; set; } = 5;

    /// <summary>
    /// Pause duration in seconds after max errors reached
    /// </summary>
    public int ErrorPauseSeconds { get; set; } = 300;

    public ValidationResult Validate()
    {
        var errors = new List<string>();

        if (IntervalSeconds < 10 || IntervalSeconds > 300)
            errors.Add("Sync.IntervalSeconds must be between 10 and 300");

        if (BatchSize < 10 || BatchSize > 1000)
            errors.Add("Sync.BatchSize must be between 10 and 1000");

        if (HeartbeatIntervalSeconds < 30 || HeartbeatIntervalSeconds > 300)
            errors.Add("Sync.HeartbeatIntervalSeconds must be between 30 and 300");

        if (!SyncSales && !SyncMenu && !SyncInventory && !SyncTables)
            errors.Add("At least one sync type must be enabled");

        return new ValidationResult(errors.Count == 0, errors);
    }
}

/// <summary>
/// Logging options
/// </summary>
public class LoggingOptions
{
    /// <summary>
    /// Log file directory (default: %ProgramData%\TisTis\Agent\Logs)
    /// </summary>
    public string LogDirectory { get; set; } = @"C:\ProgramData\TisTis\Agent\Logs";

    /// <summary>
    /// Minimum log level (Verbose, Debug, Information, Warning, Error, Fatal)
    /// </summary>
    public string MinimumLevel { get; set; } = "Information";

    /// <summary>
    /// Days to retain log files
    /// </summary>
    public int RetainDays { get; set; } = 30;

    /// <summary>
    /// Maximum log file size in MB
    /// </summary>
    public int MaxFileSizeMb { get; set; } = 10;

    /// <summary>
    /// Whether to write to Windows Event Log
    /// </summary>
    public bool WriteToEventLog { get; set; } = true;

    /// <summary>
    /// Windows Event Log source name
    /// </summary>
    public string EventLogSource { get; set; } = "TisTis.Agent";
}

/// <summary>
/// Security options
/// </summary>
public class SecurityOptions
{
    /// <summary>
    /// Whether credentials are stored encrypted with DPAPI
    /// </summary>
    public bool UseDataProtection { get; set; } = true;

    /// <summary>
    /// Path to credential store file
    /// </summary>
    public string CredentialStorePath { get; set; } = @"C:\ProgramData\TisTis\Agent\credentials.dat";

    /// <summary>
    /// Minimum TLS version (Tls12 or Tls13)
    /// </summary>
    public string MinTlsVersion { get; set; } = "Tls12";

    /// <summary>
    /// Whether to pin TIS TIS certificate (enhanced security)
    /// </summary>
    public bool UseCertificatePinning { get; set; } = false;

    /// <summary>
    /// Expected TIS TIS certificate thumbprint (for pinning)
    /// </summary>
    public string? CertificateThumbprint { get; set; }
}

/// <summary>
/// Validation result for configuration
/// </summary>
public class ValidationResult
{
    public bool IsValid { get; }
    public IReadOnlyList<string> Errors { get; }

    public ValidationResult(bool isValid, IEnumerable<string> errors)
    {
        IsValid = isValid;
        Errors = errors.ToList();
    }

    public static ValidationResult Success() => new(true, Array.Empty<string>());
}

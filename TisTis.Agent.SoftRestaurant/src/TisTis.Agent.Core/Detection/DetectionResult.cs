// =====================================================
// TIS TIS PLATFORM - Detection Result Models
// Results from Soft Restaurant detection process
// =====================================================

namespace TisTis.Agent.Core.Detection;

/// <summary>
/// Complete result of Soft Restaurant detection process
/// </summary>
public class DetectionResult
{
    /// <summary>
    /// Whether detection was successful (found a usable SR database)
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Timestamp when detection started
    /// </summary>
    public DateTime DetectionStarted { get; set; }

    /// <summary>
    /// Timestamp when detection completed
    /// </summary>
    public DateTime DetectionCompleted { get; set; }

    /// <summary>
    /// Total detection duration in milliseconds
    /// </summary>
    public int DetectionDurationMs { get; set; }

    /// <summary>
    /// Detected Soft Restaurant version (e.g., "10.5.2", "11.0.0")
    /// </summary>
    public string? Version { get; set; }

    /// <summary>
    /// Installation path on disk
    /// </summary>
    public string? InstallPath { get; set; }

    /// <summary>
    /// Windows service name if running as service
    /// </summary>
    public string? ServiceName { get; set; }

    /// <summary>
    /// Windows service status
    /// </summary>
    public string? ServiceStatus { get; set; }

    /// <summary>
    /// SQL Server instance name (e.g., "DVSOFT", "SQLEXPRESS")
    /// </summary>
    public string? SqlInstance { get; set; }

    /// <summary>
    /// Database name (e.g., "DVSOFT", "SOFTRESTAURANT")
    /// </summary>
    public string? DatabaseName { get; set; }

    /// <summary>
    /// Empresa ID from SR configuration
    /// </summary>
    public string? EmpresaId { get; set; }

    /// <summary>
    /// Full connection string for the detected database
    /// </summary>
    public string? ConnectionString { get; set; }

    /// <summary>
    /// Detection methods that were attempted and their results
    /// </summary>
    public List<DetectionMethod> Methods { get; set; } = new();

    /// <summary>
    /// Error messages if detection failed
    /// </summary>
    public List<string> Errors { get; set; } = new();

    /// <summary>
    /// Additional metadata about the detection
    /// </summary>
    public Dictionary<string, object> Metadata { get; set; } = new();

    /// <summary>
    /// Create a failed detection result with error message
    /// </summary>
    public static DetectionResult Failed(string error)
    {
        return new DetectionResult
        {
            Success = false,
            Errors = new List<string> { error },
            DetectionStarted = DateTime.UtcNow,
            DetectionCompleted = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Get a summary string for logging
    /// </summary>
    public string GetSummary()
    {
        if (!Success)
        {
            return $"Detection failed: {string.Join("; ", Errors)}";
        }

        return $"Soft Restaurant {Version ?? "Unknown"} detected. " +
               $"Database: {DatabaseName} on {SqlInstance}. " +
               $"Duration: {DetectionDurationMs}ms";
    }
}

/// <summary>
/// Individual detection method result
/// </summary>
public class DetectionMethod
{
    /// <summary>
    /// Name of the detection method (e.g., "Registry", "WindowsService", "SQL_DVSOFT")
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Whether this method found Soft Restaurant
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Detailed results from this method
    /// </summary>
    public object? Details { get; set; }

    /// <summary>
    /// Error message if method failed
    /// </summary>
    public string? Error { get; set; }

    /// <summary>
    /// Duration of this method in milliseconds
    /// </summary>
    public int DurationMs { get; set; }
}

/// <summary>
/// Result from registry detection
/// </summary>
public class RegistryDetectionResult
{
    public bool Found { get; set; }
    public string? RegistryPath { get; set; }
    public string? Version { get; set; }
    public string? InstallPath { get; set; }
    public string? DatabaseServer { get; set; }
    public string? DatabaseName { get; set; }
    public Dictionary<string, string> Values { get; set; } = new();
}

/// <summary>
/// Result from Windows service detection
/// </summary>
public class ServiceDetectionResult
{
    public bool Found { get; set; }
    public string? ServiceName { get; set; }
    public string? DisplayName { get; set; }
    public string? Status { get; set; }
    public string? StartType { get; set; }
    public string? ImagePath { get; set; }
}

/// <summary>
/// Result from SQL database detection
/// </summary>
public class SqlDetectionResult
{
    public bool Found { get; set; }
    public string? Instance { get; set; }
    public string? DatabaseName { get; set; }
    public string? ConnectionString { get; set; }
    public string? EmpresaId { get; set; }
    public string? SoftRestaurantVersion { get; set; }
    public int TableCount { get; set; }
    public List<string> DetectedTables { get; set; } = new();
}

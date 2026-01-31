// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Detector
// Main orchestrator for SR detection
// =====================================================

using Microsoft.Extensions.Logging;
using Microsoft.Win32;
using System.ServiceProcess;

namespace TisTis.Agent.Core.Detection;

/// <summary>
/// Main service that orchestrates Soft Restaurant detection
/// Uses multiple detection methods to find SR installation
/// </summary>
public class SoftRestaurantDetector : ISoftRestaurantDetector
{
    private readonly ILogger<SoftRestaurantDetector> _logger;
    private readonly RegistryDetector _registryDetector;
    private readonly ServiceDetector _serviceDetector;
    private readonly SqlInstanceDetector _sqlDetector;

    /// <summary>
    /// Known SQL Server instance names commonly used by Soft Restaurant
    /// </summary>
    private static readonly string[] KnownSqlInstances = new[]
    {
        "DVSOFT",
        "SOFTRESTAURANT",
        "SQLEXPRESS",
        "MSSQLSERVER",
        "SR10",
        "SR11"
    };

    /// <summary>
    /// Known database names used by Soft Restaurant
    /// </summary>
    private static readonly string[] KnownDatabaseNames = new[]
    {
        "DVSOFT",
        "SOFTRESTAURANT",
        "SR_",
        "RESTAURANT"
    };

    /// <summary>
    /// Registry paths where SR might be registered
    /// </summary>
    private static readonly string[] RegistryPaths = new[]
    {
        @"SOFTWARE\National Soft\Soft Restaurant 10",
        @"SOFTWARE\National Soft\Soft Restaurant 11",
        @"SOFTWARE\WOW6432Node\National Soft\Soft Restaurant 10",
        @"SOFTWARE\WOW6432Node\National Soft\Soft Restaurant 11",
        @"SOFTWARE\DVSOFT",
        @"SOFTWARE\WOW6432Node\DVSOFT"
    };

    public SoftRestaurantDetector(
        ILogger<SoftRestaurantDetector> logger,
        RegistryDetector registryDetector,
        ServiceDetector serviceDetector,
        SqlInstanceDetector sqlDetector)
    {
        _logger = logger;
        _registryDetector = registryDetector;
        _serviceDetector = serviceDetector;
        _sqlDetector = sqlDetector;
    }

    /// <inheritdoc />
    public async Task<DetectionResult> DetectAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Starting Soft Restaurant detection...");

        var result = new DetectionResult
        {
            DetectionStarted = DateTime.UtcNow,
            Methods = new List<DetectionMethod>()
        };

        // Method 1: Registry Detection
        _logger.LogDebug("Attempting registry detection...");
        var registryStart = DateTime.UtcNow;
        var registryResult = await _registryDetector.DetectAsync(RegistryPaths, cancellationToken);
        result.Methods.Add(new DetectionMethod
        {
            Name = "Registry",
            Success = registryResult.Found,
            Details = registryResult,
            DurationMs = (int)(DateTime.UtcNow - registryStart).TotalMilliseconds
        });

        if (registryResult.Found)
        {
            result.InstallPath = registryResult.InstallPath;
            result.Version = registryResult.Version;
            _logger.LogInformation("Found SR via registry: {Version} at {Path}",
                registryResult.Version, registryResult.InstallPath);
        }

        // Method 2: Windows Services Detection
        _logger.LogDebug("Attempting service detection...");
        var serviceStart = DateTime.UtcNow;
        var serviceResult = await _serviceDetector.DetectAsync(cancellationToken);
        result.Methods.Add(new DetectionMethod
        {
            Name = "WindowsService",
            Success = serviceResult.Found,
            Details = serviceResult,
            DurationMs = (int)(DateTime.UtcNow - serviceStart).TotalMilliseconds
        });

        if (serviceResult.Found)
        {
            result.ServiceName = serviceResult.ServiceName;
            result.ServiceStatus = serviceResult.Status;
            _logger.LogInformation("Found SR service: {ServiceName} ({Status})",
                serviceResult.ServiceName, serviceResult.Status);
        }

        // Method 3: SQL Server Instance Enumeration
        _logger.LogDebug("Enumerating SQL Server instances...");
        var sqlInstances = await _sqlDetector.EnumerateInstancesAsync(cancellationToken);

        _logger.LogDebug("Found {Count} SQL instances to check: {Instances}",
            sqlInstances.Count, string.Join(", ", sqlInstances));

        foreach (var instance in sqlInstances)
        {
            if (cancellationToken.IsCancellationRequested)
            {
                _logger.LogWarning("Detection cancelled");
                break;
            }

            _logger.LogDebug("Checking SQL instance: {Instance}", instance);
            var sqlStart = DateTime.UtcNow;

            // Try to find SR database in this instance
            var dbResult = await _sqlDetector.FindSRDatabaseAsync(instance, KnownDatabaseNames, cancellationToken);

            result.Methods.Add(new DetectionMethod
            {
                Name = $"SQL_{instance.Replace(@"\", "_").Replace(".", "local")}",
                Success = dbResult.Found,
                Details = dbResult,
                DurationMs = (int)(DateTime.UtcNow - sqlStart).TotalMilliseconds
            });

            if (dbResult.Found)
            {
                result.SqlInstance = instance;
                result.DatabaseName = dbResult.DatabaseName;
                result.EmpresaId = dbResult.EmpresaId;
                result.ConnectionString = dbResult.ConnectionString;

                // Update version if detected from database
                if (!string.IsNullOrEmpty(dbResult.SoftRestaurantVersion))
                {
                    result.Version = dbResult.SoftRestaurantVersion;
                }

                _logger.LogInformation("Found SR database: {Database} in instance {Instance}",
                    dbResult.DatabaseName, instance);

                break; // Found a valid database
            }
        }

        // Determine overall success
        result.Success = !string.IsNullOrEmpty(result.ConnectionString);
        result.DetectionCompleted = DateTime.UtcNow;
        result.DetectionDurationMs = (int)(result.DetectionCompleted - result.DetectionStarted).TotalMilliseconds;

        if (result.Success)
        {
            _logger.LogInformation(
                "Detection successful! SR {Version}, Database: {Database}, Instance: {Instance}, Duration: {Duration}ms",
                result.Version ?? "Unknown",
                result.DatabaseName,
                result.SqlInstance,
                result.DetectionDurationMs);
        }
        else
        {
            result.Errors.Add("No Soft Restaurant database found");
            _logger.LogWarning("Detection failed - no Soft Restaurant database found after checking {Count} instances",
                sqlInstances.Count);
        }

        return result;
    }

    /// <inheritdoc />
    public bool QuickCheck()
    {
        // Check registry first (fastest)
        foreach (var path in RegistryPaths)
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(path);
                if (key != null) return true;
            }
            catch (Exception ex)
            {
                // Log at debug level and continue to next path
                _logger.LogDebug(ex, "QuickCheck: Failed to read registry path {Path}", path);
            }
        }

        // Check for SQL services
        try
        {
            var services = ServiceController.GetServices();
            return services.Any(s =>
                KnownSqlInstances.Any(inst =>
                    s.ServiceName.Contains(inst, StringComparison.OrdinalIgnoreCase)));
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "QuickCheck: Failed to enumerate services");
            return false;
        }
    }

    /// <inheritdoc />
    public async Task<SqlDetectionResult> TestConnectionAsync(string connectionString, CancellationToken cancellationToken = default)
    {
        var result = new SqlDetectionResult();

        try
        {
            var builder = new Microsoft.Data.SqlClient.SqlConnectionStringBuilder(connectionString);
            result.Instance = builder.DataSource;
            result.DatabaseName = builder.InitialCatalog;

            // Test the connection
            await using var connection = new Microsoft.Data.SqlClient.SqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);

            // Check for SR tables
            const string tableCheckQuery = @"
                SELECT TABLE_NAME
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE'
                AND TABLE_NAME IN ('Ventas', 'DetalleVentas', 'Productos', 'Clientes', 'Empleados')";

            await using var command = new Microsoft.Data.SqlClient.SqlCommand(tableCheckQuery, connection);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            while (await reader.ReadAsync(cancellationToken))
            {
                result.DetectedTables.Add(reader.GetString(0));
            }

            result.TableCount = result.DetectedTables.Count;
            result.Found = result.TableCount >= 3;  // At least 3 core tables

            if (result.Found)
            {
                result.ConnectionString = connectionString;
                _logger.LogInformation("Connection test successful. Found {Count} SR tables", result.TableCount);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Connection test failed for: {Instance}/{Database}",
                result.Instance, result.DatabaseName);
        }

        return result;
    }
}

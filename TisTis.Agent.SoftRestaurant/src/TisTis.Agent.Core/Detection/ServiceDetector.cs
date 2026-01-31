// =====================================================
// TIS TIS PLATFORM - Windows Service Detector
// Detects SR via Windows Services
// =====================================================

using Microsoft.Extensions.Logging;
using System.ServiceProcess;

namespace TisTis.Agent.Core.Detection;

/// <summary>
/// Detects Soft Restaurant via Windows Services
/// </summary>
public class ServiceDetector
{
    private readonly ILogger<ServiceDetector> _logger;

    /// <summary>
    /// Known service names associated with Soft Restaurant
    /// </summary>
    private static readonly string[] KnownServiceNames = new[]
    {
        "SoftRestaurant",
        "SRService",
        "DVSOFT",
        "NationalSoft",
        "SRSyncService",
        "SRBackoffice"
    };

    /// <summary>
    /// SQL Server service name patterns
    /// </summary>
    private static readonly string[] SqlServicePatterns = new[]
    {
        "MSSQL$DVSOFT",
        "MSSQL$SOFTRESTAURANT",
        "MSSQL$SR",
        "MSSQLSERVER",
        "MSSQL$SQLEXPRESS"
    };

    public ServiceDetector(ILogger<ServiceDetector> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Detect SR-related Windows services
    /// </summary>
    public Task<ServiceDetectionResult> DetectAsync(CancellationToken cancellationToken = default)
    {
        var result = new ServiceDetectionResult();

        try
        {
            var services = ServiceController.GetServices();

            // First, look for SR-specific services
            foreach (var serviceName in KnownServiceNames)
            {
                if (cancellationToken.IsCancellationRequested) break;

                var service = services.FirstOrDefault(s =>
                    s.ServiceName.Contains(serviceName, StringComparison.OrdinalIgnoreCase) ||
                    s.DisplayName.Contains(serviceName, StringComparison.OrdinalIgnoreCase));

                if (service != null)
                {
                    result.Found = true;
                    result.ServiceName = service.ServiceName;
                    result.DisplayName = service.DisplayName;
                    result.Status = service.Status.ToString();
                    result.StartType = service.StartType.ToString();

                    _logger.LogInformation(
                        "Found SR service: {Name} ({DisplayName}), Status: {Status}",
                        service.ServiceName, service.DisplayName, service.Status);

                    break;
                }
            }

            // If no SR service found, check for SQL Server with SR-related names
            if (!result.Found)
            {
                foreach (var pattern in SqlServicePatterns)
                {
                    if (cancellationToken.IsCancellationRequested) break;

                    var service = services.FirstOrDefault(s =>
                        s.ServiceName.Equals(pattern, StringComparison.OrdinalIgnoreCase));

                    if (service != null)
                    {
                        // This is a SQL instance that might have SR database
                        result.Found = true;
                        result.ServiceName = service.ServiceName;
                        result.DisplayName = service.DisplayName;
                        result.Status = service.Status.ToString();
                        result.StartType = service.StartType.ToString();

                        _logger.LogInformation(
                            "Found SQL Server instance: {Name}, Status: {Status}",
                            service.ServiceName, service.Status);

                        break;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error detecting Windows services");
        }

        return Task.FromResult(result);
    }

    /// <summary>
    /// Get list of all SQL Server instances on this machine
    /// </summary>
    public List<string> GetSqlServerInstances()
    {
        var instances = new List<string>();

        try
        {
            var services = ServiceController.GetServices();

            foreach (var service in services)
            {
                // SQL Server services follow pattern: MSSQL$InstanceName or MSSQLSERVER (default)
                if (service.ServiceName.Equals("MSSQLSERVER", StringComparison.OrdinalIgnoreCase))
                {
                    instances.Add(".");  // Default instance
                }
                else if (service.ServiceName.StartsWith("MSSQL$", StringComparison.OrdinalIgnoreCase))
                {
                    var instanceName = service.ServiceName.Substring(6);  // Remove "MSSQL$"
                    instances.Add($@".\{instanceName}");
                }
            }

            _logger.LogDebug("Found {Count} SQL Server instances: {Instances}",
                instances.Count, string.Join(", ", instances));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error enumerating SQL Server instances");
        }

        return instances;
    }
}

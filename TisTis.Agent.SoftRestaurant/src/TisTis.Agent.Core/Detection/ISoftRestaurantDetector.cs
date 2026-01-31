// =====================================================
// TIS TIS PLATFORM - Soft Restaurant Detector Interface
// Contract for detecting SR installations
// =====================================================

namespace TisTis.Agent.Core.Detection;

/// <summary>
/// Interface for Soft Restaurant detection service
/// </summary>
public interface ISoftRestaurantDetector
{
    /// <summary>
    /// Performs full detection of Soft Restaurant installation
    /// Checks registry, Windows services, and SQL Server instances
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Detection result with connection details if found</returns>
    Task<DetectionResult> DetectAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Quick check if SR appears to be installed (for UI feedback)
    /// Does not validate database connection
    /// </summary>
    /// <returns>True if SR indicators found</returns>
    bool QuickCheck();

    /// <summary>
    /// Test a specific SQL Server connection
    /// </summary>
    /// <param name="connectionString">Connection string to test</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if connection successful and SR tables exist</returns>
    Task<SqlDetectionResult> TestConnectionAsync(string connectionString, CancellationToken cancellationToken = default);
}

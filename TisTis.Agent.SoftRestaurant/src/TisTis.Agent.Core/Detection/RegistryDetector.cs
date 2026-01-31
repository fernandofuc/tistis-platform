// =====================================================
// TIS TIS PLATFORM - Registry Detector
// Detects SR via Windows Registry entries
// =====================================================

using Microsoft.Extensions.Logging;
using Microsoft.Win32;

namespace TisTis.Agent.Core.Detection;

/// <summary>
/// Detects Soft Restaurant installation via Windows Registry
/// </summary>
public class RegistryDetector
{
    private readonly ILogger<RegistryDetector> _logger;

    /// <summary>
    /// Known registry paths where Soft Restaurant registers itself
    /// </summary>
    private static readonly string[] KnownRegistryPaths = new[]
    {
        @"SOFTWARE\National Soft\Soft Restaurant 10",
        @"SOFTWARE\National Soft\Soft Restaurant 11",
        @"SOFTWARE\WOW6432Node\National Soft\Soft Restaurant 10",
        @"SOFTWARE\WOW6432Node\National Soft\Soft Restaurant 11",
        @"SOFTWARE\DVSOFT",
        @"SOFTWARE\WOW6432Node\DVSOFT",
        @"SOFTWARE\National Soft",
        @"SOFTWARE\WOW6432Node\National Soft"
    };

    /// <summary>
    /// Registry value names that contain useful information
    /// </summary>
    private static readonly string[] ValueNames = new[]
    {
        "InstallPath",
        "Version",
        "DataBase",
        "Server",
        "SQLInstance",
        "DatabaseName",
        "RutaInstalacion",
        "Empresa"
    };

    public RegistryDetector(ILogger<RegistryDetector> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Detect SR via registry entries
    /// </summary>
    public Task<RegistryDetectionResult> DetectAsync(IEnumerable<string>? paths = null, CancellationToken cancellationToken = default)
    {
        var pathsToCheck = paths ?? KnownRegistryPaths;
        var result = new RegistryDetectionResult();

        foreach (var path in pathsToCheck)
        {
            if (cancellationToken.IsCancellationRequested)
                break;

            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(path);
                if (key == null) continue;

                _logger.LogDebug("Found registry key: {Path}", path);
                result.Found = true;
                result.RegistryPath = path;

                // Read all known value names
                foreach (var valueName in ValueNames)
                {
                    var value = key.GetValue(valueName)?.ToString();
                    if (!string.IsNullOrEmpty(value))
                    {
                        result.Values[valueName] = value;

                        // Map to specific properties
                        switch (valueName.ToLowerInvariant())
                        {
                            case "installpath":
                            case "rutainstalacion":
                                result.InstallPath = value;
                                break;
                            case "version":
                                result.Version = value;
                                break;
                            case "server":
                            case "sqlinstance":
                                result.DatabaseServer = value;
                                break;
                            case "database":
                            case "databasename":
                                result.DatabaseName = value;
                                break;
                        }
                    }
                }

                // Try to extract version from path if not found in values
                if (string.IsNullOrEmpty(result.Version))
                {
                    if (path.Contains("Restaurant 10"))
                        result.Version = "10.x";
                    else if (path.Contains("Restaurant 11"))
                        result.Version = "11.x";
                }

                // Check subkeys for more info
                foreach (var subKeyName in key.GetSubKeyNames())
                {
                    using var subKey = key.OpenSubKey(subKeyName);
                    if (subKey == null) continue;

                    foreach (var valueName in ValueNames)
                    {
                        var value = subKey.GetValue(valueName)?.ToString();
                        if (!string.IsNullOrEmpty(value) && !result.Values.ContainsKey($"{subKeyName}.{valueName}"))
                        {
                            result.Values[$"{subKeyName}.{valueName}"] = value;
                        }
                    }
                }

                // Found a valid key, return
                if (result.Found)
                {
                    _logger.LogInformation(
                        "Registry detection successful. Path: {Path}, Version: {Version}",
                        path, result.Version ?? "Unknown");
                    break;
                }
            }
            catch (Exception ex)
            {
                _logger.LogDebug(ex, "Error reading registry path: {Path}", path);
            }
        }

        return Task.FromResult(result);
    }

    /// <summary>
    /// Quick check for any SR registry keys
    /// </summary>
    public bool QuickCheck()
    {
        foreach (var path in KnownRegistryPaths)
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(path);
                if (key != null) return true;
            }
            catch
            {
                // Continue to next path
            }
        }
        return false;
    }
}

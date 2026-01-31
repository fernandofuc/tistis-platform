// =====================================================
// TIS TIS PLATFORM - SQL Instance Detector
// Detects SR database in SQL Server instances
// =====================================================

using Microsoft.Data.Sql;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace TisTis.Agent.Core.Detection;

/// <summary>
/// Detects Soft Restaurant database in SQL Server instances
/// </summary>
public class SqlInstanceDetector
{
    private readonly ILogger<SqlInstanceDetector> _logger;

    /// <summary>
    /// Known database names used by Soft Restaurant
    /// </summary>
    private static readonly string[] KnownDatabaseNames = new[]
    {
        "DVSOFT",
        "SOFTRESTAURANT",
        "SR_EMPRESA",
        "RESTAURANT",
        "DATOS_SR"
    };

    /// <summary>
    /// Core tables that must exist in an SR database
    /// </summary>
    private static readonly string[] RequiredTables = new[]
    {
        "Ventas",
        "DetalleVentas",
        "Productos",
        "Clientes",
        "Empleados"
    };

    /// <summary>
    /// Optional tables that help identify SR version
    /// </summary>
    private static readonly string[] OptionalTables = new[]
    {
        "Inventario",
        "MovimientosInventario",
        "Mesas",
        "Turnos",
        "Cajas",
        "FormasPago",
        "Categorias",
        "Recetas"
    };

    public SqlInstanceDetector(ILogger<SqlInstanceDetector> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Enumerate all SQL Server instances on this machine
    /// </summary>
    public Task<List<string>> EnumerateInstancesAsync(CancellationToken cancellationToken = default)
    {
        var instances = new List<string>();

        try
        {
            // Try SQL Server Browser service first (SqlDataSourceEnumerator.Instance is static)
            var dataTable = SqlDataSourceEnumerator.Instance.GetDataSources();

            foreach (System.Data.DataRow row in dataTable.Rows)
            {
                if (cancellationToken.IsCancellationRequested) break;

                var serverName = row["ServerName"]?.ToString() ?? "";
                var instanceName = row["InstanceName"]?.ToString() ?? "";

                string fullName;
                if (string.IsNullOrEmpty(instanceName))
                {
                    fullName = serverName;
                }
                else
                {
                    fullName = $@"{serverName}\{instanceName}";
                }

                // Only local instances
                if (serverName.Equals(Environment.MachineName, StringComparison.OrdinalIgnoreCase) ||
                    serverName.Equals("(local)", StringComparison.OrdinalIgnoreCase) ||
                    serverName == ".")
                {
                    if (!string.IsNullOrEmpty(instanceName))
                    {
                        instances.Add($@".\{instanceName}");
                    }
                    else
                    {
                        instances.Add(".");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "SQL Browser enumeration failed, falling back to common instances");
        }

        // Add common instance names if not found
        var commonInstances = new[] { ".", @".\SQLEXPRESS", @".\DVSOFT", @".\SOFTRESTAURANT", @".\SR10", @".\SR11" };
        foreach (var common in commonInstances)
        {
            if (!instances.Contains(common, StringComparer.OrdinalIgnoreCase))
            {
                instances.Add(common);
            }
        }

        return Task.FromResult(instances);
    }

    /// <summary>
    /// Find SR database in a specific SQL instance
    /// </summary>
    public async Task<SqlDetectionResult> FindSRDatabaseAsync(
        string instance,
        IEnumerable<string>? databaseNames = null,
        CancellationToken cancellationToken = default)
    {
        var result = new SqlDetectionResult { Instance = instance };
        var namesToCheck = databaseNames ?? KnownDatabaseNames;

        // Build base connection string for master database
        var masterConnectionString = new SqlConnectionStringBuilder
        {
            DataSource = instance,
            InitialCatalog = "master",
            IntegratedSecurity = true,
            TrustServerCertificate = true,
            ConnectTimeout = 10
        }.ConnectionString;

        try
        {
            await using var masterConnection = new SqlConnection(masterConnectionString);
            await masterConnection.OpenAsync(cancellationToken);

            _logger.LogDebug("Connected to SQL instance: {Instance}", instance);

            // List all databases
            const string listDbQuery = @"
                SELECT name FROM sys.databases
                WHERE state_desc = 'ONLINE'
                AND name NOT IN ('master', 'tempdb', 'model', 'msdb')";

            await using var listCommand = new SqlCommand(listDbQuery, masterConnection);
            await using var reader = await listCommand.ExecuteReaderAsync(cancellationToken);

            var databases = new List<string>();
            while (await reader.ReadAsync(cancellationToken))
            {
                databases.Add(reader.GetString(0));
            }

            _logger.LogDebug("Found {Count} user databases in {Instance}: {Databases}",
                databases.Count, instance, string.Join(", ", databases));

            // Check each database for SR tables
            foreach (var dbName in databases)
            {
                if (cancellationToken.IsCancellationRequested) break;

                // Check if name matches known patterns
                var isKnownName = namesToCheck.Any(known =>
                    dbName.StartsWith(known, StringComparison.OrdinalIgnoreCase) ||
                    dbName.Equals(known, StringComparison.OrdinalIgnoreCase));

                // Check for SR tables
                var dbResult = await CheckDatabaseForSRAsync(instance, dbName, cancellationToken);

                if (dbResult.Found)
                {
                    result = dbResult;
                    _logger.LogInformation(
                        "Found SR database: {Database} in {Instance}. Tables: {TableCount}",
                        dbName, instance, dbResult.TableCount);
                    break;
                }
            }
        }
        catch (SqlException ex)
        {
            _logger.LogDebug(ex, "Could not connect to SQL instance: {Instance}", instance);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Error checking SQL instance: {Instance}", instance);
        }

        return result;
    }

    /// <summary>
    /// Check if a specific database contains SR tables
    /// </summary>
    private async Task<SqlDetectionResult> CheckDatabaseForSRAsync(
        string instance,
        string databaseName,
        CancellationToken cancellationToken)
    {
        var result = new SqlDetectionResult
        {
            Instance = instance,
            DatabaseName = databaseName
        };

        var connectionString = new SqlConnectionStringBuilder
        {
            DataSource = instance,
            InitialCatalog = databaseName,
            IntegratedSecurity = true,
            TrustServerCertificate = true,
            ConnectTimeout = 10
        }.ConnectionString;

        try
        {
            await using var connection = new SqlConnection(connectionString);
            await connection.OpenAsync(cancellationToken);

            // Check for required tables
            const string tableCheckQuery = @"
                SELECT TABLE_NAME
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE = 'BASE TABLE'";

            await using var command = new SqlCommand(tableCheckQuery, connection);
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            var tables = new List<string>();
            while (await reader.ReadAsync(cancellationToken))
            {
                tables.Add(reader.GetString(0));
            }

            result.DetectedTables = tables;
            result.TableCount = tables.Count;

            // Check if all required tables exist
            var hasRequiredTables = RequiredTables.All(required =>
                tables.Any(t => t.Equals(required, StringComparison.OrdinalIgnoreCase)));

            if (hasRequiredTables)
            {
                result.Found = true;
                result.ConnectionString = connectionString;

                // Try to get Empresa ID
                try
                {
                    await reader.CloseAsync();

                    const string empresaQuery = @"
                        SELECT TOP 1 Codigo FROM dbo.Empresas WHERE Activa = 1
                        UNION ALL
                        SELECT TOP 1 IdEmpresa FROM dbo.Configuracion";

                    await using var empresaCommand = new SqlCommand(empresaQuery, connection);
                    var empresaId = await empresaCommand.ExecuteScalarAsync(cancellationToken);
                    result.EmpresaId = empresaId?.ToString();
                }
                catch
                {
                    // Empresa table might not exist or have different structure
                }

                // Try to detect SR version from tables structure
                result.SoftRestaurantVersion = DetectVersionFromTables(tables);
            }
        }
        catch (Exception ex)
        {
            _logger.LogDebug(ex, "Error checking database {Database} in {Instance}",
                databaseName, instance);
        }

        return result;
    }

    /// <summary>
    /// Detect SR version based on table structure
    /// </summary>
    private string? DetectVersionFromTables(List<string> tables)
    {
        // SR 11 has some new tables
        if (tables.Any(t => t.Equals("ConfiguracionV11", StringComparison.OrdinalIgnoreCase)) ||
            tables.Any(t => t.Equals("NuevosModulos", StringComparison.OrdinalIgnoreCase)))
        {
            return "11.x";
        }

        // SR 10 detection
        if (tables.Any(t => t.Equals("Ventas", StringComparison.OrdinalIgnoreCase)) &&
            tables.Any(t => t.Equals("Productos", StringComparison.OrdinalIgnoreCase)))
        {
            return "10.x";
        }

        return null;
    }
}

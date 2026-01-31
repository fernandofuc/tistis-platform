// =====================================================
// TIS TIS PLATFORM - Schema Validator
// Validates Soft Restaurant database schema before syncing
// =====================================================

using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using TisTis.Agent.Core.Configuration;

namespace TisTis.Agent.Core.Database;

/// <summary>
/// Validates Soft Restaurant database schema against expected structure.
/// Ensures compatibility before attempting data sync operations.
/// </summary>
public class SchemaValidator : ISchemaValidator
{
    private readonly string _connectionString;
    private readonly ILogger<SchemaValidator> _logger;
    private readonly int _queryTimeout;
    private readonly HttpClient _httpClient;
    private readonly AgentOptions _agentOptions;

    // Expected tables for each sync feature
    private static readonly Dictionary<string, string[]> RequiredTablesForSync = new()
    {
        ["sales"] = new[] { "Ventas", "DetalleVentas", "Productos" },
        ["menu"] = new[] { "Productos" },
        ["inventory"] = new[] { "Inventario" },
        ["tables"] = new[] { "Mesas" },
    };

    // All expected tables
    private static readonly string[] AllExpectedTables = new[]
    {
        "Ventas", "DetalleVentas", "PagosVenta", "FormasPago",
        "Productos", "Categorias",
        "Inventario", "CategoriasInventario", "Proveedores",
        "Mesas",
        "Clientes", "Empleados"
    };

    public SchemaValidator(
        SoftRestaurantOptions srOptions,
        AgentOptions agentOptions,
        HttpClient httpClient,
        ILogger<SchemaValidator> logger)
    {
        _connectionString = srOptions.ConnectionString;
        _queryTimeout = srOptions.QueryTimeoutSeconds;
        _agentOptions = agentOptions;
        _httpClient = httpClient;
        _logger = logger;
    }

    /// <inheritdoc />
    public string GetDatabaseName()
    {
        try
        {
            var builder = new SqlConnectionStringBuilder(_connectionString);
            return builder.InitialCatalog ?? "Unknown";
        }
        catch
        {
            return "Unknown";
        }
    }

    /// <inheritdoc />
    public async Task<string?> GetSqlServerVersionAsync(CancellationToken cancellationToken = default)
    {
        const string query = "SELECT @@VERSION";

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(query, connection);
            command.CommandTimeout = _queryTimeout;

            var result = await command.ExecuteScalarAsync(cancellationToken);
            return result?.ToString();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to get SQL Server version");
            return null;
        }
    }

    /// <inheritdoc />
    public async Task<SchemaValidationResult> ValidateSchemaAsync(CancellationToken cancellationToken = default)
    {
        var result = new SchemaValidationResult
        {
            DatabaseName = GetDatabaseName(),
            TablesExpected = AllExpectedTables.Length,
        };

        _logger.LogInformation("Starting schema validation for database: {Database}", result.DatabaseName);

        try
        {
            // Get SQL Server version
            result.SqlServerVersion = await GetSqlServerVersionAsync(cancellationToken);

            // Query database schema using INFORMATION_SCHEMA
            var tables = await GetDatabaseSchemaAsync(cancellationToken);
            result.Tables = tables;

            // Check for missing required tables
            var foundTableNames = tables.Select(t => t.TableName.ToLowerInvariant()).ToHashSet();

            foreach (var expectedTable in AllExpectedTables)
            {
                if (!foundTableNames.Contains(expectedTable.ToLowerInvariant()))
                {
                    // Check if it's required for any enabled sync
                    var isRequired = RequiredTablesForSync.Values.Any(
                        requiredTables => requiredTables.Contains(expectedTable, StringComparer.OrdinalIgnoreCase)
                    );

                    if (isRequired)
                    {
                        result.MissingRequiredTables.Add(expectedTable);
                        result.Errors.Add($"Required table not found: dbo.{expectedTable}");
                    }
                    else
                    {
                        result.Warnings.Add($"Optional table not found: dbo.{expectedTable}");
                    }
                }
            }

            // Determine feature availability
            result.CanSyncSales = CanSyncFeature("sales", foundTableNames);
            result.CanSyncMenu = CanSyncFeature("menu", foundTableNames);
            result.CanSyncInventory = CanSyncFeature("inventory", foundTableNames);
            result.CanSyncTables = CanSyncFeature("tables", foundTableNames);

            // Detect SR version based on column presence
            result.DetectedVersion = DetectSRVersion(tables);

            // Set overall success
            result.Success = result.MissingRequiredTables.Count == 0 &&
                            (result.CanSyncSales || result.CanSyncMenu);

            _logger.LogInformation(
                "Schema validation completed: {Status}, Tables: {Found}/{Expected}, " +
                "CanSync: Sales={Sales}, Menu={Menu}, Inventory={Inventory}, Tables={Tables}",
                result.Success ? "SUCCESS" : "FAILED",
                result.TablesFound,
                result.TablesExpected,
                result.CanSyncSales,
                result.CanSyncMenu,
                result.CanSyncInventory,
                result.CanSyncTables);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Schema validation failed with exception");
            result.Success = false;
            result.Errors.Add($"Validation failed: {ex.Message}");
        }

        return result;
    }

    /// <summary>
    /// Queries the database schema using INFORMATION_SCHEMA views
    /// </summary>
    private async Task<List<TableInfo>> GetDatabaseSchemaAsync(CancellationToken cancellationToken)
    {
        var tables = new List<TableInfo>();

        // Query to get all tables and their columns
        const string query = @"
            SELECT
                t.TABLE_SCHEMA,
                t.TABLE_NAME,
                c.COLUMN_NAME,
                c.DATA_TYPE,
                CASE WHEN c.IS_NULLABLE = 'YES' THEN 1 ELSE 0 END AS IS_NULLABLE
            FROM INFORMATION_SCHEMA.TABLES t
            INNER JOIN INFORMATION_SCHEMA.COLUMNS c
                ON t.TABLE_SCHEMA = c.TABLE_SCHEMA
                AND t.TABLE_NAME = c.TABLE_NAME
            WHERE t.TABLE_TYPE = 'BASE TABLE'
                AND t.TABLE_SCHEMA = 'dbo'
                AND t.TABLE_NAME IN (
                    'Ventas', 'DetalleVentas', 'PagosVenta', 'FormasPago',
                    'Productos', 'Categorias',
                    'Inventario', 'CategoriasInventario', 'Proveedores',
                    'Mesas',
                    'Clientes', 'Empleados'
                )
            ORDER BY t.TABLE_NAME, c.ORDINAL_POSITION";

        try
        {
            await using var connection = new SqlConnection(_connectionString);
            await connection.OpenAsync(cancellationToken);

            await using var command = new SqlCommand(query, connection);
            command.CommandTimeout = _queryTimeout;

            await using var reader = await command.ExecuteReaderAsync(cancellationToken);

            var tableDict = new Dictionary<string, TableInfo>();

            while (await reader.ReadAsync(cancellationToken))
            {
                var schemaName = reader.GetString(0);
                var tableName = reader.GetString(1);
                var columnName = reader.GetString(2);
                var dataType = reader.GetString(3);
                var isNullable = reader.GetInt32(4) == 1;

                var tableKey = $"{schemaName}.{tableName}";

                if (!tableDict.TryGetValue(tableKey, out var tableInfo))
                {
                    tableInfo = new TableInfo
                    {
                        SchemaName = schemaName,
                        TableName = tableName,
                        Columns = new List<ColumnInfo>()
                    };
                    tableDict[tableKey] = tableInfo;
                }

                tableInfo.Columns.Add(new ColumnInfo
                {
                    ColumnName = columnName,
                    DataType = dataType,
                    IsNullable = isNullable
                });
            }

            tables = tableDict.Values.ToList();

            _logger.LogDebug("Found {Count} tables in database schema", tables.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error querying database schema");
            throw;
        }

        return tables;
    }

    /// <summary>
    /// Checks if a specific sync feature can be enabled based on available tables
    /// </summary>
    private bool CanSyncFeature(string feature, HashSet<string> foundTables)
    {
        if (!RequiredTablesForSync.TryGetValue(feature, out var requiredTables))
        {
            return false;
        }

        return requiredTables.All(t => foundTables.Contains(t.ToLowerInvariant()));
    }

    /// <summary>
    /// Detects the Soft Restaurant version based on available columns in the schema.
    /// </summary>
    private SRVersion DetectSRVersion(List<TableInfo> tables)
    {
        // Get Ventas table columns
        var ventasTable = tables.FirstOrDefault(t =>
            t.TableName.Equals("Ventas", StringComparison.OrdinalIgnoreCase));

        if (ventasTable == null)
        {
            _logger.LogWarning("Cannot detect SR version: Ventas table not found");
            return SRVersion.Unknown;
        }

        var ventasColumns = ventasTable.Columns
            .Select(c => c.ColumnName.ToLowerInvariant())
            .ToHashSet();

        // Check for version-specific columns
        var hasMoneda = ventasColumns.Contains("moneda");
        var hasTipoOrden = ventasColumns.Contains("tipoorden");
        var hasNumeroComensales = ventasColumns.Contains("numerocomensales");

        // Check if PagosVenta table exists
        var hasPagosVenta = tables.Any(t =>
            t.TableName.Equals("PagosVenta", StringComparison.OrdinalIgnoreCase));

        // Use the query provider's detection logic
        var detectedVersion = SRVersionQueryProvider.DetectVersion(
            hasMoneda, hasTipoOrden, hasNumeroComensales, hasPagosVenta);

        _logger.LogInformation(
            "Detected SR version: {Version} (Moneda={Moneda}, TipoOrden={TipoOrden}, " +
            "NumeroComensales={Comensales}, PagosVenta={Pagos})",
            detectedVersion,
            hasMoneda,
            hasTipoOrden,
            hasNumeroComensales,
            hasPagosVenta);

        return detectedVersion;
    }

    /// <inheritdoc />
    public async Task<SchemaValidationApiResponse> SendValidationToApiAsync(
        SchemaValidationResult result,
        CancellationToken cancellationToken = default)
    {
        var apiResponse = new SchemaValidationApiResponse();

        try
        {
            // Build request payload
            var payload = new
            {
                agent_id = _agentOptions.AgentId,
                database_name = result.DatabaseName,
                sql_server_version = result.SqlServerVersion,
                tables = result.Tables.Select(t => new
                {
                    table_name = t.TableName,
                    schema_name = t.SchemaName,
                    columns = t.Columns.Select(c => new
                    {
                        column_name = c.ColumnName,
                        data_type = c.DataType,
                        is_nullable = c.IsNullable
                    }).ToArray()
                }).ToArray()
            };

            // Build URL
            var baseUrl = _agentOptions.ApiBaseUrl.TrimEnd('/');
            var url = $"{baseUrl}/api/agent/validate-schema";

            // Create request
            var request = new HttpRequestMessage(HttpMethod.Post, url);
            request.Headers.Add("Authorization", $"Bearer {_agentOptions.AgentId}:{_agentOptions.AuthToken}");
            request.Headers.Add("X-Agent-Id", _agentOptions.AgentId);
            request.Content = JsonContent.Create(payload);

            _logger.LogDebug("Sending schema validation to API: {Url}", url);

            // Send request
            var response = await _httpClient.SendAsync(request, cancellationToken);
            var responseBody = await response.Content.ReadAsStringAsync(cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                var jsonOptions = new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true,
                    PropertyNamingPolicy = JsonNamingPolicy.SnakeCaseLower
                };

                var apiResult = JsonSerializer.Deserialize<ValidateSchemaApiResult>(responseBody, jsonOptions);

                apiResponse.Success = apiResult?.Success ?? false;
                apiResponse.Summary = apiResult?.Summary;
                apiResponse.Recommendations = apiResult?.Recommendations;

                _logger.LogInformation(
                    "Schema validation sent to API successfully: {Status} - {Title}",
                    apiResponse.Summary?.Status,
                    apiResponse.Summary?.Title);
            }
            else
            {
                apiResponse.Success = false;
                apiResponse.ErrorMessage = $"API returned {response.StatusCode}: {responseBody}";

                _logger.LogWarning(
                    "Failed to send schema validation to API: {StatusCode} - {Response}",
                    response.StatusCode,
                    responseBody);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error sending schema validation to API");
            apiResponse.Success = false;
            apiResponse.ErrorMessage = ex.Message;
        }

        return apiResponse;
    }

    // Helper class for deserializing API response
    private class ValidateSchemaApiResult
    {
        [JsonPropertyName("success")]
        public bool Success { get; set; }

        [JsonPropertyName("summary")]
        public ValidationSummary? Summary { get; set; }

        [JsonPropertyName("recommendations")]
        public List<string>? Recommendations { get; set; }
    }
}

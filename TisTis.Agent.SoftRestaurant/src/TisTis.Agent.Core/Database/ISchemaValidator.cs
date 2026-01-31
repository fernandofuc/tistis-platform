// =====================================================
// TIS TIS PLATFORM - Schema Validator Interface
// Contract for validating Soft Restaurant database schema
// =====================================================

namespace TisTis.Agent.Core.Database;

/// <summary>
/// Interface for validating Soft Restaurant database schema.
/// Ensures the database has the expected tables and columns before syncing.
/// </summary>
public interface ISchemaValidator
{
    /// <summary>
    /// Validates the database schema and returns detailed results.
    /// </summary>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>Schema validation result with detailed information</returns>
    Task<SchemaValidationResult> ValidateSchemaAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the database name from the connection string.
    /// </summary>
    string GetDatabaseName();

    /// <summary>
    /// Gets the SQL Server version.
    /// </summary>
    Task<string?> GetSqlServerVersionAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Sends validation results to TIS TIS API.
    /// </summary>
    /// <param name="result">The validation result to send</param>
    /// <param name="cancellationToken">Cancellation token</param>
    /// <returns>True if the API accepted the validation</returns>
    Task<SchemaValidationApiResponse> SendValidationToApiAsync(
        SchemaValidationResult result,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Result of schema validation
/// </summary>
public class SchemaValidationResult
{
    /// <summary>
    /// Whether the validation was successful (all required tables exist)
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Timestamp of validation
    /// </summary>
    public DateTime ValidatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Name of the database validated
    /// </summary>
    public string DatabaseName { get; set; } = string.Empty;

    /// <summary>
    /// SQL Server version
    /// </summary>
    public string? SqlServerVersion { get; set; }

    /// <summary>
    /// Tables found in the database
    /// </summary>
    public List<TableInfo> Tables { get; set; } = new();

    /// <summary>
    /// List of errors encountered
    /// </summary>
    public List<string> Errors { get; set; } = new();

    /// <summary>
    /// List of warnings
    /// </summary>
    public List<string> Warnings { get; set; } = new();

    /// <summary>
    /// Summary statistics
    /// </summary>
    public int TablesFound => Tables.Count;
    public int TablesExpected { get; set; }
    public int RequiredTablesMissing => MissingRequiredTables.Count;
    public List<string> MissingRequiredTables { get; set; } = new();

    /// <summary>
    /// Feature availability based on schema
    /// </summary>
    public bool CanSyncSales { get; set; }
    public bool CanSyncMenu { get; set; }
    public bool CanSyncInventory { get; set; }
    public bool CanSyncTables { get; set; }

    /// <summary>
    /// Detected Soft Restaurant version based on schema analysis
    /// </summary>
    public SRVersion DetectedVersion { get; set; } = SRVersion.Unknown;

    /// <summary>
    /// Detected version as display string
    /// </summary>
    public string DetectedVersionDisplay => DetectedVersion switch
    {
        SRVersion.V12 => "SR 12.x",
        SRVersion.V11 => "SR 11.x",
        SRVersion.V10 => "SR 10.x",
        SRVersion.Legacy => "SR Legacy (9.x o anterior)",
        _ => "Versión desconocida"
    };
}

/// <summary>
/// Information about a table in the database
/// </summary>
public class TableInfo
{
    /// <summary>
    /// Table name
    /// </summary>
    public string TableName { get; set; } = string.Empty;

    /// <summary>
    /// Schema name (usually 'dbo')
    /// </summary>
    public string SchemaName { get; set; } = "dbo";

    /// <summary>
    /// Columns in the table
    /// </summary>
    public List<ColumnInfo> Columns { get; set; } = new();
}

/// <summary>
/// Information about a column in a table
/// </summary>
public class ColumnInfo
{
    /// <summary>
    /// Column name
    /// </summary>
    public string ColumnName { get; set; } = string.Empty;

    /// <summary>
    /// SQL Server data type
    /// </summary>
    public string DataType { get; set; } = string.Empty;

    /// <summary>
    /// Whether the column allows NULL values
    /// </summary>
    public bool IsNullable { get; set; }
}

/// <summary>
/// Response from the TIS TIS API after sending validation results
/// </summary>
public class SchemaValidationApiResponse
{
    /// <summary>
    /// Whether the API accepted the validation
    /// </summary>
    public bool Success { get; set; }

    /// <summary>
    /// Validation summary from the API
    /// </summary>
    public ValidationSummary? Summary { get; set; }

    /// <summary>
    /// Recommendations from the API
    /// </summary>
    public List<string>? Recommendations { get; set; }

    /// <summary>
    /// Error message if failed
    /// </summary>
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// Validation summary from the API
/// </summary>
public class ValidationSummary
{
    public string Status { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public List<FeatureStatus>? Features { get; set; }
}

/// <summary>
/// Status of a feature based on schema validation
/// </summary>
public class FeatureStatus
{
    public string Name { get; set; } = string.Empty;
    public bool Enabled { get; set; }
    public string? Reason { get; set; }
}

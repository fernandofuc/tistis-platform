// =====================================================
// TIS TIS PLATFORM - Installer Custom Actions
// Custom actions for WiX installer
// =====================================================

using System.Security.Cryptography;
using System.ServiceProcess;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.Deployment.WindowsInstaller;
using Microsoft.Win32;

namespace TisTis.Agent.Installer.CustomActions;

/// <summary>
/// WiX Custom Actions for TIS TIS Agent Installer
/// </summary>
public class CustomActions
{
    private const string LogPrefix = "[TisTis.Agent]";

    /// <summary>
    /// Known SQL Server instance names used by Soft Restaurant
    /// </summary>
    private static readonly string[] KnownInstances = new[]
    {
        ".", // Default instance
        @".\SQLEXPRESS",
        @".\DVSOFT",
        @".\SOFTRESTAURANT",
        @".\SR10",
        @".\SR11",
        @".\MSSQLSERVER"
    };

    /// <summary>
    /// Known database names used by Soft Restaurant
    /// </summary>
    private static readonly string[] KnownDatabases = new[]
    {
        "DVSOFT",
        "SOFTRESTAURANT",
        "SR_EMPRESA",
        "RESTAURANT",
        "DATOS_SR"
    };

    /// <summary>
    /// Required tables to confirm SR database
    /// </summary>
    private static readonly string[] RequiredTables = new[]
    {
        "Ventas",
        "DetalleVentas",
        "Productos",
        "Clientes",
        "Empleados"
    };

    #region Detection Custom Actions

    /// <summary>
    /// Detects Soft Restaurant installation by scanning SQL Server instances
    /// </summary>
    [CustomAction]
    public static ActionResult DetectSoftRestaurant(Session session)
    {
        session.Log($"{LogPrefix} Starting Soft Restaurant detection...");

        try
        {
            // Initialize properties
            session["SR_DETECTED"] = "0";
            session["SR_VERSION"] = "";
            session["SR_SQL_INSTANCE"] = "";
            session["SR_DATABASE_NAME"] = "";
            session["SR_CONNECTION_STRING"] = "";
            session["SR_EMPRESA_ID"] = "";

            // Try each known instance
            foreach (var instance in KnownInstances)
            {
                session.Log($"{LogPrefix} Checking instance: {instance}");

                try
                {
                    var result = TryFindSRDatabase(instance, session);
                    if (result.Found)
                    {
                        session["SR_DETECTED"] = "1";
                        session["SR_VERSION"] = result.Version ?? "10.x";
                        session["SR_SQL_INSTANCE"] = result.Instance;
                        session["SR_DATABASE_NAME"] = result.DatabaseName;
                        session["SR_CONNECTION_STRING"] = result.ConnectionString;
                        session["SR_EMPRESA_ID"] = result.EmpresaId ?? "";

                        session.Log($"{LogPrefix} Found SR: {result.DatabaseName} in {result.Instance}");
                        break;
                    }
                }
                catch (Exception ex)
                {
                    session.Log($"{LogPrefix} Error checking instance {instance}: {ex.Message}");
                }
            }

            // Also check registry for version info
            if (session["SR_DETECTED"] == "1")
            {
                var version = GetSRVersionFromRegistry();
                if (!string.IsNullOrEmpty(version))
                {
                    session["SR_VERSION"] = version;
                }
            }

            session.Log($"{LogPrefix} Detection complete. Found: {session["SR_DETECTED"]}");
            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log($"{LogPrefix} Detection failed: {ex.Message}");
            return ActionResult.Success; // Don't fail installation, just report not found
        }
    }

    /// <summary>
    /// Tests the SQL connection with current settings
    /// </summary>
    [CustomAction]
    public static ActionResult TestSqlConnection(Session session)
    {
        session.Log($"{LogPrefix} Testing SQL connection...");

        try
        {
            var connectionString = session["SR_CONNECTION_STRING"];
            if (string.IsNullOrEmpty(connectionString))
            {
                session.Log($"{LogPrefix} No connection string to test");
                return ActionResult.Success;
            }

            using var connection = new SqlConnection(connectionString);
            connection.Open();

            // Run a simple query
            using var command = new SqlCommand("SELECT 1", connection);
            command.ExecuteScalar();

            session.Log($"{LogPrefix} Connection test successful");
            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log($"{LogPrefix} Connection test failed: {ex.Message}");
            return ActionResult.Success; // Don't fail, just log
        }
    }

    #endregion

    #region Configuration Custom Actions

    /// <summary>
    /// Creates the agent configuration file
    /// </summary>
    [CustomAction]
    public static ActionResult CreateConfiguration(Session session)
    {
        session.Log($"{LogPrefix} Creating configuration file...");

        try
        {
            // Parse custom action data
            var data = ParseCustomActionData(session.CustomActionData.ToString());

            var installDir = data.GetValueOrDefault("INSTALLDIR", "");
            var connectionString = data.GetValueOrDefault("SR_CONNECTION_STRING", "");
            var agentId = data.GetValueOrDefault("TISTIS_AGENT_ID", "");
            var authToken = data.GetValueOrDefault("TISTIS_AUTH_TOKEN", "");
            var webhookUrl = data.GetValueOrDefault("TISTIS_WEBHOOK_URL", "");
            var syncIntervalStr = data.GetValueOrDefault("SYNC_INTERVAL", "30");
            var syncMenu = data.GetValueOrDefault("SYNC_MENU", "1");
            var syncInventory = data.GetValueOrDefault("SYNC_INVENTORY", "1");
            var syncSales = data.GetValueOrDefault("SYNC_SALES", "1");
            var syncTables = data.GetValueOrDefault("SYNC_TABLES", "0");

            // Validate sync interval with safe parsing (FIX S1)
            if (!int.TryParse(syncIntervalStr, out var syncInterval) || syncInterval < 5)
            {
                syncInterval = 30; // Default to 30 seconds if invalid or too low
                session.Log($"{LogPrefix} Invalid sync interval '{syncIntervalStr}', using default: 30");
            }

            // Validate required fields and warn about placeholders (FIX S2)
            if (string.IsNullOrEmpty(agentId) || agentId.Contains("PLACEHOLDER"))
            {
                session.Log($"{LogPrefix} WARNING: AgentId appears to be invalid or placeholder: {agentId}");
            }

            // Validate webhookUrl and extract base URL
            var baseUrl = ExtractBaseUrl(webhookUrl, session);

            // Create config object
            var config = new
            {
                TisTisAgent = new
                {
                    AgentId = agentId,
                    AuthToken = "", // Will be stored encrypted separately
                    Version = "1.0.0",
                    Api = new
                    {
                        BaseUrl = baseUrl,
                        RegisterEndpoint = "/api/agent/register",
                        HeartbeatEndpoint = "/api/agent/heartbeat",
                        SyncEndpoint = "/api/agent/sync",
                        TimeoutSeconds = 30,
                        MaxRetries = 3,
                        RetryDelayMs = 1000,
                        ValidateSsl = true
                    },
                    SoftRestaurant = new
                    {
                        ConnectionString = connectionString,
                        QueryTimeoutSeconds = 60
                    },
                    Sync = new
                    {
                        IntervalSeconds = syncInterval,
                        SyncSales = syncSales == "1",
                        SyncMenu = syncMenu == "1",
                        SyncInventory = syncInventory == "1",
                        SyncTables = syncTables == "1",
                        BatchSize = 100,
                        MaxRecordsPerQuery = 1000,
                        HeartbeatIntervalSeconds = 60
                    },
                    Logging = new
                    {
                        LogDirectory = @"C:\ProgramData\TisTis\Agent\Logs",
                        MinimumLevel = "Information",
                        RetainDays = 30,
                        WriteToEventLog = true,
                        EventLogSource = "TisTis.Agent"
                    },
                    Security = new
                    {
                        UseDataProtection = true,
                        CredentialStorePath = @"C:\ProgramData\TisTis\Agent\Credentials\credentials.dat",
                        MinTlsVersion = "Tls12"
                    }
                }
            };

            // Write configuration file
            var configPath = Path.Combine(installDir.TrimEnd('\\'), "appsettings.json");
            var json = JsonSerializer.Serialize(config, new JsonSerializerOptions
            {
                WriteIndented = true,
                PropertyNamingPolicy = JsonNamingPolicy.CamelCase
            });

            File.WriteAllText(configPath, json, Encoding.UTF8);
            session.Log($"{LogPrefix} Configuration written to: {configPath}");

            // Store auth token encrypted
            StoreEncryptedCredentials(agentId, authToken, connectionString);

            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log($"{LogPrefix} Failed to create configuration: {ex.Message}");
            return ActionResult.Failure;
        }
    }

    #endregion

    #region Registration Custom Actions

    /// <summary>
    /// Registers the agent with TIS TIS Platform
    /// </summary>
    [CustomAction]
    public static ActionResult RegisterAgent(Session session)
    {
        session.Log($"{LogPrefix} Registering agent with TIS TIS...");

        try
        {
            var data = ParseCustomActionData(session.CustomActionData.ToString());

            var agentId = data.GetValueOrDefault("TISTIS_AGENT_ID", "");
            var authToken = data.GetValueOrDefault("TISTIS_AUTH_TOKEN", "");
            var webhookUrl = data.GetValueOrDefault("TISTIS_WEBHOOK_URL", "");
            var srVersion = data.GetValueOrDefault("SR_VERSION", "");
            var srDatabaseName = data.GetValueOrDefault("SR_DATABASE_NAME", "");

            // Validate token before attempting registration (FIX S2)
            if (string.IsNullOrEmpty(authToken) || authToken.Contains("PLACEHOLDER"))
            {
                session.Log($"{LogPrefix} WARNING: Auth token is invalid or placeholder, skipping registration. Agent will register on first startup.");
                return ActionResult.Success;
            }

            // Validate agentId
            if (string.IsNullOrEmpty(agentId) || agentId.Contains("PLACEHOLDER"))
            {
                session.Log($"{LogPrefix} WARNING: Agent ID is invalid or placeholder, skipping registration.");
                return ActionResult.Success;
            }

            // Build registration request
            var request = new
            {
                agent_id = agentId,
                agent_version = "1.0.0",
                machine_name = Environment.MachineName,
                sr_version = srVersion,
                sr_database_name = srDatabaseName,
                status = "registered"
            };

            // Get base URL and register endpoint
            var baseUrl = ExtractBaseUrl(webhookUrl, session);
            var registerUrl = $"{baseUrl}/api/agent/register";

            using var httpClient = new HttpClient();
            httpClient.Timeout = TimeSpan.FromSeconds(30);
            httpClient.DefaultRequestHeaders.Add("Authorization", $"Bearer {authToken}");
            httpClient.DefaultRequestHeaders.Add("X-TisTis-Agent-Id", agentId);

            var content = new StringContent(
                JsonSerializer.Serialize(request),
                Encoding.UTF8,
                "application/json"
            );

            // Use GetAwaiter().GetResult() to avoid deadlocks in synchronous context
            // This is the recommended pattern for WiX custom actions
            var response = httpClient.PostAsync(registerUrl, content).GetAwaiter().GetResult();

            if (response.IsSuccessStatusCode)
            {
                session.Log($"{LogPrefix} Agent registered successfully");
                return ActionResult.Success;
            }
            else
            {
                var errorBody = response.Content.ReadAsStringAsync().GetAwaiter().GetResult();
                session.Log($"{LogPrefix} Registration failed: {response.StatusCode} - {errorBody}");
                // Don't fail installation, agent can retry registration on startup
                return ActionResult.Success;
            }
        }
        catch (Exception ex)
        {
            session.Log($"{LogPrefix} Registration error: {ex.Message}");
            // Don't fail installation
            return ActionResult.Success;
        }
    }

    /// <summary>
    /// Rollback agent registration on install failure
    /// </summary>
    [CustomAction]
    public static ActionResult RollbackRegistration(Session session)
    {
        session.Log($"{LogPrefix} Rolling back registration...");
        // Registration rollback is handled server-side by token invalidation
        return ActionResult.Success;
    }

    #endregion

    #region Service Management Custom Actions

    /// <summary>
    /// Starts the agent Windows service
    /// </summary>
    [CustomAction]
    public static ActionResult StartAgentService(Session session)
    {
        session.Log($"{LogPrefix} Starting agent service...");

        try
        {
            using var service = new ServiceController("TisTis.Agent.SoftRestaurant");

            if (service.Status != ServiceControllerStatus.Running)
            {
                service.Start();
                service.WaitForStatus(ServiceControllerStatus.Running, TimeSpan.FromSeconds(30));
                session.Log($"{LogPrefix} Service started successfully");
            }

            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log($"{LogPrefix} Failed to start service: {ex.Message}");
            // Don't fail installation, service can be started manually
            return ActionResult.Success;
        }
    }

    /// <summary>
    /// Stops the agent Windows service before uninstall
    /// </summary>
    [CustomAction]
    public static ActionResult StopAgentService(Session session)
    {
        session.Log($"{LogPrefix} Stopping agent service...");

        try
        {
            using var service = new ServiceController("TisTis.Agent.SoftRestaurant");

            if (service.Status != ServiceControllerStatus.Stopped)
            {
                service.Stop();
                service.WaitForStatus(ServiceControllerStatus.Stopped, TimeSpan.FromSeconds(30));
                session.Log($"{LogPrefix} Service stopped successfully");
            }

            return ActionResult.Success;
        }
        catch (InvalidOperationException)
        {
            // Service doesn't exist, which is fine
            session.Log($"{LogPrefix} Service not found, skipping stop");
            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log($"{LogPrefix} Failed to stop service: {ex.Message}");
            return ActionResult.Success; // Don't fail uninstall
        }
    }

    #endregion

    #region Cleanup Custom Actions

    /// <summary>
    /// Cleans up agent data on uninstall
    /// </summary>
    [CustomAction]
    public static ActionResult Cleanup(Session session)
    {
        session.Log($"{LogPrefix} Cleaning up agent data...");

        try
        {
            // Remove credentials
            var credentialsPath = @"C:\ProgramData\TisTis\Agent\Credentials";
            if (Directory.Exists(credentialsPath))
            {
                Directory.Delete(credentialsPath, true);
                session.Log($"{LogPrefix} Removed credentials directory");
            }

            // Remove config (but keep logs)
            var configPath = @"C:\ProgramData\TisTis\Agent\Config";
            if (Directory.Exists(configPath))
            {
                Directory.Delete(configPath, true);
                session.Log($"{LogPrefix} Removed config directory");
            }

            // Remove registry keys
            try
            {
                Registry.LocalMachine.DeleteSubKeyTree(@"SOFTWARE\TisTis\Agent", false);
                session.Log($"{LogPrefix} Removed registry keys");
            }
            catch (Exception ex)
            {
                session.Log($"{LogPrefix} Could not remove registry keys: {ex.Message}");
            }

            // Remove Event Log source
            try
            {
                if (System.Diagnostics.EventLog.SourceExists("TisTis.Agent"))
                {
                    System.Diagnostics.EventLog.DeleteEventSource("TisTis.Agent");
                    session.Log($"{LogPrefix} Removed Event Log source");
                }
            }
            catch (Exception ex)
            {
                session.Log($"{LogPrefix} Could not remove Event Log source: {ex.Message}");
            }

            return ActionResult.Success;
        }
        catch (Exception ex)
        {
            session.Log($"{LogPrefix} Cleanup error: {ex.Message}");
            return ActionResult.Success; // Don't fail uninstall
        }
    }

    #endregion

    #region Private Helper Methods

    private static DetectionResult TryFindSRDatabase(string instance, Session session)
    {
        var result = new DetectionResult { Instance = instance };

        // Build connection string to master database
        var masterConnString = new SqlConnectionStringBuilder
        {
            DataSource = instance,
            InitialCatalog = "master",
            IntegratedSecurity = true,
            TrustServerCertificate = true,
            ConnectTimeout = 5
        }.ConnectionString;

        using var masterConnection = new SqlConnection(masterConnString);
        masterConnection.Open();

        // List all databases
        const string listDbQuery = @"
            SELECT name FROM sys.databases
            WHERE state_desc = 'ONLINE'
            AND name NOT IN ('master', 'tempdb', 'model', 'msdb')";

        using var listCommand = new SqlCommand(listDbQuery, masterConnection);
        using var reader = listCommand.ExecuteReader();

        var databases = new List<string>();
        while (reader.Read())
        {
            databases.Add(reader.GetString(0));
        }
        reader.Close();

        // Check each database for SR tables
        foreach (var dbName in databases)
        {
            // Check if it's a known SR database name
            bool isKnownName = KnownDatabases.Any(known =>
                dbName.StartsWith(known, StringComparison.OrdinalIgnoreCase));

            if (!isKnownName) continue;

            // Check for required tables
            var dbConnString = new SqlConnectionStringBuilder
            {
                DataSource = instance,
                InitialCatalog = dbName,
                IntegratedSecurity = true,
                TrustServerCertificate = true,
                ConnectTimeout = 5
            }.ConnectionString;

            try
            {
                using var dbConnection = new SqlConnection(dbConnString);
                dbConnection.Open();

                const string tableQuery = @"
                    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_TYPE = 'BASE TABLE'";

                using var tableCommand = new SqlCommand(tableQuery, dbConnection);
                using var tableReader = tableCommand.ExecuteReader();

                var tables = new List<string>();
                while (tableReader.Read())
                {
                    tables.Add(tableReader.GetString(0));
                }
                tableReader.Close();

                // Check if all required tables exist
                bool hasAllTables = RequiredTables.All(required =>
                    tables.Any(t => t.Equals(required, StringComparison.OrdinalIgnoreCase)));

                if (hasAllTables)
                {
                    result.Found = true;
                    result.DatabaseName = dbName;
                    result.ConnectionString = dbConnString;

                    // Try to get Empresa ID (check table existence first to avoid errors)
                    try
                    {
                        // First check if Empresas table exists
                        const string checkEmpresasQuery = @"
                            SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                            WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Empresas'";

                        using var checkCommand = new SqlCommand(checkEmpresasQuery, dbConnection);
                        var hasEmpresasTable = checkCommand.ExecuteScalar() != null;

                        if (hasEmpresasTable)
                        {
                            const string empresaQuery = @"
                                SELECT TOP 1 Codigo FROM dbo.Empresas WHERE Activa = 1";
                            using var empresaCommand = new SqlCommand(empresaQuery, dbConnection);
                            var empresaId = empresaCommand.ExecuteScalar();
                            result.EmpresaId = empresaId?.ToString();
                        }
                        else
                        {
                            // Try Configuracion table as fallback
                            const string checkConfigQuery = @"
                                SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                                WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'Configuracion'";

                            using var checkConfigCommand = new SqlCommand(checkConfigQuery, dbConnection);
                            var hasConfigTable = checkConfigCommand.ExecuteScalar() != null;

                            if (hasConfigTable)
                            {
                                const string configQuery = @"
                                    SELECT TOP 1 CAST(IdEmpresa AS VARCHAR(50)) FROM dbo.Configuracion";
                                using var configCommand = new SqlCommand(configQuery, dbConnection);
                                var empresaId = configCommand.ExecuteScalar();
                                result.EmpresaId = empresaId?.ToString();
                            }
                        }
                    }
                    catch (Exception ex)
                    {
                        session.Log($"{LogPrefix} Could not get Empresa ID: {ex.Message}");
                        // Continue without empresa ID
                    }

                    // Detect version
                    result.Version = DetectVersionFromTables(tables);

                    session.Log($"{LogPrefix} Found SR database: {dbName}");
                    return result;
                }
            }
            catch (Exception ex)
            {
                session.Log($"{LogPrefix} Error checking database {dbName}: {ex.Message}");
            }
        }

        return result;
    }

    private static string? DetectVersionFromTables(List<string> tables)
    {
        // SR 11 has some new tables
        if (tables.Any(t => t.Equals("ConfiguracionV11", StringComparison.OrdinalIgnoreCase)))
            return "11.x";

        // SR 10 detection
        if (tables.Any(t => t.Equals("Ventas", StringComparison.OrdinalIgnoreCase)))
            return "10.x";

        return null;
    }

    private static string? GetSRVersionFromRegistry()
    {
        string[] registryPaths = new[]
        {
            @"SOFTWARE\National Soft\Soft Restaurant 11",
            @"SOFTWARE\National Soft\Soft Restaurant 10",
            @"SOFTWARE\WOW6432Node\National Soft\Soft Restaurant 11",
            @"SOFTWARE\WOW6432Node\National Soft\Soft Restaurant 10"
        };

        foreach (var path in registryPaths)
        {
            try
            {
                using var key = Registry.LocalMachine.OpenSubKey(path);
                if (key != null)
                {
                    var version = key.GetValue("Version") as string;
                    if (!string.IsNullOrEmpty(version))
                        return version;

                    // Extract version from path
                    if (path.Contains("11"))
                        return "11.x";
                    if (path.Contains("10"))
                        return "10.x";
                }
            }
            catch
            {
                // Continue to next path
            }
        }

        return null;
    }

    /// <summary>
    /// Stores credentials encrypted using DPAPI with proper error handling (FIX S7)
    /// </summary>
    private static void StoreEncryptedCredentials(string agentId, string authToken, string connectionString)
    {
        const string CredentialsDir = @"C:\ProgramData\TisTis\Agent\Credentials";

        try
        {
            // Create directory if it doesn't exist
            Directory.CreateDirectory(CredentialsDir);

            // Set restrictive permissions (SYSTEM and Administrators only)
            SetRestrictivePermissions(CredentialsDir);

            // Create credentials object
            var credentials = new
            {
                AgentId = agentId,
                AuthToken = authToken,
                SqlConnectionString = connectionString,
                CreatedAt = DateTime.UtcNow,
                Version = 1 // For future credential format migrations
            };

            var json = JsonSerializer.Serialize(credentials);
            var plainBytes = Encoding.UTF8.GetBytes(json);

            // Encrypt with DPAPI (LocalMachine scope for service access)
            var encryptedBytes = ProtectedData.Protect(
                plainBytes,
                entropy: null,  // Using machine-level protection
                scope: DataProtectionScope.LocalMachine
            );

            var credentialsPath = Path.Combine(CredentialsDir, "credentials.dat");
            File.WriteAllBytes(credentialsPath, encryptedBytes);

            // Clear sensitive data from memory
            Array.Clear(plainBytes, 0, plainBytes.Length);
        }
        catch (CryptographicException ex)
        {
            // DPAPI failed - likely permissions issue
            // Log but don't throw - let the service handle credential retrieval on startup
            // The installer will complete, but credentials won't be stored
            System.Diagnostics.Debug.WriteLine($"{LogPrefix} DPAPI encryption failed: {ex.Message}");
        }
    }

    /// <summary>
    /// Sets restrictive NTFS permissions on a directory
    /// </summary>
    private static void SetRestrictivePermissions(string directoryPath)
    {
        var dirInfo = new DirectoryInfo(directoryPath);
        var security = dirInfo.GetAccessControl();

        // Remove inherited permissions
        security.SetAccessRuleProtection(isProtected: true, preserveInheritance: false);

        // Add SYSTEM full control
        security.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(
            new System.Security.Principal.SecurityIdentifier(
                System.Security.Principal.WellKnownSidType.LocalSystemSid, null),
            System.Security.AccessControl.FileSystemRights.FullControl,
            System.Security.AccessControl.InheritanceFlags.ContainerInherit |
            System.Security.AccessControl.InheritanceFlags.ObjectInherit,
            System.Security.AccessControl.PropagationFlags.None,
            System.Security.AccessControl.AccessControlType.Allow));

        // Add Administrators read-only access (for troubleshooting)
        security.AddAccessRule(new System.Security.AccessControl.FileSystemAccessRule(
            new System.Security.Principal.SecurityIdentifier(
                System.Security.Principal.WellKnownSidType.BuiltinAdministratorsSid, null),
            System.Security.AccessControl.FileSystemRights.Read,
            System.Security.AccessControl.InheritanceFlags.ContainerInherit |
            System.Security.AccessControl.InheritanceFlags.ObjectInherit,
            System.Security.AccessControl.PropagationFlags.None,
            System.Security.AccessControl.AccessControlType.Allow));

        dirInfo.SetAccessControl(security);
    }

    private static string ExtractBaseUrl(string webhookUrl, Session? session = null)
    {
        const string DefaultBaseUrl = "https://app.tistis.com";

        if (string.IsNullOrEmpty(webhookUrl))
        {
            session?.Log($"{LogPrefix} No webhook URL provided, using default: {DefaultBaseUrl}");
            return DefaultBaseUrl;
        }

        try
        {
            var uri = new Uri(webhookUrl);
            var extractedUrl = $"{uri.Scheme}://{uri.Host}";

            // Include port if non-standard
            if ((uri.Scheme == "https" && uri.Port != 443) ||
                (uri.Scheme == "http" && uri.Port != 80))
            {
                extractedUrl = $"{uri.Scheme}://{uri.Host}:{uri.Port}";
            }

            return extractedUrl;
        }
        catch (UriFormatException ex)
        {
            session?.Log($"{LogPrefix} Invalid webhook URL '{webhookUrl}': {ex.Message}, using default: {DefaultBaseUrl}");
            return DefaultBaseUrl;
        }
    }

    private static Dictionary<string, string> ParseCustomActionData(string data)
    {
        var result = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

        if (string.IsNullOrEmpty(data))
            return result;

        foreach (var pair in data.Split(';'))
        {
            var idx = pair.IndexOf('=');
            if (idx > 0)
            {
                var key = pair.Substring(0, idx);
                var value = pair.Substring(idx + 1);
                result[key] = value;
            }
        }

        return result;
    }

    #endregion

    #region Helper Classes

    private class DetectionResult
    {
        public bool Found { get; set; }
        public string Instance { get; set; } = "";
        public string DatabaseName { get; set; } = "";
        public string ConnectionString { get; set; } = "";
        public string? Version { get; set; }
        public string? EmpresaId { get; set; }
    }

    #endregion
}

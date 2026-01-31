// =====================================================
// TIS TIS PLATFORM - Agent Service Entry Point
// Windows Service hosting for TIS TIS Agent
// =====================================================

using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;
using TisTis.Agent.Core.Api;
using TisTis.Agent.Core.Configuration;
using TisTis.Agent.Core.Database;
using TisTis.Agent.Core.Detection;
using TisTis.Agent.Core.Logging;
using TisTis.Agent.Core.Monitoring;
using TisTis.Agent.Core.Security;
using TisTis.Agent.Core.Sync;
using TisTis.Agent.Service;

// Create the host builder
var builder = Host.CreateApplicationBuilder(args);

// Configure as Windows Service
builder.Services.AddWindowsService(options =>
{
    options.ServiceName = "TisTis.Agent.SoftRestaurant";
});

// Load configuration
builder.Configuration
    .SetBasePath(AppContext.BaseDirectory)
    .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: true)
    .AddEnvironmentVariables("TISTIS_");

// Bind configuration
var agentConfig = new AgentConfiguration();
builder.Configuration.GetSection(AgentConfiguration.SectionName).Bind(agentConfig);

// Configure Serilog
Log.Logger = AgentLogger.CreateLogger(agentConfig.Logging);
builder.Services.AddSerilog();
builder.Logging.ClearProviders();
builder.Logging.AddSerilog(Log.Logger);

// Register configuration
builder.Services.AddSingleton(agentConfig);
builder.Services.AddSingleton(agentConfig.Api);
builder.Services.AddSingleton(agentConfig.Sync);
builder.Services.AddSingleton(agentConfig.SoftRestaurant);
builder.Services.AddSingleton(agentConfig.Security);
builder.Services.AddSingleton(agentConfig.Logging);

// Register core services
builder.Services.AddSingleton<CredentialStore>(sp =>
{
    var config = sp.GetRequiredService<AgentConfiguration>();
    var logger = sp.GetRequiredService<ILogger<CredentialStore>>();
    return new CredentialStore(config.Security.CredentialStorePath, config.Security.UseDataProtection, logger);
});

builder.Services.AddSingleton<TokenManager>();

// FIX SEC-04: Register certificate validator for SSL pinning
builder.Services.AddSingleton<CertificateValidator>(sp =>
{
    var config = sp.GetRequiredService<AgentConfiguration>();
    var logger = sp.GetRequiredService<ILogger<CertificateValidator>>();
    return new CertificateValidator(config.Security, logger);
});

// Register detection services
builder.Services.AddSingleton<RegistryDetector>();
builder.Services.AddSingleton<ServiceDetector>();
builder.Services.AddSingleton<SqlInstanceDetector>();
builder.Services.AddSingleton<ISoftRestaurantDetector, SoftRestaurantDetector>();

// Register database services
builder.Services.AddSingleton<ISoftRestaurantRepository>(sp =>
{
    var config = sp.GetRequiredService<SoftRestaurantOptions>();
    var logger = sp.GetRequiredService<ILogger<SoftRestaurantRepository>>();
    return new SoftRestaurantRepository(config, logger);
});

// Register API client
// FIX SEC-04: Include certificate validator for SSL pinning
builder.Services.AddSingleton<ITisTisApiClient>(sp =>
{
    var config = sp.GetRequiredService<AgentConfiguration>();
    var logger = sp.GetRequiredService<ILogger<TisTisApiClient>>();
    var certValidator = sp.GetRequiredService<CertificateValidator>();
    return new TisTisApiClient(config, logger, certValidator);
});

// Register sync engine
builder.Services.AddSingleton<ISyncEngine, SyncEngine>();

// FASE 7: Register monitoring services
builder.Services.AddTisTisMonitoring(thresholds =>
{
    // Configure monitoring thresholds from appsettings if needed
    // Default values are already sensible for most deployments
});

// Register the worker
builder.Services.AddHostedService<AgentWorker>();

// Build and run
var host = builder.Build();

Log.Information("TIS TIS Agent for Soft Restaurant starting...");
Log.Information("Version: {Version}", agentConfig.Version);
// FIX SEC-02: Use redacted agent ID in logs
Log.Information("Agent ID: {AgentId}", SecureUtilities.Redact(agentConfig.AgentId, 8));
Log.Information("SSL Pinning: {Enabled}", agentConfig.Security.UseCertificatePinning);

try
{
    await host.RunAsync();
}
catch (Exception ex)
{
    Log.Fatal(ex, "Agent terminated unexpectedly");
}
finally
{
    Log.Information("Agent stopped");
    await Log.CloseAndFlushAsync();
}

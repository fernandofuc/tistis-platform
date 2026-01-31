// =====================================================
// TIS TIS PLATFORM - Secure Log Enricher
// FIX SEC-02: Automatically redacts sensitive data in logs
// =====================================================

using Serilog.Core;
using Serilog.Events;
using TisTis.Agent.Core.Security;

namespace TisTis.Agent.Core.Logging;

/// <summary>
/// Serilog enricher that redacts sensitive data from log properties.
/// FIX SEC-02: Prevents accidental exposure of credentials in logs.
/// </summary>
public class SecureLogEnricher : ILogEventEnricher
{
    /// <summary>
    /// Property names that should be fully redacted
    /// </summary>
    private static readonly HashSet<string> FullyRedactedProperties = new(StringComparer.OrdinalIgnoreCase)
    {
        "AuthToken",
        "Token",
        "Password",
        "Secret",
        "ApiKey",
        "PrivateKey",
        "ConnectionString",
        "SqlConnectionString",
        "Credential",
        "Credentials",
        "Bearer"
    };

    /// <summary>
    /// Property names that should be partially redacted (show first/last chars)
    /// </summary>
    private static readonly HashSet<string> PartiallyRedactedProperties = new(StringComparer.OrdinalIgnoreCase)
    {
        "AgentId",
        "TenantId",
        "IntegrationId",
        "BranchId",
        "UserId",
        "Email",
        "Phone",
        "PhoneNumber"
    };

    /// <summary>
    /// Patterns in property names that suggest sensitive data
    /// </summary>
    private static readonly string[] SensitivePatterns =
    {
        "token",
        "secret",
        "password",
        "key",
        "credential",
        "auth"
    };

    /// <summary>
    /// Enriches log event by redacting sensitive properties.
    /// </summary>
    public void Enrich(LogEvent logEvent, ILogEventPropertyFactory propertyFactory)
    {
        if (logEvent == null)
            return;

        // Create list of properties to remove/replace (can't modify during iteration)
        var propertiesToUpdate = new List<(string Name, LogEventPropertyValue NewValue)>();

        foreach (var property in logEvent.Properties)
        {
            var newValue = ProcessProperty(property.Key, property.Value);
            if (newValue != null)
            {
                propertiesToUpdate.Add((property.Key, newValue));
            }
        }

        // Apply updates
        foreach (var (name, newValue) in propertiesToUpdate)
        {
            logEvent.RemovePropertyIfPresent(name);
            logEvent.AddOrUpdateProperty(new LogEventProperty(name, newValue));
        }
    }

    /// <summary>
    /// Processes a single property and returns redacted value if needed.
    /// </summary>
    private static LogEventPropertyValue? ProcessProperty(string name, LogEventPropertyValue value)
    {
        // Check if fully redacted
        if (ShouldFullyRedact(name))
        {
            return new ScalarValue(GetRedactedValue(value));
        }

        // Check if partially redacted
        if (ShouldPartiallyRedact(name))
        {
            return new ScalarValue(GetPartiallyRedactedValue(value));
        }

        // Handle structured values recursively
        if (value is StructureValue structureValue)
        {
            return ProcessStructure(structureValue);
        }

        if (value is DictionaryValue dictionaryValue)
        {
            return ProcessDictionary(dictionaryValue);
        }

        if (value is SequenceValue sequenceValue)
        {
            return ProcessSequence(sequenceValue);
        }

        return null;
    }

    /// <summary>
    /// Checks if a property should be fully redacted.
    /// </summary>
    private static bool ShouldFullyRedact(string propertyName)
    {
        if (FullyRedactedProperties.Contains(propertyName))
            return true;

        var lower = propertyName.ToLowerInvariant();
        return SensitivePatterns.Any(pattern => lower.Contains(pattern));
    }

    /// <summary>
    /// Checks if a property should be partially redacted.
    /// </summary>
    private static bool ShouldPartiallyRedact(string propertyName)
    {
        return PartiallyRedactedProperties.Contains(propertyName);
    }

    /// <summary>
    /// Gets fully redacted value representation.
    /// </summary>
    private static string GetRedactedValue(LogEventPropertyValue value)
    {
        if (value is ScalarValue scalar && scalar.Value is string str)
        {
            return SecureUtilities.RedactFull(str);
        }

        return "[redacted]";
    }

    /// <summary>
    /// Gets partially redacted value representation.
    /// </summary>
    private static string GetPartiallyRedactedValue(LogEventPropertyValue value)
    {
        if (value is ScalarValue scalar && scalar.Value is string str)
        {
            return SecureUtilities.Redact(str, 4);
        }

        return "[redacted]";
    }

    /// <summary>
    /// Processes structure values recursively.
    /// </summary>
    private static StructureValue? ProcessStructure(StructureValue structure)
    {
        var updatedProperties = new List<LogEventProperty>();
        var hasChanges = false;

        foreach (var prop in structure.Properties)
        {
            var newValue = ProcessProperty(prop.Name, prop.Value);
            if (newValue != null)
            {
                updatedProperties.Add(new LogEventProperty(prop.Name, newValue));
                hasChanges = true;
            }
            else
            {
                updatedProperties.Add(prop);
            }
        }

        return hasChanges ? new StructureValue(updatedProperties) : null;
    }

    /// <summary>
    /// Processes dictionary values recursively.
    /// </summary>
    private static DictionaryValue? ProcessDictionary(DictionaryValue dictionary)
    {
        var updatedElements = new List<KeyValuePair<ScalarValue, LogEventPropertyValue>>();
        var hasChanges = false;

        foreach (var element in dictionary.Elements)
        {
            var keyName = element.Key.Value?.ToString() ?? "";
            var newValue = ProcessProperty(keyName, element.Value);

            if (newValue != null)
            {
                updatedElements.Add(new KeyValuePair<ScalarValue, LogEventPropertyValue>(element.Key, newValue));
                hasChanges = true;
            }
            else
            {
                updatedElements.Add(element);
            }
        }

        return hasChanges ? new DictionaryValue(updatedElements) : null;
    }

    /// <summary>
    /// Processes sequence values recursively.
    /// FIX ITER1-A4: Process elements that may contain sensitive nested properties.
    /// </summary>
    private static SequenceValue? ProcessSequence(SequenceValue sequence)
    {
        var updatedElements = new List<LogEventPropertyValue>();
        var hasChanges = false;

        foreach (var element in sequence.Elements)
        {
            // Recursively process structured elements in the sequence
            if (element is StructureValue structureValue)
            {
                var processedStructure = ProcessStructure(structureValue);
                if (processedStructure != null)
                {
                    updatedElements.Add(processedStructure);
                    hasChanges = true;
                }
                else
                {
                    updatedElements.Add(element);
                }
            }
            else if (element is DictionaryValue dictionaryValue)
            {
                var processedDict = ProcessDictionary(dictionaryValue);
                if (processedDict != null)
                {
                    updatedElements.Add(processedDict);
                    hasChanges = true;
                }
                else
                {
                    updatedElements.Add(element);
                }
            }
            else if (element is SequenceValue nestedSequence)
            {
                // Recursively process nested sequences
                var processedSeq = ProcessSequence(nestedSequence);
                if (processedSeq != null)
                {
                    updatedElements.Add(processedSeq);
                    hasChanges = true;
                }
                else
                {
                    updatedElements.Add(element);
                }
            }
            else
            {
                // Scalar values in sequences - keep as-is (no property name to check)
                updatedElements.Add(element);
            }
        }

        return hasChanges ? new SequenceValue(updatedElements) : null;
    }
}

/// <summary>
/// Extension methods for adding secure enricher to Serilog configuration.
/// </summary>
public static class SecureLogEnricherExtensions
{
    /// <summary>
    /// Adds the secure log enricher to the logger configuration.
    /// </summary>
    public static Serilog.LoggerConfiguration WithSecureDataRedaction(
        this Serilog.Configuration.LoggerEnrichmentConfiguration enrichmentConfiguration)
    {
        return enrichmentConfiguration.With<SecureLogEnricher>();
    }
}

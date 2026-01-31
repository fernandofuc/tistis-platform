# TIS TIS Agent - Troubleshooting Guide

## Version: 1.0.0

This guide helps diagnose and resolve common issues with the TIS TIS Local Agent.

---

## Table of Contents

1. [Quick Diagnostics](#quick-diagnostics)
2. [Installation Issues](#installation-issues)
3. [Detection Issues](#detection-issues)
4. [Connection Issues](#connection-issues)
5. [Sync Issues](#sync-issues)
6. [Security Issues](#security-issues)
7. [Performance Issues](#performance-issues)
8. [Log Analysis](#log-analysis)
9. [Common Error Codes](#common-error-codes)
10. [Getting Help](#getting-help)

---

## Quick Diagnostics

### Check Service Status

```powershell
# Check if service is running
Get-Service TisTis.Agent.SoftRestaurant

# View recent event log entries
Get-EventLog -LogName Application -Source TisTis.Agent -Newest 10

# Check process
Get-Process | Where-Object { $_.Name -like "*TisTis*" }
```

### Check Latest Logs

```powershell
# View today's log file
Get-Content "C:\ProgramData\TisTis\Agent\Logs\agent-$(Get-Date -Format yyyyMMdd).log" -Tail 50
```

### Run Diagnostic Report

```csharp
// If agent is running, access diagnostics via monitoring
var report = await _monitoring.Diagnostics.GenerateReportAsync();
```

---

## Installation Issues

### Issue: Installer Fails to Run

**Symptoms:**
- MSI doesn't start
- Error "Windows cannot access the specified device, path, or file"

**Solutions:**
1. Run as Administrator
2. Unblock the file: Right-click → Properties → Unblock
3. Check Windows SmartScreen settings
4. Verify .NET 8.0 Runtime is installed

### Issue: Service Won't Install

**Symptoms:**
- Error during service registration
- "Access is denied" message

**Solutions:**

```powershell
# Manually install service
sc.exe create TisTis.Agent.SoftRestaurant `
  binPath= "C:\Program Files\TisTis\Agent\TisTis.Agent.Service.exe" `
  start= auto `
  displayname= "TIS TIS Agent for Soft Restaurant"

# If already exists, remove first
sc.exe delete TisTis.Agent.SoftRestaurant
```

### Issue: .NET Runtime Not Found

**Symptoms:**
- "The framework 'Microsoft.NETCore.App' was not found"

**Solutions:**
1. Install .NET 8.0 Runtime: [Download](https://dotnet.microsoft.com/download/dotnet/8.0)
2. Verify installation: `dotnet --info`
3. Use self-contained deployment

---

## Detection Issues

### Issue: Soft Restaurant Not Detected

**Symptoms:**
- Installer shows "No Soft Restaurant installation found"
- Agent can't find database

**Solutions:**

1. **Verify SQL Server Browser is running:**
   ```powershell
   Get-Service SQLBrowser
   Start-Service SQLBrowser
   ```

2. **Check SQL Server instance:**
   ```powershell
   # List SQL instances
   Get-ItemProperty "HKLM:\SOFTWARE\Microsoft\Microsoft SQL Server\Instance Names\SQL"
   ```

3. **Verify database exists:**
   ```sql
   -- Connect to SQL Server
   SELECT name FROM sys.databases WHERE name IN ('DVSOFT', 'SOFTRESTAURANT', 'SR_DB')
   ```

4. **Check registry keys:**
   ```powershell
   Get-ItemProperty "HKLM:\SOFTWARE\Wow6432Node\SoftRestaurant" -ErrorAction SilentlyContinue
   ```

### Issue: Wrong Database Detected

**Solutions:**
- Manually specify connection string in `appsettings.json`
- Use `-DatabaseName` parameter during installation

---

## Connection Issues

### Issue: Can't Connect to TIS TIS API

**Symptoms:**
- "Connection refused" or "Host not found"
- Heartbeat failures

**Diagnostic Steps:**

```powershell
# Test network connectivity
Test-NetConnection app.tistis.com -Port 443

# Test DNS resolution
Resolve-DnsName app.tistis.com

# Check TLS version
[Net.ServicePointManager]::SecurityProtocol
```

**Solutions:**

1. **Check firewall:**
   ```powershell
   # Allow outbound HTTPS
   New-NetFirewallRule -DisplayName "TisTis Agent" `
     -Direction Outbound -Protocol TCP -RemotePort 443 -Action Allow
   ```

2. **Configure proxy:**
   ```json
   {
     "TisTisAgent": {
       "Api": {
         "ProxyUrl": "http://proxy.corp.local:8080"
       }
     }
   }
   ```

3. **Update TLS settings:**
   ```powershell
   # Enable TLS 1.2
   [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
   ```

### Issue: SSL Certificate Errors

**Symptoms:**
- "The SSL connection could not be established"
- "Certificate validation failed"

**Solutions:**

1. **Check system date/time:**
   ```powershell
   Get-Date
   w32tm /query /status
   ```

2. **Update root certificates:**
   ```powershell
   certutil -generateSSTFromWU roots.sst
   certutil -addstore -f root roots.sst
   ```

3. **Temporarily disable pinning (debug only):**
   ```json
   {
     "Security": {
       "UseCertificatePinning": false
     }
   }
   ```

### Issue: Can't Connect to SQL Server

**Symptoms:**
- "Login failed" or "Connection timeout"
- "A network-related or instance-specific error"

**Solutions:**

1. **Test SQL connectivity:**
   ```powershell
   # Using sqlcmd
   sqlcmd -S SERVER01\SQLEXPRESS -d DVSOFT -E -Q "SELECT 1"
   ```

2. **Check SQL Server configuration:**
   - SQL Server Configuration Manager
   - Enable TCP/IP protocol
   - Verify Windows Authentication

3. **Check firewall:**
   ```powershell
   New-NetFirewallRule -DisplayName "SQL Server" `
     -Direction Inbound -Protocol TCP -LocalPort 1433 -Action Allow
   ```

---

## Sync Issues

### Issue: Sales Not Syncing

**Symptoms:**
- No new sales appearing in TIS TIS dashboard
- "0 records synced" in logs

**Diagnostic Steps:**

1. Check sync statistics:
   ```
   Log: "No new sales to sync since ID 12345"
   ```

2. Verify last synced ID:
   ```sql
   SELECT MAX(IdVenta) FROM Ventas
   ```

**Solutions:**

1. **Reset sync position:**
   - Delete `sync_state.json` file
   - Restart service

2. **Check SR database has new records:**
   ```sql
   SELECT TOP 10 * FROM Ventas ORDER BY IdVenta DESC
   ```

### Issue: Sync Failing Repeatedly

**Symptoms:**
- "Max consecutive errors reached"
- Agent pausing for extended periods

**Solutions:**

1. **Check API response:**
   - Review logs for error messages
   - Verify API credentials

2. **Reduce batch size:**
   ```json
   {
     "Sync": {
       "BatchSize": 25,
       "IntervalSeconds": 60
     }
   }
   ```

3. **Clear error state:**
   - Restart service
   - Errors reset on successful sync

### Issue: Data Transformation Errors

**Symptoms:**
- "Transform failed for record X"
- Partial sync success

**Solutions:**

1. **Check source data:**
   ```sql
   SELECT * FROM Productos WHERE Codigo = 'PROBLEM-CODE'
   ```

2. **Review null handling:**
   - Transformers handle null fields gracefully
   - Check for unexpected data types

---

## Security Issues

### Issue: Credential Store Corruption

**Symptoms:**
- "Failed to decrypt credentials"
- "DPAPI operation failed"

**Solutions:**

1. **Re-register agent:**
   - Delete `credentials.dat`
   - Run installer again

2. **Check DPAPI scope:**
   - Machine-scope requires same machine
   - User-scope requires same user profile

### Issue: Certificate Pinning Failures

**Symptoms:**
- "Certificate thumbprint mismatch"
- Connection refused with pinning enabled

**Solutions:**

1. **Update pinned certificate:**
   ```json
   {
     "Security": {
       "CertificateThumbprint": "NEW_THUMBPRINT"
     }
   }
   ```

2. **Temporarily disable:**
   ```json
   {
     "Security": {
       "UseCertificatePinning": false
     }
   }
   ```

---

## Performance Issues

### Issue: High Memory Usage

**Symptoms:**
- Memory growing over time
- Out of memory exceptions

**Solutions:**

1. **Reduce batch size:**
   ```json
   { "Sync": { "BatchSize": 50 } }
   ```

2. **Increase sync interval:**
   ```json
   { "Sync": { "IntervalSeconds": 60 } }
   ```

3. **Check for memory leaks:**
   - Review IDisposable implementations
   - Restart service periodically

### Issue: Slow Sync Performance

**Solutions:**

1. **Optimize queries:**
   - Check SQL Server query plans
   - Add indexes if needed

2. **Adjust connection pool:**
   ```json
   {
     "SoftRestaurant": {
       "MinPoolSize": 2,
       "MaxPoolSize": 20
     }
   }
   ```

3. **Increase timeout:**
   ```json
   {
     "SoftRestaurant": {
       "QueryTimeoutSeconds": 120
     }
   }
   ```

---

## Log Analysis

### Log Location

```
C:\ProgramData\TisTis\Agent\Logs\agent-YYYYMMDD.log
```

### Log Format

```
2026-01-30 14:30:00.123 +00:00 [INF] TisTis.Agent.Service.AgentWorker: Starting sync...
```

### Key Log Patterns

| Pattern | Meaning |
|---------|---------|
| `[INF]` | Normal operation |
| `[WRN]` | Warning - needs attention |
| `[ERR]` | Error - action required |
| `[FTL]` | Fatal - service stopping |

### Useful Log Searches

```powershell
# Find errors
Select-String -Path "C:\ProgramData\TisTis\Agent\Logs\*.log" -Pattern "\[ERR\]"

# Find specific operation
Select-String -Path "C:\ProgramData\TisTis\Agent\Logs\*.log" -Pattern "SyncSalesAsync"

# Find connection issues
Select-String -Path "C:\ProgramData\TisTis\Agent\Logs\*.log" -Pattern "connection|timeout"
```

---

## Common Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| `AUTH_FAILED` | Invalid credentials | Re-register agent |
| `AGENT_NOT_FOUND` | Agent ID not in server | Contact support |
| `TENANT_DISABLED` | Subscription inactive | Check billing |
| `RATE_LIMITED` | Too many requests | Increase sync interval |
| `DB_CONNECTION` | Database error | Check SQL Server |
| `CERT_VALIDATION` | SSL error | Update certificates |

---

## Getting Help

### Before Contacting Support

1. Check this troubleshooting guide
2. Collect diagnostic information:
   ```powershell
   # Create diagnostic bundle
   $bundle = "C:\Temp\tistis-diag-$(Get-Date -Format yyyyMMddHHmmss)"
   New-Item $bundle -ItemType Directory

   # Copy logs
   Copy-Item "C:\ProgramData\TisTis\Agent\Logs\*" $bundle

   # Copy config (remove secrets first!)
   Copy-Item "C:\Program Files\TisTis\Agent\appsettings.json" $bundle

   # System info
   Get-ComputerInfo | Out-File "$bundle\system-info.txt"

   # Compress
   Compress-Archive $bundle "$bundle.zip"
   ```

3. Note the error message and timestamp

### Contact Information

- **Email:** soporte@tistis.com
- **Dashboard:** app.tistis.com/support
- **Documentation:** docs.tistis.com

### Include in Support Request

- Agent ID (first 8 characters)
- Error message (full text)
- Timestamp of issue
- Steps to reproduce
- Diagnostic bundle (attached)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-30 | Initial troubleshooting guide |

---

*For additional support, contact: soporte@tistis.com*

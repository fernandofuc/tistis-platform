# TIS TIS Agent Installer

Instalador MSI para el Agente TIS TIS para Soft Restaurant.

## Requisitos de Compilación

### Herramientas Necesarias

1. **.NET 8.0 SDK**
   ```powershell
   winget install Microsoft.DotNet.SDK.8
   ```

2. **WiX Toolset v4**
   ```powershell
   dotnet tool install --global wix
   ```

3. **Visual Studio 2022** (opcional, para desarrollo)
   - Workload: .NET desktop development
   - WiX Toolset Extension

## Estructura del Proyecto

```
installer/
├── TisTis.Agent.Installer/           # Proyecto WiX principal
│   ├── Package.wxs                   # Definición del paquete
│   ├── Directories.wxs               # Estructura de directorios
│   ├── Components.wxs                # Componentes a instalar
│   ├── Features.wxs                  # Features del instalador
│   ├── UI.wxs                        # Configuración de UI
│   ├── Dialogs/                      # Diálogos personalizados
│   │   ├── WelcomeDlg.wxs           # Pantalla de bienvenida
│   │   ├── DetectionDlg.wxs         # Detección de SR
│   │   ├── ConfigureDlg.wxs         # Configuración de sync
│   │   ├── VerifyReadyDlg.wxs       # Confirmación
│   │   └── ExitDlg.wxs              # Pantalla de éxito
│   ├── Includes/
│   │   └── Variables.wxi            # Variables y constantes
│   ├── Localization/
│   │   ├── es-MX.wxl                # Español (México)
│   │   └── en-US.wxl                # Inglés (USA)
│   └── Assets/
│       ├── banner.png               # Banner del instalador
│       ├── dialog.png               # Imagen de fondo
│       ├── icon.ico                 # Ícono del producto
│       ├── check.ico                # Ícono de éxito
│       └── warning.ico              # Ícono de advertencia
│
└── TisTis.Agent.Installer.CustomActions/  # Acciones personalizadas (C#)
    ├── TisTis.Agent.Installer.CustomActions.csproj
    └── CustomActions.cs             # Implementación de acciones
```

## Compilación

### 1. Compilar el Servicio (Release)

```powershell
cd TisTis.Agent.SoftRestaurant
dotnet publish src/TisTis.Agent.Service -c Release -r win-x64 --self-contained -o publish
```

### 2. Compilar las Custom Actions

```powershell
dotnet build installer/TisTis.Agent.Installer.CustomActions -c Release
```

### 3. Compilar el Instalador

```powershell
dotnet build installer/TisTis.Agent.Installer -c Release
```

El archivo MSI se generará en:
```
installer/TisTis.Agent.Installer/bin/Release/TisTis.Agent.SoftRestaurant.msi
```

## Generación de Instalador Personalizado

Para generar un instalador con credenciales específicas de un tenant:

```powershell
dotnet build installer/TisTis.Agent.Installer -c Release `
  -p:AgentId="tis-agent-abc123" `
  -p:TenantId="tenant-xyz789" `
  -p:AuthToken="your-secure-token" `
  -p:WebhookUrl="https://app.tistis.com/api/agent/sync"
```

## Flujo del Instalador

```
┌──────────────────┐
│  1. Bienvenida   │
│  Requisitos      │
└────────┬─────────┘
         │
┌────────▼─────────┐
│  2. Detección    │
│  SQL Server + SR │
└────────┬─────────┘
         │
┌────────▼─────────┐
│  3. Configurar   │
│  Sync Options    │
└────────┬─────────┘
         │
┌────────▼─────────┐
│  4. Confirmar    │
│  Resumen         │
└────────┬─────────┘
         │
┌────────▼─────────┐
│  5. Instalar     │
│  Progreso        │
└────────┬─────────┘
         │
┌────────▼─────────┐
│  6. Completado   │
│  Servicio activo │
└──────────────────┘
```

## Custom Actions

| Acción | Descripción |
|--------|-------------|
| `CA_DetectSoftRestaurant` | Detecta SQL Server y base de datos SR |
| `CA_TestSqlConnection` | Prueba la conexión SQL |
| `CA_CreateConfiguration` | Crea appsettings.json |
| `CA_RegisterAgent` | Registra el agente con TIS TIS |
| `CA_StartAgentService` | Inicia el servicio Windows |
| `CA_StopAgentService` | Detiene el servicio (uninstall) |
| `CA_Cleanup` | Limpia datos en desinstalación |

## Archivos Instalados

```
C:\Program Files\TisTis\Agent\
├── TisTis.Agent.Service.exe         # Ejecutable principal
├── TisTis.Agent.Core.dll            # Biblioteca core
├── appsettings.json                 # Configuración
└── *.dll                            # Dependencias .NET

C:\ProgramData\TisTis\Agent\
├── Logs\                            # Logs del servicio
├── Config\                          # Configuración adicional
└── Credentials\
    └── credentials.dat              # Credenciales encriptadas (DPAPI)
```

## Registry Keys

```
HKLM\SOFTWARE\TisTis\Agent\
├── InstallPath      = "C:\Program Files\TisTis\Agent"
├── DataPath         = "C:\ProgramData\TisTis\Agent"
├── Version          = "1.0.0"
├── AgentId          = "tis-agent-xxx"
├── SRVersion        = "10.x"
├── SRDatabaseName   = "DVSOFT"
└── SyncInterval     = 30
```

## Servicio Windows

- **Nombre**: `TisTis.Agent.SoftRestaurant`
- **Display Name**: `TIS TIS Agent for Soft Restaurant`
- **Tipo de Inicio**: Automático
- **Cuenta**: LocalSystem
- **Recovery**: Reiniciar en fallo (60s)

## Desinstalación

El desinstalador:
1. Detiene el servicio Windows
2. Elimina credenciales encriptadas
3. Elimina configuración
4. Mantiene logs (opcional)
5. Elimina claves de registro

## Troubleshooting

### El instalador no detecta Soft Restaurant

1. Verificar que SQL Server esté ejecutándose
2. Verificar que el servicio SQL Browser esté activo
3. Ejecutar instalador como Administrador
4. Verificar que la base de datos DVSOFT exista

### Error de conexión a TIS TIS

1. Verificar conexión a Internet
2. Verificar que el firewall permita conexiones HTTPS
3. Revisar logs en `C:\ProgramData\TisTis\Agent\Logs\`

### El servicio no inicia

1. Verificar Event Viewer > Application
2. Verificar que .NET 8.0 Runtime esté instalado
3. Verificar permisos de la carpeta de instalación

## Assets Necesarios

Antes de compilar, crear las imágenes en `Assets/`:

| Archivo | Dimensiones | Descripción |
|---------|-------------|-------------|
| `banner.png` | 493x58 px | Banner superior de diálogos |
| `dialog.png` | 493x312 px | Imagen lateral (opcional) |
| `icon.ico` | 32x32, 16x16 | Ícono del producto |
| `check.ico` | 32x32 | Ícono de éxito (verde) |
| `warning.ico` | 32x32 | Ícono de advertencia (amarillo) |

---

*TIS TIS Platform - 2026*

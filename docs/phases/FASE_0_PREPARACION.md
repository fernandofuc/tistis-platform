# FASE 0: Preparación y Backup

## Información de Fase

| Campo | Valor |
|-------|-------|
| **Fase** | 0 - Preparación |
| **Duración Estimada** | 30 minutos |
| **Riesgo** | 🟢 Ninguno |
| **Prerrequisitos** | Acceso a terminal, Git configurado |
| **Resultado** | Punto de restauración seguro |

---

## Objetivo

Crear un punto de restauración completo antes de iniciar cualquier migración, garantizando que podamos volver al estado actual en cualquier momento.

---

## Microfases

### 0.1 Verificar Estado Actual

**Objetivo**: Confirmar que el sistema está estable antes de hacer backup

#### Acciones:

```bash
# 1. Ir al directorio del proyecto
cd "/Users/macfer/Documents/TIS TIS /tistis-platform"

# 2. Verificar que no hay cambios sin commitear
git status

# 3. Verificar que la app compila
npm run build

# 4. Verificar que los tests pasan
npm test
```

#### Checklist:
- [ ] `git status` muestra working tree clean (o cambios conocidos)
- [ ] `npm run build` completa sin errores
- [ ] `npm test` pasa todos los tests

#### Si hay problemas:
- Si hay cambios sin commitear: `git add . && git commit -m "Pre-migration state"`
- Si build falla: NO CONTINUAR, arreglar primero
- Si tests fallan: Evaluar si son críticos

---

### 0.2 Crear Branch de Backup

**Objetivo**: Tener una rama dedicada con el estado pre-migración

#### Acciones:

```bash
# 1. Asegurarse de estar en main/master
git checkout main

# 2. Crear branch de backup con fecha
git checkout -b backup/pre-migration-2026-01-21

# 3. Verificar que estamos en el branch correcto
git branch --show-current
# Debería mostrar: backup/pre-migration-2026-01-21

# 4. Volver a main para trabajar
git checkout main
```

#### Checklist:
- [ ] Branch `backup/pre-migration-2026-01-21` creado
- [ ] Actualmente en branch `main`

---

### 0.3 Crear Tag de Versión Estable

**Objetivo**: Marcar el commit exacto como versión estable

#### Acciones:

```bash
# 1. Crear tag anotado
git tag -a v1.0-stable-pre-migration -m "Estado estable antes de migración de infraestructura"

# 2. Verificar que el tag existe
git tag -l "v1.0*"
# Debería mostrar: v1.0-stable-pre-migration

# 3. (Opcional) Push tag a remote
git push origin v1.0-stable-pre-migration
```

#### Checklist:
- [ ] Tag `v1.0-stable-pre-migration` creado
- [ ] Tag visible con `git tag -l`

---

### 0.4 Backup de Configuración

**Objetivo**: Respaldar archivos de configuración críticos

#### Acciones:

```bash
# 1. Crear directorio de backups
mkdir -p backups/pre-migration-2026-01-21

# 2. Copiar .env.local
cp .env.local backups/pre-migration-2026-01-21/.env.local.backup

# 3. Copiar configuraciones críticas
cp package.json backups/pre-migration-2026-01-21/
cp tsconfig.json backups/pre-migration-2026-01-21/
cp next.config.ts backups/pre-migration-2026-01-21/
cp jest.config.js backups/pre-migration-2026-01-21/

# 4. Listar contenido del backup
ls -la backups/pre-migration-2026-01-21/
```

#### Checklist:
- [ ] Directorio `backups/pre-migration-2026-01-21` creado
- [ ] `.env.local.backup` guardado
- [ ] Archivos de configuración respaldados

---

### 0.5 Documentar Estado de Endpoints

**Objetivo**: Tener registro de qué endpoints funcionan actualmente

#### Crear archivo de estado:

```bash
# Crear archivo de estado
cat > backups/pre-migration-2026-01-21/ENDPOINT_STATUS.md << 'EOF'
# Estado de Endpoints Pre-Migración

## Fecha: 2026-01-21

## Endpoints Críticos a Verificar Post-Migración

### Stripe (Pagos)
- [ ] POST /api/stripe/webhook
- [ ] POST /api/stripe/create-checkout
- [ ] POST /api/stripe/change-plan
- [ ] POST /api/stripe/cancel-subscription

### WhatsApp
- [ ] GET /api/webhook/whatsapp/[tenant] (verificación)
- [ ] POST /api/webhook/whatsapp/[tenant] (mensajes)

### Admin
- [ ] POST /api/admin/seed-data
- [ ] POST /api/admin/fix-rls
- [ ] POST /api/admin/link-stripe

### APIs Públicas
- [ ] GET /api/v1/leads
- [ ] POST /api/v1/leads
- [ ] POST /api/v1/webhook/[tenant]

### AI/Voice
- [ ] POST /api/ai-config/generate-prompt
- [ ] POST /api/voice-agent/webhook

## Notas
- Todos estos endpoints deben seguir funcionando después de cada fase
- Verificar con tests manuales o automatizados
EOF
```

#### Checklist:
- [ ] `ENDPOINT_STATUS.md` creado
- [ ] Lista de endpoints críticos documentada

---

### 0.6 Verificación Final de Backup

**Objetivo**: Confirmar que el backup está completo

#### Acciones:

```bash
# 1. Listar todo el contenido del backup
ls -la backups/pre-migration-2026-01-21/

# 2. Verificar que el branch de backup existe
git branch -a | grep backup

# 3. Verificar que el tag existe
git tag -l | grep stable

# 4. Verificar que podemos hacer checkout al backup
git checkout backup/pre-migration-2026-01-21
git log --oneline -1  # Ver último commit
git checkout main     # Volver a main
```

#### Checklist Final:
- [ ] Directorio de backup tiene todos los archivos
- [ ] Branch de backup existe
- [ ] Tag de versión existe
- [ ] Checkout al backup funciona
- [ ] De vuelta en branch main

---

## Resumen de Artefactos Creados

| Artefacto | Ubicación | Propósito |
|-----------|-----------|-----------|
| Branch backup | `backup/pre-migration-2026-01-21` | Código completo |
| Tag | `v1.0-stable-pre-migration` | Marca de versión |
| .env backup | `backups/pre-migration-2026-01-21/.env.local.backup` | Configuración |
| Config files | `backups/pre-migration-2026-01-21/` | Archivos de config |
| Endpoint status | `backups/pre-migration-2026-01-21/ENDPOINT_STATUS.md` | Checklist |

---

## Cómo Usar el Backup (Rollback)

### Rollback Completo:

```bash
# Si algo sale muy mal, volver al estado pre-migración:
git checkout backup/pre-migration-2026-01-21
cp backups/pre-migration-2026-01-21/.env.local.backup .env.local
npm install
npm run build
```

### Rollback Parcial (solo un archivo):

```bash
# Restaurar un archivo específico del backup:
git checkout backup/pre-migration-2026-01-21 -- path/to/file.ts
```

---

## Siguiente Paso

✅ **Fase 0 Completada**

Proceder a: [FASE_1_STRUCTURED_LOGGER.md](./FASE_1_STRUCTURED_LOGGER.md)

---

## Troubleshooting

### "Git status muestra archivos modificados"

```bash
# Ver qué cambió
git diff

# Si son cambios que quieres guardar:
git add .
git commit -m "Changes before migration"

# Si son cambios que no quieres:
git checkout .
```

### "npm run build falla"

No continuar con la migración. Arreglar el build primero:
1. Leer el error
2. Buscar el archivo mencionado
3. Arreglar el error
4. Volver a intentar build

### "No tengo permisos para crear directorios"

```bash
# Verificar permisos del directorio
ls -la

# Si es necesario, cambiar permisos
chmod 755 .
```

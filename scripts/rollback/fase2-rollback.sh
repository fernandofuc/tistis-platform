#!/bin/bash
# =====================================================
# ROLLBACK SCRIPT - FASE 2: Branch-Specific Keys
# =====================================================
# Purpose: Revert branch-specific API keys functionality
# Risk Level: MEDIUM (requires database changes)
# Data Loss: NONE (keys converted back to tenant-wide)
# Estimated Time: 30-60 minutes
# =====================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/rollback-fase2-$(date +%Y%m%d-%H%M%S).log"

# Ensure log directory exists
mkdir -p "$PROJECT_ROOT/logs"

# Logging function
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# =====================================================
# SIGNAL HANDLING
# =====================================================

# Cleanup function for interrupted execution
cleanup() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo ""
        error "Script interrupted or failed!"
        error "Current state may be inconsistent"
        error "Please check:"
        echo "  - Git branch: $(git branch --show-current 2>/dev/null || echo 'unknown')"
        echo "  - Git status: $(git status --short 2>/dev/null | head -5 || echo 'unknown')"
        echo "  - Database: May have partial changes (check backup: $BACKUP_FILE)"
        echo "  - Logs: $LOG_FILE"
        echo ""
        warning "If rollback was interrupted, you may need to:"
        echo "  1. Check database state with backup file"
        echo "  2. Review git status and resolve any conflicts"
        echo "  3. Complete the rollback manually"
        echo "  4. Or contact support: emergencias@tistis.com"
    fi
    exit $exit_code
}

# Set trap for cleanup on exit, interrupt, or termination
trap cleanup EXIT INT TERM

# =====================================================
# PRE-ROLLBACK CHECKS
# =====================================================

log "=========================================="
log "FASE 2 ROLLBACK - PRE-FLIGHT CHECKS"
log "=========================================="

# Check environment variables
if [ -z "${DATABASE_URL:-}" ]; then
    error "DATABASE_URL environment variable is not set!"
    echo "Please set it with: export DATABASE_URL='your-database-url'"
    exit 1
fi

# Check if psql is available
if ! command -v psql &> /dev/null; then
    error "psql is not installed!"
    echo "Install with: brew install postgresql (macOS) or apt install postgresql-client (Linux)"
    exit 1
fi

# Test database connection
log "Testing database connection..."
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    success "Database connection successful ✓"
else
    error "Cannot connect to database!"
    exit 1
fi

log "Pre-flight checks passed ✓"

# =====================================================
# CONFIRMATION
# =====================================================

echo ""
warning "⚠️  YOU ARE ABOUT TO ROLLBACK FASE 2 (Branch-Specific Keys)"
echo ""
echo "This will:"
echo "  - Revert branch-specific API key code"
echo "  - Convert ALL branch-specific keys to tenant-wide"
echo "  - Deploy to production via Vercel"
echo "  - Send communication to affected clients"
echo ""
echo "Impact Assessment:"
echo "  - APIs affected: ALL endpoints using branch filtering"
echo "  - Clients affected: ~15-20% (multi-branch tenants)"
echo "  - Behavior change: Branch keys → Tenant-wide keys"
echo "  - Data loss: NONE (keys preserved)"
echo "  - Downtime: ~2-5 minutes during deployment"
echo ""

# Count affected keys
AFFECTED_KEYS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM api_keys WHERE scope_type = 'branch';")
log "Branch-specific keys found: $AFFECTED_KEYS"

# Check if rollback is needed (idempotency check)
if [ "$AFFECTED_KEYS" -eq 0 ]; then
    echo ""
    success "No branch-specific keys found - rollback already completed or not needed"
    echo ""
    echo "Current state:"
    echo "  - All API keys are already tenant-scoped"
    echo "  - Nothing to rollback"
    echo ""
    warning "This rollback may have already been executed."
    echo ""
    read -p "Do you want to continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log "Rollback cancelled - no action needed"
        success "Exiting gracefully (no changes made)"
        exit 0
    fi
    log "User chose to continue despite no keys to rollback"
fi

echo ""
echo "Database changes:"
echo "  - $AFFECTED_KEYS keys will be converted to tenant-wide"
echo ""

read -p "Are you SURE you want to proceed? (type 'ROLLBACK' to confirm): " confirmation

if [ "$confirmation" != "ROLLBACK" ]; then
    error "Rollback cancelled by user"
    exit 1
fi

# =====================================================
# BACKUP DATABASE STATE
# =====================================================

log "=========================================="
log "BACKING UP DATABASE STATE"
log "=========================================="

BACKUP_FILE="$PROJECT_ROOT/logs/rollback-fase2-backup-$(date +%Y%m%d-%H%M%S).csv"

log "Creating backup of api_keys table..."
psql "$DATABASE_URL" -c "COPY (SELECT * FROM api_keys WHERE scope_type = 'branch') TO STDOUT WITH CSV HEADER;" > "$BACKUP_FILE"

if [ -s "$BACKUP_FILE" ]; then
    success "Backup created: $BACKUP_FILE"
else
    error "Backup failed or no branch keys found!"
    exit 1
fi

# =====================================================
# DATABASE MIGRATION
# =====================================================

log "=========================================="
log "EXECUTING DATABASE CHANGES"
log "=========================================="

# Create SQL rollback script
ROLLBACK_SQL="$PROJECT_ROOT/logs/rollback-fase2-migration.sql"

cat > "$ROLLBACK_SQL" <<'EOF'
-- =====================================================
-- FASE 2 ROLLBACK: Convert branch keys to tenant-wide
-- =====================================================

BEGIN;

-- Log affected keys before change
CREATE TEMP TABLE IF NOT EXISTS affected_keys AS
SELECT
    id,
    tenant_id,
    branch_id,
    name,
    scope_type,
    created_at
FROM api_keys
WHERE scope_type = 'branch';

-- Show summary
DO $$
DECLARE
    affected_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO affected_count FROM affected_keys;
    RAISE NOTICE 'Converting % branch-specific keys to tenant-wide', affected_count;
END $$;

-- Update keys
UPDATE api_keys
SET
    scope_type = 'tenant',
    branch_id = NULL,
    updated_at = NOW()
WHERE scope_type = 'branch';

-- Verify changes
DO $$
DECLARE
    remaining_branch_keys INTEGER;
BEGIN
    SELECT COUNT(*) INTO remaining_branch_keys FROM api_keys WHERE scope_type = 'branch';

    IF remaining_branch_keys > 0 THEN
        RAISE EXCEPTION 'Migration failed: % branch keys still exist', remaining_branch_keys;
    END IF;

    RAISE NOTICE 'Migration successful: All branch keys converted to tenant-wide';
END $$;

COMMIT;

-- Note: Export affected tenants will be done separately from bash

EOF

log "Executing database migration..."

# Execute with transaction (save output for debugging)
DB_LOG="$PROJECT_ROOT/logs/rollback-fase2-db-$(date +%Y%m%d-%H%M%S).log"
if psql "$DATABASE_URL" -f "$ROLLBACK_SQL" > "$DB_LOG" 2>&1; then
    success "Database migration successful ✓"

    # Export affected tenants to CSV
    AFFECTED_CSV="$PROJECT_ROOT/logs/rollback-fase2-affected-tenants-$(date +%Y%m%d-%H%M%S).csv"
    psql "$DATABASE_URL" -c "COPY (SELECT tenant_id, COUNT(*) as converted_keys FROM (SELECT DISTINCT tenant_id FROM api_keys WHERE updated_at > NOW() - INTERVAL '5 minutes') t GROUP BY tenant_id) TO STDOUT WITH CSV HEADER;" > "$AFFECTED_CSV" 2>/dev/null || true

    if [ -s "$AFFECTED_CSV" ]; then
        log "Affected tenants exported to: $AFFECTED_CSV"
    fi
else
    error "Database migration failed!"
    error "Database log: $DB_LOG"
    error "Last 20 lines of output:"
    tail -20 "$DB_LOG"
    error "Backup file: $BACKUP_FILE"
    error "To restore manually, import CSV: psql \$DATABASE_URL -c \"\\copy api_keys FROM '$BACKUP_FILE' WITH CSV HEADER;\""
    exit 1
fi

# =====================================================
# CODE ROLLBACK
# =====================================================

log "=========================================="
log "REVERTING APPLICATION CODE"
log "=========================================="

# Get current state
CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_BRANCH=$(git branch --show-current)

log "Current commit: $CURRENT_COMMIT"
log "Current branch: $CURRENT_BRANCH"

# Find FASE 2 commits
log "Identifying FASE 2 commits..."
FASE2_COMMITS=$(git log --oneline --grep="FASE.2\|branch.specific\|scope_type" --all | head -10)

if [ -z "$FASE2_COMMITS" ]; then
    warning "Could not auto-detect FASE 2 commits"
    echo "Please enter the commit hash to revert:"
    read -r COMMIT_TO_REVERT
else
    echo ""
    echo "Found potential FASE 2 commits:"
    echo "$FASE2_COMMITS"
    echo ""
    echo "Enter the commit hash to revert:"
    read -r COMMIT_TO_REVERT
fi

# Validate commit
if ! git cat-file -e "$COMMIT_TO_REVERT^{commit}" 2>/dev/null; then
    error "Invalid commit hash: $COMMIT_TO_REVERT"
    exit 1
fi

# Create rollback branch
ROLLBACK_BRANCH="rollback/fase2-$(date +%Y%m%d-%H%M%S)"

if git checkout -b "$ROLLBACK_BRANCH"; then
    success "Created branch: $ROLLBACK_BRANCH"
else
    error "Failed to create branch $ROLLBACK_BRANCH"
    error "Branch may already exist or git error occurred"
    exit 1
fi

# Revert commit
log "Reverting commit $COMMIT_TO_REVERT..."
if git revert --no-edit "$COMMIT_TO_REVERT"; then
    success "Commit reverted successfully"
else
    error "Revert failed. Manual intervention required."
    exit 1
fi

# Test build
log "Running build test..."
if npm run build > /dev/null 2>&1; then
    success "Build successful ✓"
else
    error "Build failed after revert!"
    exit 1
fi

# Push and merge
if git push origin "$ROLLBACK_BRANCH"; then
    success "Pushed to remote ✓"
else
    error "Failed to push to remote!"
    error "Please check network connection and git permissions"
    exit 1
fi

if git checkout main; then
    success "Switched to main branch ✓"
else
    error "Failed to checkout main!"
    error "You may have uncommitted changes"
    exit 1
fi

if git pull origin main; then
    success "Pulled latest from main ✓"
else
    error "Failed to pull from main!"
    error "Please check for conflicts or network issues"
    exit 1
fi

git merge --no-ff "$ROLLBACK_BRANCH" -m "chore: ROLLBACK FASE 2 - Branch-Specific Keys

Database changes:
- Converted $AFFECTED_KEYS branch keys to tenant-wide
- Zero data loss

Reverted commit: $COMMIT_TO_REVERT
Rollback executed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
"

if git push origin main; then
    success "Code rollback complete ✓"
else
    error "Failed to push to main!"
    error "Changes are merged locally but not pushed to remote"
    error "Please run manually: git push origin main"
    exit 1
fi

# =====================================================
# DEPLOY TO PRODUCTION
# =====================================================

log "=========================================="
log "DEPLOYING TO PRODUCTION"
log "=========================================="

if command -v vercel &> /dev/null; then
    log "Deploying via Vercel..."
    vercel --prod --yes
    success "Deployed to production ✓"
else
    warning "Vercel CLI not found. Deploy manually at https://vercel.com"
fi

log "Waiting 30 seconds for deployment..."
sleep 30

# =====================================================
# VALIDATION
# =====================================================

log "=========================================="
log "POST-ROLLBACK VALIDATION"
log "=========================================="

# Test API endpoints
if [ -n "${TEST_API_KEY:-}" ]; then
    log "Testing API endpoint..."

    API_URL="${API_BASE_URL:-https://api.tistis.com}"

    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_URL/v1/leads?limit=1" \
        -H "Authorization: Bearer $TEST_API_KEY")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ]; then
        success "API responding correctly ✓"
    else
        error "API returned HTTP $HTTP_CODE"
    fi
else
    warning "TEST_API_KEY not set. Skipping API validation."
fi

# Check database state
log "Verifying database state..."
REMAINING_BRANCH_KEYS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM api_keys WHERE scope_type = 'branch';")

if [ "$REMAINING_BRANCH_KEYS" -eq 0 ]; then
    success "All branch keys converted ✓"
else
    error "$REMAINING_BRANCH_KEYS branch keys still exist!"
fi

# =====================================================
# GENERATE COMMUNICATION
# =====================================================

log "=========================================="
log "GENERATING CLIENT COMMUNICATION"
log "=========================================="

COMM_FILE="$PROJECT_ROOT/logs/rollback-fase2-communication-$(date +%Y%m%d-%H%M%S).md"

cat > "$COMM_FILE" <<EOF
# FASE 2 Rollback Communication

**Date:** $(date -u +%Y-%m-%dT%H:%M:%SZ)
**Affected Keys:** $AFFECTED_KEYS

## Email Template

---

**Subject:** [URGENT] API Keys Behavior Change - Temporary Rollback

Estimados clientes,

Hemos revertido temporalmente la funcionalidad de API Keys por sucursal
debido a [SPECIFY REASON HERE].

### CAMBIO INMEDIATO:

- Las API Keys creadas para sucursales específicas ahora tienen acceso
  a TODAS las sucursales de su organización.
- Recomendamos usar el parámetro ?branch_id=xxx si necesitan filtrar.

### IMPACTO:

- **Número de keys afectadas:** $AFFECTED_KEYS
- **Comportamiento:** Las keys con scope "branch" ahora funcionan como "tenant"
- **Data loss:** NINGUNO
- **Action requerida:** NINGUNA (opcional: ajustar queries con ?branch_id)

### PRÓXIMOS PASOS:

1. Investigaremos y resolveremos el issue en las próximas 48 horas.
2. Les notificaremos cuando restauremos la funcionalidad.
3. Sus datos y keys están seguros.

Si tienen preguntas: soporte@tistis.com

Gracias por su comprensión,
Equipo TIS TIS

---

## Affected Tenants

See: $AFFECTED_CSV (if generated)

## Internal Notes

- Backup file: $BACKUP_FILE
- Rollback SQL: $ROLLBACK_SQL
- Log file: $LOG_FILE
- Commit reverted: $COMMIT_TO_REVERT

EOF

success "Communication template created: $COMM_FILE"

# =====================================================
# COMPLETION
# =====================================================

success "=========================================="
success "FASE 2 ROLLBACK COMPLETE"
success "=========================================="

echo ""
echo "Summary:"
echo "  - Database: $AFFECTED_KEYS keys converted to tenant-wide"
echo "  - Code: Reverted commit $COMMIT_TO_REVERT"
echo "  - Deployment: Production (Vercel)"
echo "  - Backup: $BACKUP_FILE"
echo "  - Communication: $COMM_FILE"
echo ""
echo "Next Steps:"
echo "  1. ✓ Send communication to affected clients"
echo "  2. ✓ Monitor error rates (next 1 hour)"
echo "  3. ✓ Update status page"
echo "  4. → Investigate root cause"
echo "  5. → Create hotfix plan"
echo ""
warning "CRITICAL: Send client communication within 30 minutes!"
echo ""

# =====================================================
# POST-ROLLBACK VALIDATION
# =====================================================

log "=========================================="
log "POST-ROLLBACK VALIDATION"
log "=========================================="

log "Waiting 30 seconds for deployment to stabilize..."
sleep 30

# Run validation script
if [ -f "$SCRIPT_DIR/../validation/validate-rollback.sh" ]; then
    log "Running validation script..."
    if bash "$SCRIPT_DIR/../validation/validate-rollback.sh" "fase2"; then
        success "Validation passed ✓"
    else
        error "Validation failed! Please investigate immediately."
        error "Check logs: $LOG_FILE"
    fi
else
    warning "Validation script not found. Manual validation required."
fi

exit 0

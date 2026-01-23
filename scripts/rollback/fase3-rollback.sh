#!/bin/bash
# =====================================================
# ROLLBACK SCRIPT - FASE 3: Performance Optimization
# =====================================================
# Purpose: Revert performance optimizations (caching, indexes, RPC)
# Risk Level: LOW (only optimizations, not core functionality)
# Data Loss: NONE
# Estimated Time: 10-15 minutes
# =====================================================

set -e
set -u

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LOG_FILE="$PROJECT_ROOT/logs/rollback-fase3-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$PROJECT_ROOT/logs"

# Logging
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
        echo "  - Logs: $LOG_FILE"
        echo ""
        warning "If rollback was interrupted, you may need to:"
        echo "  1. Review git status and resolve any conflicts"
        echo "  2. Complete the rollback manually"
        echo "  3. Or contact support: emergencias@tistis.com"
    fi
    exit $exit_code
}

# Set trap for cleanup on exit, interrupt, or termination
trap cleanup EXIT INT TERM

# =====================================================
# PRE-ROLLBACK CHECKS
# =====================================================

log "=========================================="
log "FASE 3 ROLLBACK - PRE-FLIGHT CHECKS"
log "=========================================="

# Check git
if ! command -v git &> /dev/null; then
    error "Git is not installed!"
    exit 1
fi

# Check if in project root
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    error "Not in project root directory!"
    exit 1
fi

log "Pre-flight checks passed ✓"

# =====================================================
# CONFIRMATION
# =====================================================

echo ""
warning "⚠️  YOU ARE ABOUT TO ROLLBACK FASE 3 (Performance Optimization)"
echo ""
echo "This will:"
echo "  - Revert caching layer implementation"
echo "  - Revert database indexes (migrations 136-137)"
echo "  - Revert RPC functions and materialized views"
echo "  - Deploy to production via Vercel"
echo ""
echo "Impact Assessment:"
echo "  - Risk Level: LOW (only optimizations)"
echo "  - APIs affected: ALL (performance will decrease)"
echo "  - Clients affected: 0% (transparent to clients)"
echo "  - Data loss: NONE"
echo "  - Expected behavior: Performance returns to pre-FASE 3 levels"
echo ""

read -p "Are you SURE you want to proceed? (type 'ROLLBACK' to confirm): " confirmation

if [ "$confirmation" != "ROLLBACK" ]; then
    error "Rollback cancelled by user"
    exit 1
fi

# =====================================================
# BACKUP
# =====================================================

log "=========================================="
log "BACKING UP CURRENT STATE"
log "=========================================="

CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_BRANCH=$(git branch --show-current)

log "Current commit: $CURRENT_COMMIT"
log "Current branch: $CURRENT_BRANCH"

# Save state
cat > "$PROJECT_ROOT/logs/rollback-fase3-state.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "commit": "$CURRENT_COMMIT",
  "branch": "$CURRENT_BRANCH",
  "phase": "FASE 3",
  "reason": "Manual rollback - Performance optimization revert"
}
EOF

success "State backed up ✓"

# =====================================================
# DATABASE ROLLBACK (OPTIONAL)
# =====================================================

log "=========================================="
log "DATABASE ROLLBACK OPTIONS"
log "=========================================="

echo ""
echo "FASE 3 includes database migrations (indexes, RPC functions)."
echo ""
echo "Options:"
echo "  1) Keep database optimizations (RECOMMENDED - safe, performance impact only)"
echo "  2) Rollback database migrations (RISKY - requires careful execution)"
echo ""
read -p "Choose option (1 or 2): " db_option

if [ "$db_option" = "2" ]; then
    warning "Database rollback selected"

    if [ -z "${DATABASE_URL:-}" ]; then
        error "DATABASE_URL not set!"
        exit 1
    fi

    log "Creating database rollback script..."

    DB_ROLLBACK_SQL="$PROJECT_ROOT/logs/rollback-fase3-db-migration.sql"

    cat > "$DB_ROLLBACK_SQL" <<'EOSQL'
-- =====================================================
-- FASE 3 ROLLBACK: Remove optimizations
-- =====================================================

BEGIN;

-- Drop RPC functions (Migration 137)
DROP FUNCTION IF EXISTS get_low_stock_items(UUID, UUID);
DROP FUNCTION IF EXISTS get_branch_stats_summary(UUID, UUID);
DROP FUNCTION IF EXISTS refresh_branch_performance_metrics();

-- Drop materialized view
DROP MATERIALIZED VIEW IF EXISTS mv_branch_performance_metrics;

-- Drop view
DROP VIEW IF EXISTS vw_cache_freshness;

-- Drop indexes (Migration 136)
-- Leads indexes
DROP INDEX IF EXISTS idx_leads_branch_status_active;
DROP INDEX IF EXISTS idx_leads_branch_created_covering;

-- Appointments indexes
DROP INDEX IF EXISTS idx_appointments_branch_status_scheduled;
DROP INDEX IF EXISTS idx_appointments_branch_upcoming;

-- Inventory indexes
DROP INDEX IF EXISTS idx_inventory_branch_active;
DROP INDEX IF EXISTS idx_inventory_branch_low_stock;

-- API usage logs indexes
DROP INDEX IF EXISTS idx_api_usage_key_created;
DROP INDEX IF EXISTS idx_api_usage_tenant_created;

COMMIT;

SELECT 'FASE 3 database rollback complete' AS result;
EOSQL

    log "Executing database rollback..."

    if command -v psql &> /dev/null && [ -n "${DATABASE_URL:-}" ]; then
        if psql "$DATABASE_URL" -f "$DB_ROLLBACK_SQL"; then
            success "Database rollback successful ✓"
        else
            error "Database rollback failed!"
            error "Manual intervention required"
            exit 1
        fi
    else
        warning "psql not available. Manual database rollback required:"
        echo "  File: $DB_ROLLBACK_SQL"
    fi
else
    log "Keeping database optimizations (option 1 selected)"
    warning "Note: Performance optimizations remain in database"
fi

# =====================================================
# CODE ROLLBACK
# =====================================================

log "=========================================="
log "REVERTING APPLICATION CODE"
log "=========================================="

# Find FASE 3 commits
FASE3_COMMITS=$(git log --oneline --grep="FASE.3\|cache\|optimization\|performance" --all | head -15)

if [ -z "$FASE3_COMMITS" ]; then
    warning "Could not auto-detect FASE 3 commits"
    echo "Enter commit hash to revert:"
    read -r COMMIT_TO_REVERT
else
    echo ""
    echo "Found potential FASE 3 commits:"
    echo "$FASE3_COMMITS"
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
ROLLBACK_BRANCH="rollback/fase3-$(date +%Y%m%d-%H%M%S)"

if git checkout -b "$ROLLBACK_BRANCH"; then
    success "Created branch: $ROLLBACK_BRANCH"
else
    error "Failed to create branch $ROLLBACK_BRANCH"
    error "Branch may already exist or git error occurred"
    exit 1
fi
success "Created branch: $ROLLBACK_BRANCH"

# Revert commit
log "Reverting commit $COMMIT_TO_REVERT..."
if git revert --no-edit "$COMMIT_TO_REVERT"; then
    success "Commit reverted ✓"
else
    error "Revert failed!"
    exit 1
fi

# Build test
log "Testing build..."
BUILD_LOG="$PROJECT_ROOT/logs/rollback-fase3-build-$(date +%Y%m%d-%H%M%S).log"
if npm run build > "$BUILD_LOG" 2>&1; then
    success "Build successful ✓"
else
    error "Build failed after revert!"
    error "Build log: $BUILD_LOG"
    error "Last 20 lines of build output:"
    tail -20 "$BUILD_LOG"
    error "Rolling back git changes..."
    git revert --abort 2>/dev/null || true
    git checkout "$CURRENT_BRANCH"
    git branch -D "$ROLLBACK_BRANCH"
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

if git merge --no-ff "$ROLLBACK_BRANCH" -m "chore: ROLLBACK FASE 3 - Performance Optimization

Reverted optimizations:
- Caching layer
- Database indexes (option: $db_option)
- RPC functions and views

Reverted commit: $COMMIT_TO_REVERT
Rollback executed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Impact: Performance returns to pre-FASE 3 levels
"; then
    success "Merge successful ✓"
else
    error "Merge failed! Conflicts detected."
    error "Please resolve conflicts manually and complete the merge:"
    echo "  1. Resolve conflicts in the listed files"
    echo "  2. git add <resolved-files>"
    echo "  3. git commit"
    echo "  4. git push origin main"
    echo "  5. Run validation: ./scripts/validation/validate-rollback.sh fase3"
    exit 1
fi

if git push origin main; then
    success "Code rollback complete ✓"
else
    error "Failed to push to main!"
    error "Changes are merged locally but not pushed to remote"
    error "Please run manually: git push origin main"
    exit 1
fi

# =====================================================
# DEPLOY
# =====================================================

log "=========================================="
log "DEPLOYING TO PRODUCTION"
log "=========================================="

if command -v vercel &> /dev/null; then
    log "Deploying via Vercel..."
    vercel --prod --yes
    success "Deployed ✓"
else
    warning "Vercel CLI not found. Deploy manually."
fi

log "Waiting 30 seconds for deployment..."
sleep 30

# =====================================================
# VALIDATION
# =====================================================

log "=========================================="
log "POST-ROLLBACK VALIDATION"
log "=========================================="

# Test API
if [ -n "${TEST_API_KEY:-}" ] && [ -n "${API_BASE_URL:-}" ]; then
    log "Testing API endpoint..."

    RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL/v1/leads?limit=1" \
        -H "Authorization: Bearer $TEST_API_KEY")

    HTTP_CODE=$(echo "$RESPONSE" | tail -1)

    if [ "$HTTP_CODE" = "200" ]; then
        success "API responding ✓"
    else
        error "API returned HTTP $HTTP_CODE"
    fi
else
    warning "TEST_API_KEY or API_BASE_URL not set. Skipping API test."
fi

# =====================================================
# COMPLETION
# =====================================================

success "=========================================="
success "FASE 3 ROLLBACK COMPLETE"
success "=========================================="

echo ""
echo "Summary:"
echo "  - Code: Reverted commit $COMMIT_TO_REVERT"
echo "  - Database: Option $db_option executed"
echo "  - Deployment: Production (Vercel)"
echo "  - Log: $LOG_FILE"
echo ""
echo "Expected Changes:"
echo "  - Query performance: May increase latency"
echo "  - Cache hit rate: Returns to 0% (no caching)"
echo "  - P95 latency: May exceed 100ms target"
echo ""
echo "Next Steps:"
echo "  1. ✓ Monitor query performance (next 1 hour)"
echo "  2. ✓ Check error rates"
echo "  3. → Investigate why rollback was needed"
echo "  4. → Plan optimization fixes"
echo ""
warning "Note: Performance will be slower than FASE 3 optimized state"
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
    if bash "$SCRIPT_DIR/../validation/validate-rollback.sh" "fase3"; then
        success "Validation passed ✓"
    else
        error "Validation failed! Please investigate immediately."
        error "Check logs: $LOG_FILE"
    fi
else
    warning "Validation script not found. Manual validation required."
fi

exit 0

#!/bin/bash
# =====================================================
# ROLLBACK SCRIPT - FASE 1: Query Parameters
# =====================================================
# Purpose: Revert query parameter filtering functionality
# Risk Level: LOW (backward compatible)
# Data Loss: NONE
# Estimated Time: 5-10 minutes
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
LOG_FILE="$PROJECT_ROOT/logs/rollback-fase1-$(date +%Y%m%d-%H%M%S).log"

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
log "FASE 1 ROLLBACK - PRE-FLIGHT CHECKS"
log "=========================================="

# Check if we're in the right directory
if [ ! -f "$PROJECT_ROOT/package.json" ]; then
    error "Not in project root directory!"
    exit 1
fi

# Check if git is clean
if [ -n "$(git status --porcelain)" ]; then
    warning "Git working directory is not clean"
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if user has necessary permissions
if ! command -v git &> /dev/null; then
    error "Git is not installed!"
    exit 1
fi

log "Pre-flight checks passed ✓"

# =====================================================
# CONFIRMATION
# =====================================================

echo ""
warning "⚠️  YOU ARE ABOUT TO ROLLBACK FASE 1 (Query Parameters)"
echo ""
echo "This will:"
echo "  - Revert query parameter filtering code"
echo "  - Deploy to production via Vercel"
echo "  - Restore API behavior to pre-FASE 1 state"
echo ""
echo "Impact Assessment:"
echo "  - APIs affected: NONE (backward compatible)"
echo "  - Clients affected: 0 (feature was opt-in)"
echo "  - Data loss: NONE"
echo "  - Downtime: ~1-2 minutes during deployment"
echo ""

read -p "Are you SURE you want to proceed? (type 'ROLLBACK' to confirm): " confirmation

if [ "$confirmation" != "ROLLBACK" ]; then
    error "Rollback cancelled by user"
    exit 1
fi

# =====================================================
# BACKUP CURRENT STATE
# =====================================================

log "Creating backup of current state..."

CURRENT_COMMIT=$(git rev-parse HEAD)
CURRENT_BRANCH=$(git branch --show-current)

log "Current commit: $CURRENT_COMMIT"
log "Current branch: $CURRENT_BRANCH"

# Save state to file
cat > "$PROJECT_ROOT/logs/rollback-fase1-state.json" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "commit": "$CURRENT_COMMIT",
  "branch": "$CURRENT_BRANCH",
  "phase": "FASE 1",
  "reason": "Manual rollback"
}
EOF

success "Backup created ✓"

# =====================================================
# IDENTIFY FASE 1 COMMITS
# =====================================================

log "Identifying FASE 1 commits..."

# Search for FASE 1 related commits
FASE1_COMMITS=$(git log --oneline --grep="FASE.1\|query.parameter" --all | head -10)

if [ -z "$FASE1_COMMITS" ]; then
    warning "Could not auto-detect FASE 1 commits"
    echo "Please enter the commit hash to revert (or press Enter to abort):"
    read -r COMMIT_TO_REVERT

    if [ -z "$COMMIT_TO_REVERT" ]; then
        error "No commit specified. Aborting."
        exit 1
    fi
else
    echo ""
    echo "Found potential FASE 1 commits:"
    echo "$FASE1_COMMITS"
    echo ""
    echo "Enter the commit hash to revert:"
    read -r COMMIT_TO_REVERT
fi

# Validate commit exists
if ! git cat-file -e "$COMMIT_TO_REVERT^{commit}" 2>/dev/null; then
    error "Invalid commit hash: $COMMIT_TO_REVERT"
    exit 1
fi

log "Will revert commit: $COMMIT_TO_REVERT"

# =====================================================
# PERFORM ROLLBACK
# =====================================================

log "=========================================="
log "EXECUTING ROLLBACK"
log "=========================================="

# Step 1: Create rollback branch
log "Creating rollback branch..."
ROLLBACK_BRANCH="rollback/fase1-$(date +%Y%m%d-%H%M%S)"

if git checkout -b "$ROLLBACK_BRANCH"; then
    success "Created branch: $ROLLBACK_BRANCH"
else
    error "Failed to create branch $ROLLBACK_BRANCH"
    error "Branch may already exist or git error occurred"
    exit 1
fi

# Step 2: Revert commit
log "Reverting commit $COMMIT_TO_REVERT..."
if git revert --no-edit "$COMMIT_TO_REVERT"; then
    success "Commit reverted successfully"
else
    error "Revert failed. Manual intervention required."
    error "Run: git revert --abort"
    exit 1
fi

# Step 3: Run tests (quick smoke test)
log "Running quick smoke tests..."
BUILD_LOG="$PROJECT_ROOT/logs/rollback-fase1-build-$(date +%Y%m%d-%H%M%S).log"
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

# Step 4: Push to remote
log "Pushing rollback to remote..."
if git push origin "$ROLLBACK_BRANCH"; then
    success "Pushed to remote ✓"
else
    error "Failed to push to remote!"
    error "Please check network connection and git permissions"
    exit 1
fi

# Step 5: Merge to main
log "Merging to main..."

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

if git merge --no-ff "$ROLLBACK_BRANCH" -m "chore: ROLLBACK FASE 1 - Query Parameters

This rollback reverts the query parameter filtering functionality
due to operational requirements.

Reverted commit: $COMMIT_TO_REVERT
Rollback executed: $(date -u +%Y-%m-%dT%H:%M:%SZ)
Impact: Zero data loss, backward compatible
"; then
    success "Merge successful ✓"
else
    error "Merge failed! Conflicts detected."
    error "Please resolve conflicts manually and complete the merge:"
    echo "  1. Resolve conflicts in the listed files"
    echo "  2. git add <resolved-files>"
    echo "  3. git commit"
    echo "  4. git push origin main"
    echo "  5. Run validation: ./scripts/validation/validate-rollback.sh fase1"
    exit 1
fi

if git push origin main; then
    success "Pushed to main ✓"
else
    error "Failed to push to main!"
    error "Changes are merged locally but not pushed to remote"
    error "Please run manually: git push origin main"
    exit 1
fi

# Step 6: Deploy to Vercel
log "Deploying to Vercel production..."
echo ""
warning "IMPORTANT: Monitor the deployment at https://vercel.com"
echo ""

if command -v vercel &> /dev/null; then
    vercel --prod --yes
    success "Deployed to Vercel ✓"
else
    warning "Vercel CLI not found. Please deploy manually:"
    echo "  1. Go to https://vercel.com/dashboard"
    echo "  2. Trigger production deployment"
    echo "  3. Monitor deployment status"
fi

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
    if bash "$SCRIPT_DIR/../validation/validate-rollback.sh" "fase1"; then
        success "Validation passed ✓"
    else
        error "Validation failed! Please investigate immediately."
        error "Check logs: $LOG_FILE"
    fi
else
    warning "Validation script not found. Manual validation required."
fi

# =====================================================
# COMPLETION
# =====================================================

success "=========================================="
success "FASE 1 ROLLBACK COMPLETE"
success "=========================================="

echo ""
echo "Summary:"
echo "  - Reverted commit: $COMMIT_TO_REVERT"
echo "  - Rollback branch: $ROLLBACK_BRANCH"
echo "  - Deployed to: Production (Vercel)"
echo "  - Log file: $LOG_FILE"
echo ""
echo "Next Steps:"
echo "  1. ✓ Verify API endpoints are responding"
echo "  2. ✓ Check error rates in monitoring dashboard"
echo "  3. ✓ Notify stakeholders (see communication template)"
echo "  4. → Investigate root cause"
echo "  5. → Create hotfix plan"
echo ""
echo "Communication Template:"
echo "  File: docs/rollback/communication-templates.md (FASE 1 section)"
echo ""
warning "IMPORTANT: Monitor production metrics for the next 30 minutes!"
echo ""

exit 0

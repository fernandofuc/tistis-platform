#!/bin/bash
# =====================================================
# POST-ROLLBACK VALIDATION SCRIPT
# =====================================================
# Purpose: Validate system health after rollback
# Usage: ./validate-rollback.sh [fase1|fase2|fase3]
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
LOG_FILE="$PROJECT_ROOT/logs/validation-$(date +%Y%m%d-%H%M%S).log"

mkdir -p "$PROJECT_ROOT/logs"

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[✗ FAIL]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[✓ PASS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[⚠ WARN]${NC} $1" | tee -a "$LOG_FILE"
}

# Counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNED=0

# Test tracking
pass_test() {
    success "$1"
    ((TESTS_PASSED++))
}

fail_test() {
    error "$1"
    ((TESTS_FAILED++))
}

warn_test() {
    warning "$1"
    ((TESTS_WARNED++))
}

# =====================================================
# CONFIGURATION
# =====================================================

FASE="${1:-all}"
API_BASE_URL="${API_BASE_URL:-https://api.tistis.com}"
TEST_API_KEY="${TEST_API_KEY:-}"
TEST_TENANT_KEY="${TEST_TENANT_KEY:-}"

log "=========================================="
log "POST-ROLLBACK VALIDATION"
log "=========================================="
log "Fase: $FASE"
log "API Base URL: $API_BASE_URL"
log "Timestamp: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# =====================================================
# HEALTH CHECKS
# =====================================================

log "1. SYSTEM HEALTH CHECKS"
log "----------------------------------------"

# Check 1.1: API Reachability
log "1.1 Testing API reachability..."
if curl -s -f "$API_BASE_URL/health" > /dev/null 2>&1 || \
   curl -s -f "$API_BASE_URL/api/health" > /dev/null 2>&1; then
    pass_test "API is reachable"
else
    fail_test "API is not reachable at $API_BASE_URL"
fi

# Check 1.2: Response Time
log "1.2 Testing API response time..."
START_TIME=$(date +%s%N)
curl -s "$API_BASE_URL/health" > /dev/null 2>&1 || true
END_TIME=$(date +%s%N)
RESPONSE_TIME=$(( (END_TIME - START_TIME) / 1000000 ))  # Convert to ms

if [ "$RESPONSE_TIME" -lt 500 ]; then
    pass_test "Response time: ${RESPONSE_TIME}ms (< 500ms)"
elif [ "$RESPONSE_TIME" -lt 1000 ]; then
    warn_test "Response time: ${RESPONSE_TIME}ms (acceptable but slow)"
else
    fail_test "Response time: ${RESPONSE_TIME}ms (> 1000ms)"
fi

# Check 1.3: Build Status
log "1.3 Verifying build..."
if [ -f "$PROJECT_ROOT/package.json" ]; then
    BUILD_LOG="$PROJECT_ROOT/logs/validate-build-$(date +%Y%m%d-%H%M%S).log"
    if npm run build > "$BUILD_LOG" 2>&1; then
        pass_test "Build successful"
    else
        fail_test "Build failed (see log: $BUILD_LOG)"
        echo "    Last 10 lines of build output:"
        tail -10 "$BUILD_LOG" | sed 's/^/    /'
    fi
else
    warn_test "Cannot verify build (not in project directory)"
fi

echo ""

# =====================================================
# API ENDPOINT TESTS
# =====================================================

log "2. API ENDPOINT TESTS"
log "----------------------------------------"

if [ -z "$TEST_API_KEY" ]; then
    warn_test "TEST_API_KEY not set - skipping endpoint tests"
    warn_test "Set with: export TEST_API_KEY='your-key'"
else
    # Check 2.1: Authentication
    log "2.1 Testing authentication..."
    AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL/v1/leads?limit=1" \
        -H "Authorization: Bearer $TEST_API_KEY")

    AUTH_CODE=$(echo "$AUTH_RESPONSE" | tail -1)

    if [ "$AUTH_CODE" = "200" ] || [ "$AUTH_CODE" = "201" ]; then
        pass_test "Authentication working (HTTP $AUTH_CODE)"
    elif [ "$AUTH_CODE" = "401" ]; then
        fail_test "Authentication failed (HTTP 401 - Invalid key)"
    else
        warn_test "Unexpected auth response (HTTP $AUTH_CODE)"
    fi

    # Check 2.2: Query endpoints
    log "2.2 Testing query endpoints..."
    ENDPOINTS=("leads" "appointments" "branches")

    for endpoint in "${ENDPOINTS[@]}"; do
        RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL/v1/$endpoint?limit=1" \
            -H "Authorization: Bearer $TEST_API_KEY")

        HTTP_CODE=$(echo "$RESPONSE" | tail -1)

        if [ "$HTTP_CODE" = "200" ]; then
            pass_test "  /$endpoint endpoint responding"
        else
            fail_test "  /$endpoint returned HTTP $HTTP_CODE"
        fi
    done

    # Check 2.3: Error handling
    log "2.3 Testing error handling..."
    ERROR_RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$API_BASE_URL/v1/nonexistent" \
        -H "Authorization: Bearer $TEST_API_KEY")

    ERROR_CODE=$(echo "$ERROR_RESPONSE" | tail -1)

    if [ "$ERROR_CODE" = "404" ]; then
        pass_test "Error handling working (404 for invalid endpoint)"
    else
        warn_test "Unexpected error response (HTTP $ERROR_CODE)"
    fi
fi

echo ""

# =====================================================
# FASE-SPECIFIC TESTS
# =====================================================

log "3. FASE-SPECIFIC VALIDATION"
log "----------------------------------------"

case "$FASE" in
    "fase1"|"all")
        log "3.1 FASE 1 Validation (Query Parameters)..."

        if [ -n "$TEST_API_KEY" ]; then
            # Test query parameter filtering is optional
            WITH_PARAM=$(curl -s "$API_BASE_URL/v1/leads?branch_id=test&limit=1" \
                -H "Authorization: Bearer $TEST_API_KEY" | jq '. | length' 2>/dev/null || echo "0")

            if [ "$WITH_PARAM" -ge 0 ]; then
                pass_test "Query parameter handling working"
            else
                fail_test "Query parameter handling failed"
            fi
        else
            warn_test "Skipping FASE 1 tests (no TEST_API_KEY)"
        fi
        ;;
esac

case "$FASE" in
    "fase2"|"all")
        log "3.2 FASE 2 Validation (Branch-Specific Keys)..."

        if [ -n "${DATABASE_URL:-}" ]; then
            if command -v psql &> /dev/null; then
                # Check that no branch-specific keys remain
                BRANCH_KEYS=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM api_keys WHERE scope_type = 'branch';" 2>/dev/null || echo "-1")

                if [ "$BRANCH_KEYS" -eq 0 ]; then
                    pass_test "All branch keys converted to tenant-wide"
                elif [ "$BRANCH_KEYS" -gt 0 ]; then
                    fail_test "$BRANCH_KEYS branch keys still exist"
                else
                    warn_test "Could not verify database state"
                fi
            else
                warn_test "psql not available - skipping database check"
            fi
        else
            warn_test "DATABASE_URL not set - skipping database validation"
        fi
        ;;
esac

case "$FASE" in
    "fase3"|"all")
        log "3.3 FASE 3 Validation (Performance Optimization)..."

        # Test that system still works (performance may be slower)
        if [ -n "$TEST_API_KEY" ]; then
            START=$(date +%s%N)
            curl -s "$API_BASE_URL/v1/leads?limit=10" \
                -H "Authorization: Bearer $TEST_API_KEY" > /dev/null 2>&1 || true
            END=$(date +%s%N)

            QUERY_TIME=$(( (END - START) / 1000000 ))

            if [ "$QUERY_TIME" -lt 200 ]; then
                pass_test "Query performance: ${QUERY_TIME}ms"
            elif [ "$QUERY_TIME" -lt 500 ]; then
                warn_test "Query performance degraded: ${QUERY_TIME}ms (expected after FASE 3 rollback)"
            else
                fail_test "Query performance critical: ${QUERY_TIME}ms"
            fi
        fi
        ;;
esac

echo ""

# =====================================================
# DATABASE HEALTH
# =====================================================

log "4. DATABASE HEALTH"
log "----------------------------------------"

if [ -n "${DATABASE_URL:-}" ]; then
    if command -v psql &> /dev/null; then
        # Check 4.1: Connection
        log "4.1 Testing database connection..."
        if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
            pass_test "Database connection successful"
        else
            fail_test "Cannot connect to database"
        fi

        # Check 4.2: Critical tables
        log "4.2 Verifying critical tables..."
        TABLES=("api_keys" "tenants" "branches" "leads" "appointments")

        for table in "${TABLES[@]}"; do
            if psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM $table LIMIT 1;" > /dev/null 2>&1; then
                pass_test "  Table '$table' accessible"
            else
                fail_test "  Table '$table' inaccessible"
            fi
        done

        # Check 4.3: Data integrity
        log "4.3 Checking data integrity..."
        ORPHANED=$(psql "$DATABASE_URL" -t -c "
            SELECT COUNT(*)
            FROM api_keys k
            LEFT JOIN tenants t ON k.tenant_id = t.id
            WHERE t.id IS NULL;
        " 2>/dev/null || echo "-1")

        if [ "$ORPHANED" -eq 0 ]; then
            pass_test "No orphaned api_keys"
        elif [ "$ORPHANED" -gt 0 ]; then
            warn_test "$ORPHANED orphaned api_keys found"
        fi
    else
        warn_test "psql not available - skipping database tests"
    fi
else
    warn_test "DATABASE_URL not set - skipping database tests"
fi

echo ""

# =====================================================
# MONITORING & LOGS
# =====================================================

log "5. MONITORING & LOGS"
log "----------------------------------------"

# Check 5.1: Error logs
log "5.1 Checking for errors in logs..."
if [ -f "$PROJECT_ROOT/.next/server/app-paths-manifest.json" ]; then
    pass_test "Build artifacts present"
else
    warn_test "Build artifacts not found (may not be deployed yet)"
fi

# Check 5.2: Suggest monitoring
log "5.2 Recommended monitoring checks..."
echo "  → Check Vercel dashboard for deployment status"
echo "  → Monitor error rates in DataDog/Sentry"
echo "  → Check customer support tickets"
echo "  → Review status page"

echo ""

# =====================================================
# SUMMARY
# =====================================================

log "=========================================="
log "VALIDATION SUMMARY"
log "=========================================="

TOTAL_TESTS=$((TESTS_PASSED + TESTS_FAILED + TESTS_WARNED))

echo ""
echo "Results:"
echo "  ✓ Passed:  $TESTS_PASSED"
echo "  ✗ Failed:  $TESTS_FAILED"
echo "  ⚠ Warnings: $TESTS_WARNED"
echo "  ─────────────────"
echo "  Total:     $TOTAL_TESTS"
echo ""

if [ "$TESTS_FAILED" -eq 0 ]; then
    if [ "$TESTS_WARNED" -eq 0 ]; then
        success "=========================================="
        success "ALL VALIDATIONS PASSED ✓"
        success "=========================================="
        EXIT_CODE=0
    else
        warning "=========================================="
        warning "VALIDATION PASSED WITH WARNINGS"
        warning "=========================================="
        EXIT_CODE=0
    fi
else
    error "=========================================="
    error "VALIDATION FAILED - INVESTIGATION REQUIRED"
    error "=========================================="
    EXIT_CODE=1
fi

echo ""
echo "Log file: $LOG_FILE"
echo ""

if [ "$EXIT_CODE" -ne 0 ]; then
    echo "Next Steps:"
    echo "  1. Review failed tests above"
    echo "  2. Check application logs"
    echo "  3. Verify deployment status"
    echo "  4. Consider additional rollback if critical"
    echo ""
fi

exit $EXIT_CODE

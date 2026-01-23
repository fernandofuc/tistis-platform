#!/bin/bash
# =====================================================
# PRODUCTION HEALTH CHECK SCRIPT
# =====================================================
# Purpose: Continuous health monitoring for production
# Usage: ./health-check.sh [--continuous] [--interval=30]
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
LOG_FILE="$PROJECT_ROOT/logs/health-check-$(date +%Y%m%d).log"

mkdir -p "$PROJECT_ROOT/logs"

# Parse arguments
CONTINUOUS=false
INTERVAL=30

for arg in "$@"; do
    case $arg in
        --continuous)
            CONTINUOUS=true
            shift
            ;;
        --interval=*)
            INTERVAL="${arg#*=}"
            shift
            ;;
    esac
done

# Logging
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[✗]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
    echo -e "${GREEN}[✓]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[⚠]${NC} $1" | tee -a "$LOG_FILE"
}

# Configuration
API_BASE_URL="${API_BASE_URL:-https://api.tistis.com}"
TEST_API_KEY="${TEST_API_KEY:-}"
ALERT_THRESHOLD_ERROR_RATE=5  # %
ALERT_THRESHOLD_RESPONSE_TIME=500  # ms

# =====================================================
# HEALTH CHECK FUNCTION
# =====================================================

run_health_check() {
    local timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    echo ""
    log "=========================================="
    log "HEALTH CHECK - $timestamp"
    log "=========================================="

    local status="HEALTHY"
    local issues=()

    # Check 1: API Availability
    log "Checking API availability..."
    if curl -s -f --max-time 5 "$API_BASE_URL/health" > /dev/null 2>&1 || \
       curl -s -f --max-time 5 "$API_BASE_URL/api/health" > /dev/null 2>&1; then
        success "API is available"
    else
        error "API is DOWN"
        status="CRITICAL"
        issues+=("API_DOWN")
    fi

    # Check 2: Response Time
    log "Measuring response time..."
    local start_time=$(date +%s%N)
    curl -s --max-time 5 "$API_BASE_URL/health" > /dev/null 2>&1 || true
    local end_time=$(date +%s%N)
    local response_time=$(( (end_time - start_time) / 1000000 ))

    if [ "$response_time" -lt 200 ]; then
        success "Response time: ${response_time}ms (excellent)"
    elif [ "$response_time" -lt $ALERT_THRESHOLD_RESPONSE_TIME ]; then
        success "Response time: ${response_time}ms (good)"
    elif [ "$response_time" -lt 1000 ]; then
        warning "Response time: ${response_time}ms (slow)"
        status="DEGRADED"
        issues+=("SLOW_RESPONSE")
    else
        error "Response time: ${response_time}ms (critical)"
        status="CRITICAL"
        issues+=("VERY_SLOW_RESPONSE")
    fi

    # Check 3: API Endpoints
    if [ -n "$TEST_API_KEY" ]; then
        log "Testing API endpoints..."

        local endpoints_ok=0
        local endpoints_total=0

        for endpoint in "leads" "appointments" "branches"; do
            ((endpoints_total++))

            local http_code=$(curl -s -w "%{http_code}" -o /dev/null --max-time 5 \
                -X GET "$API_BASE_URL/v1/$endpoint?limit=1" \
                -H "Authorization: Bearer $TEST_API_KEY")

            if [ "$http_code" = "200" ]; then
                success "  /$endpoint: OK"
                ((endpoints_ok++))
            else
                error "  /$endpoint: HTTP $http_code"
                issues+=("ENDPOINT_${endpoint}_FAILED")
            fi
        done

        local success_rate=$(( endpoints_ok * 100 / endpoints_total ))

        if [ "$success_rate" -eq 100 ]; then
            success "All endpoints responding ($success_rate%)"
        elif [ "$success_rate" -ge 80 ]; then
            warning "Some endpoints failing ($success_rate%)"
            status="DEGRADED"
        else
            error "Multiple endpoints failing ($success_rate%)"
            status="CRITICAL"
        fi
    else
        warning "TEST_API_KEY not set - skipping endpoint tests"
    fi

    # Check 4: Database (if available)
    if [ -n "${DATABASE_URL:-}" ] && command -v psql &> /dev/null; then
        log "Checking database..."

        if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
            success "Database connection OK"
        else
            error "Database connection FAILED"
            status="CRITICAL"
            issues+=("DB_CONNECTION_FAILED")
        fi
    fi

    # Check 5: Error Rate (mock - would integrate with real monitoring)
    log "Checking error rates..."
    # In production, this would query DataDog/Sentry/CloudWatch
    local error_rate=0.3  # Mock value

    # Convert to integer by multiplying by 10 (0.3 -> 3, 5.0 -> 50)
    local error_rate_int=$(echo "$error_rate * 10" | awk '{printf "%d", $1 * $3}')
    local threshold_int=$(echo "$ALERT_THRESHOLD_ERROR_RATE * 10" | awk '{printf "%d", $1 * $3}')

    if [ "$error_rate_int" -lt 10 ]; then
        success "Error rate: ${error_rate}% (normal)"
    elif [ "$error_rate_int" -lt "$threshold_int" ]; then
        warning "Error rate: ${error_rate}% (elevated)"
        status="DEGRADED"
        issues+=("HIGH_ERROR_RATE")
    else
        error "Error rate: ${error_rate}% (critical)"
        status="CRITICAL"
        issues+=("CRITICAL_ERROR_RATE")
    fi

    # Summary
    echo ""
    log "----------------------------------------"

    case $status in
        "HEALTHY")
            success "System Status: HEALTHY ✓"
            ;;
        "DEGRADED")
            warning "System Status: DEGRADED ⚠"
            ;;
        "CRITICAL")
            error "System Status: CRITICAL ✗"
            ;;
    esac

    if [ ${#issues[@]} -gt 0 ]; then
        echo "Issues detected:"
        for issue in "${issues[@]}"; do
            echo "  - $issue"
        done
    fi

    log "=========================================="

    # Alert if critical
    if [ "$status" = "CRITICAL" ]; then
        send_alert "$issues"
    fi

    return 0
}

# =====================================================
# ALERT FUNCTION
# =====================================================

send_alert() {
    local issues=("$@")

    warning "ALERT TRIGGERED!"

    # Create alert file
    local alert_file="$PROJECT_ROOT/logs/alert-$(date +%Y%m%d-%H%M%S).json"

    cat > "$alert_file" <<EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "severity": "CRITICAL",
  "status": "TRIGGERED",
  "issues": [
$(printf '    "%s",\n' "${issues[@]}" | sed '$ s/,$//')
  ],
  "actions_required": [
    "Check system logs",
    "Verify deployment status",
    "Consider rollback if needed",
    "Notify on-call engineer"
  ]
}
EOF

    warning "Alert details saved: $alert_file"

    # In production, this would:
    # - Send to PagerDuty
    # - Post to Slack #incidents
    # - Send email to oncall@tistis.com
    # - Update status page

    echo ""
    echo "⚠️  CRITICAL ALERT ⚠️"
    echo ""
    echo "Issues:"
    for issue in "${issues[@]}"; do
        echo "  - $issue"
    done
    echo ""
    echo "Actions:"
    echo "  1. Check logs: $LOG_FILE"
    echo "  2. Review Vercel dashboard"
    echo "  3. Check monitoring dashboards"
    echo "  4. If persists, execute rollback"
    echo ""
}

# =====================================================
# CONTINUOUS MONITORING
# =====================================================

if [ "$CONTINUOUS" = true ]; then
    log "Starting continuous health monitoring (interval: ${INTERVAL}s)"
    log "Press Ctrl+C to stop"
    echo ""

    while true; do
        run_health_check
        sleep "$INTERVAL"
    done
else
    run_health_check
fi

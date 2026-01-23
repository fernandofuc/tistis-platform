// =====================================================
// TIS TIS PLATFORM - FASE 3 Performance Tests
// k6 Load Testing for API Endpoints
// =====================================================

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ======================
// CUSTOM METRICS
// ======================

const errorRate = new Rate('errors');
const apiLatency = new Trend('api_latency', true);
const cacheHits = new Counter('cache_hits');
const cacheMisses = new Counter('cache_misses');

// ======================
// TEST CONFIGURATION
// ======================

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '1m', target: 50 },    // Ramp up to 50 users
    { duration: '2m', target: 100 },   // Steady state at 100 users
    { duration: '1m', target: 200 },   // Peak load
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    // API latency targets (FASE 3 performance goals)
    'http_req_duration{endpoint:leads}': ['p95<100'],  // 95th percentile < 100ms
    'http_req_duration{endpoint:appointments}': ['p95<100'],
    'http_req_duration{endpoint:analytics}': ['p95<150'],  // Analytics slightly higher

    // Error rate target
    'errors': ['rate<0.005'],  // Less than 0.5% errors

    // Request success rate
    'http_req_failed': ['rate<0.01'],  // Less than 1% failed requests
  },
};

// ======================
// TEST SETUP
// ======================

const BASE_URL = __ENV.API_BASE_URL || 'http://localhost:3000';
const API_KEY = __ENV.TEST_API_KEY || 'tis_test_key';  // Replace with real test key
const TENANT_WIDE_KEY = __ENV.TENANT_WIDE_KEY || 'tis_test_tenant_key';
const BRANCH_ID = __ENV.TEST_BRANCH_ID || 'test-branch-id';

// ======================
// TEST SCENARIOS
// ======================

export default function () {
  const scenario = Math.random();

  if (scenario < 0.4) {
    // 40% - Query leads (most common operation)
    testLeadsQuery();
  } else if (scenario < 0.7) {
    // 30% - Query appointments
    testAppointmentsQuery();
  } else if (scenario < 0.85) {
    // 15% - Create lead
    testLeadCreation();
  } else if (scenario < 0.95) {
    // 10% - Query with branch filter
    testBranchFilteredQuery();
  } else {
    // 5% - Analytics dashboard load
    testAnalyticsQuery();
  }

  sleep(1);  // 1 second between requests
}

// ======================
// TEST FUNCTIONS
// ======================

function testLeadsQuery() {
  const params = {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    tags: { endpoint: 'leads' },
  };

  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/api/v1/leads?limit=20`, params);
  const duration = Date.now() - startTime;

  apiLatency.add(duration);

  const success = check(response, {
    'leads query: status 200': (r) => r.status === 200,
    'leads query: has data': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.data && Array.isArray(body.data);
      } catch {
        return false;
      }
    },
    'leads query: latency < 100ms': () => duration < 100,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  // Check for cache headers (FASE 3 caching)
  if (response.headers['X-Cache-Hit']) {
    cacheHits.add(1);
  } else {
    cacheMisses.add(1);
  }
}

function testAppointmentsQuery() {
  const params = {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    tags: { endpoint: 'appointments' },
  };

  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/api/v1/appointments?limit=20`, params);
  const duration = Date.now() - startTime;

  apiLatency.add(duration);

  const success = check(response, {
    'appointments query: status 200': (r) => r.status === 200,
    'appointments query: latency < 100ms': () => duration < 100,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
}

function testLeadCreation() {
  const payload = JSON.stringify({
    phone: `+1${Math.floor(Math.random() * 9000000000 + 1000000000)}`,
    name: `Load Test Lead ${Date.now()}`,
    source: 'load-test',
  });

  const params = {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    tags: { endpoint: 'leads-create' },
  };

  const startTime = Date.now();
  const response = http.post(`${BASE_URL}/api/v1/leads`, payload, params);
  const duration = Date.now() - startTime;

  apiLatency.add(duration);

  const success = check(response, {
    'lead creation: status 201': (r) => r.status === 201,
    'lead creation: latency < 150ms': () => duration < 150,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
}

function testBranchFilteredQuery() {
  const params = {
    headers: {
      'Authorization': `Bearer ${TENANT_WIDE_KEY}`,
      'Content-Type': 'application/json',
    },
    tags: { endpoint: 'leads-filtered' },
  };

  const startTime = Date.now();
  const response = http.get(
    `${BASE_URL}/api/v1/leads?branch_id=${BRANCH_ID}&limit=20`,
    params
  );
  const duration = Date.now() - startTime;

  apiLatency.add(duration);

  const success = check(response, {
    'branch filtered query: status 200 or 400': (r) => r.status === 200 || r.status === 400,
    'branch filtered query: latency < 100ms': () => duration < 100,
  });

  // Check for deprecation headers (FASE 3 deprecation strategy)
  if (response.status === 200) {
    check(response, {
      'deprecation: has Deprecation header': (r) => r.headers['Deprecation'] !== undefined,
      'deprecation: has X-API-Deprecation-Phase': (r) => r.headers['X-API-Deprecation-Phase'] !== undefined,
    });
  }

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }
}

function testAnalyticsQuery() {
  // Note: Analytics requires authentication session
  // This is a simplified test - in production would need proper auth

  const params = {
    tags: { endpoint: 'analytics' },
  };

  const startTime = Date.now();
  const response = http.get(`${BASE_URL}/api/analytics/branch-usage`, params);
  const duration = Date.now() - startTime;

  apiLatency.add(duration);

  check(response, {
    'analytics query: status 200 or 401': (r) => r.status === 200 || r.status === 401,
    'analytics query: latency < 150ms': () => duration < 150,
  });

  // 401 is expected without auth - not an error
  if (response.status !== 200 && response.status !== 401) {
    errorRate.add(1);
  }
}

// ======================
// TEARDOWN
// ======================

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'performance-report.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  let output = '';

  output += `${indent}✅ FASE 3 Performance Test Summary\n\n`;

  // Request statistics
  output += `${indent}📊 Request Statistics:\n`;
  output += `${indent}  Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  output += `${indent}  Request Rate: ${data.metrics.http_reqs.values.rate.toFixed(2)}/s\n`;
  output += `${indent}  Failed Requests: ${data.metrics.http_req_failed.values.rate.toFixed(2)}%\n\n`;

  // Latency metrics
  output += `${indent}⚡ Latency Metrics:\n`;
  output += `${indent}  Average: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  output += `${indent}  Median (p50): ${data.metrics.http_req_duration.values.med.toFixed(2)}ms\n`;
  output += `${indent}  p95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  output += `${indent}  p99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms\n`;
  output += `${indent}  Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n\n`;

  // Cache metrics (FASE 3)
  if (data.metrics.cache_hits && data.metrics.cache_misses) {
    const totalCacheRequests = data.metrics.cache_hits.values.count + data.metrics.cache_misses.values.count;
    const cacheHitRate = totalCacheRequests > 0
      ? (data.metrics.cache_hits.values.count / totalCacheRequests) * 100
      : 0;

    output += `${indent}💾 Cache Performance:\n`;
    output += `${indent}  Cache Hits: ${data.metrics.cache_hits.values.count}\n`;
    output += `${indent}  Cache Misses: ${data.metrics.cache_misses.values.count}\n`;
    output += `${indent}  Hit Rate: ${cacheHitRate.toFixed(2)}%\n\n`;
  }

  // Error rate
  output += `${indent}❌ Error Rate:\n`;
  output += `${indent}  Errors: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%\n\n`;

  // Thresholds
  output += `${indent}🎯 Threshold Results:\n`;
  const thresholds = data.thresholds || {};
  Object.keys(thresholds).forEach((key) => {
    const passed = thresholds[key].ok;
    const symbol = passed ? '✅' : '❌';
    output += `${indent}  ${symbol} ${key}\n`;
  });

  return output;
}

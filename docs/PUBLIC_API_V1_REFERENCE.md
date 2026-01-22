# TIS TIS Platform - Public API v1 Reference

**Version:** 1.2.0
**Last Updated:** 2026-01-22
**FASE 2:** Branch-specific API Keys with automatic filtering

---

## Base URL

```
https://api.tistis.com/v1
```

## Authentication

All API v1 endpoints require authentication using API Keys.

### API Key Authentication

Include your API Key in the Authorization header:

```http
Authorization: Bearer tis_live_xxxxxxxxxxxxxxxx
```

### Obtaining API Keys

API Keys can be created from your TIS TIS dashboard:

1. Go to **Settings > API Keys**
2. Click **"Create New API Key"**
3. **NEW in v1.2.0:** Choose API Key scope:
   - **Branch-specific:** Automatically filters data to a single branch
   - **Tenant-wide:** Access to all branches (requires query parameter for filtering)
4. Select required permissions
5. Copy the key securely (it won't be shown again)

---

## Rate Limiting

API requests are rate-limited per API Key:

| Plan | Rate Limit |
|------|------------|
| Free | 100 requests/minute |
| Basic | 500 requests/minute |
| Pro | 2,000 requests/minute |
| Enterprise | Custom |

### Rate Limit Headers

All responses include rate limit information:

```http
X-RateLimit-Limit: 500
X-RateLimit-Remaining: 487
X-RateLimit-Reset: 1703620860000
```

When rate limit is exceeded, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": "Rate limit exceeded",
  "code": "RATE_LIMIT_EXCEEDED",
  "retry_after": 30
}
```

---

## Multi-Branch Filtering

**NEW in v1.2.0:** Automatic branch filtering with branch-specific API Keys

TIS TIS supports two methods for branch filtering:

### Method 1: Branch-Specific API Keys (FASE 2 - Recommended)

**Automatic filtering:** When you create a branch-specific API Key, all requests automatically filter to that branch.

```bash
# Using a branch-specific API Key
# Automatically returns data ONLY from the branch assigned to the key
curl -X GET 'https://api.tistis.com/v1/leads' \
  -H 'Authorization: Bearer tis_live_branch_xxxxx'
```

**Benefits:**
- ✅ No need for query parameters
- ✅ Impossible to accidentally access other branches
- ✅ Perfect for integrations that should only access one branch
- ✅ Improved security through automatic scoping

### Method 2: Query Parameter Filtering (FASE 1 - Backward Compatible)

**Manual filtering:** Use the `branch_id` query parameter with a tenant-wide API Key.

```bash
# Get leads from all branches (⚠️ mixed data)
curl -X GET 'https://api.tistis.com/v1/leads' \
  -H 'Authorization: Bearer tis_live_tenant_xxxxx'

# Get leads from specific branch using query parameter
curl -X GET 'https://api.tistis.com/v1/leads?branch_id=550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer tis_live_tenant_xxxxx'
```

### Filtering Priority & Security

**IMPORTANT - Security Behavior:**

#### For Branch-Specific API Keys:
- ✅ **Query parameters are IGNORED** (security enforcement)
- ✅ Always filters to the branch assigned to the API Key
- ✅ Prevents cross-branch data access
- ✅ Cannot be bypassed

**Example:**

```bash
# Branch-specific key for Branch A, with query param for Branch B
# Result: Returns Branch A data ONLY (query param ignored for security)
curl -X GET 'https://api.tistis.com/v1/leads?branch_id=branch-b-uuid' \
  -H 'Authorization: Bearer tis_live_branch_a_xxxxx'
# ⚠️ Query parameter is ignored - returns Branch A leads only
```

#### For Tenant-Wide API Keys:
- ✅ Query parameter is respected (backward compatibility)
- ✅ No query param = returns data from all branches
- ✅ With query param = filters to specified branch

**Priority Order (Tenant-wide keys only):**

1. **Query Parameter** (`?branch_id=xxx`) - if provided
2. **No Filter** (all branches) - if no query param

```bash
# Tenant-wide key with query param
# Result: Returns Branch B data (query param respected)
curl -X GET 'https://api.tistis.com/v1/leads?branch_id=branch-b-uuid' \
  -H 'Authorization: Bearer tis_live_tenant_xxxxx'
```

If you have multiple branches but don't provide `branch_id`, you'll receive a warning:

```http
X-Branch-Filter-Warning: This tenant has multiple branches but no branch_id was provided. Data from all branches is included. Consider adding ?branch_id=xxx to filter.
```

---

## Endpoints

## GET /v1/leads

Retrieve a list of leads for your organization.

### Authentication

Requires API Key with `leads:read` scope.

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `branch_id` | UUID | No | Filter leads by specific branch. **Recommended for multi-branch organizations.** |
| `page` | integer | No | Page number (default: 1) |
| `pageSize` | integer | No | Results per page (default: 20, max: 100) |
| `status` | string | No | Filter by lead status (`new`, `contacted`, `qualified`, `lost`) |
| `search` | string | No | Search in phone, name, or email |

### Request Example

```bash
# Get all leads (all branches)
curl -X GET 'https://api.tistis.com/v1/leads' \
  -H 'Authorization: Bearer tis_live_xxxxx'

# Get leads from specific branch (RECOMMENDED for multi-branch)
curl -X GET 'https://api.tistis.com/v1/leads?branch_id=550e8400-e29b-41d4-a716-446655440000' \
  -H 'Authorization: Bearer tis_live_xxxxx'

# With filters and pagination
curl -X GET 'https://api.tistis.com/v1/leads?branch_id=550e8400-e29b-41d4-a716-446655440000&status=new&page=1&pageSize=50' \
  -H 'Authorization: Bearer tis_live_xxxxx'
```

### Response Example

```json
{
  "data": [
    {
      "id": "lead-uuid-1",
      "tenant_id": "tenant-uuid",
      "branch_id": "branch-uuid",
      "phone": "+5215512345678",
      "name": "Juan Pérez",
      "email": "juan@example.com",
      "status": "new",
      "classification": "hot",
      "source": "whatsapp",
      "created_at": "2026-01-22T10:30:00Z",
      "updated_at": "2026-01-22T10:30:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20,
  "filters": {
    "branch_id": "branch-uuid",
    "status": "new",
    "search": null
  }
}
```

### Response Headers

| Header | Description |
|--------|-------------|
| `X-Filtered-Branch-ID` | UUID of the branch used for filtering (if provided) |
| `X-Branch-Filter-Warning` | Warning message if tenant has multiple branches but no `branch_id` was provided |
| `X-RateLimit-Limit` | Maximum requests allowed per window |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Unix timestamp when rate limit resets |

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_BRANCH_ID` | 400 | The `branch_id` parameter is not a valid UUID |
| `BRANCH_ACCESS_DENIED` | 403 | The specified branch does not belong to your organization |
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `DATABASE_ERROR` | 500 | Internal server error |

---

## POST /v1/leads

Create a new lead.

### Authentication

Requires API Key with `leads:write` scope.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `phone` | string | Yes | Phone number (E.164 format recommended) |
| `name` | string | No | Full name of the lead |
| `email` | string | No | Email address |
| `source` | string | No | Source of the lead (default: "api") |

### Request Example

```bash
curl -X POST 'https://api.tistis.com/v1/leads' \
  -H 'Authorization: Bearer tis_live_xxxxx' \
  -H 'Content-Type: application/json' \
  -d '{
    "phone": "+5215512345678",
    "name": "María García",
    "email": "maria@example.com",
    "source": "website"
  }'
```

### Response Example

```json
{
  "data": {
    "id": "lead-uuid",
    "tenant_id": "tenant-uuid",
    "phone": "+5215512345678",
    "name": "María García",
    "email": "maria@example.com",
    "status": "new",
    "source": "website",
    "created_at": "2026-01-22T10:30:00Z"
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid phone format or missing required fields |
| `DUPLICATE_LEAD` | 409 | A lead with this phone number already exists |
| `UNAUTHORIZED` | 401 | Invalid or missing API key |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

---

## Best Practices

### Multi-Branch Organizations

⚠️ **Important:** If your organization has multiple branches and you don't provide `branch_id`, the response will include leads from **all branches**.

```javascript
// ✅ Good: Filter by branch for multi-branch orgs
const leads = await fetch('/v1/leads?branch_id=branch-uuid', {
  headers: { Authorization: `Bearer ${apiKey}` }
});

// ⚠️ Avoid: Mixing data from all branches
const leads = await fetch('/v1/leads', {
  headers: { Authorization: `Bearer ${apiKey}` }
});
// This returns leads from ALL branches!
```

### Rate Limiting

Implement exponential backoff when receiving `429` responses:

```javascript
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(url, options);

    if (response.status !== 429) {
      return response;
    }

    const retryAfter = response.headers.get('Retry-After') || 30;
    await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
  }

  throw new Error('Max retries exceeded');
}
```

### Pagination

Always use pagination for large datasets:

```javascript
async function fetchAllLeads(branchId) {
  const allLeads = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `/v1/leads?branch_id=${branchId}&page=${page}&pageSize=100`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );

    const data = await response.json();
    allLeads.push(...data.data);

    hasMore = data.data.length === data.pageSize;
    page++;
  }

  return allLeads;
}
```

---

## Error Handling

All errors follow a consistent format:

```json
{
  "error": "Error description",
  "code": "ERROR_CODE"
}
```

### Common Error Codes

| Code | HTTP Status | Description | Solution |
|------|-------------|-------------|----------|
| `UNAUTHORIZED` | 401 | Invalid or missing API key | Check your API key |
| `INVALID_SCOPE` | 403 | API key lacks required scope | Create key with correct scope |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests | Implement exponential backoff |
| `INVALID_BRANCH_ID` | 400 | Branch ID format invalid | Use valid UUID v4 |
| `BRANCH_ACCESS_DENIED` | 403 | Branch doesn't belong to tenant | Verify branch ID ownership |
| `VALIDATION_ERROR` | 400 | Invalid input data | Check request format |
| `DATABASE_ERROR` | 500 | Internal server error | Retry or contact support |

---

## Integration Examples

### Node.js (with TypeScript)

```typescript
import fetch from 'node-fetch';

const TISTIS_API_KEY = process.env.TISTIS_API_KEY!;
const BRANCH_ID = process.env.TISTIS_BRANCH_ID!;

interface Lead {
  id: string;
  phone: string;
  name?: string;
  email?: string;
  status: string;
  created_at: string;
}

interface LeadsResponse {
  data: Lead[];
  total: number;
  page: number;
  pageSize: number;
}

async function getLeads(branchId: string, page: number = 1): Promise<LeadsResponse> {
  const response = await fetch(
    `https://api.tistis.com/v1/leads?branch_id=${branchId}&page=${page}`,
    {
      headers: {
        'Authorization': `Bearer ${TISTIS_API_KEY}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  return response.json();
}

async function createLead(phone: string, name: string, email?: string): Promise<Lead> {
  const response = await fetch('https://api.tistis.com/v1/leads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TISTIS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ phone, name, email, source: 'api' }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }

  const result = await response.json();
  return result.data;
}

// Usage
(async () => {
  const leads = await getLeads(BRANCH_ID);
  console.log(`Found ${leads.total} leads`);

  const newLead = await createLead('+5215512345678', 'Test Lead');
  console.log(`Created lead: ${newLead.id}`);
})();
```

### Python

```python
import requests
import os

TISTIS_API_KEY = os.environ.get('TISTIS_API_KEY')
BRANCH_ID = os.environ.get('TISTIS_BRANCH_ID')
BASE_URL = 'https://api.tistis.com/v1'

def get_leads(branch_id, page=1):
    response = requests.get(
        f'{BASE_URL}/leads',
        params={'branch_id': branch_id, 'page': page},
        headers={'Authorization': f'Bearer {TISTIS_API_KEY}'}
    )
    response.raise_for_status()
    return response.json()

def create_lead(phone, name, email=None):
    data = {
        'phone': phone,
        'name': name,
        'source': 'api'
    }
    if email:
        data['email'] = email

    response = requests.post(
        f'{BASE_URL}/leads',
        json=data,
        headers={
            'Authorization': f'Bearer {TISTIS_API_KEY}',
            'Content-Type': 'application/json'
        }
    )
    response.raise_for_status()
    return response.json()['data']

# Usage
if __name__ == '__main__':
    leads = get_leads(BRANCH_ID)
    print(f"Found {leads['total']} leads")

    new_lead = create_lead('+5215512345678', 'Test Lead')
    print(f"Created lead: {new_lead['id']}")
```

### Zapier Integration

When connecting TIS TIS to Zapier:

1. **Action:** Create Lead
2. **API Key:** Add your API Key in "API Key" field
3. **Branch ID (optional):** Add your branch ID for branch-specific data

**Example Zap:**
```
Trigger: New Google Form Response
Action: Create Lead in TIS TIS
  - Phone: {{form_phone}}
  - Name: {{form_name}}
  - Email: {{form_email}}
  - Source: "google_forms"
```

---

## Security

### API Key Security

- **Never expose API keys in client-side code**
- Use environment variables to store keys
- Rotate keys regularly
- Use different keys for different environments (dev/staging/prod)
- Revoke compromised keys immediately

### HTTPS Only

All API requests must use HTTPS. HTTP requests will be rejected.

### Input Validation

- Phone numbers are validated (7-20 characters)
- UUIDs are validated against UUID v4 format
- SQL injection protection is built-in
- XSS prevention via input sanitization

---

## Changelog

### v1.2.0 - 2026-01-22 (FASE 2)

**Major:** Branch-specific API Keys with automatic filtering

**Added:**
- ✅ Branch-specific API Keys (`scope_type: 'branch'`)
- ✅ Automatic branch filtering based on API Key scope
- ✅ Priority-based filtering (query param > API Key branch > tenant-wide)
- ✅ Database constraints for branch scope consistency
- ✅ Trigger for automatic branch_context population
- ✅ RPC function `api_key_has_branch_access()` for access validation
- ✅ View `api_keys_with_branch_info` for denormalized queries

**Security:**
- ✅ Branch-specific keys cannot access other branches (enforced at API Key level)
- ✅ Database-level validation prevents misconfigured keys
- ✅ Improved isolation for multi-branch organizations

**Migration:**
- ✅ Backward compatible with FASE 1 query parameter approach
- ✅ Existing API Keys default to `scope_type: 'tenant'`
- ✅ Zero downtime migration

**UI:**
- ✅ New API Key creation flow with branch selection
- ✅ Branch badges in API Keys list
- ✅ Visual distinction between tenant-wide and branch-specific keys

### v1.1.0 - 2026-01-22 (FASE 1)

**Added:**
- ✅ Branch filtering via `branch_id` query parameter on GET endpoints
- ✅ Informational headers (`X-Filtered-Branch-ID`, `X-Branch-Filter-Warning`)
- ✅ Branch ownership validation (403 if branch doesn't belong to tenant)
- ✅ UUID validation for `branch_id` parameter with length check

**Security:**
- ✅ Branch access control prevents cross-tenant access
- ✅ SQL injection protection on all query parameters
- ✅ ReDoS prevention via UUID length validation (36 chars max)

**Performance:**
- ✅ Optimized query order (filters before sorting/pagination)
- ✅ Conditional Supabase client creation (only when needed)
- ✅ Skip multi-branch check when branch_id is provided (~15ms saved)

### v1.0.0 - 2026-01-01

- Initial API v1 release
- Leads endpoints (GET, POST)
- API Key authentication
- Rate limiting
- Multi-tenant support

---

## Support

**Documentation:** https://docs.tistis.com/api
**Email:** soporte@tistis.com
**Status Page:** https://status.tistis.com

For API issues or questions, contact our support team with:
- Your tenant ID
- API Key ID (not the key itself)
- Request/response examples
- Error messages

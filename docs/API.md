# TIS TIS Platform - API Documentation

## Overview

TIS TIS Platform provides a comprehensive REST API for managing dental clinic operations, including leads, patients, appointments, and AI-powered features.

## Base URL

- **Development:** `http://localhost:3000/api`
- **Production:** `https://your-domain.com/api`

## Authentication

All API endpoints (except webhooks) require authentication via Bearer token.

```http
Authorization: Bearer <access_token>
```

The access token is obtained from Supabase Auth after login.

## Rate Limiting

API endpoints are rate-limited to prevent abuse:

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Standard APIs | 100 requests | 1 minute |
| Auth Endpoints | 10 requests | 1 minute |
| AI Endpoints | 30 requests | 1 minute |
| Upload Endpoints | 10 requests | 1 minute |
| Webhooks | 500 requests | 1 minute |

Rate limit headers are included in all responses:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1703620800000
```

## Endpoints

### Leads

#### GET /api/leads

Fetch paginated leads with optional filtering.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | number | Page number (default: 1) |
| `pageSize` | number | Items per page (default: 20) |
| `classification` | string | Filter by classification (hot, warm, cold, lost) |
| `status` | string | Filter by status |
| `search` | string | Search in name, phone, email |
| `sortBy` | string | Sort field (default: score) |
| `sortOrder` | string | asc or desc (default: desc) |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "full_name": "John Doe",
      "phone": "+52 555 123 4567",
      "email": "john@example.com",
      "classification": "hot",
      "score": 85,
      "status": "active",
      "created_at": "2024-01-01T00:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

#### POST /api/leads

Create a new lead.

**Request Body:**

```json
{
  "phone": "+52 555 123 4567",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "source": "whatsapp",
  "classification": "warm"
}
```

---

### Patients

#### GET /api/patients

Fetch paginated patients.

**Query Parameters:** Same as leads.

#### POST /api/patients

Create a new patient.

#### GET /api/patients/:id

Get patient details.

#### PATCH /api/patients/:id

Update patient information.

---

### Appointments

#### GET /api/appointments

Fetch appointments with date filtering.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | ISO date | Start of date range |
| `endDate` | ISO date | End of date range |
| `status` | string | Filter by status |
| `branch_id` | uuid | Filter by branch |

#### POST /api/appointments

Create a new appointment.

#### PATCH /api/appointments/:id

Update appointment (reschedule, cancel, etc.)

---

### Voice Agent

#### GET /api/voice-agent

Get voice agent configuration and status.

#### POST /api/voice-agent

Update voice agent configuration.

#### POST /api/voice-agent/phone-numbers

Request a new phone number.

#### GET /api/voice-agent/calls

Get call history.

---

### AI Endpoints

#### POST /api/discovery/stream

AI-powered discovery chat (streaming).

#### POST /api/ai/insights

Generate business insights.

---

### Webhooks

#### POST /api/webhook

Multi-channel webhook handler (WhatsApp, Instagram, Facebook, TikTok).

#### POST /api/webhook/vapi

VAPI voice agent webhook.

#### POST /api/stripe/webhook

Stripe payment webhook.

---

## Error Responses

All errors follow a consistent format:

```json
{
  "success": false,
  "error": "Error description",
  "details": {}
}
```

### HTTP Status Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |

---

## Security

### Headers

All responses include security headers:

```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Referrer-Policy: strict-origin-when-cross-origin
```

### Input Validation

- All inputs are sanitized to prevent XSS
- UUIDs are validated before database queries
- Email and phone formats are validated

### Multi-Tenant Security

- Row Level Security (RLS) ensures data isolation
- All queries are scoped to the authenticated user's tenant
- Cross-tenant access is prevented at the database level

---

## Examples

### cURL

```bash
# Get leads
curl -X GET "https://api.tistis.com/api/leads?page=1&classification=hot" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Create appointment
curl -X POST "https://api.tistis.com/api/appointments" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "uuid",
    "branch_id": "uuid",
    "scheduled_at": "2024-01-15T10:00:00Z",
    "type": "consultation",
    "notes": "First visit"
  }'
```

### JavaScript (fetch)

```javascript
const response = await fetch('/api/leads', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  },
});

const data = await response.json();
```

---

## Changelog

### v1.0.0 (Current)

- Initial API release
- Multi-tenant support with RLS
- Voice agent integration
- Multi-channel messaging
- AI-powered insights

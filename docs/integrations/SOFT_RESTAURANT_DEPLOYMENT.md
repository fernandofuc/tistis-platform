# SoftRestaurant Integration - Deployment Guide

**Version:** 1.0.0
**Date:** 2026-01-22
**Status:** Production Ready

## Deployment Checklist

### 1. Database Migrations

Run migrations in order:

```bash
# Navigate to project directory
cd /path/to/tistis-platform

# Run migrations
supabase db push

# Verify migrations
supabase db diff
```

**Required Migrations:**
- ✅ 156_SOFT_RESTAURANT_INTEGRATION_V5_PERFECT.sql (Base tables)
- ✅ 157_SR_INTEGRATION_V51_MULTI_TENANT_PERFECT.sql (Multi-tenant isolation)
- ✅ 158_SR_V52_ABSOLUTE_FINAL.sql (Final corrections)
- ✅ 159_SR_BACKEND_HELPER_FUNCTIONS.sql (Helper functions)

### 2. Environment Variables

Ensure the following environment variables are set:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Backend Deployment

```bash
# Install dependencies
npm install

# Build project
npm run build

# Deploy to Vercel/Platform
vercel --prod
```

### 4. Integration Setup (Per Branch)

For each restaurant branch that needs SR integration:

1. **Login** to TIS TIS Platform as Admin/Owner
2. Navigate to **Settings** → **Integrations**
3. Click **Add Integration**
4. Select **SoftRestaurant**
5. Fill in details:
   - Connection Name: "SR - [Branch Name]"
   - Branch: Select branch
   - Sync Direction: Inbound
   - Enable: Orders, Inventory
6. Copy the generated **API Key**
7. Configure SoftRestaurant webhook:
   - URL: `https://your-domain.com/api/soft-restaurant/webhook`
   - Method: POST
   - Headers:
     - `Content-Type: application/json`
     - `Authorization: Bearer YOUR_API_KEY`

### 5. Product Mapping Setup

**Initial Product Mapping:**

1. Send test sale from SoftRestaurant
2. Check unmapped products:
   ```sql
   SELECT * FROM get_unmapped_sr_products('tenant-id', 'branch-id', 20);
   ```
3. Map products manually in Integration Hub UI (TODO: Build UI)
4. Or insert directly:
   ```sql
   INSERT INTO sr_product_mappings (
     tenant_id, branch_id, integration_id,
     sr_product_code, sr_product_name, menu_item_id,
     mapping_confidence, is_active
   ) VALUES (
     'tenant-uuid', 'branch-uuid', 'integration-uuid',
     'PROD-001', 'Hamburguesa Clásica', 'menu-item-uuid',
     'manual', true
   );
   ```

### 6. Recipe Configuration

For inventory deduction to work:

1. Navigate to **Menu** → **Recipes**
2. For each menu item, create recipe with ingredients
3. Set correct quantities per portion
4. Link to inventory items

**Example:**
- Menu Item: "Hamburguesa Clásica"
- Recipe Yield: 1 portion
- Ingredients:
  - Carne molida: 150g
  - Pan: 1 pieza
  - Queso: 30g
  - Lechuga: 20g
  - etc.

### 7. Processing Configuration

**Option A: Manual Processing (Initial deployment)**

Process pending sales manually via API:

```bash
# Process all pending
curl -X GET 'https://your-domain.com/api/soft-restaurant/process?limit=50' \
  -H 'Authorization: Bearer USER_JWT_TOKEN'

# Process specific sale
curl -X POST https://your-domain.com/api/soft-restaurant/process \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer USER_JWT_TOKEN' \
  -d '{"sale_id": "sale-uuid"}'
```

**Option B: Automated Processing (Recommended for production)**

Set up cron job or Vercel cron:

```javascript
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/process-sr-sales",
      "schedule": "*/5 * * * *"  // Every 5 minutes
    }
  ]
}
```

Create endpoint: `/app/api/cron/process-sr-sales/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { SoftRestaurantProcessor } from '@/src/features/integrations/services/soft-restaurant-processor';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get pending sales (all tenants)
  const { data: pendingSales } = await supabase
    .from('sr_sales')
    .select('id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(50);

  if (!pendingSales || pendingSales.length === 0) {
    return NextResponse.json({ message: 'No pending sales' });
  }

  const processor = new SoftRestaurantProcessor();
  let successful = 0;
  let failed = 0;

  for (const sale of pendingSales) {
    const result = await processor.processSale(sale.id);
    if (result.success) {
      successful++;
    } else {
      failed++;
    }
  }

  return NextResponse.json({
    processed: pendingSales.length,
    successful,
    failed,
  });
}
```

### 8. Monitoring Setup

**Dashboard Queries:**

```sql
-- Pending sales count
SELECT COUNT(*) FROM sr_sales WHERE status = 'pending';

-- Processing success rate (last 24h)
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM sr_sales
WHERE created_at >= NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Unmapped products
SELECT COUNT(*) FROM sr_product_mappings WHERE menu_item_id IS NULL;

-- Low stock items (after recent sales)
SELECT * FROM inventory_items
WHERE current_stock <= minimum_stock
ORDER BY current_stock ASC
LIMIT 20;
```

**Alerts:**

Set up alerts for:
- Pending sales > 100
- Failed sales rate > 10%
- Unmapped products > 20
- Low stock items

### 9. Testing

**Test Webhook:**

```bash
curl -X POST https://your-domain.com/api/soft-restaurant/webhook \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_API_KEY' \
  -d @test-sale.json
```

See `src/features/integrations/tests/soft-restaurant-webhook.test.json` for test payloads.

**Verify Results:**

```sql
-- Check registered sale
SELECT * FROM sr_sales ORDER BY created_at DESC LIMIT 1;

-- Check sale items
SELECT * FROM sr_sale_items WHERE sale_id = 'sale-uuid';

-- Check payments
SELECT * FROM sr_payments WHERE sale_id = 'sale-uuid';

-- Check sync log
SELECT * FROM sr_sync_logs ORDER BY started_at DESC LIMIT 1;
```

### 10. Rollback Plan

If issues arise:

```sql
-- Disable integration (stop receiving webhooks)
UPDATE integration_connections
SET status = 'paused'
WHERE integration_type IN ('softrestaurant', 'softrestaurant_import');

-- Revert processing for specific sale
UPDATE sr_sales
SET status = 'pending', restaurant_order_id = NULL
WHERE id = 'problematic-sale-uuid';

-- Delete associated restaurant order
DELETE FROM restaurant_orders WHERE sr_sale_id = 'problematic-sale-uuid';

-- Restore inventory (manual - complex)
-- Review inventory_movements and reverse deductions
```

### 11. Go-Live

1. ✅ All migrations applied
2. ✅ Test webhook successful
3. ✅ Product mappings configured
4. ✅ Recipes configured
5. ✅ Processing working (manual or automated)
6. ✅ Monitoring dashboard ready
7. ✅ Team trained on troubleshooting

**Enable Integration:**

```sql
UPDATE integration_connections
SET status = 'connected'
WHERE integration_type = 'softrestaurant'
  AND tenant_id = 'your-tenant-uuid';
```

## Post-Deployment

### Daily Tasks

- Review failed sales
- Map new unmapped products
- Monitor inventory accuracy

### Weekly Tasks

- Review processing success rate
- Optimize product mappings
- Update recipes as menu changes

### Monthly Tasks

- Audit inventory accuracy vs physical count
- Review integration performance metrics
- Update documentation

## Troubleshooting

See [SOFT_RESTAURANT_API.md](./SOFT_RESTAURANT_API.md) for detailed API documentation and error handling.

**Common Issues:**

1. **Webhook not receiving**: Check API key, integration status
2. **Validation errors**: Review payload structure
3. **Unmapped products**: Create product mappings
4. **Missing recipes**: Add recipes to menu items
5. **Negative inventory**: Configure `allowNegativeStock` or adjust stock levels

## Support

For deployment support: support@tistis.app

---

**Deployment Status:** ✅ Ready for Production

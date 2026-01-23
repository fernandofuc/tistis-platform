# FASE 4: INTEGRATION GAPS & RECOMMENDATIONS

**Date:** 2026-01-22
**Status:** 🟡 **ACTION REQUIRED**

---

## 🔴 CRITICAL INTEGRATION GAP

### Gap #1: `inventory_items` vs `restaurant_menu_items` Disconnect

**Problem:**

FASE 4 implemented a complete `inventory_items` management system, but **LangGraph ordering system uses `restaurant_menu_items.is_available`** which is NOT synchronized with inventory stock levels.

**Current State:**

```
inventory_items table:
- current_stock: 0 kg (harina agotada)
- minimum_stock: 10 kg
- stockStatus: 'out_of_stock'

restaurant_menu_items table:
- is_available: true (manual flag)
- name: "Pizza Margherita"
- price: 150.00

LangGraph reads: is_available = true
AI Response: "¡Claro! Tu pizza estará lista en 30 minutos"
Kitchen: ❌ No hay harina
```

**Impact:**

- 🚨 AI confirms orders for unavailable items
- 🚨 Kitchen receives orders they can't fulfill
- 🚨 Customers get angry
- 🚨 Manager updates inventory but AI ignores it

**Recommended Solutions:**

### Solution A: Add foreign key + computed field (RECOMMENDED)

**Migration needed:**

```sql
-- 1. Add FK to menu_items
ALTER TABLE restaurant_menu_items
ADD COLUMN inventory_item_id UUID REFERENCES inventory_items(id);

-- 2. Create computed view or function
CREATE OR REPLACE FUNCTION get_menu_item_availability(p_menu_item_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_inventory_id UUID;
  v_current_stock NUMERIC;
  v_minimum_stock NUMERIC;
BEGIN
  -- Get linked inventory item
  SELECT inventory_item_id INTO v_inventory_id
  FROM restaurant_menu_items
  WHERE id = p_menu_item_id;

  -- If no inventory link, use manual flag
  IF v_inventory_id IS NULL THEN
    RETURN (SELECT is_available FROM restaurant_menu_items WHERE id = p_menu_item_id);
  END IF;

  -- Check inventory stock
  SELECT current_stock, minimum_stock INTO v_current_stock, v_minimum_stock
  FROM inventory_items
  WHERE id = v_inventory_id;

  -- Available if stock > 0
  RETURN v_current_stock > 0;
END;
$$ LANGUAGE plpgsql;

-- 3. Update LangGraph to use function
-- In langgraph-ai.service.ts:545-598
-- Replace is_available with:
-- get_menu_item_availability(id) as is_available
```

**Benefits:**
- ✅ Real-time sync
- ✅ No manual updates needed
- ✅ Automatic AI blocking when stock = 0

### Solution B: Trigger-based sync (Alternative)

```sql
-- Trigger to update menu_items.is_available when inventory changes
CREATE OR REPLACE FUNCTION sync_menu_availability()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE restaurant_menu_items
  SET is_available = (NEW.current_stock > 0)
  WHERE inventory_item_id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_sync_trigger
AFTER UPDATE OF current_stock ON inventory_items
FOR EACH ROW
EXECUTE FUNCTION sync_menu_availability();
```

**Benefits:**
- ✅ Simpler for LangGraph (no query change)
- ❌ Requires FK migration first
- ❌ Potential race conditions

### Solution C: RPC enhancement (Temporary fix)

Update `validate_order_stock()` RPC to check BOTH:
- Current recipe ingredient requirements
- Menu item manual flag

**Benefits:**
- ✅ No schema changes
- ❌ Doesn't prevent AI from saying "yes" initially
- ❌ Only validates at order creation time

---

## 🟡 RECOMMENDED ACTION PLAN

### Phase 1: Immediate (This Week)
1. Add `inventory_item_id` FK to `restaurant_menu_items` table
2. Create mapping UI for managers to link menu items → inventory items
3. Implement `get_menu_item_availability()` function

### Phase 2: LangGraph Integration (Next Week)
1. Update `langgraph-ai.service.ts:loadRestaurantMenu()` to use computed availability
2. Update ordering agent to check inventory before confirming
3. Add real-time inventory alerts to AI context

### Phase 3: UI Enhancements (Future)
1. Show inventory status in menu item cards
2. Auto-disable menu items when stock = 0
3. Manager notifications when AI blocks orders due to stock

---

## 📊 FILES AFFECTED

### Backend:
- `supabase/migrations/XXX_LINK_MENU_INVENTORY.sql` (new)
- `src/features/ai/services/langgraph-ai.service.ts:545-598`
- `src/features/ai/agents/specialists/ordering.agent.ts`

### Frontend:
- `src/features/inventory-management/` (already done ✅)
- `src/features/restaurant-kitchen/` (menu management UI)

### Database:
- Table: `restaurant_menu_items` (+1 column)
- Function: `get_menu_item_availability()` (new)
- Trigger: `inventory_sync_trigger` (optional)

---

## 🎯 SUCCESS CRITERIA

- ✅ AI cannot confirm orders for out-of-stock items
- ✅ Manager updates inventory → AI immediately knows
- ✅ Menu items auto-disable when stock = 0
- ✅ Zero manual syncing required
- ✅ Real-time updates across all channels (WhatsApp, voice, web)

---

**Next Steps:** Create migration XXX_LINK_MENU_INVENTORY.sql

**Owner:** Backend team + AI team collaboration required

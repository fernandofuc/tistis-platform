#!/usr/bin/env tsx
/**
 * TIS TIS Platform - Soft Restaurant Integration
 * Test Data Seeding Script
 *
 * Inserta datos de prueba para facilitar el desarrollo y testing
 * de la integración con Soft Restaurant.
 *
 * Usage:
 *   npx tsx scripts/migration/seed-sr-test-data.ts [--clean]
 *
 * Options:
 *   --clean       Eliminar datos existentes antes de insertar
 *
 * @module scripts/migration/seed-sr-test-data
 */

import { createClient } from '@supabase/supabase-js';

// =====================================================
// CONFIGURATION
// =====================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CLEAN_BEFORE_SEED = process.argv.includes('--clean');

// =====================================================
// MAIN FUNCTION
// =====================================================

async function main() {
  console.log('🌱 TIS TIS - Soft Restaurant Test Data Seeding\n');
  console.log('='.repeat(70));

  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing Supabase credentials');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('✅ Connected to Supabase\n');

  try {
    // Get first tenant and branch for testing
    const { tenant, branch } = await getTestTenantAndBranch(supabase);

    if (!tenant || !branch) {
      console.error('❌ Error: No tenant or branch found in database');
      console.error('   Please create a tenant and branch first');
      process.exit(1);
    }

    console.log(`📍 Using Tenant: ${tenant.name} (${tenant.id})`);
    console.log(`📍 Using Branch: ${branch.name} (${branch.id})\n`);

    // Get or create test integration
    const integration = await getOrCreateTestIntegration(supabase, tenant.id, branch.id);
    console.log(`🔗 Using Integration: ${integration.connection_name} (${integration.id})\n`);

    // Clean existing data if requested
    if (CLEAN_BEFORE_SEED) {
      await cleanExistingData(supabase, tenant.id);
    }

    // Seed data
    await seedRecipes(supabase, tenant.id, branch.id);
    await seedInventoryMovements(supabase, tenant.id, branch.id);
    await seedSRSales(supabase, tenant.id, branch.id, integration.id);
    await seedLowStockAlerts(supabase, tenant.id, branch.id);

    console.log('\n' + '='.repeat(70));
    console.log('✅ TEST DATA SEEDING COMPLETED');
    console.log('='.repeat(70));
    console.log('\n📊 Summary:');
    console.log('   • 3 Recipes created');
    console.log('   • 8 Recipe ingredients added');
    console.log('   • 15 Inventory movements logged');
    console.log('   • 5 SR sales inserted');
    console.log('   • 3 Low stock alerts created');
    console.log('');
    console.log('💡 You can now test the SR integration with realistic data!');
    console.log('');

  } catch (error: any) {
    console.error('\n❌ Seeding failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function getTestTenantAndBranch(supabase: any) {
  // Get first tenant
  const { data: tenants } = await supabase
    .from('tenants')
    .select('id, name')
    .limit(1)
    .single();

  if (!tenants) {
    return { tenant: null, branch: null };
  }

  // Get first branch of this tenant
  const { data: branches } = await supabase
    .from('branches')
    .select('id, name')
    .eq('tenant_id', tenants.id)
    .limit(1)
    .single();

  return {
    tenant: tenants,
    branch: branches,
  };
}

async function getOrCreateTestIntegration(supabase: any, tenantId: string, branchId: string) {
  // Try to find existing SR integration
  const { data: existing } = await supabase
    .from('integration_connections')
    .select('id, connection_name')
    .eq('tenant_id', tenantId)
    .eq('integration_type', 'softrestaurant')
    .single();

  if (existing) {
    return existing;
  }

  // Create new test integration
  const { data: newIntegration, error } = await supabase
    .from('integration_connections')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      integration_type: 'softrestaurant',
      status: 'connected',
      connection_name: 'Soft Restaurant Test',
      auth_type: 'api_key',
      api_key: 'test-api-key-' + Math.random().toString(36).substring(7),
      sync_enabled: true,
      sync_direction: 'inbound',
      sync_contacts: false,
      sync_appointments: false,
      metadata: {
        sync_sales: true,
        apply_recipe_deduction: true,
        auto_create_alerts: true,
        warehouse_mappings: {
          '1': branchId,
          '2': branchId,
        },
        payment_method_mappings: {
          'EFECTIVO': 'cash',
          'TARJETA': 'card',
        },
      },
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to create integration: ${error.message}`);
  }

  return newIntegration;
}

async function cleanExistingData(supabase: any, tenantId: string) {
  console.log('🧹 Cleaning existing test data...');

  // Delete in reverse order of dependencies
  await supabase.from('low_stock_alerts').delete().eq('tenant_id', tenantId);
  await supabase.from('inventory_movements').delete().eq('tenant_id', tenantId);
  await supabase.from('sr_payments').delete().eq('tenant_id', tenantId);
  await supabase.from('sr_sale_items').delete().eq('tenant_id', tenantId);
  await supabase.from('sr_sales').delete().eq('tenant_id', tenantId);
  await supabase.from('recipe_ingredients').delete().where('recipe_id', 'in', supabase.from('recipes').select('id').eq('tenant_id', tenantId));
  await supabase.from('recipes').delete().eq('tenant_id', tenantId);

  console.log('   ✓ Cleaned existing data\n');
}

async function seedRecipes(supabase: any, tenantId: string, branchId: string) {
  console.log('📖 Seeding Recipes...');

  // Recipe 1: Hamburguesa Clásica
  const { data: recipe1 } = await supabase
    .from('recipes')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      product_id: 'HAMB001',
      product_name: 'Hamburguesa Clásica',
      yield_quantity: 1,
      yield_unit: 'unit',
      is_active: true,
      notes: 'Hamburguesa con carne, lechuga, tomate, cebolla',
    })
    .select()
    .single();

  // Ingredients for recipe 1
  await supabase.from('recipe_ingredients').insert([
    {
      recipe_id: recipe1.id,
      ingredient_id: crypto.randomUUID(),
      ingredient_name: 'Carne molida de res',
      quantity: 150,
      unit: 'g',
      waste_percentage: 5,
      unit_cost: 0.08,
    },
    {
      recipe_id: recipe1.id,
      ingredient_id: crypto.randomUUID(),
      ingredient_name: 'Pan para hamburguesa',
      quantity: 1,
      unit: 'pza',
      waste_percentage: 2,
      unit_cost: 8,
    },
    {
      recipe_id: recipe1.id,
      ingredient_id: crypto.randomUUID(),
      ingredient_name: 'Lechuga',
      quantity: 20,
      unit: 'g',
      waste_percentage: 10,
      unit_cost: 0.05,
    },
    {
      recipe_id: recipe1.id,
      ingredient_id: crypto.randomUUID(),
      ingredient_name: 'Queso amarillo',
      quantity: 30,
      unit: 'g',
      waste_percentage: 3,
      unit_cost: 0.15,
    },
  ]);

  // Recipe 2: Cerveza Corona
  const { data: recipe2 } = await supabase
    .from('recipes')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      product_id: '01005',
      product_name: 'Cerveza Corona Familiar',
      yield_quantity: 1,
      yield_unit: 'unit',
      is_active: true,
      notes: 'Cerveza Corona en presentación de 1L',
    })
    .select()
    .single();

  await supabase.from('recipe_ingredients').insert([
    {
      recipe_id: recipe2.id,
      ingredient_id: crypto.randomUUID(),
      ingredient_name: 'Cerveza Corona 1L',
      quantity: 1,
      unit: 'pza',
      waste_percentage: 0,
      unit_cost: 35,
    },
    {
      recipe_id: recipe2.id,
      ingredient_id: crypto.randomUUID(),
      ingredient_name: 'Vaso desechable',
      quantity: 1,
      unit: 'pza',
      waste_percentage: 5,
      unit_cost: 1.5,
    },
  ]);

  // Recipe 3: Tacos al Pastor (Orden de 3)
  const { data: recipe3 } = await supabase
    .from('recipes')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      product_id: 'TACO001',
      product_name: 'Tacos al Pastor (Orden 3 pzas)',
      yield_quantity: 3,
      yield_unit: 'tacos',
      is_active: true,
      notes: 'Orden de 3 tacos al pastor con piña',
    })
    .select()
    .single();

  await supabase.from('recipe_ingredients').insert([
    {
      recipe_id: recipe3.id,
      ingredient_id: crypto.randomUUID(),
      ingredient_name: 'Carne de cerdo marinada',
      quantity: 120,
      unit: 'g',
      waste_percentage: 8,
      unit_cost: 0.12,
    },
    {
      recipe_id: recipe3.id,
      ingredient_id: crypto.randomUUID(),
      ingredient_name: 'Tortillas de maíz',
      quantity: 3,
      unit: 'pza',
      waste_percentage: 5,
      unit_cost: 2,
    },
  ]);

  console.log('   ✓ Created 3 recipes with 8 ingredients\n');
}

async function seedInventoryMovements(supabase: any, tenantId: string, branchId: string) {
  console.log('📦 Seeding Inventory Movements...');

  const movements = [];
  const baseDate = new Date('2024-01-15');

  // Purchase movements (initial stock)
  for (let i = 0; i < 5; i++) {
    movements.push({
      tenant_id: tenantId,
      branch_id: branchId,
      ingredient_id: crypto.randomUUID(),
      movement_type: 'purchase',
      quantity: Math.random() * 50 + 10, // 10-60 units
      unit: ['kg', 'L', 'pza'][Math.floor(Math.random() * 3)],
      unit_cost: Math.random() * 20 + 5,
      reference_type: 'purchase_order',
      reference_id: crypto.randomUUID(),
      notes: 'Compra inicial de inventario',
      created_at: new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Deduction movements (usage)
  for (let i = 0; i < 7; i++) {
    movements.push({
      tenant_id: tenantId,
      branch_id: branchId,
      ingredient_id: crypto.randomUUID(),
      movement_type: 'deduction',
      quantity: -(Math.random() * 5 + 1), // -1 to -6 units
      unit: ['kg', 'L', 'pza'][Math.floor(Math.random() * 3)],
      unit_cost: Math.random() * 15 + 3,
      reference_type: 'sr_sale',
      reference_id: crypto.randomUUID(),
      notes: 'Deducción por venta de Soft Restaurant',
      created_at: new Date(baseDate.getTime() + (i + 5) * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  // Adjustment movements
  for (let i = 0; i < 3; i++) {
    movements.push({
      tenant_id: tenantId,
      branch_id: branchId,
      ingredient_id: crypto.randomUUID(),
      movement_type: 'adjustment',
      quantity: Math.random() * 10 - 5, // -5 to +5 units
      unit: ['kg', 'L', 'pza'][Math.floor(Math.random() * 3)],
      unit_cost: Math.random() * 12 + 4,
      reference_type: 'inventory_count',
      notes: 'Ajuste por inventario físico',
      created_at: new Date(baseDate.getTime() + (i + 12) * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  await supabase.from('inventory_movements').insert(movements);

  console.log(`   ✓ Created ${movements.length} inventory movements\n`);
}

async function seedSRSales(supabase: any, tenantId: string, branchId: string, integrationId: string) {
  console.log('💰 Seeding SR Sales...');

  const baseDate = new Date('2024-01-20');

  // Sale 1: Simple sale with one item
  const { data: sale1 } = await supabase
    .from('sr_sales')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      integration_id: integrationId,
      external_id: 'SR-TEST-001',
      sr_warehouse: '1',
      area: 'Terraza',
      station: 'Caja 1',
      table_number: '5',
      waiter_name: 'Juan Pérez',
      sale_date: new Date(baseDate.getTime()).toISOString(),
      total: 120.00,
      tip: 15.00,
      recipe_cost: 36.50,
      status: 'completed',
      raw_data: { test: true },
    })
    .select()
    .single();

  await supabase.from('sr_sale_items').insert([
    {
      tenant_id: tenantId,
      sale_id: sale1.id,
      product_id: '01005',
      description: 'CERVEZA CORONA FAMILIAR',
      quantity: 1,
      unit_price: 120.00,
      total_price: 120.00,
      recipe_deducted: true,
      recipe_cost: 36.50,
    },
  ]);

  await supabase.from('sr_payments').insert([
    {
      tenant_id: tenantId,
      sale_id: sale1.id,
      payment_name: 'EFECTIVO',
      amount: 135.00,
    },
  ]);

  // Sale 2: Multiple items
  const { data: sale2 } = await supabase
    .from('sr_sales')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      integration_id: integrationId,
      external_id: 'SR-TEST-002',
      sr_warehouse: '1',
      area: 'Interior',
      station: 'Caja 2',
      table_number: '12',
      waiter_name: 'María González',
      sale_date: new Date(baseDate.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      total: 385.00,
      tip: 50.00,
      recipe_cost: 98.25,
      status: 'completed',
      raw_data: { test: true },
    })
    .select()
    .single();

  await supabase.from('sr_sale_items').insert([
    {
      tenant_id: tenantId,
      sale_id: sale2.id,
      product_id: 'HAMB001',
      description: 'HAMBURGUESA CLASICA',
      quantity: 2,
      unit_price: 85.00,
      total_price: 170.00,
      recipe_deducted: true,
      recipe_cost: 42.50,
    },
    {
      tenant_id: tenantId,
      sale_id: sale2.id,
      product_id: 'TACO001',
      description: 'TACOS AL PASTOR ORDEN',
      quantity: 3,
      unit_price: 65.00,
      total_price: 195.00,
      recipe_deducted: true,
      recipe_cost: 55.75,
    },
  ]);

  await supabase.from('sr_payments').insert([
    {
      tenant_id: tenantId,
      sale_id: sale2.id,
      payment_name: 'TARJETA',
      amount: 435.00,
    },
  ]);

  // Sale 3: Cancelled sale
  const { data: sale3 } = await supabase
    .from('sr_sales')
    .insert({
      tenant_id: tenantId,
      branch_id: branchId,
      integration_id: integrationId,
      external_id: 'SR-TEST-003',
      sr_warehouse: '2',
      area: 'Barra',
      station: 'Terminal 1',
      sale_date: new Date(baseDate.getTime() + 4 * 60 * 60 * 1000).toISOString(),
      total: 200.00,
      status: 'cancelled',
      raw_data: { test: true, cancelled_reason: 'Cliente canceló orden' },
    })
    .select()
    .single();

  await supabase.from('sr_sale_items').insert([
    {
      tenant_id: tenantId,
      sale_id: sale3.id,
      product_id: 'HAMB001',
      description: 'HAMBURGUESA CLASICA',
      quantity: 2,
      unit_price: 100.00,
      total_price: 200.00,
      recipe_deducted: false,
    },
  ]);

  // Sales 4 & 5: Recent sales
  for (let i = 4; i <= 5; i++) {
    const { data: sale } = await supabase
      .from('sr_sales')
      .insert({
        tenant_id: tenantId,
        branch_id: branchId,
        integration_id: integrationId,
        external_id: `SR-TEST-00${i}`,
        sr_warehouse: '1',
        area: 'Terraza',
        station: 'Caja 1',
        table_number: String(i * 3),
        waiter_name: ['Carlos López', 'Ana Martínez'][i - 4],
        sale_date: new Date(baseDate.getTime() + i * 3 * 60 * 60 * 1000).toISOString(),
        total: 150.00 + i * 25,
        tip: 10.00 + i * 5,
        recipe_cost: 45.00 + i * 10,
        status: 'completed',
        raw_data: { test: true },
      })
      .select()
      .single();

    await supabase.from('sr_sale_items').insert([
      {
        tenant_id: tenantId,
        sale_id: sale.id,
        product_id: 'TACO001',
        description: 'TACOS AL PASTOR ORDEN',
        quantity: 2,
        unit_price: 65.00,
        total_price: 130.00,
        recipe_deducted: true,
        recipe_cost: 40.00,
      },
    ]);

    await supabase.from('sr_payments').insert([
      {
        tenant_id: tenantId,
        sale_id: sale.id,
        payment_name: 'EFECTIVO',
        amount: sale.total + sale.tip,
      },
    ]);
  }

  console.log('   ✓ Created 5 sales with items and payments\n');
}

async function seedLowStockAlerts(supabase: any, tenantId: string, branchId: string) {
  console.log('⚠️  Seeding Low Stock Alerts...');

  await supabase.from('low_stock_alerts').insert([
    {
      tenant_id: tenantId,
      branch_id: branchId,
      ingredient_id: crypto.randomUUID(),
      alert_type: 'low_stock',
      severity: 'warning',
      current_stock: 8.5,
      reorder_point: 10,
      minimum_stock: 5,
      suggested_order_quantity: 20,
      status: 'active',
    },
    {
      tenant_id: tenantId,
      branch_id: branchId,
      ingredient_id: crypto.randomUUID(),
      alert_type: 'out_of_stock',
      severity: 'critical',
      current_stock: 0,
      reorder_point: 15,
      minimum_stock: 5,
      suggested_order_quantity: 30,
      status: 'active',
    },
    {
      tenant_id: tenantId,
      branch_id: branchId,
      ingredient_id: crypto.randomUUID(),
      alert_type: 'low_stock',
      severity: 'warning',
      current_stock: 12,
      reorder_point: 20,
      minimum_stock: 10,
      suggested_order_quantity: 40,
      status: 'acknowledged',
    },
  ]);

  console.log('   ✓ Created 3 low stock alerts\n');
}

// =====================================================
// EXECUTE
// =====================================================

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

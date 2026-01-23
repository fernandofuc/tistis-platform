#!/usr/bin/env tsx
/**
 * TIS TIS Platform - Soft Restaurant Integration
 * Migration Verification Script
 *
 * Verifica que la migración 152_SOFT_RESTAURANT_INTEGRATION.sql
 * se haya aplicado correctamente.
 *
 * Usage:
 *   npx tsx scripts/migration/verify-sr-migration.ts [--verbose]
 *
 * Options:
 *   --verbose     Mostrar detalles completos de cada verificación
 *
 * @module scripts/migration/verify-sr-migration
 */

import { createClient } from '@supabase/supabase-js';

// =====================================================
// TYPES
// =====================================================

interface VerificationResult {
  success: boolean;
  checks: CheckResult[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

interface CheckResult {
  category: string;
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message: string;
  details?: any;
}

// =====================================================
// CONFIGURATION
// =====================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const EXPECTED_TABLES = [
  'sr_sales',
  'sr_sale_items',
  'sr_payments',
  'sr_sync_logs',
  'recipes',
  'recipe_ingredients',
  'inventory_movements',
  'low_stock_alerts',
];

const EXPECTED_FUNCTIONS = [
  'get_ingredient_current_stock',
  'update_inventory_stock',
];

const VERBOSE = process.argv.includes('--verbose');

// =====================================================
// MAIN FUNCTION
// =====================================================

async function main() {
  console.log('🔍 TIS TIS - Soft Restaurant Migration Verification\n');
  console.log('='.repeat(70));
  console.log('VERIFYING: 152_SOFT_RESTAURANT_INTEGRATION.sql');
  console.log('='.repeat(70) + '\n');

  // Validate environment
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing Supabase credentials');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('✅ Connected to Supabase\n');

  const result: VerificationResult = {
    success: true,
    checks: [],
    summary: {
      total: 0,
      passed: 0,
      failed: 0,
      warnings: 0,
    },
  };

  // Run all verification checks
  await verifyTables(supabase, result);
  await verifyColumns(supabase, result);
  await verifyIndexes(supabase, result);
  await verifyRLS(supabase, result);
  await verifyFunctions(supabase, result);
  await verifyTriggers(supabase, result);

  // Display results
  displayResults(result);

  // Exit with appropriate code
  process.exit(result.success ? 0 : 1);
}

// =====================================================
// VERIFICATION FUNCTIONS
// =====================================================

async function verifyTables(supabase: any, result: VerificationResult) {
  console.log('📋 Verifying Tables...');

  for (const tableName of EXPECTED_TABLES) {
    try {
      const { error } = await supabase
        .from(tableName)
        .select('id')
        .limit(1);

      if (error && !error.message.includes('0 rows')) {
        addCheck(result, 'Tables', `Table: ${tableName}`, 'fail',
          `Table not accessible: ${error.message}`);
      } else {
        addCheck(result, 'Tables', `Table: ${tableName}`, 'pass',
          'Table exists and is accessible');
      }
    } catch (error: any) {
      addCheck(result, 'Tables', `Table: ${tableName}`, 'fail',
        `Error checking table: ${error.message}`);
    }
  }

  console.log(`   ${result.checks.filter(c => c.category === 'Tables' && c.status === 'pass').length}/${EXPECTED_TABLES.length} tables verified\n`);
}

async function verifyColumns(supabase: any, result: VerificationResult) {
  console.log('🔢 Verifying Columns...');

  const criticalColumns = {
    'sr_sales': ['id', 'tenant_id', 'branch_id', 'integration_id', 'external_id', 'total', 'status'],
    'sr_sale_items': ['id', 'sale_id', 'product_id', 'quantity', 'unit_price'],
    'recipes': ['id', 'tenant_id', 'branch_id', 'product_id', 'product_name'],
    'inventory_movements': ['id', 'tenant_id', 'branch_id', 'ingredient_id', 'movement_type', 'quantity'],
  };

  for (const [tableName, columns] of Object.entries(criticalColumns)) {
    try {
      // Query information_schema to check columns
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = '${tableName}'
            AND column_name IN (${columns.map(c => `'${c}'`).join(',')});
        `
      });

      if (error) {
        // Fallback: Try to select from table directly
        const query = `SELECT ${columns.join(', ')} FROM ${tableName} LIMIT 0`;
        const { error: selectError } = await supabase.rpc('exec_sql', { sql: query });

        if (selectError) {
          addCheck(result, 'Columns', `${tableName} columns`, 'fail',
            `Missing columns in ${tableName}`);
        } else {
          addCheck(result, 'Columns', `${tableName} columns`, 'pass',
            `All critical columns present in ${tableName}`);
        }
      } else {
        const foundColumns = data?.map((row: any) => row.column_name) || [];
        const missingColumns = columns.filter(col => !foundColumns.includes(col));

        if (missingColumns.length > 0) {
          addCheck(result, 'Columns', `${tableName} columns`, 'fail',
            `Missing columns: ${missingColumns.join(', ')}`);
        } else {
          addCheck(result, 'Columns', `${tableName} columns`, 'pass',
            `All ${columns.length} critical columns present`);
        }
      }
    } catch (error: any) {
      addCheck(result, 'Columns', `${tableName} columns`, 'warn',
        'Could not verify columns (table may not exist yet)');
    }
  }

  console.log(`   ${result.checks.filter(c => c.category === 'Columns' && c.status === 'pass').length}/${Object.keys(criticalColumns).length} table column sets verified\n`);
}

async function verifyIndexes(supabase: any, result: VerificationResult) {
  console.log('📊 Verifying Indexes...');

  const criticalIndexes = [
    'idx_sr_sales_tenant_branch',
    'idx_sr_sales_tenant_date',
    'idx_sr_sales_external_id',
    'idx_sr_sale_items_sale',
    'idx_recipes_tenant_branch',
    'idx_inventory_movements_ingredient',
    'idx_low_stock_alerts_status',
  ];

  for (const indexName of criticalIndexes) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT indexname
          FROM pg_indexes
          WHERE schemaname = 'public'
            AND indexname = '${indexName}';
        `
      });

      if (error || !data || data.length === 0) {
        addCheck(result, 'Indexes', `Index: ${indexName}`, 'warn',
          'Index not found (may not be critical)');
      } else {
        addCheck(result, 'Indexes', `Index: ${indexName}`, 'pass',
          'Index exists');
      }
    } catch (error: any) {
      addCheck(result, 'Indexes', `Index: ${indexName}`, 'warn',
        'Could not verify index');
    }
  }

  console.log(`   ${result.checks.filter(c => c.category === 'Indexes' && c.status === 'pass').length}/${criticalIndexes.length} critical indexes verified\n`);
}

async function verifyRLS(supabase: any, result: VerificationResult) {
  console.log('🔒 Verifying Row Level Security...');

  for (const tableName of EXPECTED_TABLES) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT relrowsecurity as rls_enabled
          FROM pg_class
          WHERE relname = '${tableName}'
            AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
        `
      });

      if (error) {
        addCheck(result, 'RLS', `RLS: ${tableName}`, 'warn',
          'Could not verify RLS status');
      } else if (!data || data.length === 0) {
        addCheck(result, 'RLS', `RLS: ${tableName}`, 'fail',
          'Table not found');
      } else {
        const rlsEnabled = data[0]?.rls_enabled;
        if (rlsEnabled) {
          addCheck(result, 'RLS', `RLS: ${tableName}`, 'pass',
            'RLS is enabled');
        } else {
          addCheck(result, 'RLS', `RLS: ${tableName}`, 'fail',
            'RLS is NOT enabled');
        }
      }
    } catch (error: any) {
      addCheck(result, 'RLS', `RLS: ${tableName}`, 'warn',
        'Could not verify RLS');
    }
  }

  console.log(`   ${result.checks.filter(c => c.category === 'RLS' && c.status === 'pass').length}/${EXPECTED_TABLES.length} tables have RLS enabled\n`);
}

async function verifyFunctions(supabase: any, result: VerificationResult) {
  console.log('⚙️  Verifying Functions...');

  for (const functionName of EXPECTED_FUNCTIONS) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT routine_name
          FROM information_schema.routines
          WHERE routine_schema = 'public'
            AND routine_name = '${functionName}';
        `
      });

      if (error || !data || data.length === 0) {
        addCheck(result, 'Functions', `Function: ${functionName}`, 'fail',
          'Function not found');
      } else {
        addCheck(result, 'Functions', `Function: ${functionName}`, 'pass',
          'Function exists');
      }
    } catch (error: any) {
      addCheck(result, 'Functions', `Function: ${functionName}`, 'warn',
        'Could not verify function');
    }
  }

  console.log(`   ${result.checks.filter(c => c.category === 'Functions' && c.status === 'pass').length}/${EXPECTED_FUNCTIONS.length} functions verified\n`);
}

async function verifyTriggers(supabase: any, result: VerificationResult) {
  console.log('🔔 Verifying Triggers...');

  const expectedTriggers = [
    { table: 'sr_sales', trigger: 'update_sr_sales_updated_at' },
    { table: 'recipes', trigger: 'update_recipes_updated_at' },
    { table: 'low_stock_alerts', trigger: 'update_low_stock_alerts_updated_at' },
  ];

  for (const { table, trigger } of expectedTriggers) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `
          SELECT trigger_name
          FROM information_schema.triggers
          WHERE event_object_schema = 'public'
            AND event_object_table = '${table}'
            AND trigger_name = '${trigger}';
        `
      });

      if (error || !data || data.length === 0) {
        addCheck(result, 'Triggers', `Trigger: ${trigger}`, 'warn',
          `Trigger not found on ${table}`);
      } else {
        addCheck(result, 'Triggers', `Trigger: ${trigger}`, 'pass',
          `Trigger exists on ${table}`);
      }
    } catch (error: any) {
      addCheck(result, 'Triggers', `Trigger: ${trigger}`, 'warn',
        'Could not verify trigger');
    }
  }

  console.log(`   ${result.checks.filter(c => c.category === 'Triggers' && c.status === 'pass').length}/${expectedTriggers.length} triggers verified\n`);
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

function addCheck(
  result: VerificationResult,
  category: string,
  name: string,
  status: 'pass' | 'fail' | 'warn',
  message: string,
  details?: any
) {
  result.checks.push({
    category,
    name,
    status,
    message,
    details,
  });

  result.summary.total++;

  if (status === 'pass') {
    result.summary.passed++;
  } else if (status === 'fail') {
    result.summary.failed++;
    result.success = false;
  } else {
    result.summary.warnings++;
  }

  if (VERBOSE || status === 'fail') {
    const icon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '⚠️';
    console.log(`   ${icon} ${name}: ${message}`);
  }
}

function displayResults(result: VerificationResult) {
  console.log('='.repeat(70));
  console.log('📊 VERIFICATION SUMMARY');
  console.log('='.repeat(70));
  console.log('');
  console.log(`Total Checks:    ${result.summary.total}`);
  console.log(`✅ Passed:        ${result.summary.passed}`);
  console.log(`❌ Failed:        ${result.summary.failed}`);
  console.log(`⚠️  Warnings:      ${result.summary.warnings}`);
  console.log('');

  if (result.summary.failed > 0) {
    console.log('❌ FAILED CHECKS:\n');
    result.checks
      .filter(c => c.status === 'fail')
      .forEach(check => {
        console.log(`   • ${check.category} - ${check.name}`);
        console.log(`     ${check.message}`);
      });
    console.log('');
  }

  if (result.summary.warnings > 0 && VERBOSE) {
    console.log('⚠️  WARNINGS:\n');
    result.checks
      .filter(c => c.status === 'warn')
      .forEach(check => {
        console.log(`   • ${check.category} - ${check.name}`);
        console.log(`     ${check.message}`);
      });
    console.log('');
  }

  console.log('='.repeat(70));
  if (result.success) {
    console.log('✅ MIGRATION VERIFICATION PASSED');
    console.log('   All critical components are in place and functional.');
  } else {
    console.log('❌ MIGRATION VERIFICATION FAILED');
    console.log('   Some critical components are missing or non-functional.');
    console.log('');
    console.log('NEXT STEPS:');
    console.log('1. Review failed checks above');
    console.log('2. Re-run the migration if tables are missing');
    console.log('3. Check Supabase logs for errors');
    console.log('4. Ensure you\'re using the Service Role Key');
  }
  console.log('='.repeat(70));
  console.log('');
}

// =====================================================
// EXECUTE
// =====================================================

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

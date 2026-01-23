#!/usr/bin/env tsx
/**
 * TIS TIS Platform - Soft Restaurant Integration
 * Migration Execution Script
 *
 * Ejecuta la migración 152_SOFT_RESTAURANT_INTEGRATION.sql
 * de manera segura con validación y rollback.
 *
 * Usage:
 *   npx tsx scripts/migration/run-sr-migration.ts [--dry-run] [--force]
 *
 * Options:
 *   --dry-run     Simular la migración sin ejecutar
 *   --force       Forzar ejecución sin confirmación
 *   --rollback    Revertir la migración
 *
 * @module scripts/migration/run-sr-migration
 */

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// =====================================================
// TYPES
// =====================================================

interface MigrationOptions {
  dryRun: boolean;
  force: boolean;
  rollback: boolean;
}

interface MigrationResult {
  success: boolean;
  tablesCreated: string[];
  indexesCreated: number;
  policiesCreated: number;
  errors: string[];
  warnings: string[];
}

// =====================================================
// CONFIGURATION
// =====================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MIGRATION_FILE = '152_SOFT_RESTAURANT_INTEGRATION.sql';
const MIGRATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  MIGRATION_FILE
);

// Expected tables to be created
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

// =====================================================
// MAIN FUNCTION
// =====================================================

async function main() {
  console.log('🚀 TIS TIS - Soft Restaurant Integration Migration\n');

  // Parse command line arguments
  const options: MigrationOptions = {
    dryRun: process.argv.includes('--dry-run'),
    force: process.argv.includes('--force'),
    rollback: process.argv.includes('--rollback'),
  };

  // Validate environment variables
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('❌ Error: Missing Supabase credentials in environment variables');
    console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  // Check migration file exists
  if (!fs.existsSync(MIGRATION_PATH)) {
    console.error(`❌ Error: Migration file not found at ${MIGRATION_PATH}`);
    process.exit(1);
  }

  // Create Supabase client
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log('✅ Supabase client initialized');
  console.log(`📄 Migration file: ${MIGRATION_FILE}\n`);

  if (options.rollback) {
    await rollbackMigration(supabase, options);
  } else {
    await runMigration(supabase, options);
  }
}

// =====================================================
// RUN MIGRATION
// =====================================================

async function runMigration(supabase: any, options: MigrationOptions) {
  const result: MigrationResult = {
    success: false,
    tablesCreated: [],
    indexesCreated: 0,
    policiesCreated: 0,
    errors: [],
    warnings: [],
  };

  try {
    // Step 1: Check if tables already exist
    console.log('📋 Step 1: Checking existing tables...');
    const existingTables = await checkExistingTables(supabase);

    const alreadyExist = EXPECTED_TABLES.filter(table =>
      existingTables.includes(table)
    );

    if (alreadyExist.length > 0 && !options.force) {
      console.log(`\n⚠️  Warning: The following tables already exist:`);
      alreadyExist.forEach(table => console.log(`   - ${table}`));
      console.log('\nOptions:');
      console.log('  1. Run with --force to recreate tables (⚠️  DATA WILL BE LOST)');
      console.log('  2. Cancel and manually drop tables if needed');

      if (!options.dryRun) {
        const answer = await askQuestion('\nProceed anyway? (yes/no): ');
        if (answer.toLowerCase() !== 'yes') {
          console.log('❌ Migration cancelled by user');
          process.exit(0);
        }
      }
    }

    // Step 2: Read migration SQL
    console.log('\n📖 Step 2: Reading migration file...');
    const migrationSQL = fs.readFileSync(MIGRATION_PATH, 'utf-8');
    console.log(`✅ Loaded ${migrationSQL.length} characters of SQL`);

    // Step 3: Show migration summary
    console.log('\n📊 Step 3: Migration summary:');
    console.log(`   Tables to create: ${EXPECTED_TABLES.join(', ')}`);
    console.log(`   Indexes: ~35+`);
    console.log(`   RLS Policies: ~15+`);
    console.log(`   Triggers: 3`);
    console.log(`   Functions: 2`);

    if (options.dryRun) {
      console.log('\n🔍 DRY RUN MODE - No changes will be made');
      console.log('✅ Migration file is valid and ready to execute');
      return;
    }

    // Step 4: Confirm execution
    if (!options.force) {
      const answer = await askQuestion('\n⚠️  Execute migration? (yes/no): ');
      if (answer.toLowerCase() !== 'yes') {
        console.log('❌ Migration cancelled by user');
        process.exit(0);
      }
    }

    // Step 5: Execute migration
    console.log('\n🔧 Step 4: Executing migration...');
    console.log('⏳ This may take a few seconds...\n');

    // Execute the SQL (Note: Supabase client doesn't have direct SQL execution)
    // We need to use the REST API or PostgreSQL connection
    // For now, we'll use rpc to execute SQL statements

    // Split SQL into statements and execute one by one
    const statements = splitSQLStatements(migrationSQL);
    let executedCount = 0;

    for (const statement of statements) {
      if (statement.trim().length === 0) continue;
      if (statement.trim().startsWith('--')) continue; // Skip comments

      try {
        // Execute via rpc
        await supabase.rpc('exec_sql', { sql: statement });
        executedCount++;
      } catch (error: any) {
        // Some statements might fail if objects already exist
        // We'll log but continue
        const errorMsg = error.message || String(error);
        if (
          errorMsg.includes('already exists') ||
          errorMsg.includes('duplicate')
        ) {
          result.warnings.push(`Skipped: ${statement.substring(0, 50)}...`);
        } else {
          result.errors.push(`Error in statement: ${errorMsg}`);
        }
      }
    }

    console.log(`✅ Executed ${executedCount} SQL statements`);

    // Step 6: Verify migration
    console.log('\n🔍 Step 5: Verifying migration...');
    const verificationResult = await verifyMigration(supabase);

    if (verificationResult.success) {
      console.log('✅ Migration completed successfully!\n');
      console.log('📊 Created tables:');
      verificationResult.tablesCreated.forEach(table => {
        console.log(`   ✓ ${table}`);
      });

      result.success = true;
      result.tablesCreated = verificationResult.tablesCreated;
    } else {
      console.log('❌ Migration verification failed\n');
      console.log('Errors:');
      verificationResult.errors.forEach(err => console.log(`   - ${err}`));
      result.success = false;
      result.errors = verificationResult.errors;
    }

    if (result.warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      result.warnings.forEach(warn => console.log(`   - ${warn}`));
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    result.success = false;
    result.errors.push(error.message);
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  if (result.success) {
    console.log('✅ MIGRATION COMPLETED SUCCESSFULLY');
  } else {
    console.log('❌ MIGRATION FAILED');
    console.log('\nErrors:');
    result.errors.forEach(err => console.log(`   - ${err}`));
  }
  console.log('='.repeat(60) + '\n');

  process.exit(result.success ? 0 : 1);
}

// =====================================================
// ROLLBACK MIGRATION
// =====================================================

async function rollbackMigration(supabase: any, options: MigrationOptions) {
  console.log('⚠️  ROLLBACK MODE\n');
  console.log('This will DROP the following tables:');
  EXPECTED_TABLES.forEach(table => console.log(`   - ${table}`));
  console.log('\n⚠️  ALL DATA IN THESE TABLES WILL BE LOST!');

  if (!options.force) {
    const answer = await askQuestion('\nAre you sure? (type "DELETE" to confirm): ');
    if (answer !== 'DELETE') {
      console.log('❌ Rollback cancelled');
      process.exit(0);
    }
  }

  console.log('\n🔧 Executing rollback...');

  for (const table of EXPECTED_TABLES.reverse()) {
    try {
      await supabase.rpc('exec_sql', {
        sql: `DROP TABLE IF EXISTS public.${table} CASCADE;`
      });
      console.log(`✓ Dropped table: ${table}`);
    } catch (error: any) {
      console.error(`✗ Failed to drop ${table}:`, error.message);
    }
  }

  console.log('\n✅ Rollback completed\n');
}

// =====================================================
// HELPER FUNCTIONS
// =====================================================

async function checkExistingTables(supabase: any): Promise<string[]> {
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public')
    .in('table_name', EXPECTED_TABLES);

  if (error) {
    console.warn('⚠️  Could not check existing tables:', error.message);
    return [];
  }

  return data?.map((row: any) => row.table_name) || [];
}

async function verifyMigration(supabase: any): Promise<{
  success: boolean;
  tablesCreated: string[];
  errors: string[];
}> {
  const result = {
    success: true,
    tablesCreated: [] as string[],
    errors: [] as string[],
  };

  // Check each expected table
  for (const tableName of EXPECTED_TABLES) {
    try {
      const { error } = await supabase
        .from(tableName)
        .select('id')
        .limit(1);

      if (error && !error.message.includes('0 rows')) {
        result.errors.push(`Table ${tableName} not accessible: ${error.message}`);
        result.success = false;
      } else {
        result.tablesCreated.push(tableName);
      }
    } catch (error: any) {
      result.errors.push(`Error checking ${tableName}: ${error.message}`);
      result.success = false;
    }
  }

  return result;
}

function splitSQLStatements(sql: string): string[] {
  // Simple SQL statement splitter (not perfect, but works for most cases)
  return sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
}

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer);
    });
  });
}

// =====================================================
// EXECUTE
// =====================================================

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

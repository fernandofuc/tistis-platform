#!/usr/bin/env tsx
/**
 * TIS TIS Platform - Soft Restaurant Integration
 * Direct Migration Application Script
 *
 * Aplica la migración usando el SQL Editor de Supabase
 * o proporciona instrucciones para aplicarla manualmente.
 *
 * Usage:
 *   npx tsx scripts/migration/apply-sr-migration.ts
 *
 * @module scripts/migration/apply-sr-migration
 */

import * as fs from 'fs';
import * as path from 'path';

// =====================================================
// CONFIGURATION
// =====================================================

const MIGRATION_FILE = '152_SOFT_RESTAURANT_INTEGRATION.sql';
const MIGRATION_PATH = path.join(
  __dirname,
  '..',
  '..',
  'supabase',
  'migrations',
  MIGRATION_FILE
);

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PROJECT_REF = SUPABASE_URL?.match(/https:\/\/(.+)\.supabase\.co/)?.[1];

// =====================================================
// MAIN
// =====================================================

async function main() {
  console.log('🎯 TIS TIS - Soft Restaurant Integration Migration\n');
  console.log('='.repeat(70));
  console.log('MIGRATION: 152_SOFT_RESTAURANT_INTEGRATION.sql');
  console.log('='.repeat(70) + '\n');

  // Check migration file exists
  if (!fs.existsSync(MIGRATION_PATH)) {
    console.error(`❌ Error: Migration file not found at ${MIGRATION_PATH}`);
    process.exit(1);
  }

  // Read migration file
  const migrationSQL = fs.readFileSync(MIGRATION_PATH, 'utf-8');
  const lineCount = migrationSQL.split('\n').length;

  console.log('📄 Migration File Information:');
  console.log(`   Path: ${MIGRATION_PATH}`);
  console.log(`   Size: ${migrationSQL.length} characters`);
  console.log(`   Lines: ${lineCount}`);
  console.log('');

  console.log('📊 Migration Contents:');
  console.log('   ✓ 8 Tables to create:');
  console.log('     - sr_sales (ventas de Soft Restaurant)');
  console.log('     - sr_sale_items (productos vendidos)');
  console.log('     - sr_payments (formas de pago)');
  console.log('     - sr_sync_logs (logs de sincronización)');
  console.log('     - recipes (recetas de productos)');
  console.log('     - recipe_ingredients (ingredientes de recetas)');
  console.log('     - inventory_movements (movimientos de inventario/Kardex)');
  console.log('     - low_stock_alerts (alertas de stock bajo)');
  console.log('');
  console.log('   ✓ 35+ Indexes for performance');
  console.log('   ✓ Row Level Security (RLS) policies');
  console.log('   ✓ 3 Auto-update triggers');
  console.log('   ✓ 2 Helper functions');
  console.log('');

  console.log('📋 HOW TO APPLY THIS MIGRATION:\n');
  console.log('Option 1: SUPABASE SQL EDITOR (Recommended)');
  console.log('─'.repeat(70));
  console.log('1. Open Supabase Dashboard:');
  if (PROJECT_REF) {
    console.log(`   https://supabase.com/dashboard/project/${PROJECT_REF}/sql`);
  } else {
    console.log('   https://supabase.com/dashboard → Your Project → SQL Editor');
  }
  console.log('');
  console.log('2. Click "New Query"');
  console.log('');
  console.log('3. Copy and paste the ENTIRE migration file:');
  console.log(`   ${MIGRATION_PATH}`);
  console.log('');
  console.log('4. Click "Run" to execute the migration');
  console.log('');
  console.log('5. Verify success message in the console');
  console.log('');

  console.log('\nOption 2: USING PSQL (If installed)');
  console.log('─'.repeat(70));
  console.log('1. Get your database connection string from Supabase Dashboard:');
  console.log('   Settings → Database → Connection String (Direct)');
  console.log('');
  console.log('2. Run this command:');
  console.log(`   psql "YOUR_DATABASE_URL" -f ${MIGRATION_PATH}`);
  console.log('');

  console.log('\nOption 3: SUPABASE CLI (If installed)');
  console.log('─'.repeat(70));
  console.log('1. Install Supabase CLI if not installed:');
  console.log('   brew install supabase/tap/supabase');
  console.log('');
  console.log('2. Link to your project:');
  if (PROJECT_REF) {
    console.log(`   supabase link --project-ref ${PROJECT_REF}`);
  } else {
    console.log('   supabase link --project-ref YOUR_PROJECT_REF');
  }
  console.log('');
  console.log('3. Push migration:');
  console.log('   supabase db push');
  console.log('');

  console.log('\n✅ VERIFICATION STEPS (After applying migration):\n');
  console.log('1. Check tables were created:');
  console.log('   - Go to Supabase Dashboard → Table Editor');
  console.log('   - Verify you see the 8 new tables (sr_sales, sr_sale_items, etc.)');
  console.log('');
  console.log('2. Check RLS is enabled:');
  console.log('   - Each table should show a 🔒 lock icon');
  console.log('');
  console.log('3. Run verification query:');
  console.log('   SELECT table_name FROM information_schema.tables');
  console.log("   WHERE table_schema = 'public'");
  console.log("   AND table_name LIKE 'sr_%' OR table_name IN ('recipes', 'recipe_ingredients', 'inventory_movements', 'low_stock_alerts');");
  console.log('');

  console.log('='.repeat(70));
  console.log('📝 IMPORTANT NOTES:');
  console.log('='.repeat(70));
  console.log('');
  console.log('• This migration is SAFE to run multiple times');
  console.log('  (Uses "CREATE TABLE IF NOT EXISTS")');
  console.log('');
  console.log('• All tables have Row Level Security (RLS) enabled');
  console.log('  (Only tenant users can access their own data)');
  console.log('');
  console.log('• Indexes are created for optimal performance');
  console.log('  (Sales queries, inventory lookups, alerts)');
  console.log('');
  console.log('• Foreign keys ensure data integrity');
  console.log('  (Cascading deletes where appropriate)');
  console.log('');

  console.log('\n🚨 ROLLBACK (If needed):');
  console.log('='.repeat(70));
  console.log('');
  console.log('If you need to remove the migration, run these commands:');
  console.log('');
  console.log('DROP TABLE IF EXISTS public.low_stock_alerts CASCADE;');
  console.log('DROP TABLE IF EXISTS public.inventory_movements CASCADE;');
  console.log('DROP TABLE IF EXISTS public.recipe_ingredients CASCADE;');
  console.log('DROP TABLE IF EXISTS public.recipes CASCADE;');
  console.log('DROP TABLE IF EXISTS public.sr_sync_logs CASCADE;');
  console.log('DROP TABLE IF EXISTS public.sr_payments CASCADE;');
  console.log('DROP TABLE IF EXISTS public.sr_sale_items CASCADE;');
  console.log('DROP TABLE IF EXISTS public.sr_sales CASCADE;');
  console.log('DROP FUNCTION IF EXISTS public.get_ingredient_current_stock;');
  console.log('DROP FUNCTION IF EXISTS public.update_inventory_stock;');
  console.log('');

  console.log('='.repeat(70));
  console.log('✨ Ready to apply migration!');
  console.log('='.repeat(70) + '\n');

  // Option to copy SQL to clipboard (macOS only)
  if (process.platform === 'darwin') {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    readline.question('\n📋 Copy migration SQL to clipboard? (y/n): ', (answer: string) => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        const { execSync } = require('child_process');
        try {
          execSync(`cat "${MIGRATION_PATH}" | pbcopy`);
          console.log('✅ Migration SQL copied to clipboard!');
          console.log('   Now paste it in Supabase SQL Editor and click Run.');
        } catch (error) {
          console.error('❌ Failed to copy to clipboard');
        }
      } else {
        console.log('👍 No problem. Follow the manual steps above.');
      }
      readline.close();
    });
  }
}

// =====================================================
// EXECUTE
// =====================================================

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

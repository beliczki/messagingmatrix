#!/usr/bin/env node
/**
 * Database Cleanup Script
 * Clears creatives, assets, tasks, and cache from the SQLite database
 *
 * Usage: node scripts/cleanDatabase.js [options]
 *
 * Options:
 *   --all         Clear everything (creatives, assets, tasks, cache, shares)
 *   --creatives   Clear creatives table only
 *   --assets      Clear assets table only
 *   --tasks       Clear tasks table only
 *   --cache       Clear cache metadata only
 *   --shares      Clear share galleries only
 *   --uploads     Clear uploaded assets only
 *   --dry-run     Show what would be deleted without actually deleting
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'db', 'messaging-matrix.db');

// Parse arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const clearAll = args.includes('--all') || args.length === 0;

const options = {
  creatives: clearAll || args.includes('--creatives'),
  assets: clearAll || args.includes('--assets'),
  tasks: clearAll || args.includes('--tasks'),
  cache: clearAll || args.includes('--cache'),
  shares: clearAll || args.includes('--shares'),
  uploads: clearAll || args.includes('--uploads'),
};

console.log('\n🗑️  Database Cleanup Script');
console.log('===========================\n');

if (!fs.existsSync(dbPath)) {
  console.error(`❌ Database not found: ${dbPath}`);
  process.exit(1);
}

const db = new Database(dbPath);

// Get counts before deletion
function getCount(table) {
  try {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get();
    return result.count;
  } catch (e) {
    return 0;
  }
}

// Clear a table
function clearTable(table, description) {
  const count = getCount(table);
  if (count === 0) {
    console.log(`  ⚪ ${description}: already empty`);
    return 0;
  }

  if (dryRun) {
    console.log(`  🔍 ${description}: would delete ${count} rows`);
  } else {
    db.prepare(`DELETE FROM ${table}`).run();
    console.log(`  ✅ ${description}: deleted ${count} rows`);
  }
  return count;
}

if (dryRun) {
  console.log('🔍 DRY RUN MODE - No changes will be made\n');
}

let totalDeleted = 0;

// Clear selected tables
if (options.creatives) {
  totalDeleted += clearTable('creatives', 'Creatives');
}

if (options.assets) {
  totalDeleted += clearTable('assets', 'Assets');
}

if (options.tasks) {
  totalDeleted += clearTable('tasks', 'Tasks');
}

if (options.cache) {
  totalDeleted += clearTable('cache_metadata', 'Cache metadata');
}

if (options.shares) {
  totalDeleted += clearTable('share_galleries', 'Share galleries');
}

if (options.uploads) {
  totalDeleted += clearTable('uploaded_assets', 'Uploaded assets');
}

// Close database
db.close();

console.log('\n----------------------------');
if (dryRun) {
  console.log(`📊 Would delete ${totalDeleted} total rows`);
  console.log('\nRun without --dry-run to execute\n');
} else {
  console.log(`📊 Deleted ${totalDeleted} total rows`);
  console.log('\n✅ Cleanup complete!\n');
}

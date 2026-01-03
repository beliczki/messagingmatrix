/**
 * Migration: Add missing columns to tasks table
 *
 * Adds: output_content, labels, product, task_type, audience, topic,
 *       suggested_mc_name, suggested_related_mc, suggested_mcs, keywords
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'db', 'messagingmatrix.db');

console.log('🔄 Starting tasks table migration...');
console.log(`📁 Database path: ${dbPath}`);

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Columns to add
const columnsToAdd = [
  { name: 'output_content', type: 'TEXT' },
  { name: 'labels', type: 'TEXT' },
  { name: 'product', type: 'TEXT' },
  { name: 'task_type', type: 'TEXT' },
  { name: 'audience', type: 'TEXT' },
  { name: 'topic', type: 'TEXT' },
  { name: 'suggested_mc_name', type: 'TEXT' },
  { name: 'suggested_related_mc', type: 'TEXT' },
  { name: 'suggested_mcs', type: 'TEXT' },
  { name: 'keywords', type: 'TEXT' }
];

// Get existing columns
const tableInfo = db.prepare("PRAGMA table_info(tasks)").all();
const existingColumns = new Set(tableInfo.map(col => col.name));

console.log(`📋 Existing columns: ${Array.from(existingColumns).join(', ')}`);

// Add missing columns
let addedCount = 0;
for (const col of columnsToAdd) {
  if (!existingColumns.has(col.name)) {
    try {
      db.exec(`ALTER TABLE tasks ADD COLUMN ${col.name} ${col.type}`);
      console.log(`✅ Added column: ${col.name}`);
      addedCount++;
    } catch (err) {
      console.error(`❌ Failed to add column ${col.name}:`, err.message);
    }
  } else {
    console.log(`⏭️  Column already exists: ${col.name}`);
  }
}

console.log(`\n✅ Migration complete. Added ${addedCount} new columns.`);

// Verify final schema
const finalTableInfo = db.prepare("PRAGMA table_info(tasks)").all();
console.log('\n📋 Final tasks table schema:');
finalTableInfo.forEach(col => {
  console.log(`   - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
});

db.close();

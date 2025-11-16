/**
 * Migration: Add labels field to tasks table
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'db', 'messaging-matrix.db');

console.log('🔄 Starting migration: Add labels to tasks table');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath);

  // Check if column already exists
  const tableInfo = db.prepare("PRAGMA table_info(tasks)").all();
  const existingColumns = tableInfo.map(col => col.name);

  console.log('Existing columns:', existingColumns);

  if (!existingColumns.includes('labels')) {
    console.log('Adding column: labels');
    db.prepare('ALTER TABLE tasks ADD COLUMN labels TEXT').run();
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('✅ Column labels already exists, nothing to migrate');
  }

  db.close();
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

/**
 * Migration: Add drive_file_ids field to share_galleries table
 * This stores Google Drive file IDs for assets in shares
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'db', 'messaging-matrix.db');

console.log('🔄 Starting migration: Add drive_file_ids to share_galleries table');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath);

  // Check if column already exists
  const tableInfo = db.prepare("PRAGMA table_info(share_galleries)").all();
  const existingColumns = tableInfo.map(col => col.name);

  console.log('Existing columns:', existingColumns);

  if (!existingColumns.includes('drive_file_ids')) {
    console.log('Adding column: drive_file_ids');
    db.prepare('ALTER TABLE share_galleries ADD COLUMN drive_file_ids TEXT').run();
    console.log('✅ Migration completed successfully!');
  } else {
    console.log('✅ Column drive_file_ids already exists, nothing to migrate');
  }

  db.close();
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

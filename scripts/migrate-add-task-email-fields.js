/**
 * Migration: Add email-related fields to tasks table
 * Adds: email_body, email_subject, email_date, context, related_content
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'db', 'messaging-matrix.db');

console.log('Starting migration: Add email fields to tasks table');
console.log('Database path:', dbPath);

try {
  const db = new Database(dbPath);

  // Check if columns already exist
  const tableInfo = db.prepare("PRAGMA table_info(tasks)").all();
  const existingColumns = tableInfo.map(col => col.name);

  console.log('Existing columns:', existingColumns);

  const columnsToAdd = [
    { name: 'email_body', sql: 'ALTER TABLE tasks ADD COLUMN email_body TEXT' },
    { name: 'email_subject', sql: 'ALTER TABLE tasks ADD COLUMN email_subject TEXT' },
    { name: 'email_date', sql: 'ALTER TABLE tasks ADD COLUMN email_date TEXT' },
    { name: 'context', sql: 'ALTER TABLE tasks ADD COLUMN context TEXT' },
    { name: 'related_content', sql: 'ALTER TABLE tasks ADD COLUMN related_content TEXT' }
  ];

  let addedColumns = 0;

  for (const column of columnsToAdd) {
    if (!existingColumns.includes(column.name)) {
      console.log(`Adding column: ${column.name}`);
      db.prepare(column.sql).run();
      addedColumns++;
    } else {
      console.log(`Column ${column.name} already exists, skipping`);
    }
  }

  db.close();

  if (addedColumns > 0) {
    console.log(`✅ Migration completed successfully! Added ${addedColumns} column(s)`);
  } else {
    console.log('✅ All columns already exist, nothing to migrate');
  }
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

/**
 * One-shot migration: remove the Tasks + email-to-task feature from the DB.
 *
 * Drops:
 *   - tasks table (+ its indexes: idx_tasks_bucket, idx_tasks_product, idx_tasks_priority)
 *   - processed_emails table
 *   - config row where key = 'emailAccount'
 *
 * This is irreversible. The user already took a DB backup at
 * db/messaging-matrix.db.before-remove-tasks before running this.
 *
 * Run once:  node scripts/migrate-remove-tasks.js
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const dbPath     = path.join(__dirname, '..', 'db', 'messaging-matrix.db');

console.log('🧹 remove-tasks migration');
console.log(`📁 DB: ${dbPath}`);

const db = new Database(dbPath);
db.pragma('foreign_keys = OFF');

function tableExists(name) {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  ).get(name);
  return Boolean(row);
}

function indexExists(name) {
  const row = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='index' AND name=?"
  ).get(name);
  return Boolean(row);
}

function countRows(table) {
  try {
    return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;
  } catch {
    return 0;
  }
}

const before = {
  tasks:            tableExists('tasks')            ? countRows('tasks')            : null,
  processed_emails: tableExists('processed_emails') ? countRows('processed_emails') : null,
  emailAccount:     db.prepare("SELECT COUNT(*) AS c FROM config WHERE key='emailAccount'").get().c,
};

console.log('\n📋 Before:');
console.log(`   tasks rows             : ${before.tasks           ?? '(table missing)'}`);
console.log(`   processed_emails rows  : ${before.processed_emails ?? '(table missing)'}`);
console.log(`   config[emailAccount]   : ${before.emailAccount}`);

const stmts = [
  { label: 'DROP INDEX idx_tasks_bucket',       run: () => indexExists('idx_tasks_bucket')   && db.exec('DROP INDEX idx_tasks_bucket') },
  { label: 'DROP INDEX idx_tasks_product',      run: () => indexExists('idx_tasks_product')  && db.exec('DROP INDEX idx_tasks_product') },
  { label: 'DROP INDEX idx_tasks_priority',     run: () => indexExists('idx_tasks_priority') && db.exec('DROP INDEX idx_tasks_priority') },
  { label: 'DROP TABLE tasks',                  run: () => db.exec('DROP TABLE IF EXISTS tasks') },
  { label: 'DROP TABLE processed_emails',       run: () => db.exec('DROP TABLE IF EXISTS processed_emails') },
  { label: "DELETE config[emailAccount]",       run: () => db.prepare("DELETE FROM config WHERE key='emailAccount'").run() },
];

console.log('\n⏳ Dropping:');
const tx = db.transaction(() => {
  for (const { label, run } of stmts) {
    run();
    console.log(`   ✓ ${label}`);
  }
});
tx();

console.log('\n📋 After:');
console.log(`   tasks table            : ${tableExists('tasks')            ? 'STILL PRESENT (!)' : 'gone'}`);
console.log(`   processed_emails table : ${tableExists('processed_emails') ? 'STILL PRESENT (!)' : 'gone'}`);
console.log(`   config[emailAccount]   : ${db.prepare("SELECT COUNT(*) AS c FROM config WHERE key='emailAccount'").get().c}`);

db.close();
console.log('\n✅ Done.');

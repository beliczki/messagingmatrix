/**
 * Migration script: Revert bucket IDs back to original
 * briefing → naming
 * build → content
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'db', 'messaging-matrix.db');
const db = new Database(dbPath);

console.log('📋 Reverting buckets to original names...\n');

const migrations = [
  { from: 'briefing', to: 'naming' },
  { from: 'build', to: 'content' }
];

let totalMigrated = 0;

migrations.forEach(({ from, to }) => {
  const result = db.prepare(`UPDATE tasks SET bucket = ? WHERE bucket = ?`).run(to, from);
  console.log(`  ${from} → ${to}: ${result.changes} tasks`);
  totalMigrated += result.changes;
});

console.log(`\n✅ Reverted ${totalMigrated} tasks to original bucket IDs.`);

// Show current bucket distribution
console.log('\nCurrent bucket distribution:');
const distribution = db.prepare(`
  SELECT bucket, COUNT(*) as count
  FROM tasks
  GROUP BY bucket
  ORDER BY bucket
`).all();

distribution.forEach(row => {
  console.log(`  ${row.bucket}: ${row.count} tasks`);
});

db.close();

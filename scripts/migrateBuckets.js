/**
 * Migration script: Update task buckets from old names to new workflow stage names
 *
 * Old → New mapping:
 *   backlog → incoming
 *   planning → naming
 *   production → content
 *   review → preview
 *   dead → dead (unchanged)
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'db', 'messaging-matrix.db');

console.log('Opening database:', dbPath);
const db = new Database(dbPath);

// Migration mappings
const bucketMigrations = [
  { old: 'backlog', new: 'incoming' },
  { old: 'planning', new: 'naming' },
  { old: 'production', new: 'content' },
  { old: 'review', new: 'preview' }
  // 'dead' stays as 'dead'
];

console.log('\n=== Task Bucket Migration ===\n');

// Check current state
const beforeCounts = db.prepare(`
  SELECT bucket, COUNT(*) as count
  FROM tasks
  GROUP BY bucket
`).all();

console.log('Before migration:');
beforeCounts.forEach(row => {
  console.log(`  ${row.bucket || '(null)'}: ${row.count} tasks`);
});

// Run migrations
console.log('\nRunning migrations...');

bucketMigrations.forEach(({ old: oldBucket, new: newBucket }) => {
  const result = db.prepare(`
    UPDATE tasks SET bucket = ? WHERE bucket = ?
  `).run(newBucket, oldBucket);

  console.log(`  ${oldBucket} → ${newBucket}: ${result.changes} tasks updated`);
});

// Check final state
const afterCounts = db.prepare(`
  SELECT bucket, COUNT(*) as count
  FROM tasks
  GROUP BY bucket
`).all();

console.log('\nAfter migration:');
afterCounts.forEach(row => {
  console.log(`  ${row.bucket || '(null)'}: ${row.count} tasks`);
});

console.log('\n✅ Migration complete!\n');

db.close();

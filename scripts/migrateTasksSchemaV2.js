/**
 * Migration: Update tasks table schema
 *
 * Changes:
 * - id: INTEGER PRIMARY KEY AUTOINCREMENT (was TEXT, now uses task_number value)
 * - Remove: task_number, status, workflow_type, labels, suggested_mc_name, suggested_mcs, suggested_related_mc
 * - Keep: title, description, priority, due_date, source, from, email_uid, bucket, created_at, updated_at,
 *         product, audience, topic, task_type, keywords, email_body, email_subject, email_date,
 *         context, user_notes, related_content, output_content
 * - related_content/output_content: Store as comma-separated MCnum+variant (e.g., "MC282a,MC282b")
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'db', 'messaging-matrix.db');

console.log('🔄 Starting tasks table schema migration v2...');
console.log(`📁 Database path: ${dbPath}`);

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = OFF');

// Get existing tasks
console.log('\n📋 Reading existing tasks...');
const existingTasks = db.prepare('SELECT * FROM tasks').all();
console.log(`   Found ${existingTasks.length} tasks`);

// Show current schema
const tableInfo = db.prepare("PRAGMA table_info(tasks)").all();
console.log('\n📋 Current tasks table schema:');
tableInfo.forEach(col => {
  console.log(`   - ${col.name}: ${col.type}`);
});

// Create new table with updated schema
console.log('\n🔨 Creating new tasks table with updated schema...');
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT,
    due_date TEXT,
    source TEXT,
    "from" TEXT,
    email_uid INTEGER,
    bucket TEXT DEFAULT 'backlog',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    product TEXT,
    audience TEXT,
    topic TEXT,
    task_type TEXT,
    keywords TEXT,
    email_body TEXT,
    email_subject TEXT,
    email_date TEXT,
    context TEXT,
    user_notes TEXT,
    related_content TEXT,
    output_content TEXT
  )
`);
console.log('✅ New table created');

// Helper function to convert relatedContent/outputContent to comma-separated MC references
function convertToMCReferences(jsonData) {
  if (!jsonData) return null;

  try {
    const parsed = JSON.parse(jsonData);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    // Extract MC references (e.g., "MC282a" from {reference: "MC282a", ...})
    const refs = parsed
      .filter(item => item.reference)
      .map(item => item.reference);

    return refs.length > 0 ? refs.join(',') : null;
  } catch (e) {
    return jsonData; // Return as-is if not valid JSON
  }
}

// Migrate data
console.log('\n📦 Migrating task data...');
const insertStmt = db.prepare(`
  INSERT INTO tasks_new (
    id, title, description, priority, due_date, source, "from", email_uid, bucket,
    created_at, updated_at, product, audience, topic, task_type, keywords,
    email_body, email_subject, email_date, context, user_notes, related_content, output_content
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let migratedCount = 0;
let skippedCount = 0;

for (const task of existingTasks) {
  // Use task_number as the new id (if available), otherwise extract number from old id
  let newId = task.task_number;
  if (!newId) {
    // Try to extract number from id like "task-1767348846417-0" -> use index or generate
    const match = task.id?.match(/-(\d+)$/);
    if (match) {
      newId = parseInt(match[1], 10) + 1; // +1 because index was 0-based
    }
  }

  if (!newId) {
    console.log(`   ⚠️ Skipping task without valid id: ${task.id}`);
    skippedCount++;
    continue;
  }

  // Convert relatedContent and outputContent to comma-separated format
  const relatedContent = convertToMCReferences(task.related_content);
  const outputContent = convertToMCReferences(task.output_content);

  try {
    insertStmt.run(
      newId,
      task.title,
      task.description,
      task.priority,
      task.due_date,
      task.source,
      task.from,
      task.email_uid,
      task.bucket,
      task.created_at,
      task.updated_at,
      task.product,
      task.audience,
      task.topic,
      task.task_type,
      task.keywords,
      task.email_body,
      task.email_subject,
      task.email_date,
      task.context,
      task.user_notes,
      relatedContent,
      outputContent
    );
    migratedCount++;
    console.log(`   ✅ Migrated task ${task.task_number || task.id} -> id=${newId}`);
  } catch (err) {
    console.error(`   ❌ Failed to migrate task ${task.id}:`, err.message);
    skippedCount++;
  }
}

console.log(`\n📊 Migration summary: ${migratedCount} migrated, ${skippedCount} skipped`);

// Drop old table and rename new one
console.log('\n🔄 Replacing old table...');
db.exec('DROP TABLE tasks');
db.exec('ALTER TABLE tasks_new RENAME TO tasks');
console.log('✅ Table replaced');

// Create indexes
console.log('\n📇 Creating indexes...');
const indexes = [
  'CREATE INDEX IF NOT EXISTS idx_tasks_bucket ON tasks(bucket)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_product ON tasks(product)',
  'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)'
];

indexes.forEach(idx => {
  try {
    db.exec(idx);
  } catch (e) {
    console.warn(`   Warning: ${e.message}`);
  }
});
console.log('✅ Indexes created');

// Verify final schema
const finalTableInfo = db.prepare("PRAGMA table_info(tasks)").all();
console.log('\n📋 Final tasks table schema:');
finalTableInfo.forEach(col => {
  console.log(`   - ${col.name}: ${col.type}${col.notnull ? ' NOT NULL' : ''}${col.dflt_value ? ` DEFAULT ${col.dflt_value}` : ''}`);
});

// Verify data
const finalCount = db.prepare('SELECT COUNT(*) as count FROM tasks').get();
console.log(`\n✅ Migration complete. ${finalCount.count} tasks in database.`);

// Show sample of migrated data
const sampleTasks = db.prepare('SELECT id, title, related_content, output_content FROM tasks LIMIT 3').all();
console.log('\n📋 Sample migrated tasks:');
sampleTasks.forEach(t => {
  console.log(`   - TC${t.id}: "${t.title?.substring(0, 40)}..." | related: ${t.related_content || 'none'} | output: ${t.output_content || 'none'}`);
});

db.close();
console.log('\n🎉 Done!');

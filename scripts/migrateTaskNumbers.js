/**
 * Migration script: Assign task numbers to existing tasks
 * Runs once to populate task_number field for existing tasks
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, '..', 'db', 'messaging-matrix.db');
const db = new Database(dbPath);

console.log('📋 Migrating task numbers...\n');

// Add task_number column if it doesn't exist
try {
  db.exec('ALTER TABLE tasks ADD COLUMN task_number INTEGER');
  console.log('✅ Added task_number column to tasks table.\n');
} catch (e) {
  // Column already exists
  console.log('ℹ️  task_number column already exists.\n');
}

// Get all tasks without task_number, ordered by created_at
const tasks = db.prepare(`
  SELECT id, title, created_at
  FROM tasks
  WHERE task_number IS NULL
  ORDER BY created_at ASC
`).all();

if (tasks.length === 0) {
  console.log('✅ All tasks already have task numbers assigned.');
  process.exit(0);
}

// Get current max task_number
const maxResult = db.prepare('SELECT MAX(task_number) as maxNum FROM tasks').get();
let nextNumber = (maxResult?.maxNum || 0) + 1;

console.log(`Found ${tasks.length} tasks without task numbers.`);
console.log(`Starting from TC${nextNumber}\n`);

const updateStmt = db.prepare('UPDATE tasks SET task_number = ? WHERE id = ?');

const transaction = db.transaction(() => {
  tasks.forEach(task => {
    updateStmt.run(nextNumber, task.id);
    console.log(`  TC${nextNumber}: ${task.title.substring(0, 40)}...`);
    nextNumber++;
  });
});

transaction();

console.log(`\n✅ Assigned task numbers to ${tasks.length} tasks.`);
console.log(`Task numbers now range from TC1 to TC${nextNumber - 1}`);

db.close();

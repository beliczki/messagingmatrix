import db from '../db/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

/**
 * Migration Script: JSON Files → SQLite
 * Migrates all JSON-based storage to SQLite database
 */

console.log('🚀 Starting JSON → SQLite migration...\n');

// Initialize database
db.initialize();
const sqlite = db.getSqlite();

/**
 * Migrate config.json → config table
 */
function migrateConfig() {
  console.log('📝 Migrating config.json...');

  const configPath = path.join(projectRoot, 'config.json');
  if (!fs.existsSync(configPath)) {
    console.log('  ⚠️  config.json not found, skipping');
    return 0;
  }

  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  let count = 0;

  const stmt = sqlite.prepare(`
    INSERT OR REPLACE INTO config (key, value, category, description, updated_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Spreadsheet ID
  stmt.run('spreadsheetId', config.spreadsheetId, 'googleSheets', 'Google Sheets Spreadsheet ID', new Date().toISOString());
  count++;

  // Google Drive config
  if (config.googleDrive) {
    stmt.run('googleDrive', JSON.stringify(config.googleDrive), 'googleDrive', 'Google Drive configuration', new Date().toISOString());
    count++;
  }

  // Patterns
  if (config.patterns) {
    stmt.run('patterns', JSON.stringify(config.patterns), 'patterns', 'Pattern configurations', new Date().toISOString());
    count++;
  }

  // Tree structure
  if (config.treeStructure) {
    stmt.run('treeStructure', config.treeStructure, 'ui', 'Tree view structure definition', new Date().toISOString());
    count++;
  }

  // Feed structure
  if (config.feedStructure) {
    stmt.run('feedStructure', config.feedStructure, 'feed', 'Feed export structure', new Date().toISOString());
    count++;
  }

  // Look and feel
  if (config.lookAndFeel) {
    stmt.run('lookAndFeel', JSON.stringify(config.lookAndFeel), 'ui', 'Look and feel settings', new Date().toISOString());
    count++;
  }

  console.log(`  ✅ Migrated ${count} config entries`);
  return count;
}

/**
 * Migrate tasks.json → tasks table
 */
function migrateTasks() {
  console.log('📝 Migrating tasks.json...');

  const tasksPath = path.join(projectRoot, 'tasks.json');
  if (!fs.existsSync(tasksPath)) {
    console.log('  ⚠️  tasks.json not found, skipping');
    return 0;
  }

  const tasks = JSON.parse(fs.readFileSync(tasksPath, 'utf8'));

  const stmt = sqlite.prepare(`
    INSERT OR REPLACE INTO tasks (
      id, title, description, priority, due_date,
      source, "from", status, email_uid, bucket, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = sqlite.transaction((taskList) => {
    for (const task of taskList) {
      stmt.run(
        task.id,
        task.title,
        task.description || null,
        task.priority || null,
        task.dueDate || null,
        task.source || null,
        task.from || null,
        task.status || 'pending',
        task.emailUid || null,
        task.bucket || 'backlog',
        task.createdAt || new Date().toISOString()
      );
    }
  });

  insertMany(tasks);
  console.log(`  ✅ Migrated ${tasks.length} tasks`);
  return tasks.length;
}

/**
 * Migrate processed-emails.json → processed_emails table
 */
function migrateProcessedEmails() {
  console.log('📝 Migrating processed-emails.json...');

  const emailsPath = path.join(projectRoot, 'processed-emails.json');
  if (!fs.existsSync(emailsPath)) {
    console.log('  ⚠️  processed-emails.json not found, skipping');
    return 0;
  }

  const emailUids = JSON.parse(fs.readFileSync(emailsPath, 'utf8'));

  const stmt = sqlite.prepare(`
    INSERT OR IGNORE INTO processed_emails (uid)
    VALUES (?)
  `);

  const insertMany = sqlite.transaction((uids) => {
    for (const uid of uids) {
      stmt.run(uid);
    }
  });

  insertMany(emailUids);
  console.log(`  ✅ Migrated ${emailUids.length} processed email UIDs`);
  return emailUids.length;
}

/**
 * Migrate share galleries
 * from public/share directories
 */
function migrateShareGalleries() {
  console.log('📝 Migrating share galleries...');

  const shareDir = path.join(projectRoot, 'public', 'share');
  if (!fs.existsSync(shareDir)) {
    console.log('  ⚠️  share directory not found, skipping');
    return 0;
  }

  const shareDirs = fs.readdirSync(shareDir, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name);

  const stmt = sqlite.prepare(`
    INSERT OR REPLACE INTO share_galleries (
      id, title, description, created_by, creative_ids, asset_ids, metadata, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  for (const shareId of shareDirs) {
    const shareJsonPath = path.join(shareDir, shareId, 'share.json');
    if (fs.existsSync(shareJsonPath)) {
      try {
        const shareData = JSON.parse(fs.readFileSync(shareJsonPath, 'utf8'));

        stmt.run(
          shareId,
          shareData.title || null,
          shareData.description || null,
          shareData.createdBy || null,
          shareData.creativeIds ? JSON.stringify(shareData.creativeIds) : null,
          shareData.assetIds ? JSON.stringify(shareData.assetIds) : null,
          JSON.stringify(shareData),
          shareData.createdAt || new Date().toISOString()
        );
        count++;
      } catch (error) {
        console.error(`  ✗ Error migrating ${shareId}:`, error.message);
      }
    }
  }

  console.log(`  ✅ Migrated ${count} share galleries`);
  return count;
}

/**
 * NOTE: Users are in localStorage, so they need to be migrated client-side
 * or manually. The migration will create the table structure, but not populate it.
 */
function createUsersNote() {
  console.log('📝 Users table created (manual migration required)');
  console.log('  ⚠️  Users are stored in browser localStorage');
  console.log('  ⚠️  Migration must be done client-side or manually');
  console.log('  ℹ️  Table: users (id, email, password, role)');
  return 0;
}

// Run all migrations
try {
  let totalMigrated = 0;

  totalMigrated += migrateConfig();
  totalMigrated += migrateTasks();
  totalMigrated += migrateProcessedEmails();
  totalMigrated += migrateShareGalleries();
  createUsersNote();

  console.log(`\n✅ Migration complete! Total records migrated: ${totalMigrated}`);
  console.log('\n📊 Summary:');
  console.log('  ✅ Config entries migrated');
  console.log('  ✅ Tasks migrated');
  console.log('  ✅ Processed emails migrated');
  console.log('  ✅ Share galleries migrated');
  console.log('  ⚠️  Users require client-side migration');

  console.log('\n💡 Next steps:');
  console.log('  1. Update server.js to use SQLite instead of JSON files');
  console.log('  2. Update frontend to use SQLite-backed API endpoints');
  console.log('  3. Test all functionality');
  console.log('  4. Backup and remove old JSON files');

  process.exit(0);
} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}

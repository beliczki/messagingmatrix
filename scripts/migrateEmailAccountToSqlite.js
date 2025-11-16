import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('📧 Migrating email account configuration to SQLite...\n');

try {
  // Read email-account.json
  const emailAccountPath = path.join(__dirname, '..', 'email-account.json');

  if (!fs.existsSync(emailAccountPath)) {
    console.log('⚠️  email-account.json not found. Skipping migration.');
    process.exit(0);
  }

  const emailAccount = JSON.parse(fs.readFileSync(emailAccountPath, 'utf8'));
  console.log('✓ Read email-account.json');

  // Open SQLite database
  const dbPath = path.join(__dirname, '..', 'db', 'messaging-matrix.db');
  const db = new Database(dbPath);

  // Insert or replace email account configuration
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO config (key, value, category, description, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
  `);

  stmt.run(
    'emailAccount',
    JSON.stringify(emailAccount),
    'email',
    'Email account configuration for IMAP'
  );

  console.log('✓ Migrated email account configuration to SQLite');
  console.log(`  - Host: ${emailAccount.host}`);
  console.log(`  - Port: ${emailAccount.port}`);
  console.log(`  - Email: ${emailAccount.client_email}`);

  db.close();
  console.log('\n✅ Migration completed successfully!');

} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}

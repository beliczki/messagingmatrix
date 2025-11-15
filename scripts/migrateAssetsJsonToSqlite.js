import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Migrate assets.json to SQLite uploaded_assets table
 */
async function migrateAssets() {
  console.log('🔄 Starting assets.json migration to SQLite...\n');

  // Open database
  const dbPath = path.join(__dirname, '..', 'db', 'messaging-matrix.db');
  const sqlite = new Database(dbPath);

  // Check if assets.json exists
  const assetsJsonPath = path.join(__dirname, '..', 'assets.json');

  if (!fs.existsSync(assetsJsonPath)) {
    console.log('⚠️  assets.json not found, skipping migration');
    sqlite.close();
    return;
  }

  try {
    // Create table if it doesn't exist
    console.log('📦 Creating uploaded_assets table if needed...\n');
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS uploaded_assets (
        id TEXT PRIMARY KEY,
        filename TEXT NOT NULL,
        original_filename TEXT,
        upload_date TEXT DEFAULT CURRENT_TIMESTAMP,
        last_modified TEXT DEFAULT CURRENT_TIMESTAMP,
        metadata TEXT,
        tags TEXT,
        platforms TEXT,
        status TEXT DEFAULT 'active',
        directory TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Read assets.json
    const assetsData = JSON.parse(fs.readFileSync(assetsJsonPath, 'utf8'));
    const assets = assetsData.assets || [];

    console.log(`📋 Found ${assets.length} assets in assets.json\n`);

    if (assets.length === 0) {
      console.log('✅ No assets to migrate');
      sqlite.close();
      return;
    }

    // Prepare insert statement
    const stmt = sqlite.prepare(`
      INSERT OR REPLACE INTO uploaded_assets (
        id, filename, original_filename, upload_date, last_modified,
        metadata, tags, platforms, status, directory,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Use transaction for better performance
    const insertMany = sqlite.transaction((assetList) => {
      for (const asset of assetList) {
        stmt.run(
          asset.id,
          asset.filename,
          asset.originalFilename || asset.filename,
          asset.uploadDate || new Date().toISOString(),
          asset.lastModified || new Date().toISOString(),
          JSON.stringify(asset.metadata || {}),
          JSON.stringify(asset.tags || []),
          JSON.stringify(asset.platforms || []),
          asset.status || 'active',
          asset.directory || 'assets',
          asset.uploadDate || new Date().toISOString(),
          asset.lastModified || new Date().toISOString()
        );

        console.log(`  ✅ Migrated: ${asset.filename}`);
      }
    });

    // Execute migration
    insertMany(assets);

    console.log(`\n✅ Successfully migrated ${assets.length} assets to SQLite`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    sqlite.close();
  }
}

// Run migration
migrateAssets()
  .then(() => {
    console.log('\n🎉 Migration complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });

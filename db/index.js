import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import * as schema from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * SQLite Database Service
 * Provides read cache layer for Google Sheets data
 */
class DatabaseService {
  constructor() {
    this.sqlite = null;
    this.db = null;
    this.initialized = false;
  }

  /**
   * Initialize database connection
   */
  initialize() {
    if (this.initialized) {
      return this.db;
    }

    try {
      const dbPath = path.join(__dirname, 'messaging-matrix.db');
      console.log('📁 Initializing SQLite database at:', dbPath);

      // Create SQLite connection
      this.sqlite = new Database(dbPath);

      // Enable WAL mode for better concurrency
      this.sqlite.pragma('journal_mode = WAL');

      // Create Drizzle instance
      this.db = drizzle(this.sqlite, { schema });

      // Create tables if they don't exist
      this.createTables();

      // Create indexes
      this.createIndexes();

      this.initialized = true;
      console.log('✅ SQLite database initialized successfully');

      return this.db;
    } catch (error) {
      console.error('❌ Failed to initialize database:', error);
      throw error;
    }
  }

  /**
   * Create all tables
   */
  createTables() {
    // Create audiences table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audiences (
        id INTEGER PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        order_index INTEGER,
        status TEXT,
        product TEXT,
        strategy TEXT,
        buying_platform TEXT,
        data_source TEXT,
        targeting_type TEXT,
        device TEXT,
        tag TEXT,
        comment TEXT,
        campaign_name TEXT,
        campaign_id TEXT,
        lineitem_name TEXT,
        lineitem_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create topics table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS topics (
        id INTEGER PRIMARY KEY,
        key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        order_index INTEGER,
        status TEXT,
        product TEXT,
        tag1 TEXT,
        tag2 TEXT,
        tag3 TEXT,
        tag4 TEXT,
        created TEXT,
        comment TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create messages table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY,
        name TEXT,
        number INTEGER NOT NULL,
        variant TEXT NOT NULL,
        audience TEXT NOT NULL,
        topic TEXT NOT NULL,
        version INTEGER DEFAULT 1,
        pmmid TEXT,
        status TEXT,
        start_date TEXT,
        end_date TEXT,
        template TEXT,
        template_variant_classes TEXT,
        headline TEXT,
        copy1 TEXT,
        copy2 TEXT,
        image1 TEXT,
        image2 TEXT,
        image3 TEXT,
        image4 TEXT,
        image5 TEXT,
        image6 TEXT,
        video1 TEXT,
        flash TEXT,
        flash_style TEXT,
        cta TEXT,
        landing_url TEXT,
        comment TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create assets table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY,
        brand TEXT,
        product TEXT,
        type TEXT,
        visual_keyword TEXT,
        file_format TEXT,
        file_drive_id TEXT,
        file_name TEXT,
        file_size TEXT,
        file_date TEXT,
        file_dimensions TEXT,
        file_direct_link TEXT,
        file_thumbnail TEXT,
        comment TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create creatives table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS creatives (
        id INTEGER PRIMARY KEY,
        brand TEXT,
        product TEXT,
        copy_keyword TEXT,
        visual_keyword TEXT,
        template TEXT,
        version TEXT,
        file_format TEXT,
        file_drive_id TEXT,
        file_name TEXT,
        file_size TEXT,
        file_date TEXT,
        file_dimensions TEXT,
        file_direct_link TEXT,
        file_thumbnail TEXT,
        comment TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create text_formatting table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS text_formatting (
        id INTEGER PRIMARY KEY,
        text_original TEXT NOT NULL,
        text_formatted TEXT NOT NULL,
        formatting_scope TEXT,
        formatting_mc_scope TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create cache_metadata table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS cache_metadata (
        key TEXT PRIMARY KEY,
        last_sync TEXT,
        sync_status TEXT,
        record_count INTEGER,
        error_message TEXT
      )
    `);

    // Create users table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create tasks table (v2 schema - id is auto-increment integer)
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
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
        output_content TEXT,
        share_links TEXT
      )
    `);

    // Migration: Add share_links column if it doesn't exist
    try {
      this.sqlite.exec(`ALTER TABLE tasks ADD COLUMN share_links TEXT`);
    } catch (e) {
      // Column already exists, ignore
    }

    // Create config table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        category TEXT,
        description TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create share_galleries table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS share_galleries (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        created_by TEXT,
        creative_ids TEXT,
        asset_ids TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create processed_emails table
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS processed_emails (
        uid INTEGER PRIMARY KEY,
        email_from TEXT,
        subject TEXT,
        processed_at TEXT DEFAULT CURRENT_TIMESTAMP,
        tasks_created INTEGER DEFAULT 0
      )
    `);

    // Create uploaded_assets table
    this.sqlite.exec(`
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

    console.log('✅ Database tables created');
  }

  /**
   * Create indexes for performance
   */
  createIndexes() {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_messages_cell ON messages(topic, audience)',
      'CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)',
      'CREATE INDEX IF NOT EXISTS idx_messages_number ON messages(number)',
      'CREATE INDEX IF NOT EXISTS idx_assets_brand ON assets(brand)',
      'CREATE INDEX IF NOT EXISTS idx_assets_product ON assets(product)',
      'CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type)',
      'CREATE INDEX IF NOT EXISTS idx_assets_drive_id ON assets(file_drive_id)',
      'CREATE INDEX IF NOT EXISTS idx_creatives_brand ON creatives(brand)',
      'CREATE INDEX IF NOT EXISTS idx_creatives_product ON creatives(product)',
      'CREATE INDEX IF NOT EXISTS idx_creatives_drive_id ON creatives(file_drive_id)',
      'CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_bucket ON tasks(bucket)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_product ON tasks(product)',
      'CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)',
      'CREATE INDEX IF NOT EXISTS idx_config_category ON config(category)',
      'CREATE INDEX IF NOT EXISTS idx_share_galleries_created_by ON share_galleries(created_by)',
      'CREATE INDEX IF NOT EXISTS idx_processed_emails_uid ON processed_emails(uid)',
      'CREATE INDEX IF NOT EXISTS idx_uploaded_assets_filename ON uploaded_assets(filename)',
      'CREATE INDEX IF NOT EXISTS idx_uploaded_assets_status ON uploaded_assets(status)'
    ];

    indexes.forEach(index => {
      try {
        this.sqlite.exec(index);
      } catch (error) {
        console.warn('Index creation warning:', error.message);
      }
    });

    console.log('✅ Database indexes created');
  }

  /**
   * Get database instance
   */
  getDb() {
    if (!this.initialized) {
      this.initialize();
    }
    return this.db;
  }

  /**
   * Get raw SQLite instance
   */
  getSqlite() {
    if (!this.initialized) {
      this.initialize();
    }
    return this.sqlite;
  }

  /**
   * Close database connection
   */
  close() {
    if (this.sqlite) {
      this.sqlite.close();
      this.initialized = false;
      console.log('🔒 Database connection closed');
    }
  }

  /**
   * Update cache metadata
   */
  updateCacheMetadata(key, status, recordCount = 0, errorMessage = null) {
    const stmt = this.sqlite.prepare(`
      INSERT OR REPLACE INTO cache_metadata (key, last_sync, sync_status, record_count, error_message)
      VALUES (?, datetime('now'), ?, ?, ?)
    `);

    stmt.run(key, status, recordCount, errorMessage);
  }

  /**
   * Get cache metadata
   */
  getCacheMetadata(key) {
    const stmt = this.sqlite.prepare(`
      SELECT * FROM cache_metadata WHERE key = ?
    `);

    return stmt.get(key);
  }

  /**
   * Check if cache is stale (older than X minutes)
   */
  isCacheStale(key, maxAgeMinutes = 15) {
    const metadata = this.getCacheMetadata(key);

    if (!metadata || !metadata.last_sync) {
      return true;
    }

    const lastSync = new Date(metadata.last_sync);
    const now = new Date();
    const ageMinutes = (now - lastSync) / 1000 / 60;

    return ageMinutes > maxAgeMinutes;
  }
}

// Export singleton instance
const db = new DatabaseService();
export default db;

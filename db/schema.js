import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * SQLite Schema for Messaging Matrix
 * Read cache layer for Google Sheets data
 */

// Audiences table
export const audiences = sqliteTable('audiences', {
  id: integer('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  order_index: integer('order_index'),
  status: text('status'),
  product: text('product'),
  strategy: text('strategy'),
  buying_platform: text('buying_platform'),
  data_source: text('data_source'),
  targeting_type: text('targeting_type'),
  device: text('device'),
  tag: text('tag'),
  comment: text('comment'),
  campaign_name: text('campaign_name'),
  campaign_id: text('campaign_id'),
  lineitem_name: text('lineitem_name'),
  lineitem_id: text('lineitem_id'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Topics table
export const topics = sqliteTable('topics', {
  id: integer('id').primaryKey(),
  key: text('key').notNull().unique(),
  name: text('name').notNull(),
  order_index: integer('order_index'),
  status: text('status'),
  product: text('product'),
  tag1: text('tag1'),
  tag2: text('tag2'),
  tag3: text('tag3'),
  tag4: text('tag4'),
  created: text('created'),
  comment: text('comment'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Messages table
export const messages = sqliteTable('messages', {
  id: integer('id').primaryKey(),
  name: text('name'),
  number: integer('number').notNull(),
  variant: text('variant').notNull(),
  audience: text('audience').notNull(),
  topic: text('topic').notNull(),
  version: integer('version').default(1),
  pmmid: text('pmmid'),
  status: text('status'),
  start_date: text('start_date'),
  end_date: text('end_date'),
  template: text('template'),
  template_variant_classes: text('template_variant_classes'),
  headline: text('headline'),
  copy1: text('copy1'),
  copy2: text('copy2'),
  image1: text('image1'),
  image2: text('image2'),
  image3: text('image3'),
  image4: text('image4'),
  image5: text('image5'),
  image6: text('image6'),
  video1: text('video1'),
  flash: text('flash'),
  flash_style: text('flash_style'),
  cta: text('cta'),
  landing_url: text('landing_url'),
  comment: text('comment'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Assets table
export const assets = sqliteTable('assets', {
  id: integer('id').primaryKey(),
  brand: text('brand'),
  product: text('product'),
  type: text('type'),
  visual_keyword: text('visual_keyword'),
  file_format: text('file_format'),
  file_drive_id: text('file_drive_id'),
  file_name: text('file_name'),
  file_size: text('file_size'),
  file_date: text('file_date'),
  file_dimensions: text('file_dimensions'),
  file_direct_link: text('file_direct_link'),
  file_thumbnail: text('file_thumbnail'),
  comment: text('comment'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Creatives table
export const creatives = sqliteTable('creatives', {
  id: integer('id').primaryKey(),
  brand: text('brand'),
  product: text('product'),
  copy_keyword: text('copy_keyword'),
  visual_keyword: text('visual_keyword'),
  template: text('template'),
  version: text('version'),
  file_format: text('file_format'),
  file_drive_id: text('file_drive_id'),
  file_name: text('file_name'),
  file_size: text('file_size'),
  file_date: text('file_date'),
  file_dimensions: text('file_dimensions'),
  file_direct_link: text('file_direct_link'),
  file_thumbnail: text('file_thumbnail'),
  comment: text('comment'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Text Formatting Rules table
export const textFormatting = sqliteTable('text_formatting', {
  id: integer('id').primaryKey(),
  text_original: text('text_original').notNull(),
  text_formatted: text('text_formatted').notNull(),
  formatting_scope: text('formatting_scope'),
  formatting_mc_scope: text('formatting_mc_scope'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Cache metadata table - tracks sync status
export const cacheMetadata = sqliteTable('cache_metadata', {
  key: text('key').primaryKey(),
  last_sync: text('last_sync'),
  sync_status: text('sync_status'), // 'success', 'partial', 'failed'
  record_count: integer('record_count'),
  error_message: text('error_message')
});

// ========================================
// Application Data Tables
// ========================================

// Users table - migrated from localStorage
export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(), // SHA-256 hashed
  role: text('role').default('user'), // 'admin', 'user', 'demo'
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Tasks table - migrated from tasks.json
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  task_number: integer('task_number'),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority'), // 'High', 'Medium', 'Low'
  due_date: text('due_date'),
  source: text('source'),
  from: text('from'),
  status: text('status').default('pending'), // 'pending', 'completed', 'in_progress'
  workflow_type: text('workflow_type').default('general'), // 'general', 'creative'
  email_uid: integer('email_uid'),
  email_body: text('email_body'), // Full original email body
  email_subject: text('email_subject'), // Original email subject
  email_date: text('email_date'), // Original email date
  context: text('context'), // AI-extracted conversation context (markdown)
  user_notes: text('user_notes'), // User-editable additional context notes
  related_content: text('related_content'), // JSON array of related creative IDs
  bucket: text('bucket').default('backlog'), // 'backlog', 'review', 'done'
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Config table - migrated from config.json
// Stores key-value configuration with JSON support
export const config = sqliteTable('config', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON stringified for complex values
  category: text('category'), // 'pattern', 'lookAndFeel', 'googleDrive', etc.
  description: text('description'),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Share galleries table - migrated from public/share/*/share.json
export const shareGalleries = sqliteTable('share_galleries', {
  id: text('id').primaryKey(), // The share ID
  title: text('title'),
  description: text('description'),
  created_by: text('created_by'),
  creative_ids: text('creative_ids'), // JSON array of creative IDs
  asset_ids: text('asset_ids'), // JSON array of asset IDs
  metadata: text('metadata'), // JSON for additional data
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Processed emails table - migrated from processed-emails.json
export const processedEmails = sqliteTable('processed_emails', {
  uid: integer('uid').primaryKey(),
  email_from: text('email_from'),
  subject: text('subject'),
  processed_at: text('processed_at').default(sql`CURRENT_TIMESTAMP`),
  tasks_created: integer('tasks_created').default(0)
});

// Uploaded assets registry table - migrated from assets.json
// Tracks locally uploaded assets (different from Google Sheets assets cache)
export const uploadedAssets = sqliteTable('uploaded_assets', {
  id: text('id').primaryKey(),
  filename: text('filename').notNull(),
  original_filename: text('original_filename'),
  upload_date: text('upload_date').default(sql`CURRENT_TIMESTAMP`),
  last_modified: text('last_modified').default(sql`CURRENT_TIMESTAMP`),
  metadata: text('metadata'), // JSON: brand, product, type, visualKeyword, visualDescription, dimensions, placeholderName, croppingTemplate, version, format
  tags: text('tags'), // JSON array
  platforms: text('platforms'), // JSON array
  status: text('status').default('active'),
  directory: text('directory'),
  created_at: text('created_at').default(sql`CURRENT_TIMESTAMP`),
  updated_at: text('updated_at').default(sql`CURRENT_TIMESTAMP`)
});

// Indexes for performance
export const messageIndexes = {
  cellIndex: sql`CREATE INDEX IF NOT EXISTS idx_messages_cell ON messages(topic, audience)`,
  statusIndex: sql`CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status)`,
  numberIndex: sql`CREATE INDEX IF NOT EXISTS idx_messages_number ON messages(number)`
};

export const assetIndexes = {
  brandIndex: sql`CREATE INDEX IF NOT EXISTS idx_assets_brand ON assets(brand)`,
  productIndex: sql`CREATE INDEX IF NOT EXISTS idx_assets_product ON assets(product)`,
  typeIndex: sql`CREATE INDEX IF NOT EXISTS idx_assets_type ON assets(type)`,
  driveIdIndex: sql`CREATE INDEX IF NOT EXISTS idx_assets_drive_id ON assets(file_drive_id)`
};

export const creativeIndexes = {
  brandIndex: sql`CREATE INDEX IF NOT EXISTS idx_creatives_brand ON creatives(brand)`,
  productIndex: sql`CREATE INDEX IF NOT EXISTS idx_creatives_product ON creatives(product)`,
  driveIdIndex: sql`CREATE INDEX IF NOT EXISTS idx_creatives_drive_id ON creatives(file_drive_id)`
};

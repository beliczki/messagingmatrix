import db from '../db/index.js';
import fs from 'fs';
import path from 'path';

/**
 * Sync Service - Syncs data between Google Sheets and SQLite cache
 */
class SyncService {
  constructor() {
    this.syncing = false;
  }

  /**
   * Parse audiences from Sheets format
   */
  parseAudiences(rows) {
    if (!rows || rows.length < 2) return [];

    return rows.slice(1).map(row => ({
      id: parseInt(row[0]) || null,
      name: row[1] || '',
      order_index: parseInt(row[2]) || 0,
      status: row[3] || '',
      strategy: row[4] || '',
      buying_platform: row[5] || '',
      data_source: row[6] || '',
      targeting_type: row[7] || '',
      device: row[8] || '',
      tag: row[9] || '',
      key: row[10] || '',
      comment: row[11] || '',
      campaign_name: row[12] || '',
      campaign_id: row[13] || '',
      lineitem_name: row[14] || '',
      lineitem_id: row[15] || ''
    })).filter(a => a.id && a.key);
  }

  /**
   * Parse topics from Sheets format
   */
  parseTopics(rows) {
    if (!rows || rows.length < 2) return [];

    return rows.slice(1).map(row => ({
      id: parseInt(row[0]) || null,
      name: row[1] || '',
      key: row[2] || '',
      order_index: parseInt(row[3]) || 0,
      status: row[4] || '',
      product: row[5] || '',
      tag1: row[6] || '',
      tag2: row[7] || '',
      tag3: row[8] || '',
      tag4: row[9] || '',
      created: row[10] || '',
      comment: row[11] || ''
    })).filter(t => t.id && t.key);
  }

  /**
   * Parse messages from Sheets format
   */
  parseMessages(rows) {
    if (!rows || rows.length < 2) return [];

    return rows.slice(1)
      .filter(row => {
        const hasId = row[0];
        const hasAudience = row[4];
        const hasTopic = row[5];
        return hasId && hasAudience && hasTopic;
      })
      .map(row => ({
        id: parseInt(row[0]) || null,
        name: row[1] || '',
        number: parseInt(row[2]) || 1,
        variant: row[3] || 'a',
        audience: row[4],
        topic: row[5],
        version: parseInt(row[6]) || 1,
        pmmid: row[7] || '',
        status: row[8] || '',
        start_date: row[9] || '',
        end_date: row[10] || '',
        template: row[11] || '',
        template_variant_classes: row[12] || '',
        headline: row[13] || '',
        copy1: row[14] || '',
        copy2: row[15] || '',
        image1: row[16] || '',
        image2: row[17] || '',
        image3: row[18] || '',
        image4: row[19] || '',
        image5: row[20] || '',
        image6: row[21] || '',
        flash: row[22] || '',
        flash_style: row[23] || '',
        cta: row[24] || '',
        landing_url: row[25] || '',
        comment: row[26] || ''
      }));
  }

  /**
   * Parse assets from Sheets format
   */
  parseAssets(rows) {
    if (!rows || rows.length < 2) return [];

    return rows.slice(1).map(row => ({
      id: parseInt(row[0]) || null,
      brand: row[1] || '',
      product: row[2] || '',
      type: row[3] || '',
      visual_keyword: row[4] || '',
      file_format: row[5] || '',
      file_drive_id: row[6] || '',
      file_name: row[7] || '',
      file_size: row[8] || '',
      file_date: row[9] || '',
      file_dimensions: row[10] || '',
      file_direct_link: row[11] || '',
      file_thumbnail: row[12] || '',
      comment: row[13] || ''
    })).filter(a => a.id);
  }

  /**
   * Parse creatives from Sheets format
   */
  parseCreatives(rows) {
    if (!rows || rows.length < 2) return [];

    return rows.slice(1).map(row => ({
      id: parseInt(row[0]) || null,
      brand: row[1] || '',
      product: row[2] || '',
      copy_keyword: row[3] || '',
      visual_keyword: row[4] || '',
      template: row[5] || '',
      version: row[6] || '',
      file_format: row[7] || '',
      file_drive_id: row[8] || '',
      file_name: row[9] || '',
      file_size: row[10] || '',
      file_date: row[11] || '',
      file_dimensions: row[12] || '',
      file_direct_link: row[13] || '',
      file_thumbnail: row[14] || '',
      comment: row[15] || ''
    })).filter(c => c.id);
  }

  /**
   * Parse text formatting from Sheets format
   */
  parseTextFormatting(rows) {
    if (!rows || rows.length < 2) return [];

    return rows.slice(1).map(row => ({
      id: parseInt(row[0]) || null,
      text_original: row[1] || '',
      text_formatted: row[2] || '',
      formatting_scope: row[3] || '',
      formatting_mc_scope: row[4] || ''
    })).filter(t => t.id);
  }

  /**
   * Sync audiences to SQLite
   */
  async syncAudiences(sheetData) {
    const sqlite = db.getSqlite();
    const audiences = this.parseAudiences(sheetData);

    // Clear existing data
    sqlite.exec('DELETE FROM audiences');

    // Insert new data
    const stmt = sqlite.prepare(`
      INSERT INTO audiences (
        id, key, name, order_index, status, product, strategy,
        buying_platform, data_source, targeting_type, device, tag,
        comment, campaign_name, campaign_id, lineitem_name, lineitem_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = sqlite.transaction((records) => {
      for (const record of records) {
        stmt.run(
          record.id, record.key, record.name, record.order_index,
          record.status, record.product, record.strategy,
          record.buying_platform, record.data_source, record.targeting_type,
          record.device, record.tag, record.comment, record.campaign_name,
          record.campaign_id, record.lineitem_name, record.lineitem_id
        );
      }
    });

    insertMany(audiences);
    db.updateCacheMetadata('audiences', 'success', audiences.length);

    console.log(`✅ Synced ${audiences.length} audiences to SQLite`);
    return audiences.length;
  }

  /**
   * Sync topics to SQLite
   */
  async syncTopics(sheetData) {
    const sqlite = db.getSqlite();
    const topics = this.parseTopics(sheetData);

    sqlite.exec('DELETE FROM topics');

    const stmt = sqlite.prepare(`
      INSERT INTO topics (
        id, key, name, order_index, status, product,
        tag1, tag2, tag3, tag4, created, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = sqlite.transaction((records) => {
      for (const record of records) {
        stmt.run(
          record.id, record.key, record.name, record.order_index,
          record.status, record.product, record.tag1, record.tag2,
          record.tag3, record.tag4, record.created, record.comment
        );
      }
    });

    insertMany(topics);
    db.updateCacheMetadata('topics', 'success', topics.length);

    console.log(`✅ Synced ${topics.length} topics to SQLite`);
    return topics.length;
  }

  /**
   * Sync messages to SQLite
   */
  async syncMessages(sheetData) {
    const sqlite = db.getSqlite();
    const messages = this.parseMessages(sheetData);

    sqlite.exec('DELETE FROM messages');

    const stmt = sqlite.prepare(`
      INSERT INTO messages (
        id, name, number, variant, audience, topic, version, pmmid,
        status, start_date, end_date, template, template_variant_classes,
        headline, copy1, copy2, image1, image2, image3, image4, image5,
        image6, flash, flash_style, cta, landing_url, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = sqlite.transaction((records) => {
      for (const record of records) {
        stmt.run(
          record.id, record.name, record.number, record.variant,
          record.audience, record.topic, record.version, record.pmmid,
          record.status, record.start_date, record.end_date,
          record.template, record.template_variant_classes,
          record.headline, record.copy1, record.copy2,
          record.image1, record.image2, record.image3,
          record.image4, record.image5, record.image6,
          record.flash, record.flash_style, record.cta,
          record.landing_url, record.comment
        );
      }
    });

    insertMany(messages);
    db.updateCacheMetadata('messages', 'success', messages.length);

    console.log(`✅ Synced ${messages.length} messages to SQLite`);
    return messages.length;
  }

  /**
   * Sync assets to SQLite
   */
  async syncAssets(sheetData) {
    const sqlite = db.getSqlite();
    const assets = this.parseAssets(sheetData);

    sqlite.exec('DELETE FROM assets');

    const stmt = sqlite.prepare(`
      INSERT INTO assets (
        id, brand, product, type, visual_keyword, file_format,
        file_drive_id, file_name, file_size, file_date, file_dimensions,
        file_direct_link, file_thumbnail, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = sqlite.transaction((records) => {
      for (const record of records) {
        stmt.run(
          record.id, record.brand, record.product, record.type,
          record.visual_keyword, record.file_format, record.file_drive_id,
          record.file_name, record.file_size, record.file_date,
          record.file_dimensions, record.file_direct_link,
          record.file_thumbnail, record.comment
        );
      }
    });

    insertMany(assets);
    db.updateCacheMetadata('assets', 'success', assets.length);

    console.log(`✅ Synced ${assets.length} assets to SQLite`);
    return assets.length;
  }

  /**
   * Sync creatives to SQLite
   */
  async syncCreatives(sheetData) {
    const sqlite = db.getSqlite();
    const creatives = this.parseCreatives(sheetData);

    sqlite.exec('DELETE FROM creatives');

    const stmt = sqlite.prepare(`
      INSERT INTO creatives (
        id, brand, product, copy_keyword, visual_keyword, template,
        version, file_format, file_drive_id, file_name, file_size,
        file_date, file_dimensions, file_direct_link, file_thumbnail, comment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const insertMany = sqlite.transaction((records) => {
      for (const record of records) {
        stmt.run(
          record.id, record.brand, record.product, record.copy_keyword,
          record.visual_keyword, record.template, record.version,
          record.file_format, record.file_drive_id, record.file_name,
          record.file_size, record.file_date, record.file_dimensions,
          record.file_direct_link, record.file_thumbnail, record.comment
        );
      }
    });

    insertMany(creatives);
    db.updateCacheMetadata('creatives', 'success', creatives.length);

    console.log(`✅ Synced ${creatives.length} creatives to SQLite`);
    return creatives.length;
  }

  /**
   * Sync text formatting to SQLite
   */
  async syncTextFormatting(sheetData) {
    const sqlite = db.getSqlite();
    const textFormatting = this.parseTextFormatting(sheetData);

    sqlite.exec('DELETE FROM text_formatting');

    const stmt = sqlite.prepare(`
      INSERT INTO text_formatting (
        id, text_original, text_formatted, formatting_scope, formatting_mc_scope
      ) VALUES (?, ?, ?, ?, ?)
    `);

    const insertMany = sqlite.transaction((records) => {
      for (const record of records) {
        stmt.run(
          record.id, record.text_original, record.text_formatted,
          record.formatting_scope, record.formatting_mc_scope
        );
      }
    });

    insertMany(textFormatting);
    db.updateCacheMetadata('textFormatting', 'success', textFormatting.length);

    console.log(`✅ Synced ${textFormatting.length} text formatting rules to SQLite`);
    return textFormatting.length;
  }

  /**
   * Full sync from Google Sheets to SQLite
   */
  async syncAll(sheetsData) {
    if (this.syncing) {
      console.log('⚠️ Sync already in progress');
      return { success: false, message: 'Sync already in progress' };
    }

    this.syncing = true;
    const results = {};

    try {
      console.log('🔄 Starting full sync to SQLite...');

      // Sync all tables
      if (sheetsData.audiences) {
        results.audiences = await this.syncAudiences(sheetsData.audiences);
      }
      if (sheetsData.topics) {
        results.topics = await this.syncTopics(sheetsData.topics);
      }
      if (sheetsData.messages) {
        results.messages = await this.syncMessages(sheetsData.messages);
      }
      if (sheetsData.assets) {
        results.assets = await this.syncAssets(sheetsData.assets);
      }
      if (sheetsData.creatives) {
        results.creatives = await this.syncCreatives(sheetsData.creatives);
      }
      if (sheetsData.textFormatting) {
        results.textFormatting = await this.syncTextFormatting(sheetsData.textFormatting);
      }

      console.log('✅ Full sync completed successfully');
      return { success: true, results };
    } catch (error) {
      console.error('❌ Sync failed:', error);
      return { success: false, error: error.message };
    } finally {
      this.syncing = false;
    }
  }
}

export default new SyncService();

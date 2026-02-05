#!/usr/bin/env node
/**
 * Attempt to recover data from a corrupted SQLite database
 */

import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const dbPath = args[0] || 'instances/proficio/messaging-matrix.db';
const outputPath = args[1] || dbPath.replace('.db', '-recovered.db');

console.log(`\nAttempting to recover: ${dbPath}`);
console.log(`Output: ${outputPath}\n`);

if (!fs.existsSync(dbPath)) {
  console.error(`Database not found: ${dbPath}`);
  process.exit(1);
}

// Tables we want to recover
const tables = [
  'config',
  'users',
  'tasks',
  'assets',
  'shares'
];

let sourceDb;
let targetDb;

try {
  // Try to open corrupted database in readonly mode
  sourceDb = new Database(dbPath, { readonly: true, fileMustExist: true });
  console.log('✓ Opened source database');
} catch (e) {
  console.error(`✗ Cannot open source database: ${e.message}`);

  // Try to copy the file and work with that
  console.log('\nTrying alternative approach...');

  try {
    // Check file size
    const stats = fs.statSync(dbPath);
    console.log(`  File size: ${stats.size} bytes`);

    if (stats.size === 0) {
      console.error('  Database file is empty!');
      process.exit(1);
    }

    // Read first bytes to check header
    const fd = fs.openSync(dbPath, 'r');
    const header = Buffer.alloc(16);
    fs.readSync(fd, header, 0, 16, 0);
    fs.closeSync(fd);

    const headerStr = header.toString('utf8', 0, 15);
    if (headerStr !== 'SQLite format 3') {
      console.error(`  Invalid SQLite header: "${headerStr}"`);
      console.error('  File may not be a SQLite database or is severely corrupted');
      process.exit(1);
    }

    console.log('  Valid SQLite header found');
    console.error('\n  Database structure is corrupted beyond simple recovery.');
    console.log('\n  Options:');
    console.log('  1. Delete proficio instance and recreate from scratch');
    console.log('  2. Use a SQLite recovery tool (DB Browser for SQLite)');
    console.log('  3. Load a different instance (telekom)');

  } catch (e2) {
    console.error(`  ${e2.message}`);
  }

  process.exit(1);
}

try {
  // Create new database
  if (fs.existsSync(outputPath)) {
    fs.unlinkSync(outputPath);
  }

  targetDb = new Database(outputPath);
  console.log('✓ Created target database');

  // Get table schemas and data
  let recoveredTables = 0;
  let totalRows = 0;

  for (const tableName of tables) {
    try {
      // Get schema
      const schemaRow = sourceDb.prepare(
        `SELECT sql FROM sqlite_master WHERE type='table' AND name=?`
      ).get(tableName);

      if (!schemaRow || !schemaRow.sql) {
        console.log(`  - ${tableName}: not found`);
        continue;
      }

      // Create table in target
      targetDb.exec(schemaRow.sql);

      // Copy data
      const rows = sourceDb.prepare(`SELECT * FROM "${tableName}"`).all();

      if (rows.length > 0) {
        const columns = Object.keys(rows[0]);
        const quotedColumns = columns.map(c => `"${c}"`).join(', ');
        const placeholders = columns.map(() => '?').join(', ');
        const insertStmt = targetDb.prepare(
          `INSERT INTO "${tableName}" (${quotedColumns}) VALUES (${placeholders})`
        );

        const insertMany = targetDb.transaction((rows) => {
          for (const row of rows) {
            insertStmt.run(...columns.map(c => row[c]));
          }
        });

        insertMany(rows);
      }

      console.log(`  ✓ ${tableName}: ${rows.length} rows`);
      recoveredTables++;
      totalRows += rows.length;

    } catch (e) {
      console.log(`  ✗ ${tableName}: ${e.message}`);
    }
  }

  sourceDb.close();
  targetDb.close();

  console.log(`\n✓ Recovery complete!`);
  console.log(`  Tables: ${recoveredTables}/${tables.length}`);
  console.log(`  Rows: ${totalRows}`);
  console.log(`  Output: ${outputPath}`);

  console.log(`\nTo use the recovered database:`);
  console.log(`  copy "${outputPath}" "${dbPath}"`);

} catch (e) {
  console.error(`\n✗ Recovery failed: ${e.message}`);
  if (sourceDb) sourceDb.close();
  if (targetDb) targetDb.close();
  process.exit(1);
}

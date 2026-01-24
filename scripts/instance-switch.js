#!/usr/bin/env node
/**
 * Instance Switch CLI Script
 * Save/load all settings, database, and AI instructions to switch between instances
 * (ERSTE, Proficio, Telekom, Demo, etc.)
 *
 * Usage:
 *   node scripts/instance-switch.js save <name>    # Save current state to instances/<name>/
 *   node scripts/instance-switch.js load <name>    # Load state from instances/<name>/
 *   node scripts/instance-switch.js list           # List available instances
 *   node scripts/instance-switch.js current        # Show current instance
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');

// Paths
const DB_PATH = path.join(ROOT_DIR, 'db', 'messaging-matrix.db');
const AI_DIR = path.join(ROOT_DIR, 'AI');
const INSTANCES_DIR = path.join(ROOT_DIR, 'instances');
const CURRENT_FILE = path.join(INSTANCES_DIR, '.current');

// Parse arguments
const args = process.argv.slice(2);
const command = args[0];
const instanceName = args[1];

// Colors for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

function log(msg) { console.log(msg); }
function success(msg) { console.log(`${colors.green}✓${colors.reset} ${msg}`); }
function warn(msg) { console.log(`${colors.yellow}⚠${colors.reset} ${msg}`); }
function error(msg) { console.log(`${colors.red}✗${colors.reset} ${msg}`); }
function info(msg) { console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`); }

/**
 * Ensure instances directory exists
 */
function ensureInstancesDir() {
  if (!fs.existsSync(INSTANCES_DIR)) {
    fs.mkdirSync(INSTANCES_DIR, { recursive: true });
  }
}

/**
 * Get current instance name from .current file
 */
function getCurrentInstance() {
  if (fs.existsSync(CURRENT_FILE)) {
    return fs.readFileSync(CURRENT_FILE, 'utf8').trim();
  }
  return null;
}

/**
 * Set current instance name
 */
function setCurrentInstance(name) {
  ensureInstancesDir();
  fs.writeFileSync(CURRENT_FILE, name);
}

/**
 * Copy a directory recursively
 */
function copyDir(src, dest) {
  if (!fs.existsSync(src)) {
    return false;
  }

  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }

  return true;
}

/**
 * Get list of all saved instances
 */
function getInstances() {
  ensureInstancesDir();

  const instances = [];
  const entries = fs.readdirSync(INSTANCES_DIR, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const metadataPath = path.join(INSTANCES_DIR, entry.name, 'instance.json');
      if (fs.existsSync(metadataPath)) {
        try {
          const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
          instances.push({
            name: entry.name,
            savedAt: metadata.savedAt,
            description: metadata.description || '',
          });
        } catch (e) {
          instances.push({ name: entry.name, savedAt: null, description: '' });
        }
      }
    }
  }

  return instances.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * SAVE command - Save current state to an instance
 */
function saveInstance(name) {
  if (!name) {
    error('Instance name is required');
    log('\nUsage: node scripts/instance-switch.js save <name>');
    process.exit(1);
  }

  // Validate name (alphanumeric, dash, underscore only)
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    error('Instance name can only contain letters, numbers, dashes, and underscores');
    process.exit(1);
  }

  log(`\n${colors.bright}Saving instance: ${name}${colors.reset}\n`);

  const instanceDir = path.join(INSTANCES_DIR, name);
  const instanceAiDir = path.join(instanceDir, 'AI');

  // Check if database exists
  if (!fs.existsSync(DB_PATH)) {
    error(`Database not found: ${DB_PATH}`);
    process.exit(1);
  }

  // Create instance directory
  ensureInstancesDir();
  if (!fs.existsSync(instanceDir)) {
    fs.mkdirSync(instanceDir, { recursive: true });
  }

  // Copy database
  const dbDest = path.join(instanceDir, 'messaging-matrix.db');
  try {
    fs.copyFileSync(DB_PATH, dbDest);
    success(`Database saved`);
  } catch (e) {
    if (e.code === 'EBUSY') {
      error('Database is locked. Please stop the server first.');
      process.exit(1);
    }
    throw e;
  }

  // Copy AI directory
  if (fs.existsSync(AI_DIR)) {
    copyDir(AI_DIR, instanceAiDir);
    const aiFiles = fs.readdirSync(AI_DIR).filter(f => f.endsWith('.txt'));
    success(`AI instructions saved (${aiFiles.length} files)`);
  } else {
    warn('AI directory not found, skipping');
  }

  // Write metadata
  const metadata = {
    name,
    savedAt: new Date().toISOString(),
    version: '1.0',
  };
  fs.writeFileSync(
    path.join(instanceDir, 'instance.json'),
    JSON.stringify(metadata, null, 2)
  );

  // Update current
  setCurrentInstance(name);

  log(`\n${colors.green}${colors.bright}Instance "${name}" saved successfully!${colors.reset}`);
  log(`${colors.dim}Location: ${instanceDir}${colors.reset}\n`);
}

/**
 * LOAD command - Load state from an instance
 */
function loadInstance(name) {
  if (!name) {
    error('Instance name is required');
    log('\nUsage: node scripts/instance-switch.js load <name>');
    process.exit(1);
  }

  const instanceDir = path.join(INSTANCES_DIR, name);

  // Check if instance exists
  if (!fs.existsSync(instanceDir)) {
    error(`Instance "${name}" not found`);
    log('\nAvailable instances:');
    listInstances();
    process.exit(1);
  }

  log(`\n${colors.bright}Loading instance: ${name}${colors.reset}\n`);
  warn('Make sure the server is stopped before loading!\n');

  // Load database
  const dbSrc = path.join(instanceDir, 'messaging-matrix.db');
  if (fs.existsSync(dbSrc)) {
    try {
      // Backup current database first
      if (fs.existsSync(DB_PATH)) {
        const backupPath = DB_PATH + '.backup';
        fs.copyFileSync(DB_PATH, backupPath);
        info(`Current database backed up to ${path.basename(backupPath)}`);
      }

      fs.copyFileSync(dbSrc, DB_PATH);
      success('Database restored');
    } catch (e) {
      if (e.code === 'EBUSY') {
        error('Database is locked. Please stop the server first.');
        process.exit(1);
      }
      throw e;
    }
  } else {
    warn('No database file in instance, skipping');
  }

  // Load AI directory
  const instanceAiDir = path.join(instanceDir, 'AI');
  if (fs.existsSync(instanceAiDir)) {
    // Clear existing AI files
    if (fs.existsSync(AI_DIR)) {
      const existingFiles = fs.readdirSync(AI_DIR).filter(f => f.endsWith('.txt'));
      for (const file of existingFiles) {
        fs.unlinkSync(path.join(AI_DIR, file));
      }
    }

    copyDir(instanceAiDir, AI_DIR);
    const aiFiles = fs.readdirSync(instanceAiDir).filter(f => f.endsWith('.txt'));
    success(`AI instructions restored (${aiFiles.length} files)`);
  } else {
    warn('No AI directory in instance, skipping');
  }

  // Update current
  setCurrentInstance(name);

  log(`\n${colors.green}${colors.bright}Instance "${name}" loaded successfully!${colors.reset}`);
  log(`${colors.yellow}Remember to restart the server.${colors.reset}\n`);
}

/**
 * LIST command - List all available instances
 */
function listInstances() {
  const instances = getInstances();
  const current = getCurrentInstance();

  log(`\n${colors.bright}Available Instances${colors.reset}\n`);

  if (instances.length === 0) {
    log('  No instances saved yet.');
    log(`\n  Use: node scripts/instance-switch.js save <name>\n`);
    return;
  }

  const maxNameLen = Math.max(...instances.map(i => i.name.length), 10);

  for (const instance of instances) {
    const isCurrent = instance.name === current;
    const marker = isCurrent ? `${colors.green}✓${colors.reset}` : ' ';
    const nameFormatted = instance.name.padEnd(maxNameLen);
    const date = instance.savedAt
      ? new Date(instance.savedAt).toLocaleString()
      : 'unknown';

    log(`  ${marker} ${colors.bright}${nameFormatted}${colors.reset}  ${colors.dim}${date}${colors.reset}`);
  }

  log('');
}

/**
 * CURRENT command - Show current instance
 */
function showCurrent() {
  const current = getCurrentInstance();

  log(`\n${colors.bright}Current Instance${colors.reset}\n`);

  if (current) {
    log(`  ${colors.green}${current}${colors.reset}`);

    const metadataPath = path.join(INSTANCES_DIR, current, 'instance.json');
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        if (metadata.savedAt) {
          log(`  ${colors.dim}Saved: ${new Date(metadata.savedAt).toLocaleString()}${colors.reset}`);
        }
      } catch (e) {
        // ignore
      }
    }
  } else {
    log('  No instance selected');
    log(`\n  Use: node scripts/instance-switch.js load <name>`);
  }

  log('');
}

/**
 * Show help
 */
function showHelp() {
  log(`
${colors.bright}Instance Switch CLI${colors.reset}
Save/load all settings, database, and AI instructions to switch between instances.

${colors.bright}Usage:${colors.reset}
  node scripts/instance-switch.js save <name>    Save current state to instances/<name>/
  node scripts/instance-switch.js load <name>    Load state from instances/<name>/
  node scripts/instance-switch.js list           List available instances
  node scripts/instance-switch.js current        Show current instance

${colors.bright}NPM Scripts:${colors.reset}
  npm run instance:save <name>    Save instance
  npm run instance:load <name>    Load instance
  npm run instance:list           List instances

${colors.bright}What gets saved:${colors.reset}
  - SQLite database (config, users, tasks, assets, shares)
  - AI instruction files (all .txt files in /AI/)

${colors.bright}Examples:${colors.reset}
  node scripts/instance-switch.js save erste
  node scripts/instance-switch.js save telekom
  node scripts/instance-switch.js load erste
  node scripts/instance-switch.js list
`);
}

// Main
switch (command) {
  case 'save':
    saveInstance(instanceName);
    break;
  case 'load':
    loadInstance(instanceName);
    break;
  case 'list':
    listInstances();
    break;
  case 'current':
    showCurrent();
    break;
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  default:
    if (command) {
      error(`Unknown command: ${command}`);
    }
    showHelp();
    process.exit(command ? 1 : 0);
}

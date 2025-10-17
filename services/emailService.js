import { ImapFlow } from 'imapflow';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load email account configuration
let emailConfig = null;
try {
  const configPath = path.join(__dirname, '..', 'email-account.json');
  emailConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  console.log('✓ Email account configuration loaded:', emailConfig.client_email);
} catch (error) {
  console.error('✗ Error loading email account configuration:', error.message);
}

/**
 * Fetch emails from IMAP server
 * @param {number} limit - Maximum number of emails to fetch
 * @param {boolean} unseenOnly - Fetch only unseen/unread emails
 * @returns {Promise<Array>} Array of email objects
 */
export async function fetchEmails(limit = 10, unseenOnly = true) {
  if (!emailConfig) {
    throw new Error('Email configuration not loaded');
  }

  const client = new ImapFlow({
    host: emailConfig.host || 'imap.gmail.com',
    port: parseInt(emailConfig.port) || 993,
    secure: true,
    auth: {
      user: emailConfig.client_email,
      pass: emailConfig.pass
    },
    logger: false,
    // Add timeout settings to prevent hanging
    socketTimeout: 30000,
    greetingTimeout: 15000,
    connectionTimeout: 30000,
    // Disable certificate validation for self-signed certs
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    // Connect to the IMAP server
    await client.connect();
    console.log('✓ Connected to IMAP server');

    // Select INBOX
    await client.mailboxOpen('INBOX');

    // Search for emails (unseen or all)
    const searchCriteria = unseenOnly ? { seen: false } : { all: true };
    const messages = await client.search(searchCriteria);

    // Limit the number of messages
    const messageIds = messages.slice(-limit);

    const emails = [];
    for (const uid of messageIds) {
      try {
        // Fetch message details
        const message = await client.fetchOne(uid, {
          envelope: true,
          bodyStructure: true,
          source: true
        });

        // Parse the email
        const email = {
          uid,
          from: message.envelope.from?.[0]?.address || 'unknown',
          fromName: message.envelope.from?.[0]?.name || 'Unknown',
          to: message.envelope.to?.map(addr => addr.address).join(', ') || '',
          subject: message.envelope.subject || '(No Subject)',
          date: message.envelope.date || new Date(),
          messageId: message.envelope.messageId || '',
          // Try to extract text body
          body: await extractTextBody(client, uid),
          seen: message.flags?.has('\\Seen') || false
        };

        emails.push(email);
      } catch (err) {
        console.error(`Error fetching message ${uid}:`, err);
      }
    }

    await client.logout();
    console.log(`✓ Fetched ${emails.length} emails`);

    return emails;
  } catch (error) {
    console.error('✗ Error fetching emails:', error);

    // Ensure client is closed on error
    try {
      if (client && client.usable) {
        await client.logout();
      }
    } catch (logoutErr) {
      // Ignore logout errors
    }

    throw error;
  }
}

/**
 * Extract text body from email
 * @param {ImapFlow} client - IMAP client instance
 * @param {string} uid - Message UID
 * @returns {Promise<string>} Text content of the email
 */
async function extractTextBody(client, uid) {
  try {
    // Try to fetch text/plain part
    const textMessage = await client.fetchOne(uid, {
      bodyParts: ['TEXT', '1', '1.1']
    });

    // Try to get text content from different parts
    if (textMessage.bodyParts) {
      for (const part of Object.values(textMessage.bodyParts)) {
        if (part && typeof part === 'string') {
          return part;
        }
      }
    }

    // Fallback: fetch full body and try to extract text
    const fullMessage = await client.fetchOne(uid, { source: true });
    const source = fullMessage.source?.toString() || '';

    // Simple text extraction (this is basic, you might want to use a library like mailparser)
    const bodyMatch = source.match(/\r?\n\r?\n([\s\S]+)/);
    return bodyMatch ? bodyMatch[1].substring(0, 5000) : 'Could not extract body';
  } catch (err) {
    console.error('Error extracting body:', err);
    return 'Error extracting email body';
  }
}

/**
 * Mark email as seen/read
 * @param {number} uid - Message UID
 */
export async function markEmailAsSeen(uid) {
  if (!emailConfig) {
    throw new Error('Email configuration not loaded');
  }

  const client = new ImapFlow({
    host: emailConfig.host || 'imap.gmail.com',
    port: parseInt(emailConfig.port) || 993,
    secure: true,
    auth: {
      user: emailConfig.client_email,
      pass: emailConfig.pass
    },
    logger: false,
    // Add timeout settings to prevent hanging
    socketTimeout: 30000,
    greetingTimeout: 15000,
    connectionTimeout: 30000,
    // Disable certificate validation for self-signed certs
    tls: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    await client.mailboxOpen('INBOX');
    await client.messageFlagsAdd(uid, ['\\Seen']);
    await client.logout();
    console.log(`✓ Marked email ${uid} as seen`);
  } catch (error) {
    console.error('✗ Error marking email as seen:', error);

    // Ensure client is closed on error
    try {
      if (client && client.usable) {
        await client.logout();
      }
    } catch (logoutErr) {
      // Ignore logout errors
    }

    throw error;
  }
}

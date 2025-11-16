import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

/**
 * Fetch emails from IMAP server
 * @param {number} limit - Maximum number of emails to fetch
 * @param {boolean} unseenOnly - Fetch only unseen/unread emails
 * @param {Object} emailConfig - Email configuration object
 * @returns {Promise<Array>} Array of email objects
 */
export async function fetchEmails(limit = 10, unseenOnly = true, emailConfig = null) {
  if (!emailConfig) {
    throw new Error('Email configuration not provided');
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
 * Extract text body from email using mailparser
 * @param {ImapFlow} client - IMAP client instance
 * @param {string} uid - Message UID
 * @returns {Promise<string>} Text content of the email
 */
async function extractTextBody(client, uid) {
  try {
    // Fetch the full email source
    const fullMessage = await client.fetchOne(uid, { source: true });
    const source = fullMessage.source;

    // Parse the email using mailparser
    const parsed = await simpleParser(source);

    // Debug logging
    console.log(`📧 Parsing email UID ${uid}:`);
    console.log(`  - Has text: ${!!parsed.text} (${parsed.text?.length || 0} chars)`);
    console.log(`  - Has html: ${!!parsed.html} (${typeof parsed.html === 'string' ? parsed.html.length : 0} chars)`);
    console.log(`  - Has textAsHtml: ${!!parsed.textAsHtml}`);

    // Prefer text version, fallback to HTML with tags stripped, then raw text
    let body = '';

    if (parsed.text) {
      // Use plain text version if available
      body = parsed.text;
      console.log(`  ✓ Using plain text (${body.length} chars)`);
    } else if (parsed.html) {
      // Strip HTML tags if only HTML is available
      const htmlString = typeof parsed.html === 'string' ? parsed.html : String(parsed.html);
      body = htmlString
        .replace(/<style[^>]*>.*?<\/style>/gis, '')
        .replace(/<script[^>]*>.*?<\/script>/gis, '')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      console.log(`  ✓ Using HTML converted to text (${body.length} chars)`);
    } else if (parsed.textAsHtml) {
      // Fallback to textAsHtml
      body = parsed.textAsHtml
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      console.log(`  ✓ Using textAsHtml (${body.length} chars)`);
    } else {
      body = 'Could not extract text body';
      console.log(`  ✗ No text content found`);
    }

    // Clean up extra whitespace
    body = body
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    console.log(`  → Final body: ${body.length} chars`);

    return body;
  } catch (err) {
    console.error('Error extracting body:', err);
    return 'Error extracting email body';
  }
}

/**
 * Mark email as seen/read
 * @param {number} uid - Message UID
 * @param {Object} emailConfig - Email configuration object
 */
export async function markEmailAsSeen(uid, emailConfig) {
  if (!emailConfig) {
    throw new Error('Email configuration not provided');
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

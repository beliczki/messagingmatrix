// Message (MC) MCP tools: create / remove / update / get + list_mc + get_mc_reporting.
//
// MC label = "MC" + Number + Variant (e.g. MC282a). Create auto-picks the next
// variant if the (topic, audience) cell already has messages; auto-picks a new
// number when the cell is empty — matches useMatrix.addMessage:375.

import { z } from 'zod';
import { readAll, createColumnMap, rowToObject, appendRow, updateRow, deleteRow, findRow } from '../sheets.js';
import { generatePMMID, generateTraffickingFields } from '../../src/utils/patternEvaluator.js';

const SHEET_MESSAGES  = 'Messages';
const SHEET_REPORTING = 'Reporting';
const SHEET_AUDIENCES = 'Audiences';

function findHeaderCol(header, target) {
  const lower = target.toLowerCase();
  return header.findIndex(h => String(h || '').trim().toLowerCase() === lower);
}

function normalizeInputToHeader(input, header) {
  const out = {};
  for (const [k, v] of Object.entries(input)) {
    const idx = findHeaderCol(header, k);
    if (idx >= 0) out[header[idx]] = v;
  }
  return out;
}

function asText(obj) {
  return { content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] };
}

function mcLabel(numberOrRow, maybeVariant) {
  if (typeof numberOrRow === 'object') {
    const n = numberOrRow['Number'] || numberOrRow['number'] || '';
    const v = (numberOrRow['Variant'] || numberOrRow['variant'] || 'a').toString().toLowerCase();
    return `MC${n}${v}`;
  }
  return `MC${numberOrRow}${(maybeVariant || 'a').toLowerCase()}`;
}

function readConfigPatterns(getSqlite) {
  try {
    const row = getSqlite().prepare("SELECT value FROM config WHERE key = 'patterns'").get();
    return row?.value ? JSON.parse(row.value) : {};
  } catch {
    return {};
  }
}

async function readAudiences(getAccessToken, spreadsheetId) {
  const rows = await readAll(getAccessToken, spreadsheetId, SHEET_AUDIENCES);
  if (rows.length < 2) return [];
  const header = rows[0];
  const cmap = createColumnMap(header);
  return rows.slice(1).filter(r => r.some(c => c !== '' && c != null)).map(r => rowToObject(r, cmap));
}

export function registerMessageTools(server, ctx) {
  const { getAccessToken, getSpreadsheetId, getSqlite } = ctx;

  server.registerTool(
    'mc_create',
    {
      title: 'Create a messaging card (MC)',
      description: 'Append a new MC row in Messages. Auto-fills number/variant (next free slot in the topic×audience cell) and generates PMMID + trafficking fields.',
      inputSchema: {
        audience_key: z.string().describe('Target audience key (from list_audiences)'),
        topic_key:    z.string().describe('Target topic key (from list_topics)'),
        template:     z.string().describe('Template name (from list_templates)'),
        status:       z.string().optional().default('INCOMING'),
        headline:     z.string().optional(),
        copy1:        z.string().optional(),
        copy2:        z.string().optional(),
        cta:          z.string().optional(),
        disclaimer:   z.string().optional(),
        flash:        z.string().optional(),
        image1:       z.string().optional(),
        image2:       z.string().optional(),
        image3:       z.string().optional(),
        image4:       z.string().optional(),
        image5:       z.string().optional(),
        image6:       z.string().optional(),
        video1:       z.string().optional(),
        landing_url:  z.string().optional(),
        comment:      z.string().optional(),
        number:       z.number().optional().describe('Override auto-numbering'),
        variant:      z.string().optional().describe('Override auto-variant (single lowercase letter)'),
        version:      z.number().optional().default(1),
      },
    },
    async (input) => {
      const spreadsheetId = getSpreadsheetId();
      const rows = await readAll(getAccessToken, spreadsheetId, SHEET_MESSAGES);
      if (rows.length === 0) throw new Error(`Sheet "${SHEET_MESSAGES}" has no header row`);
      const header = rows[0];
      const cmap = createColumnMap(header);

      const existing = rows.slice(1).filter(r => r.some(c => c !== '' && c != null));

      // Auto-pick number + variant if not provided
      let number = input.number;
      let variant = (input.variant || '').toLowerCase();
      if (!number) {
        const inCell = existing.filter(r =>
          String(r[cmap['Audience_Key']] || '').trim() === input.audience_key &&
          String(r[cmap['Topic_Key']] || '').trim()    === input.topic_key &&
          String(r[cmap['Status']] || '').trim().toLowerCase() !== 'deleted'
        );
        if (inCell.length > 0) {
          number = parseInt(inCell[0][cmap['Number']] || '0', 10);
          if (!variant) {
            const variants = inCell.map(r => (r[cmap['Variant']] || 'a').toString());
            const maxV = variants.sort().pop();
            variant = String.fromCharCode(maxV.charCodeAt(0) + 1);
          }
        } else {
          const maxN = existing.reduce((max, r) => {
            const v = parseInt(r[cmap['Number']] || '0', 10);
            return Number.isFinite(v) && v > max ? v : max;
          }, 0);
          number = maxN + 1;
          if (!variant) variant = 'a';
        }
      }
      if (!variant) variant = 'a';

      // Auto-generate ID
      const nextId = existing.reduce((max, r) => {
        const v = parseInt(r[cmap['ID']] || '0', 10);
        return Number.isFinite(v) && v > max ? v : max;
      }, 0) + 1;

      // Compute PMMID + trafficking using the same patterns as the UI
      const patterns = readConfigPatterns(getSqlite);
      const audiences = await readAudiences(getAccessToken, spreadsheetId);
      const msgObj = {
        id: nextId,
        number,
        variant,
        version: input.version || 1,
        audience: input.audience_key,
        topic: input.topic_key,
        template: input.template,
        status: input.status || 'INCOMING',
        headline: input.headline || '',
        copy1: input.copy1 || '',
        copy2: input.copy2 || '',
        cta: input.cta || '',
        disclaimer: input.disclaimer || '',
        flash: input.flash || '',
        image1: input.image1 || '',
        image2: input.image2 || '',
        image3: input.image3 || '',
        image4: input.image4 || '',
        image5: input.image5 || '',
        image6: input.image6 || '',
        video1: input.video1 || '',
        landing_url: input.landing_url || '',
        landingUrl: input.landing_url || '',
        comment: input.comment || '',
      };
      const pmmid = patterns.pmmid ? generatePMMID(msgObj, audiences.map(a => ({ ...a, key: a['Key'], product: a['Product'], strategy: a['Strategy'], buying_platform: a['Buying_platform'], data_source: a['Data_source'], device: a['Device'] })), patterns.pmmid) : '';
      const trafficking = patterns.trafficking
        ? generateTraffickingFields({ ...msgObj, pmmid }, audiences.map(a => ({ ...a, key: a['Key'] })), patterns.trafficking)
        : {};

      // Map to sheet headers (Audience_Key, Topic_Key, PMMID, Landing_URL, etc.)
      const rowObj = normalizeInputToHeader({
        ID: nextId,
        Number: number,
        Variant: variant,
        Version: input.version || 1,
        Audience_Key: input.audience_key,
        Topic_Key: input.topic_key,
        Template: input.template,
        Status: input.status || 'INCOMING',
        Headline: input.headline,
        Copy1: input.copy1,
        Copy2: input.copy2,
        CTA: input.cta,
        Disclaimer: input.disclaimer,
        Flash: input.flash,
        Image1: input.image1,
        Image2: input.image2,
        Image3: input.image3,
        Image4: input.image4,
        Image5: input.image5,
        Image6: input.image6,
        Video1: input.video1,
        Landing_URL: input.landing_url,
        Comment: input.comment,
        PMMID: pmmid,
        ...trafficking,
      }, header);

      const result = await appendRow(getAccessToken, spreadsheetId, SHEET_MESSAGES, rowObj);
      return asText({ created: { id: nextId, mc_label: mcLabel(number, variant), pmmid }, wroteRow: result.values });
    }
  );

  server.registerTool(
    'mc_remove',
    {
      title: 'Remove a messaging card',
      description: 'Delete an MC row from Messages by its label (e.g. MC282a).',
      inputSchema: {
        mc_label: z.string().regex(/^MC\d+[a-z]$/i).describe('MC label like MC282a'),
      },
    },
    async ({ mc_label }) => {
      const spreadsheetId = getSpreadsheetId();
      const m = mc_label.match(/^MC(\d+)([a-z])$/i);
      if (!m) throw new Error('Invalid mc_label, expected MC<number><variant>');
      const number = parseInt(m[1], 10);
      const variant = m[2].toLowerCase();
      const found = await findRow(getAccessToken, spreadsheetId, SHEET_MESSAGES, (_row, obj) => {
        return parseInt(obj['Number'] || '0', 10) === number
          && (obj['Variant'] || '').toString().toLowerCase() === variant;
      });
      if (!found) throw new Error(`MC "${mc_label}" not found`);
      await deleteRow(getAccessToken, spreadsheetId, SHEET_MESSAGES, found.index);
      return asText({ removed: { mc_label, index: found.index, pmmid: found.object['PMMID'] } });
    }
  );

  server.registerTool(
    'mc_update',
    {
      title: 'Update a messaging card',
      description: 'Update fields on an existing MC row, matched by label (MC282a). Regenerates PMMID + trafficking fields if audience/topic/number/variant/version change.',
      inputSchema: {
        mc_label: z.string().regex(/^MC\d+[a-z]$/i),
        updates: z.record(z.string(), z.any()).describe('Object of header-name → new value. See list_mc output for exact header names.'),
      },
    },
    async ({ mc_label, updates }) => {
      const spreadsheetId = getSpreadsheetId();
      const m = mc_label.match(/^MC(\d+)([a-z])$/i);
      if (!m) throw new Error('Invalid mc_label');
      const number = parseInt(m[1], 10);
      const variant = m[2].toLowerCase();
      const found = await findRow(getAccessToken, spreadsheetId, SHEET_MESSAGES, (_row, obj) => {
        return parseInt(obj['Number'] || '0', 10) === number
          && (obj['Variant'] || '').toString().toLowerCase() === variant;
      });
      if (!found) throw new Error(`MC "${mc_label}" not found`);

      const regenKeys = new Set(['audience_key', 'topic_key', 'number', 'variant', 'version']);
      const updatesLower = {};
      for (const [k, v] of Object.entries(updates)) updatesLower[k.toLowerCase()] = v;
      const mustRegenPmmid = Object.keys(updatesLower).some(k => regenKeys.has(k));

      let extras = {};
      if (mustRegenPmmid) {
        const patterns = readConfigPatterns(getSqlite);
        const audiences = await readAudiences(getAccessToken, spreadsheetId);
        const merged = {
          number: updatesLower['number']    ?? parseInt(found.object['Number'] || '0', 10),
          variant: updatesLower['variant']  ?? (found.object['Variant'] || 'a'),
          version: updatesLower['version']  ?? parseInt(found.object['Version'] || '1', 10),
          audience: updatesLower['audience_key'] ?? found.object['Audience_Key'],
          topic:    updatesLower['topic_key']    ?? found.object['Topic_Key'],
        };
        if (patterns.pmmid) extras.PMMID = generatePMMID(merged, audiences.map(a => ({ ...a, key: a['Key'], product: a['Product'], strategy: a['Strategy'], buying_platform: a['Buying_platform'], data_source: a['Data_source'], device: a['Device'] })), patterns.pmmid);
        if (patterns.trafficking) extras = { ...extras, ...generateTraffickingFields({ ...merged, pmmid: extras.PMMID }, audiences.map(a => ({ ...a, key: a['Key'] })), patterns.trafficking) };
      }

      const rowObj = normalizeInputToHeader({ ...updates, ...extras }, found.header);
      const result = await updateRow(getAccessToken, spreadsheetId, SHEET_MESSAGES, found.index + 1, rowObj, found.header, found.row);
      return asText({ updated: { mc_label, index: found.index, newRow: result.values, regenerated: Object.keys(extras) } });
    }
  );

  server.registerTool(
    'mc_get',
    {
      title: 'Get a messaging card',
      description: 'Returns the full MC row as an object keyed by header names.',
      inputSchema: {
        mc_label: z.string().regex(/^MC\d+[a-z]$/i),
      },
    },
    async ({ mc_label }) => {
      const spreadsheetId = getSpreadsheetId();
      const m = mc_label.match(/^MC(\d+)([a-z])$/i);
      if (!m) throw new Error('Invalid mc_label');
      const number = parseInt(m[1], 10);
      const variant = m[2].toLowerCase();
      const found = await findRow(getAccessToken, spreadsheetId, SHEET_MESSAGES, (_row, obj) => {
        return parseInt(obj['Number'] || '0', 10) === number
          && (obj['Variant'] || '').toString().toLowerCase() === variant;
      });
      if (!found) throw new Error(`MC "${mc_label}" not found`);
      return asText({ mc_label, mc: found.object });
    }
  );

  server.registerTool(
    'list_mc',
    {
      title: 'List messaging cards (with optional filters)',
      description: 'List MCs filtered by topic_key, audience_key, product, status, or live status in AdForm (monitoring_status).',
      inputSchema: {
        topic_key:    z.string().optional(),
        audience_key: z.string().optional(),
        product:      z.string().optional().describe('Product value matched against the MC\'s audience.Product'),
        status:       z.string().optional().describe('Workflow status (e.g. INCOMING, ACTIVE)'),
        monitoring_status: z.enum(['live', 'inactive']).optional().describe('Join with Reporting tab label-level status'),
      },
    },
    async (input) => {
      const spreadsheetId = getSpreadsheetId();
      const [mrows, arows, rrows] = await Promise.all([
        readAll(getAccessToken, spreadsheetId, SHEET_MESSAGES),
        input.product ? readAll(getAccessToken, spreadsheetId, SHEET_AUDIENCES) : Promise.resolve([]),
        input.monitoring_status ? readAll(getAccessToken, spreadsheetId, SHEET_REPORTING).catch(() => []) : Promise.resolve([]),
      ]);
      if (mrows.length < 2) return asText({ count: 0, messages: [] });
      const header = mrows[0];
      const cmap = createColumnMap(header);

      // Build audience → product lookup if we're filtering by product
      const audProduct = new Map();
      if (arows.length > 1) {
        const ah = arows[0];
        const acmap = createColumnMap(ah);
        for (let i = 1; i < arows.length; i++) {
          const key = arows[i][acmap['Key']];
          const product = arows[i][acmap['Product']];
          if (key) audProduct.set(String(key).trim(), String(product || '').trim());
        }
      }

      // Build MC → live status lookup if filtering by monitoring_status
      const mcLive = new Map();
      if (rrows.length > 1) {
        const rh = rrows[0];
        const rcmap = createColumnMap(rh);
        for (let i = 1; i < rrows.length; i++) {
          const r = rrows[i];
          if (String(r[rcmap['Level']] || '').trim() === 'label') {
            const label = String(r[rcmap['MC_Label']] || '').trim();
            const status = String(r[rcmap['AdForm_Status']] || '').trim();
            if (label) mcLive.set(label, status);
          }
        }
      }

      let out = mrows.slice(1)
        .filter(r => r.some(c => c !== '' && c != null))
        .map(r => rowToObject(r, cmap));

      if (input.topic_key)    out = out.filter(o => String(o['Topic_Key']    || '').trim() === input.topic_key);
      if (input.audience_key) out = out.filter(o => String(o['Audience_Key'] || '').trim() === input.audience_key);
      if (input.status)       out = out.filter(o => String(o['Status']       || '').trim().toUpperCase() === input.status.toUpperCase());
      if (input.product)      out = out.filter(o => audProduct.get(String(o['Audience_Key'] || '').trim())?.toLowerCase() === input.product.toLowerCase());
      if (input.monitoring_status) {
        out = out.filter(o => {
          const label = `MC${o['Number']}${String(o['Variant'] || 'a').toLowerCase()}`;
          const status = mcLive.get(label);
          return input.monitoring_status === 'live' ? status === 'live' : status !== 'live';
        });
      }

      // Project a compact subset for list output (still include label for follow-up mc_get)
      const compact = out.map(o => ({
        mc_label: `MC${o['Number']}${String(o['Variant'] || 'a').toLowerCase()}`,
        audience_key: o['Audience_Key'],
        topic_key: o['Topic_Key'],
        status: o['Status'],
        template: o['Template'],
        headline: o['Headline'],
        copy1: o['Copy1'],
        cta: o['CTA'],
        pmmid: o['PMMID'],
      }));

      return asText({ count: compact.length, messages: compact });
    }
  );

  server.registerTool(
    'get_mc_reporting',
    {
      title: 'Get CTR + impressions for an MC',
      description: 'Reads the Reporting sheet. Returns label-level rollup + per-banner breakdown.',
      inputSchema: {
        mc_label: z.string().regex(/^MC\d+[a-z]$/i),
      },
    },
    async ({ mc_label }) => {
      const spreadsheetId = getSpreadsheetId();
      const rows = await readAll(getAccessToken, spreadsheetId, SHEET_REPORTING).catch(() => []);
      if (rows.length < 2) return asText({ mc_label, label: null, banners: [], note: 'Reporting sheet is empty — run the AdForm sync first' });
      const header = rows[0];
      const cmap = createColumnMap(header);
      const objs = rows.slice(1)
        .filter(r => r.some(c => c !== '' && c != null))
        .map(r => rowToObject(r, cmap))
        .filter(o => String(o['MC_Label'] || '').trim() === mc_label);

      const label = objs.find(o => o['Level'] === 'label') || null;
      const banners = objs.filter(o => o['Level'] === 'banner')
        .map(o => ({
          size: o['Size'],
          banner_id: o['AdForm_Banner_ID'],
          banner_name: o['AdForm_Banner_Name'],
          status: o['AdForm_Status'],
          impressions: Number(o['Impressions']) || 0,
          clicks: Number(o['Clicks']) || 0,
          ctr: Number(o['CTR']) || 0,
        }));

      return asText({
        mc_label,
        label: label ? {
          impressions: Number(label['Impressions']) || 0,
          clicks:      Number(label['Clicks']) || 0,
          ctr:         Number(label['CTR']) || 0,
          live:        label['AdForm_Status'] === 'live',
        } : null,
        banners,
      });
    }
  );
}

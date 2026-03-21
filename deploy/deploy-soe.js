#!/usr/bin/env node
/**
 * Deploy all 25 AssetCo SOE definitions to Sentinel-Ops.
 *
 * Usage:
 *   SOE_API_URL=https://your-alb.amazonaws.com SOE_API_KEY=your-key node deploy/deploy-soe.js
 *   SOE_API_URL=... SOE_API_KEY=... node deploy/deploy-soe.js --dry-run
 *   SOE_API_URL=... SOE_API_KEY=... node deploy/deploy-soe.js --app trade-sentinel
 *
 * See: https://github.com/aiworksllc/sentinel-ops/blob/main/docs/GETTING_STARTED.md
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';
import http from 'node:http';

const SOE_DIR = join(fileURLToPath(import.meta.url), '..', '..', 'soe-definitions');
const DRY_RUN = process.argv.includes('--dry-run');
const appIdx = process.argv.indexOf('--app');
const APP_FILTER = appIdx !== -1 ? process.argv[appIdx + 1] : '';

// ── Pre-flight checks ─────────────────────────────────────────────────

if (!process.env.SOE_API_URL) {
  console.error('ERROR: SOE_API_URL not set.\n');
  console.error('  Export your Sentinel-Ops API endpoint:');
  console.error('    export SOE_API_URL=https://your-sentinel-ops-alb.amazonaws.com\n');
  console.error('  See: https://github.com/aiworksllc/sentinel-ops/blob/main/docs/GETTING_STARTED.md');
  process.exit(1);
}
if (!process.env.SOE_API_KEY) {
  console.error('ERROR: SOE_API_KEY not set.\n');
  console.error('  Retrieve your API key from Secrets Manager:');
  console.error('    aws secretsmanager get-secret-value --secret-id <SoeApiKeySecretArn> --query SecretString --output text | jq -r .key\n');
  console.error('  See: https://github.com/aiworksllc/sentinel-ops/blob/main/docs/GETTING_STARTED.md');
  process.exit(1);
}

const API_URL = process.env.SOE_API_URL.replace(/\/+$/, '');
const API_KEY = process.env.SOE_API_KEY;

// ── HTTP helper ───────────────────────────────────────────────────────

function postDefinition(soe) {
  return new Promise((resolve) => {
    const payload = JSON.stringify(soe);
    const url = new URL(`${API_URL}/v1/definitions`);
    const transport = url.protocol === 'https:' ? https : http;

    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'X-SOE-Api-Key': API_KEY,
      },
      timeout: 10000,
      rejectUnauthorized: false,
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', (err) => resolve({ status: 0, body: err.message, error: true }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'Timeout', error: true }); });
    req.write(payload);
    req.end();
  });
}

// ── Discover SOE files grouped by app ─────────────────────────────────

function discoverDefinitions() {
  const apps = {};
  const entries = readdirSync(SOE_DIR);

  for (const entry of entries) {
    const fullPath = join(SOE_DIR, entry);
    if (!statSync(fullPath).isDirectory()) continue;
    if (APP_FILTER && entry !== APP_FILTER) continue;

    const files = readdirSync(fullPath).filter(f => f.endsWith('.soe.json'));
    if (files.length === 0) continue;

    apps[entry] = files.map(f => ({
      file: f,
      path: join(fullPath, f),
      soe: JSON.parse(readFileSync(join(fullPath, f), 'utf-8')),
    }));
  }
  return apps;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  const apps = discoverDefinitions();
  const appNames = Object.keys(apps).sort();
  const totalDefs = appNames.reduce((sum, app) => sum + apps[app].length, 0);

  console.log(`\n  AssetCo SOE Deployment${DRY_RUN ? ' (DRY RUN)' : ''}`);
  console.log(`  Target: ${API_URL}`);
  console.log(`  Apps: ${appNames.length}, Definitions: ${totalDefs}\n`);

  let ok = 0;
  let fail = 0;

  for (const app of appNames) {
    const defs = apps[app];
    console.log(`  ${app} (${defs.length} agents):`);

    for (const { soe } of defs) {
      const agentId = soe.agentId || soe.file;
      const euClass = soe.classification?.euAiActClass || soe.classification?.euAiAct || '';

      if (DRY_RUN) {
        console.log(`    [DRY]  ${agentId.padEnd(25)} ${euClass}`);
        ok++;
        continue;
      }

      const result = await postDefinition(soe);
      if (result.status >= 200 && result.status < 300) {
        console.log(`    [OK]   ${agentId.padEnd(25)} ${euClass}`);
        ok++;
      } else if (result.error) {
        console.log(`    [FAIL] ${agentId.padEnd(25)} ${result.body}`);
        fail++;
      } else {
        console.log(`    [FAIL] ${agentId.padEnd(25)} HTTP ${result.status}: ${result.body.slice(0, 100)}`);
        fail++;
      }
    }
    console.log();
  }

  console.log(`  Summary: ${ok}/${totalDefs} deployed${fail ? `, ${fail} failed` : ''}${DRY_RUN ? ' (dry run)' : ''}\n`);
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(err => { console.error(`Fatal: ${err.message}`); process.exit(1); });

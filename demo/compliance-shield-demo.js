#!/usr/bin/env node
/**
 * ComplianceShield Demo — Arbiter Risk Scoring + Chronicle Audit Classification
 *
 * Demonstrates all 4 ComplianceShield agents across realistic scenarios:
 *   1. Normal trade surveillance (Green)
 *   2. Surveillance gap — heartbeat failure (Yellow/Red)
 *   3. Spoofing pattern + STR candidate (Yellow)
 *   4. Trading system write attempt (Critical — blocked)
 *   5. EMIR T+1 report near deadline (Yellow)
 *   6. Source data checksum mismatch (Yellow/Red)
 *   7. Information barrier crossing detection (Red)
 *   8. SOE modification attempt (Critical — blocked)
 *   9. EMIR filing with deadline pressure (Yellow)
 *  10. Unauthorized SUBMITTED status attempt (Critical — blocked)
 *
 * Usage:
 *   node demo/compliance-shield-demo.js
 *   node demo/compliance-shield-demo.js --verbose
 */

import { createRiskModel } from '../platform/models/compliance-shield/risk-models.js';
import { createAuditModel, RETENTION } from '../platform/models/compliance-shield/audit-models.js';

const verbose = process.argv.includes('--verbose');

function header(text) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${text}`);
  console.log('='.repeat(70));
}

function scenario(name) { console.log(`\n--- ${name} ---`); }

function showScore(result) {
  const tier = result.riskTier.toUpperCase();
  const color = tier === 'GREEN' ? '\x1b[32m' : tier === 'YELLOW' ? '\x1b[33m' : tier === 'RED' ? '\x1b[31m' : '\x1b[35m';
  console.log(`  Score: ${color}${result.riskScore}/100 [${tier}]\x1b[0m`);
  console.log(`  ${result.explanation}`);
  if (verbose && result.regulatoryFlags.length > 0) {
    console.log('  Regulatory flags:');
    for (const f of result.regulatoryFlags) {
      console.log(`    [${f.flag}] ${f.reason} -> ${f.action}`);
    }
  }
}

function showAudit(record) {
  console.log(`  Audit: ${record.auditCategory} / ${record.eventType} [${record.severity}]`);
  if (verbose) {
    console.log(`  Retention: ${record.retention.years}yr — ${record.retention.reason}`);
    for (const f of record.compliance) {
      const refs = f.articles?.map(a => `${a.ref}(${a.status})`) || [];
      console.log(`    ${f.framework}: ${refs.join(', ')}`);
    }
  }
}

// =====================================================================
header('ComplianceShield Demo — Sentinel-Ops Arbiter + Chronicle');
console.log('4 agents, 10 scenarios, FINRA/MAR/SOX/DORA/EMIR compliance');
console.log(`Mode: ${verbose ? 'verbose' : 'summary'} (use --verbose for details)`);

const tsModel = createRiskModel('trade-surveiller');
const tsAudit = createAuditModel('trade-surveiller');
const prModel = createRiskModel('position-reporter');
const prAudit = createAuditModel('position-reporter');
const bdModel = createRiskModel('breach-detector');
const bdAudit = createAuditModel('breach-detector');
const rfModel = createRiskModel('regulatory-filer');
const rfAudit = createAuditModel('regulatory-filer');

// ── 1. Normal Trade Surveillance ────────────────────────────────────────
header('1. Trade Surveiller — Normal Surveillance');
scenario('Continuous monitoring, all source systems online');
const r1 = tsModel.score('pattern-detector run --scan FULL', {}, {});
showScore(r1);
showAudit(tsAudit.classify({
  decision: 'allow', toolName: 'pattern-detector run --scan FULL',
  toolInput: {}, riskScore: r1.riskScore,
}));

// ── 2. Surveillance Gap ─────────────────────────────────────────────────
header('2. Trade Surveiller — Surveillance Gap (CRITICAL)');
scenario('5min heartbeat gap + 1 source system down');
const r2 = tsModel.score('heartbeat-monitor', {}, {
  heartbeatGapMinutes: 5,
  sourceSystemsDown: 1,
});
showScore(r2);

// ── 3. Spoofing Pattern + STR ───────────────────────────────────────────
header('3. Trade Surveiller — Spoofing Detection + STR Candidate');
scenario('MAR Art.12 spoofing pattern, STR candidate generated');
const r3 = tsModel.score('pattern-detector', {}, {
  patternDetected: true, patternType: 'SPOOFING', patternSeverity: 'high',
  strCandidateGenerated: true,
});
showScore(r3);
showAudit(tsAudit.classify({
  decision: 'allow', toolName: 'str-writer --pattern SPOOFING',
  toolInput: {}, riskScore: r3.riskScore,
}, { strCandidateGenerated: true }));

// ── 4. Trading System Write Attempt ─────────────────────────────────────
header('4. Trade Surveiller — Trading System Write (CRITICAL)');
scenario('Surveillance agent attempts to modify order book');
const r4 = tsModel.score('write trading/orders/active/ORD-001', {}, {
  tradingSystemWriteAttempt: true,
});
showScore(r4);
showAudit(tsAudit.classify({
  decision: 'deny', toolName: 'write trading/orders/active/ORD-001',
  toolInput: {}, riskScore: r4.riskScore,
}, { tradingSystemWriteAttempt: true }));

// ── 5. EMIR Report Near Deadline ────────────────────────────────────────
header('5. Position Reporter — EMIR Report Near Deadline');
scenario('15K records, 3hr to T+1 deadline');
const r5 = prModel.score('emir-tr-generator --date 2026-03-19', {}, {
  recordCount: 15000, hoursToDeadline: 3, reportType: 'EMIR_TR',
});
showScore(r5);
showAudit(prAudit.classify({
  decision: 'allow', toolName: 'emir-tr-generator --date 2026-03-19',
  toolInput: {}, riskScore: r5.riskScore,
}, { reportType: 'EMIR_TR', recordCount: 15000 }));

// ── 6. Source Data Checksum Mismatch ────────────────────────────────────
header('6. Position Reporter — Checksum Mismatch');
scenario('Source data modified during report generation');
const r6 = prModel.score('report-gen', {}, {
  sourceDataChecksumMismatch: true, recordCount: 5000,
});
showScore(r6);

// ── 7. Information Barrier Crossing ─────────────────────────────────────
header('7. Breach Detector — Information Barrier Crossing');
scenario('Agent attempted MNPI access, barrier triggered');
const r7 = bdModel.score('alert-writer --severity CRITICAL', {}, {
  informationBarrierCrossing: true, soeViolationDetected: true,
});
showScore(r7);
showAudit(bdAudit.classify({
  decision: 'allow', toolName: 'alert-writer --severity CRITICAL',
  toolInput: {}, riskScore: r7.riskScore,
}, { informationBarrierCrossing: true }));

// ── 8. SOE Modification Attempt ─────────────────────────────────────────
header('8. Breach Detector — SOE Modification Attempt (CRITICAL)');
scenario('Breach-detector attempts to modify SOE definitions');
const r8 = bdModel.score('modify-soe soe-definitions/alpha-engine', {}, {
  soeModificationAttempt: true,
});
showScore(r8);
showAudit(bdAudit.classify({
  decision: 'deny', toolName: 'modify-soe soe-definitions/alpha-engine',
  toolInput: {}, riskScore: r8.riskScore,
}, { soeModificationAttempt: true }));

// ── 9. EMIR Filing with Deadline ────────────────────────────────────────
header('9. Regulatory Filer — EMIR Filing Preparation');
scenario('EMIR_TR filing, 3hr to deadline');
const r9 = rfModel.score('emir-tr-formatter --quarter Q1', {}, {
  filingType: 'EMIR_TR', hoursToDeadline: 3,
});
showScore(r9);
showAudit(rfAudit.classify({
  decision: 'allow', toolName: 'emir-tr-formatter --quarter Q1',
  toolInput: {}, riskScore: r9.riskScore,
}, { filingType: 'EMIR_TR' }));

// ── 10. Unauthorized Status Transition ──────────────────────────────────
header('10. Regulatory Filer — Unauthorized SUBMITTED (CRITICAL)');
scenario('Agent attempts human-only SUBMITTED status transition');
const r10 = rfModel.score('status-updater SUBMITTED', {}, {
  statusTransition: 'SUBMITTED', filingType: 'EMIR_TR',
});
showScore(r10);
showAudit(rfAudit.classify({
  decision: 'deny', toolName: 'status-updater SUBMITTED',
  toolInput: {}, riskScore: r10.riskScore,
}, { statusTransition: 'SUBMITTED', filingType: 'EMIR_TR' }));

// ── Summary ─────────────────────────────────────────────────────────────
header('Summary');
console.log('\nRetention Schedule:');
for (const [cat, ret] of Object.entries(RETENTION)) {
  console.log(`  ${cat.padEnd(35)} ${String(ret.years).padStart(3)}yr  ${ret.reason}`);
}

console.log('\nCritical SOE Boundaries:');
console.log('  1. trade-surveiller: broadest read scope in firm but ZERO write to trading/orders/executions');
console.log('  2. trade-surveiller: surveillance gaps >3min trigger CRITICAL DORA Art.10 alert');
console.log('  3. position-reporter: reads source data, writes reports ONLY — cannot modify positions');
console.log('  4. breach-detector: observe-and-escalate ONLY — cannot modify SOE, risk limits, or barriers');
console.log('  5. regulatory-filer: can set DRAFT and PENDING_REVIEW — SUBMITTED/APPROVED are human-only');
console.log('  6. regulatory-filer: cannot access regulatory portals — submission is human-only');

console.log('\n\x1b[32mDemo complete.\x1b[0m 10 scenarios across 4 agents.');
console.log('FINRA 3110 (supervision), MAR Art.12/16 (abuse/STR), SOX 302/404 (controls), DORA (resilience).');

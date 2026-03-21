#!/usr/bin/env node
/**
 * OpsFabric Demo — Arbiter Risk Scoring + Chronicle Audit Classification
 *
 * Demonstrates all 3 OpsFabric agents across realistic scenarios:
 *   1. Normal settlement instruction (Green)
 *   2. T+1 deadline pressure (Yellow/Red)
 *   3. CSDR buy-in threshold (Red)
 *   4. Reconciliation break aging (Yellow)
 *   5. Source record modification attempt (Critical)
 *   6. NAV with stale pricing (Yellow)
 *   7. NAV publication attempt (Critical — dual-approval gate)
 *
 * Usage:
 *   node demo/ops-fabric-demo.js
 *   node demo/ops-fabric-demo.js --verbose
 */

import { createRiskModel } from '../platform/models/ops-fabric/risk-models.js';
import { createAuditModel, RETENTION } from '../platform/models/ops-fabric/audit-models.js';

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

// ══════════════════════════════════════════════════════════════════════════
header('OpsFabric Demo — Sentinel-Ops Arbiter + Chronicle');
console.log('3 agents, 7 scenarios, CSDR/EMIR/SOX compliance');
console.log(`Mode: ${verbose ? 'verbose' : 'summary'} (use --verbose for details)`);

// ── 1. Normal Settlement ─────────────────────────────────────────────────
header('1. Settlement Processor — Normal Instruction Generation');
scenario('BNY Mellon settlement instruction, 4 hours before cutoff');
const settModel = createRiskModel('settlement-processor');
const settAudit = createAuditModel('settlement-processor');

const r1 = settModel.score('bny-mellon/settlement/submit-instruction', {}, {
  minutesToT1Cutoff: 240, openFailRatePct: 0.3,
});
showScore(r1);
showAudit(settAudit.classify({
  decision: 'allow', toolName: 'bny-mellon/settlement/submit-instruction',
  toolInput: {}, riskScore: r1.riskScore,
}, { tradeId: 'TRD-20260320-001', isin: 'US0378331005', custodian: 'bny-mellon' }));

// ── 2. Deadline Pressure ─────────────────────────────────────────────────
header('2. Settlement Processor — T+1 Deadline Pressure');
scenario('25 minutes to cutoff, 3.5% fail rate, CCP routing error');
const r2 = settModel.score('dtcc/settlement/submit', {}, {
  minutesToT1Cutoff: 25, openFailRatePct: 3.5, ccpRoutingErrors: 1,
});
showScore(r2);

// ── 3. CSDR Buy-In ──────────────────────────────────────────────────────
header('3. Settlement Processor — CSDR Buy-In Threshold');
scenario('Equity fail at T+5, $12K daily penalty accrual');
const r3 = settModel.score('dtcc/settlement/query', {}, {
  businessDaysSinceFail: 5, dailyCsdrPenaltyUSD: 12000,
});
showScore(r3);

// ── 4. Reconciliation Break Aging ────────────────────────────────────────
header('4. Reconciler — Break Aging + Material Discrepancy');
scenario('$750K break, 6 days old, 160% of 4-week average volume');
const recModel = createRiskModel('reconciler');
const recAudit = createAuditModel('reconciler');

const r4 = recModel.score('classify-break', {}, {
  maxBreakAgeDays: 6, maxBreakValueUSD: 750000, breakCountVs4WeekAvg: 1.6,
});
showScore(r4);
showAudit(recAudit.classify({
  decision: 'allow', toolName: 'classify-break --category position-mismatch',
  toolInput: {}, riskScore: r4.riskScore,
}, { breakId: 'BRK-20260320-042', breakValueUSD: 750000, breakAgeDays: 6, custodian: 'bny-mellon' }));

// ── 5. Source Record Modification ────────────────────────────────────────
header('5. Reconciler — Source Record Modification Attempt (CRITICAL)');
scenario('Reconciler attempts to amend Eagle PACE position record');
const r5 = recModel.score('amend-position', {}, { sourceRecordWriteAttempt: true });
showScore(r5);
showAudit(recAudit.classify({
  decision: 'deny', toolName: 'amend-position --id POS-123',
  toolInput: {}, riskScore: r5.riskScore, reason: 'SOE denies amend-position — sourceRecordImmutability enforced',
}));

// ── 6. NAV Stale Pricing ─────────────────────────────────────────────────
header('6. NAV Calculator — Stale Pricing + Level 3 Concentration');
scenario('3.5% stale prices by NAV weight, 18% Level 3, Bloomberg feed down');
const navModel = createRiskModel('nav-calculator');
const navAudit = createAuditModel('nav-calculator');

const r6 = navModel.score('validate-pricing', {}, {
  stalePriceByNavWeightPct: 3.5, level3PctOfNav: 18,
  pricingFeedDown: 'bloomberg', minutesToNavTarget: 45,
});
showScore(r6);
showAudit(navAudit.classify({
  decision: 'allow', toolName: 'validate-pricing --isin XS1234567890 --source bval',
  toolInput: {}, riskScore: r6.riskScore,
}, { fundId: 'FUND-ALT-003', navDate: '2026-03-20', level3Pct: 18 }));

// ── 7. NAV Publication Attempt ───────────────────────────────────────────
header('7. NAV Calculator — Publication Attempt (CRITICAL — Dual-Approval Gate)');
scenario('nav-calculator attempts publish-nav (SOE DENIED — requires dual human approval)');
const r7 = navModel.score('publish-nav', { destination: 'operations/nav/published/fund1' }, {});
showScore(r7);
showAudit(navAudit.classify({
  decision: 'deny', toolName: 'publish-nav --fund FUND-001',
  toolInput: { path: 'operations/nav/published/fund1' },
  riskScore: r7.riskScore,
  reason: 'SOE denies publish-nav — navPublicationGate requires dual human approval',
}));

// ── Summary ──────────────────────────────────────────────────────────────
header('Summary');
console.log('\nRetention Schedule:');
for (const [cat, ret] of Object.entries(RETENTION)) {
  console.log(`  ${cat.padEnd(30)} ${ret.years}yr  ${ret.reason}`);
}

console.log('\nCritical SOE Boundaries:');
console.log('  1. nav-calculator CANNOT write to operations/nav/published/** (dual-approval gate)');
console.log('  2. reconciler CANNOT write to source records (eagle-pace/**, custodian-records/**)');
console.log('  3. settlement-processor CANNOT call custodian account management endpoints');

console.log('\n\x1b[32mDemo complete.\x1b[0m 7 scenarios across 3 agents.');
console.log('EU AI Act: LIMITED risk. Financial accuracy: CRITICAL governance.');

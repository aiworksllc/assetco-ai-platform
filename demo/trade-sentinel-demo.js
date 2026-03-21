#!/usr/bin/env node
/**
 * TradeSentinel Demo — Arbiter Risk Scoring + Chronicle Audit Classification
 *
 * Demonstrates all 3 TradeSentinel agents across realistic scenarios:
 *   1. Normal order routing (Green)
 *   2. Block-level order with venue concentration (Yellow)
 *   3. NBBO violation attempt (Red — blocked)
 *   4. Human approval bypass attempt (Critical)
 *   5. Chinese wall violation (Critical — all agents)
 *   6. Execution quality monitoring — severe slippage (Yellow)
 *   7. MAR Art.12 spoofing pattern detection (Red)
 *   8. TCA batch analysis (Green)
 *   9. TCA live data access attempt (Critical — SoD violation)
 *
 * Usage:
 *   node demo/trade-sentinel-demo.js
 *   node demo/trade-sentinel-demo.js --verbose
 */

import { createRiskModel } from '../platform/models/trade-sentinel/risk-models.js';
import { createAuditModel, RETENTION } from '../platform/models/trade-sentinel/audit-models.js';

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
header('TradeSentinel Demo — Sentinel-Ops Arbiter + Chronicle');
console.log('3 agents, 9 scenarios, MiFID II/Reg NMS/MAR/EU AI Act compliance');
console.log(`Mode: ${verbose ? 'verbose' : 'summary'} (use --verbose for details)`);

const orModel = createRiskModel('order-router');
const orAudit = createAuditModel('order-router');
const emModel = createRiskModel('execution-monitor');
const emAudit = createAuditModel('execution-monitor');
const tcaModel = createRiskModel('tca-analyzer');
const tcaAudit = createAuditModel('tca-analyzer');

// ── 1. Normal Order Routing ─────────────────────────────────────────────
header('1. Order Router — Normal Order Staging');
scenario('$200K equity order, NBBO validated, mandate compliant');
const r1 = orModel.score('flexTrade submit-order --staged-id ORD-001', {}, {
  orderNotional: 200000,
});
showScore(r1);
showAudit(orAudit.classify({
  decision: 'allow', toolName: 'flexTrade submit-order --staged-id ORD-001',
  toolInput: {}, riskScore: r1.riskScore,
}, { orderId: 'ORD-001', instrument: 'AAPL', notional: 200000 }));

// ── 2. Block Order + Venue Concentration ────────────────────────────────
header('2. Order Router — Block Order with Venue Concentration');
scenario('$5M block, 85% to single venue, 6% of ADV');
const r2 = orModel.score('flexTrade submit-order', {}, {
  orderNotional: 5000000,
  singleVenueConcentrationPct: 85,
  orderPctOfAdv: 6,
});
showScore(r2);

// ── 3. NBBO Violation Attempt ───────────────────────────────────────────
header('3. Order Router — NBBO Violation Attempt (BLOCKED)');
scenario('Attempted trade-through — Reg NMS Rule 611 violation');
const r3 = orModel.score('nbbo-validator validate', {}, {
  nbboViolationAttempt: true,
  orderNotional: 300000,
});
showScore(r3);
showAudit(orAudit.classify({
  decision: 'deny', toolName: 'nbbo-validator validate --instrument TSLA --price 142.50',
  toolInput: {}, riskScore: r3.riskScore,
  reason: 'NBBO trade-through blocked — Reg NMS Rule 611',
}, { nbboViolationAttempt: true, orderId: 'ORD-003', instrument: 'TSLA' }));

// ── 4. Human Approval Bypass ────────────────────────────────────────────
header('4. Order Router — Human Approval Bypass (CRITICAL)');
scenario('>EUR 500K order submitted without human approval flag');
const r4 = orModel.score('flexTrade submit-order', {}, {
  orderNotional: 800000,
  humanApprovalBypass: true,
});
showScore(r4);
showAudit(orAudit.classify({
  decision: 'deny', toolName: 'flexTrade submit-order --staged-id ORD-004',
  toolInput: {}, riskScore: r4.riskScore,
  reason: 'EUR 500K gate — human approval required per EU AI Act Art.14',
}, { humanApprovalBypass: true, orderId: 'ORD-004' }));

// ── 5. Chinese Wall Violation ───────────────────────────────────────────
header('5. Order Router — Chinese Wall Violation (CRITICAL)');
scenario('Attempted read of pre-publication research signals');
const r5 = orModel.score('read research-nexus/pre-publication/signals', {}, {
  chineseWallViolation: true,
});
showScore(r5);
showAudit(orAudit.classify({
  decision: 'deny', toolName: 'read research-nexus/pre-publication/signals/alpha-q2',
  toolInput: {}, riskScore: r5.riskScore,
}, { chineseWallViolation: true }));

// ── 6. Execution Quality — Severe Slippage ──────────────────────────────
header('6. Execution Monitor — Severe Slippage Detection');
scenario('30bp slippage vs VWAP, low fill rate, 20bp cumulative IS');
const r6 = emModel.score('benchmark-calculator vwap', {}, {
  slippageVsVwapBps: 30,
  cumulativeDailyIsCostBps: 20,
  venueFillRatePct: 35,
});
showScore(r6);
showAudit(emAudit.classify({
  decision: 'allow', toolName: 'alert-service post --channel trading-desk --severity HIGH',
  toolInput: {}, riskScore: r6.riskScore,
}, { orderId: 'ORD-006', slippageVsVwap: 30 }));

// ── 7. MAR Pattern Detection ────────────────────────────────────────────
header('7. Execution Monitor — MAR Art.12 Spoofing Pattern');
scenario('Anomaly detector flags spoofing pattern, STR draft created');
const r7 = emModel.score('anomaly-detector run --pattern SPOOFING', {}, {
  marPatternDetected: true,
  marPatternType: 'SPOOFING',
  marPatternSeverity: 'high',
  strDraftCreated: true,
});
showScore(r7);
showAudit(emAudit.classify({
  decision: 'allow', toolName: 'compliance-shield create-str-draft --pattern SPOOFING --orders ORD-007,ORD-008',
  toolInput: {}, riskScore: r7.riskScore,
}, { strDraftCreated: true, marPatternType: 'SPOOFING', alertId: 'ALT-007' }));

// ── 8. TCA Batch Analysis ───────────────────────────────────────────────
header('8. TCA Analyzer — Quarterly Batch Analysis');
scenario('Q1 2026 batch: 5000 orders, RTS 28 report generation');
const r8 = tcaModel.score('tca-engine compute-batch --date-range Q1-2026', {}, {
  ordersAnalysed: 5000,
  rts28Report: true,
});
showScore(r8);
showAudit(tcaAudit.classify({
  decision: 'allow', toolName: 'rts28-reporter generate --quarter Q1 --asset-class equities',
  toolInput: {}, riskScore: r8.riskScore,
}, { rts28Report: true, reportId: 'RTS28-Q1-2026', quarter: 'Q1-2026', assetClass: 'equities' }));

// ── 9. TCA Live Data Attempt ────────────────────────────────────────────
header('9. TCA Analyzer — Live Data Access Attempt (CRITICAL)');
scenario('Post-trade analyst attempts to read live market data');
const r9 = tcaModel.score('read market-data/live/quotes', {}, {
  liveDataAccessAttempt: true,
});
showScore(r9);
showAudit(tcaAudit.classify({
  decision: 'deny', toolName: 'read market-data/live/quotes/AAPL',
  toolInput: {}, riskScore: r9.riskScore,
  reason: 'SOE denies — tca-analyzer is post-trade only, no live data access',
}, { liveDataAccessAttempt: true }));

// ── Summary ─────────────────────────────────────────────────────────────
header('Summary');
console.log('\nRetention Schedule:');
for (const [cat, ret] of Object.entries(RETENTION)) {
  console.log(`  ${cat.padEnd(35)} ${ret.years}yr  ${ret.reason}`);
}

console.log('\nCritical SOE Boundaries:');
console.log('  1. ALL agents: Chinese wall — pre-publication research access = 500 risk units = immediate freeze');
console.log('  2. order-router: writes ONLY to trading/orders/staged/** (cannot modify active/executed)');
console.log('  3. order-router: >EUR 500K requires human approval (EU AI Act Art.14)');
console.log('  4. execution-monitor: CANNOT modify orders (alert-only, separation of duties)');
console.log('  5. execution-monitor: NOT frozen on budget breach (surveillance must continue)');
console.log('  6. tca-analyzer: post-trade ONLY — no live data, no order writes, no alerts');

console.log('\n\x1b[32mDemo complete.\x1b[0m 9 scenarios across 3 agents.');
console.log('EU AI Act: HIGH RISK. Best execution: MiFID II Art.27. Market abuse: MAR Art.12/16.');

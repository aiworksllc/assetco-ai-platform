#!/usr/bin/env node
/**
 * AlphaEngine Demo — Arbiter Risk Scoring + Chronicle Audit Classification
 *
 * Demonstrates all 4 AlphaEngine agents across realistic scenarios:
 *   1. Normal portfolio optimization (Green)
 *   2. Near-IPS-limit optimization (Yellow/Red)
 *   3. Chinese wall violation attempt (Critical)
 *   4. ERISA rebalancing with tax lot optimization (Green)
 *   5. High drift rebalancing (Yellow)
 *   6. Allocation proposal during macro regime shift (Green)
 *   7. Approval bypass attempt (Critical — EU AI Act Art.14)
 *   8. Factor analysis with unintended tilts (Green)
 *   9. Factor analyst production write attempt (Critical)
 *
 * Usage:
 *   node demo/alpha-engine-demo.js
 *   node demo/alpha-engine-demo.js --verbose
 */

import { createRiskModel } from '../platform/models/alpha-engine/risk-models.js';
import { createAuditModel, RETENTION } from '../platform/models/alpha-engine/audit-models.js';

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
header('AlphaEngine Demo — Sentinel-Ops Arbiter + Chronicle');
console.log('4 agents, 9 scenarios, SEC/MiFID II/SFDR/ERISA/EU AI Act compliance');
console.log(`Mode: ${verbose ? 'verbose' : 'summary'} (use --verbose for details)`);

// ── 1. Normal Optimization ──────────────────────────────────────────────
header('1. Portfolio Optimizer — Normal Mean-Variance Optimization');
scenario('Incremental adjustment, well within IPS limits');
const optModel = createRiskModel('portfolio-optimizer');
const optAudit = createAuditModel('portfolio-optimizer');

const r1 = optModel.score('optimization.run', {}, {
  aggregateWeightChangePct: 1,
  ipsConcentrationProximityPct: 30,
  esgScoreMarginAboveMin: 25,
  trackingErrorBudgetUsedPct: 30,
  maxFactorTiltSD: 0.05,
});
showScore(r1);
showAudit(optAudit.classify({
  decision: 'allow', toolName: 'optimization.run --mandate MAND-EQ-001',
  toolInput: {}, riskScore: r1.riskScore,
}, { mandateId: 'MAND-EQ-001', erisaMandate: false, sfdrArticle: 8 }));

// ── 2. Near-IPS-Limit Optimization ─────────────────────────────────────
header('2. Portfolio Optimizer — Near IPS Concentration Limit');
scenario('10% weight change, 92% of IPS concentration limit');
const r2 = optModel.score('optimization.run', {}, {
  aggregateWeightChangePct: 10,
  ipsConcentrationProximityPct: 92,
  esgScoreMarginAboveMin: 12,
  trackingErrorBudgetUsedPct: 80,
  maxFactorTiltSD: 0.3,
  correlatedMandatesPct: 35,
});
showScore(r2);

// ── 3. Chinese Wall Violation Attempt ───────────────────────────────────
header('3. Portfolio Optimizer — Chinese Wall Violation (CRITICAL)');
scenario('Attempted read of pre-publication research signals');
const r3 = optModel.score('read research-nexus/pre-publication/signals', {}, {
  chineseWallViolation: true,
});
showScore(r3);
showAudit(optAudit.classify({
  decision: 'deny', toolName: 'read research-nexus/pre-publication/signals/alpha-q2',
  toolInput: {}, riskScore: r3.riskScore,
  reason: 'SOE denies read — Chinese wall enforcement',
}, { chineseWallViolation: true }));

// ── 4. ERISA Rebalancing ───────────────────────────────────────────────
header('4. Rebalancer — ERISA Mandate Tax-Aware Rebalancing');
scenario('3% drift, ERISA mandate with specific lot identification');
const rebModel = createRiskModel('rebalancer');
const rebAudit = createAuditModel('rebalancer');

const r4 = rebModel.score('generate-trade-list', {}, {
  aggregateWeightChangePct: 3,
  maxDriftPct: 3,
  estimatedTxCostBps: 15,
  erisaTaxLotSelection: true,
});
showScore(r4);
showAudit(rebAudit.classify({
  decision: 'allow', toolName: 'generate-trade-list --mandate MAND-ERISA-001',
  toolInput: {}, riskScore: r4.riskScore,
}, { mandateId: 'MAND-ERISA-001', erisaTaxLotSelection: true, estimatedTxCostBps: 15 }));

// ── 5. High Drift Rebalancing ──────────────────────────────────────────
header('5. Rebalancer — High Drift Rebalancing');
scenario('15% max drift, 55bps transaction cost, significant turnover');
const r5 = rebModel.score('generate-trade-list', {}, {
  aggregateWeightChangePct: 12,
  maxDriftPct: 15,
  estimatedTxCostBps: 55,
});
showScore(r5);

// ── 6. Allocation Proposal ─────────────────────────────────────────────
header('6. Allocation Advisor — Macro Regime Shift Proposal');
scenario('Proposal during macro transition, ERISA mandate with rationale');
const advModel = createRiskModel('allocation-advisor');
const advAudit = createAuditModel('allocation-advisor');

const r6 = advModel.score('generate-proposal', {}, {
  aggregateWeightChangePct: 5,
  ipsConcentrationProximityPct: 40,
  macroRegimeShift: true,
  erisaMandate: true,
  erisaRationaleIncluded: true,
});
showScore(r6);
showAudit(advAudit.classify({
  decision: 'allow', toolName: 'generate-proposal --mandate MAND-ERISA-002',
  toolInput: {}, riskScore: r6.riskScore,
}, { mandateId: 'MAND-ERISA-002', erisaMandate: true, erisaRationaleIncluded: true }));

// ── 7. Approval Bypass Attempt ─────────────────────────────────────────
header('7. Allocation Advisor — Approval Bypass Attempt (CRITICAL)');
scenario('Agent attempts to activate allocation without human approval');
const r7 = advModel.score('activate-allocation', {}, {
  approvalBypassAttempt: true,
});
showScore(r7);
showAudit(advAudit.classify({
  decision: 'deny', toolName: 'activate-allocation --proposal PROP-001',
  toolInput: {}, riskScore: r7.riskScore,
  reason: 'SOE denies — EU AI Act Art.14 human approval gate enforced',
}, { approvalBypassAttempt: true }));

// ── 8. Factor Analysis ─────────────────────────────────────────────────
header('8. Factor Analyst — Multi-Portfolio Factor Exposure');
scenario('10 portfolios analyzed, 2 unintended tilts detected');
const facModel = createRiskModel('factor-analyst');
const facAudit = createAuditModel('factor-analyst');

const r8 = facModel.score('compute-exposures', {}, {
  maxFactorTiltSD: 0.25,
  portfoliosAnalyzed: 10,
  unintendedTiltsDetected: 2,
});
showScore(r8);
showAudit(facAudit.classify({
  decision: 'allow', toolName: 'compute-exposures --portfolio FUND-ALT-003',
  toolInput: {}, riskScore: r8.riskScore,
}, { portfolioId: 'FUND-ALT-003', portfoliosAnalyzed: 10 }));

// ── 9. Factor Analyst Production Write ─────────────────────────────────
header('9. Factor Analyst — Production Write Attempt (CRITICAL)');
scenario('factor-analyst attempts to write to portfolios/live — read-only violation');
const r9 = facModel.score('write --path portfolios/live/fund1', {}, {
  productionWriteAttempt: true,
});
showScore(r9);
showAudit(facAudit.classify({
  decision: 'deny', toolName: 'write --path portfolios/live/fund1',
  toolInput: {}, riskScore: r9.riskScore,
  reason: 'SOE denies write — factor-analyst is read-only',
}, { productionWriteAttempt: true }));

// ── Summary ─────────────────────────────────────────────────────────────
header('Summary');
console.log('\nRetention Schedule:');
for (const [cat, ret] of Object.entries(RETENTION)) {
  console.log(`  ${cat.padEnd(35)} ${ret.years}yr  ${ret.reason}`);
}

console.log('\nCritical SOE Boundaries:');
console.log('  1. portfolio-optimizer CANNOT read pre-publication research (Chinese wall)');
console.log('  2. portfolio-optimizer CANNOT submit orders (propose-only)');
console.log('  3. rebalancer CANNOT submit orders (trade-list-only)');
console.log('  4. allocation-advisor CANNOT activate allocations without human approval');
console.log('  5. allocation-advisor writes ONLY to portfolios/proposals/**');
console.log('  6. factor-analyst has ZERO write access to production systems');

console.log('\n\x1b[32mDemo complete.\x1b[0m 9 scenarios across 4 agents.');
console.log('EU AI Act: HIGH RISK. Fiduciary governance: SEC + MiFID II + ERISA + SFDR.');

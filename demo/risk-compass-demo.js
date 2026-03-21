#!/usr/bin/env node
/**
 * RiskCompass Demo — Arbiter Risk Scoring + Chronicle Audit Classification
 *
 * Demonstrates all 4 RiskCompass agents across realistic scenarios:
 *   1. Normal operation (Green)
 *   2. Elevated activity (Yellow)
 *   3. Unauthorized patterns (Red/Critical)
 *   4. Regulatory compliance mapping
 *
 * Usage:
 *   node demo/risk-compass-demo.js
 *   node demo/risk-compass-demo.js --verbose
 */

import { createRiskModel, RISK_DECAY_SCHEDULE } from '../platform/models/risk-compass/risk-models.js';
import { createAuditModel, RETENTION } from '../platform/models/risk-compass/audit-models.js';

const verbose = process.argv.includes('--verbose');

function header(text) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  ${text}`);
  console.log('='.repeat(70));
}

function scenario(name) {
  console.log(`\n--- ${name} ---`);
}

function showScore(result) {
  const tier = result.riskTier.toUpperCase();
  const color = tier === 'GREEN' ? '\x1b[32m' : tier === 'YELLOW' ? '\x1b[33m' : tier === 'RED' ? '\x1b[31m' : '\x1b[35m';
  console.log(`  Score: ${color}${result.riskScore}/100 [${tier}]\x1b[0m`);
  console.log(`  ${result.explanation}`);
  if (verbose) {
    console.log('  Factors:');
    for (const f of result.factors.filter(f => f.impact !== 0)) {
      console.log(`    ${f.impact > 0 ? '+' : ''}${f.impact} ${f.name}: ${f.reason}`);
    }
    if (result.regulatoryFlags.length > 0) {
      console.log('  Regulatory flags:');
      for (const f of result.regulatoryFlags) {
        console.log(`    [${f.flag}] ${f.reason} → ${f.action}`);
      }
    }
  }
}

function showAudit(record) {
  console.log(`  Audit: ${record.auditCategory} / ${record.eventType} [${record.severity}]`);
  if (verbose) {
    console.log(`  Retention: ${record.retention.years}yr — ${record.retention.reason}`);
    console.log('  Compliance frameworks:');
    for (const f of record.compliance) {
      const refs = f.articles?.map(a => a.ref) || f.criteria?.map(c => c.ref) || [];
      console.log(`    ${f.framework}: ${refs.join(', ')}`);
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════
header('RiskCompass Demo — Sentinel-Ops Arbiter + Chronicle');
console.log('4 agents, 8 scenarios, multi-jurisdictional compliance');
console.log(`Mode: ${verbose ? 'verbose' : 'summary'} (use --verbose for full details)`);

// ── Scenario 1: Normal VaR Calculation ───────────────────────────────────
header('1. VaR Calculator — Normal Parametric VaR Run');

scenario('Scheduled daily VaR for single equity fund');
const varModel = createRiskModel('var-calculator');
const varAudit = createAuditModel('var-calculator');

const varResult = varModel.score('riskcompass.publish_var_report', {}, {
  fundsAccessed: 1,
  assetClassesAccessed: 1,
  callsThisHour: 5,
  fundsAggregated: 1,
  businessLinesAggregated: 1,
  methodology: 'parametric',
});
showScore(varResult);

const varRecord = varAudit.classify({
  decision: 'allow',
  toolName: 'riskcompass.publish_var_report',
  toolInput: {},
  riskScore: varResult.riskScore,
  reason: 'Within SOE — scheduled run',
}, { methodology: 'parametric', calculationId: 'CALC-20260320-001', modelId: 'MDL-VAR-001' });
showAudit(varRecord);

// ── Scenario 2: VaR Backtesting Exception ────────────────────────────────
header('2. VaR Calculator — Backtesting Exception (SR 11-7)');

scenario('5 backtesting exceptions YTD — model version mismatch');
const btResult = varModel.score('chronicle.log_backtesting_exception', {}, {
  fundsAccessed: 1,
  callsThisHour: 10,
  fundsAggregated: 1,
  businessLinesAggregated: 1,
  backtestingExceptions: 5,
  modelVersion: '1.1.0-beta',
  approvedModelVersion: '1.0.0',
});
showScore(btResult);

const btRecord = varAudit.classify({
  decision: 'allow',
  toolName: 'chronicle.log_backtesting_exception',
  toolInput: {},
  riskScore: btResult.riskScore,
}, { calculationId: 'CALC-20260320-002', modelId: 'MDL-VAR-001' });
showAudit(btRecord);

// ── Scenario 3: Stress Tester — AIFMD Quarterly ─────────────────────────
header('3. Stress Tester — AIFMD Quarterly Liquidity Stress');

scenario('Quarterly AIFMD Art.16 stress test across alternative funds');
const stressModel = createRiskModel('stress-tester');
const stressAudit = createAuditModel('stress-tester');

const stressResult = stressModel.score('riskcompass.run_stress_scenario', {}, {
  fundsAccessed: 3,
  callsThisHour: 8,
  fundsAggregated: 3,
  businessLinesAggregated: 1,
  trigger: 'aifmd-quarterly',
  methodology: 'stress-scenario',
});
showScore(stressResult);

const stressRecord = stressAudit.classify({
  decision: 'allow',
  toolName: 'riskcompass.run_stress_scenario',
  toolInput: {},
  riskScore: stressResult.riskScore,
}, { trigger: 'aifmd-quarterly', scenarioId: 'SCEN-003', scenarioName: '2008 GFC Replay' });
showAudit(stressRecord);

// ── Scenario 4: Exposure Monitor — Full Firm Aggregation ─────────────────
header('4. Exposure Monitor — Full Firm Cross-Fund Aggregation');

scenario('All 5 business lines, $85B AUM, firm-level concentration check');
const expoModel = createRiskModel('exposure-monitor');
const expoAudit = createAuditModel('exposure-monitor');

const expoResult = expoModel.score('riskcompass.aggregate_exposure', {}, {
  crossFund: true,
  assetClassesAccessed: 5,
  fundsAccessed: 25,
  callsThisHour: 20,
  fundsAggregated: 25,
  businessLinesAggregated: 5,
  dataFreshnessSeconds: 300,
});
showScore(expoResult);

const expoRecord = expoAudit.classify({
  decision: 'allow',
  toolName: 'riskcompass.aggregate_exposure',
  toolInput: {},
  riskScore: expoResult.riskScore,
}, { crossFund: true, businessLinesAggregated: 5, aggregationRunId: 'AGG-20260320-004', totalPositionsRead: 12500 });
showAudit(expoRecord);

// ── Scenario 5: Exposure Monitor — Possible Data Exfiltration ────────────
header('5. Exposure Monitor — Rapid Aggregation (Possible Scraping)');

scenario('15 aggregation runs in 5 minutes + stale data + velocity spike');
const exfilResult = expoModel.score('riskcompass.aggregate_exposure', {}, {
  crossFund: true,
  assetClassesAccessed: 5,
  fundsAccessed: 25,
  callsThisHour: 80,
  fundsAggregated: 25,
  businessLinesAggregated: 5,
  aggregationRunsInWindow: 15,
  dataFreshnessSeconds: 7200,
  velocitySpike: 6,
});
showScore(exfilResult);

// ── Scenario 6: Limit Enforcer — Leverage Breach ────────────────────────
header('6. Limit Enforcer — AIFMD Leverage Limit Breach');

scenario('Gross leverage 220% exceeds 200% limit for Alternative Fund III');
const limitModel = createRiskModel('limit-enforcer');
const limitAudit = createAuditModel('limit-enforcer');

const breachResult = limitModel.score('riskcompass.generate_breach_event', {}, {
  fundsAccessed: 1,
  callsThisHour: 15,
  fundsAggregated: 1,
  businessLinesAggregated: 1,
  breachEventsInWindow: 2,
  limitType: 'leverage-aifmd-gross',
});
showScore(breachResult);

const breachRecord = limitAudit.classify({
  decision: 'allow',
  toolName: 'riskcompass.generate_breach_event',
  toolInput: {},
  riskScore: breachResult.riskScore,
}, { limitType: 'leverage-aifmd-gross', limitId: 'LIM-ALT3-GROSS', breachEventId: 'BRE-20260320-001' });
showAudit(breachRecord);

// ── Scenario 7: Limit Enforcer — Unauthorized Modification Attempt ──────
header('7. Limit Enforcer — Unauthorized Limit Override Attempt');

scenario('Agent attempts to modify a VaR limit + suppress an alert');
const overrideResult = limitModel.score('riskcompass.modify_limit', {}, {
  fundsAccessed: 1,
  callsThisHour: 20,
  fundsAggregated: 1,
  businessLinesAggregated: 1,
  limitModificationAttempt: true,
  alertSuppressionAttempt: true,
  breachEventsInWindow: 5,
});
showScore(overrideResult);

const overrideRecord = limitAudit.classify({
  decision: 'deny',
  toolName: 'riskcompass.modify_limit',
  toolInput: {},
  riskScore: overrideResult.riskScore,
  reason: 'SOE denies riskcompass.modify_limit — toolActions.deny match',
}, { limitType: 'var-limit', limitId: 'LIM-EQ1-VAR' });
showAudit(overrideRecord);

// ── Scenario 8: Write to Trading System (SOE-Blocked) ───────────────────
header('8. Any Agent — Write Attempt to Trading System');

scenario('Exposure-monitor attempts to write to TradeSentinel path');
const tradingWriteResult = expoModel.score('write', { destination: 'tradesentinel/pending-orders' }, {
  fundsAccessed: 1,
  callsThisHour: 5,
  fundsAggregated: 1,
  businessLinesAggregated: 1,
});
showScore(tradingWriteResult);

// ── Summary ──────────────────────────────────────────────────────────────
header('Summary');

console.log('\nRetention Schedule:');
for (const [cat, ret] of Object.entries(RETENTION)) {
  console.log(`  ${cat.padEnd(30)} ${ret.years}yr  ${ret.tier}`);
}

console.log('\nRisk Decay Schedule (RiskCompass — accelerated for read-only):');
for (const tier of RISK_DECAY_SCHEDULE.schedule) {
  const window = tier.maxMinutes === Infinity ? `${tier.minMinutes}+ min` : `${tier.minMinutes}-${tier.maxMinutes} min`;
  console.log(`  ${window.padEnd(15)} decay: ${(tier.decayRatePer5Min * 100).toFixed(0)}%/5min  ${tier.reason}`);
}

console.log('\n\x1b[32mDemo complete.\x1b[0m 8 scenarios across 4 agents.');
console.log('All agents are READ-ONLY. Zero write authority. Fail-CLOSED.');

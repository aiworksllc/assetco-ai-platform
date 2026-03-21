/**
 * ResearchNexus Demo — 10 Scenarios
 *
 * Demonstrates SOE enforcement for the ResearchNexus application:
 *   - Chinese wall (information barrier) enforcement
 *   - Pre-publication leakage prevention
 *   - ESG data quality monitoring
 *   - Sentiment anomaly detection
 *   - Fair value model risk controls
 *   - NAV write protection
 */

import { createRiskModel } from '../platform/models/research-nexus/risk-models.js';
import { createAuditModel } from '../platform/models/research-nexus/audit-models.js';

function demo(label, agentId, toolName, context = {}) {
  const risk = createRiskModel(agentId);
  const audit = createAuditModel(agentId);
  const riskResult = risk.score(toolName, {}, context);
  const auditResult = audit.classify({
    toolName,
    decision: riskResult.riskTier === 'critical' ? 'deny' : 'allow',
    riskScore: riskResult.riskScore,
    reason: riskResult.explanation,
  }, context);

  console.log(`\n${'═'.repeat(70)}`);
  console.log(`  ${label}`);
  console.log(`${'═'.repeat(70)}`);
  console.log(`  Agent:    ${agentId}`);
  console.log(`  Tool:     ${toolName}`);
  console.log(`  Decision: ${auditResult.event.decision.toUpperCase()}`);
  console.log(`  Risk:     ${riskResult.riskScore} (${riskResult.riskTier})`);
  console.log(`  Category: ${auditResult.auditCategory}`);
  console.log(`  Severity: ${auditResult.severity}`);
  console.log(`  Retain:   ${auditResult.retention.years}yr — ${auditResult.retention.reason}`);
  if (riskResult.regulatoryFlags.length) console.log(`  Flags:    ${riskResult.regulatoryFlags.join(', ')}`);
  if (riskResult.factors.length) console.log(`  Factors:  ${riskResult.factors.map(f => f.name).join(', ')}`);
}

console.log('\n╔══════════════════════════════════════════════════════════════════════╗');
console.log('║  ResearchNexus Demo — SOE Enforcement Scenarios                     ║');
console.log('║  4 agents · Chinese wall · Pre-pub controls · ESG/Valuation risk    ║');
console.log('╚══════════════════════════════════════════════════════════════════════╝');

// ── Scenario 1: Normal research operation ────────────────────────────────
demo(
  'Scenario 1: market-analyst — Normal SEC EDGAR query',
  'market-analyst',
  'curl https://efts.sec.gov/LATEST/search-index?q=AAPL&dateRange=custom&startdt=2026-01-01',
);

// ── Scenario 2: Chinese wall violation ───────────────────────────────────
demo(
  'Scenario 2: market-analyst — Chinese wall violation (read trading positions)',
  'market-analyst',
  'read positions/equity-book/long-positions.json',
  { chineseWallViolation: true, attemptedPath: 'positions/equity-book/long-positions.json' },
);

// ── Scenario 3: Pre-publication leakage attempt ──────────────────────────
demo(
  'Scenario 3: market-analyst — Pre-publication leakage (write to published/)',
  'market-analyst',
  'write research/published/analysis/AAPL/2026-Q1-earnings.json',
  { prePublicationLeakageAttempt: true },
);

// ── Scenario 4: ESG scoring with good data ───────────────────────────────
demo(
  'Scenario 4: esg-scorer — Normal PAI computation (90% coverage)',
  'esg-scorer',
  'python pai_calculator.py FUND-001',
  { dataCoverage: 90 },
);

// ── Scenario 5: ESG critical data gap ────────────────────────────────────
demo(
  'Scenario 5: esg-scorer — Critical data gap (<50% PAI coverage)',
  'esg-scorer',
  'python pai_calculator.py FUND-003',
  { dataCoverage: 40, staleData: true, providerOutage: true },
);

// ── Scenario 6: SFDR disclosure write ────────────────────────────────────
demo(
  'Scenario 6: esg-scorer — SFDR Art.8 disclosure write',
  'esg-scorer',
  'write compliance/sfdr/FUND-001-art8-2026.json',
);

// ── Scenario 7: Sentiment anomaly (prompt injection) ─────────────────────
demo(
  'Scenario 7: sentiment-analyzer — Prompt injection detected in news feed',
  'sentiment-analyzer',
  'python sentiment_analyzer.py injected-news-batch.json',
  { promptInjectionDetected: true, sentimentReversalPct: 90, extremeValueCluster: true },
);

// ── Scenario 8: Fair value Level 3 with deviation ────────────────────────
demo(
  'Scenario 8: fair-value-modeler — Level 3 deviation exceeds threshold',
  'fair-value-modeler',
  'python level3_rollforward.py private-credit-XYZ',
  { fvHierarchyLevel: 3, level3DeviationPct: 18, navImpactPct: 0.8, deviationPct: 18 },
);

// ── Scenario 9: NAV write attempt ────────────────────────────────────────
demo(
  'Scenario 9: fair-value-modeler — NAV publication write blocked',
  'fair-value-modeler',
  'write portfolios/nav/FUND-001/2026-03-20.json',
);

// ── Scenario 10: Order flow probe ────────────────────────────────────────
demo(
  'Scenario 10: sentiment-analyzer — Order flow data access attempt',
  'sentiment-analyzer',
  'read data/market-data/orderflow/aggregated-institutional.json',
);

console.log(`\n${'═'.repeat(70)}`);
console.log('  Demo complete — 10 scenarios executed');
console.log(`${'═'.repeat(70)}\n`);

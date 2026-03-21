#!/usr/bin/env node
/**
 * AdvisorLens Demo — Arbiter Risk Scoring + Chronicle Audit Classification
 *
 * Demonstrates all 3 AdvisorLens agents across realistic scenarios:
 *   1. Normal suitability check — suitable (Green)
 *   2. Requires-review for retail client (Yellow)
 *   3. Suitability override without compliance sign-off (Red/Critical)
 *   4. Standard investment proposal (Green)
 *   5. ERISA client with GDPR Art.22 opt-out (Red)
 *   6. Art.52 disclosure missing — BLOCKED (Critical)
 *   7. Delivery path write attempt — BLOCKED (Critical)
 *   8. Quarterly client report (Green)
 *   9. Cross-client data access attempt — BLOCKED (Critical)
 *
 * Usage:
 *   node demo/advisor-lens-demo.js
 *   node demo/advisor-lens-demo.js --verbose
 */

import { createRiskModel } from '../platform/models/advisor-lens/risk-models.js';
import { createAuditModel, RETENTION } from '../platform/models/advisor-lens/audit-models.js';

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
header('AdvisorLens Demo — Sentinel-Ops Arbiter + Chronicle');
console.log('3 agents, 9 scenarios, MiFID II/EU AI Act/GDPR/ERISA compliance');
console.log(`Mode: ${verbose ? 'verbose' : 'summary'} (use --verbose for details)`);

const scModel = createRiskModel('suitability-checker');
const scAudit = createAuditModel('suitability-checker');
const pgModel = createRiskModel('proposal-generator');
const pgAudit = createAuditModel('proposal-generator');
const crModel = createRiskModel('client-reporter');
const crAudit = createAuditModel('client-reporter');

// ── 1. Normal Suitability Check ─────────────────────────────────────────
header('1. Suitability Checker — Standard Assessment');
scenario('Professional client, standard product, suitable determination');
const r1 = scModel.score('suitability-check', {}, {
  suitabilityDetermination: 'suitable', clientCategory: 'professional',
});
showScore(r1);
showAudit(scAudit.classify({
  decision: 'allow', toolName: 'suitability-check',
  toolInput: {}, riskScore: r1.riskScore,
}, { suitabilityDetermination: 'suitable', clientId: 'C-1001' }));

// ── 2. Requires-Review for Retail ───────────────────────────────────────
header('2. Suitability Checker — Retail Client Requires-Review');
scenario('Retail client, complex product, requires-review determination');
const r2 = scModel.score('suitability-check', {}, {
  suitabilityDetermination: 'requires-review', clientCategory: 'retail',
  productComplexityClass: 'complex',
});
showScore(r2);

// ── 3. Override Without Sign-Off ────────────────────────────────────────
header('3. Suitability Checker — Override Without Compliance Sign-Off');
scenario('Advisor overrides unsuitable determination, no CCO sign-off');
const r3 = scModel.score('suitability-override', {}, {
  suitabilityOverride: true, complianceSignOff: false,
  suitabilityDetermination: 'unsuitable',
});
showScore(r3);
showAudit(scAudit.classify({
  decision: 'allow', toolName: 'suitability-override',
  toolInput: {}, riskScore: r3.riskScore,
}, { suitabilityOverride: true, complianceSignOff: false }));

// ── 4. Standard Proposal ────────────────────────────────────────────────
header('4. Proposal Generator — Standard Investment Proposal');
scenario('Standard diversified equity proposal, Art.52 disclosure present');
const r4 = pgModel.score('write-proposal-draft', {}, {
  proposalType: 'standard',
});
showScore(r4);
showAudit(pgAudit.classify({
  decision: 'allow', toolName: 'write-proposal-draft',
  toolInput: {}, riskScore: r4.riskScore,
}, { proposalType: 'standard', proposalId: 'P-2001' }));

// ── 5. ERISA + GDPR Art.22 ─────────────────────────────────────────────
header('5. Proposal Generator — ERISA Client + GDPR Art.22 Opt-Out');
scenario('ERISA client opted out of automated decisions, no deliberative review tag');
const r5 = pgModel.score('write-proposal-draft', {}, {
  proposalType: 'erisa-client',
  gdprArt22OptOut: true, deliberativeReviewTagged: false,
});
showScore(r5);
showAudit(pgAudit.classify({
  decision: 'allow', toolName: 'write-proposal-draft',
  toolInput: {}, riskScore: r5.riskScore,
}, { proposalType: 'erisa-client', gdprArt22OptOut: true, deliberativeReviewTagged: false }));

// ── 6. Art.52 Disclosure Missing ────────────────────────────────────────
header('6. Proposal Generator — Art.52 Disclosure Missing (CRITICAL)');
scenario('Proposal draft attempted without AI disclosure — BLOCKED by SOE');
const r6 = pgModel.score('write-proposal-draft', {}, {
  art52DisclosureMissing: true,
});
showScore(r6);
showAudit(pgAudit.classify({
  decision: 'deny', toolName: 'write advisory/proposals/draft/P-2003',
  toolInput: {}, riskScore: r6.riskScore,
  reason: 'Art.52 AI disclosure absent — write blocked',
}, { art52DisclosureMissing: true }));

// ── 7. Delivery Path Write Attempt ──────────────────────────────────────
header('7. Proposal Generator — Delivery Path Write (CRITICAL)');
scenario('Attempted write to advisory/proposals/delivered/ — human approval gate bypass');
const r7 = pgModel.score('write advisory/proposals/delivered/P-2004', {}, {
  deliveryPathWriteAttempt: true,
});
showScore(r7);
showAudit(pgAudit.classify({
  decision: 'deny', toolName: 'write advisory/proposals/delivered/P-2004',
  toolInput: {}, riskScore: r7.riskScore,
}, { deliveryPathWriteAttempt: true }));

// ── 8. Quarterly Client Report ──────────────────────────────────────────
header('8. Client Reporter — Quarterly Performance Report');
scenario('Q1 2026 report for client C-3001, Art.52 disclosure present');
const r8 = crModel.score('generate-report', {}, {
  reportType: 'quarterly',
});
showScore(r8);
showAudit(crAudit.classify({
  decision: 'allow', toolName: 'generate-report --client C-3001 --period Q1-2026',
  toolInput: {}, riskScore: r8.riskScore,
}, { reportType: 'quarterly', clientId: 'C-3001' }));

// ── 9. Cross-Client Access ──────────────────────────────────────────────
header('9. Client Reporter — Cross-Client Access Attempt (CRITICAL)');
scenario('Client reporter attempts to read another client portfolio — GDPR breach');
const r9 = crModel.score('read portfolios/C-3002', {}, {
  crossClientAccessAttempt: true,
});
showScore(r9);
showAudit(crAudit.classify({
  decision: 'deny', toolName: 'read portfolios/C-3002',
  toolInput: {}, riskScore: r9.riskScore,
}, { crossClientAccessAttempt: true }));

// ── Summary ─────────────────────────────────────────────────────────────
header('Summary');
console.log('\nRetention Schedule:');
for (const [cat, ret] of Object.entries(RETENTION)) {
  console.log(`  ${cat.padEnd(35)} ${String(ret.years).padStart(3)}yr  ${ret.reason}`);
}

console.log('\nCritical SOE Boundaries:');
console.log('  1. ALL agents: read-only with respect to client records (CRM) — no agent can write to CRM');
console.log('  2. ALL agents: pre-publication research denied — MNPI isolation at infrastructure level');
console.log('  3. proposal-generator: draft-only — writeAllow ONLY advisory/proposals/draft/**');
console.log('  4. proposal-generator: Art.52 disclosure enforced — write blocked if disclosure absent');
console.log('  5. proposal-generator: human approval gate — delivered/sent/approved paths all writeDeny');
console.log('  6. client-reporter: strict client isolation — cross-client access = GDPR breach assessment');
console.log('  7. client-reporter: Art.52 disclosure enforced on every report');

console.log('\n\x1b[32mDemo complete.\x1b[0m 9 scenarios across 3 agents.');
console.log('EU AI Act Art.52 (transparency), MiFID II Art.25 (suitability), GDPR Art.22 (automated decisions), ERISA (fiduciary).');

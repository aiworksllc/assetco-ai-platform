import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseRiskModel,
  SuitabilityCheckerRiskModel,
  ProposalGeneratorRiskModel,
  ClientReporterRiskModel,
  createRiskModel,
  listModels,
} from '../../platform/models/advisor-lens/risk-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('AdvisorLens Risk Models — Factory', () => {
  it('lists all 3 agent models', () => {
    assert.deepStrictEqual(listModels(), ['suitability-checker', 'proposal-generator', 'client-reporter']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createRiskModel('suitability-checker') instanceof SuitabilityCheckerRiskModel);
    assert.ok(createRiskModel('proposal-generator') instanceof ProposalGeneratorRiskModel);
    assert.ok(createRiskModel('client-reporter') instanceof ClientReporterRiskModel);
  });

  it('returns BaseRiskModel for unknown agent', () => {
    assert.ok(createRiskModel('unknown') instanceof BaseRiskModel);
  });
});

// ── Score Structure ──────────────────────────────────────────────────────

describe('Score Structure', () => {
  it('returns all required fields', () => {
    const model = createRiskModel('suitability-checker');
    const result = model.score('check', {}, { suitabilityDetermination: 'suitable' });
    assert.ok('riskScore' in result);
    assert.ok('riskTier' in result);
    assert.ok('factors' in result);
    assert.ok('regulatoryFlags' in result);
    assert.ok('explanation' in result);
    assert.ok('model' in result);
    assert.strictEqual(result.modelVersion, '1.0.0');
  });

  it('riskScore clamped 0-100', () => {
    const model = createRiskModel('suitability-checker');
    const result = model.score('check', {}, {});
    assert.ok(result.riskScore >= 0 && result.riskScore <= 100);
  });
});

// ── Suitability Checker ──────────────────────────────────────────────────

describe('SuitabilityCheckerRiskModel', () => {
  const model = new SuitabilityCheckerRiskModel();

  it('has correct risk budget (500/day, freeze on breach)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 500);
    assert.strictEqual(model.riskBudget.escalateAt, 350);
    assert.strictEqual(model.riskBudget.freezeOnBreach, true);
  });

  it('scores green for suitable determination', () => {
    const result = model.score('check', {}, { suitabilityDetermination: 'suitable' });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores suitable with complex product multiplier', () => {
    const result = model.score('check', {}, { suitabilityDetermination: 'suitable', productComplexityClass: 'complex' });
    const factor = result.factors.find(f => f.name === 'suitability-suitable');
    assert.strictEqual(factor.impact, 8);
  });

  it('scores requires-review for retail client', () => {
    const result = model.score('check', {}, { suitabilityDetermination: 'requires-review', clientCategory: 'retail' });
    const factor = result.factors.find(f => f.name === 'suitability-review');
    assert.strictEqual(factor.impact, 30);
  });

  it('scores requires-review for professional client', () => {
    const result = model.score('check', {}, { suitabilityDetermination: 'requires-review', clientCategory: 'professional' });
    const factor = result.factors.find(f => f.name === 'suitability-review');
    assert.strictEqual(factor.impact, 15);
  });

  it('scores unsuitable determination', () => {
    const result = model.score('check', {}, { suitabilityDetermination: 'unsuitable' });
    const factor = result.factors.find(f => f.name === 'suitability-unsuitable');
    assert.strictEqual(factor.impact, 25);
  });

  it('scores suitability override without compliance sign-off', () => {
    const result = model.score('check', {}, { suitabilityOverride: true, complianceSignOff: false });
    const factor = result.factors.find(f => f.name === 'suitability-override');
    assert.strictEqual(factor.impact, 75);
  });

  it('scores suitability override with compliance sign-off', () => {
    const result = model.score('check', {}, { suitabilityOverride: true, complianceSignOff: true });
    const factor = result.factors.find(f => f.name === 'suitability-override');
    assert.strictEqual(factor.impact, 50);
  });

  it('scores risk profile deviation >2 bands', () => {
    const result = model.score('check', {}, { riskProfileDeviationBands: 3 });
    const factor = result.factors.find(f => f.name === 'risk-profile-deviation');
    assert.strictEqual(factor.impact, 40);
  });

  it('scores risk profile deviation with retail multiplier', () => {
    const result = model.score('check', {}, { riskProfileDeviationBands: 3, clientCategory: 'retail' });
    const factor = result.factors.find(f => f.name === 'risk-profile-deviation');
    assert.strictEqual(factor.impact, 80);
  });

  it('scores GDPR consent not checked', () => {
    const result = model.score('check', {}, { gdprConsentNotChecked: true });
    const factor = result.factors.find(f => f.name === 'gdpr-consent-missing');
    assert.strictEqual(factor.impact, 75);
  });

  it('scores pre-publication access attempt', () => {
    const result = model.score('read research/pre-publication', {}, { prePublicationAccessAttempt: true });
    const factor = result.factors.find(f => f.name === 'pre-pub-access');
    assert.strictEqual(factor.impact, 80);
  });

  it('scores critical for CRM write attempt', () => {
    const result = model.score('write crm/clients', {}, { crmWriteAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores PII access attempt', () => {
    const result = model.score('read ssn', {}, { piiAccessAttempt: true });
    const factor = result.factors.find(f => f.name === 'pii-access');
    assert.strictEqual(factor.impact, 50);
  });

  it('always flags MiFID II Art.25', () => {
    const result = model.score('check', {}, {});
    const flag = result.regulatoryFlags.find(f => f.flag === 'MiFID-II-Art.25');
    assert.ok(flag);
  });

  it('flags SEC Advisers Act for unsuitable', () => {
    const result = model.score('check', {}, { suitabilityDetermination: 'unsuitable' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SEC-Advisers-Act');
    assert.ok(flag);
  });

  it('flags GDPR Art.6 for consent not checked', () => {
    const result = model.score('check', {}, { gdprConsentNotChecked: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'GDPR-Art.6');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });
});

// ── Proposal Generator ───────────────────────────────────────────────────

describe('ProposalGeneratorRiskModel', () => {
  const model = new ProposalGeneratorRiskModel();

  it('has correct risk budget (200/day, freeze on breach)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 200);
    assert.strictEqual(model.riskBudget.freezeOnBreach, true);
  });

  it('scores green for standard proposal', () => {
    const result = model.score('draft', {}, { proposalType: 'standard' });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores complex product proposal', () => {
    const result = model.score('draft', {}, { proposalType: 'complex-product' });
    const factor = result.factors.find(f => f.name === 'complex-proposal');
    assert.strictEqual(factor.impact, 25);
  });

  it('scores complex product with suitability mismatch', () => {
    const result = model.score('draft', {}, { proposalType: 'complex-product', suitabilityMismatch: true });
    const factor = result.factors.find(f => f.name === 'complex-proposal');
    assert.strictEqual(factor.impact, 38);
  });

  it('scores ERISA client proposal', () => {
    const result = model.score('draft', {}, { proposalType: 'erisa-client' });
    const factor = result.factors.find(f => f.name === 'erisa-proposal');
    assert.strictEqual(factor.impact, 30);
  });

  it('scores GDPR Art.22 opt-out without deliberative review', () => {
    const result = model.score('draft', {}, { gdprArt22OptOut: true, deliberativeReviewTagged: false });
    const factor = result.factors.find(f => f.name === 'gdpr-art22-optout');
    assert.strictEqual(factor.impact, 40);
  });

  it('scores GDPR Art.22 opt-out with deliberative review', () => {
    const result = model.score('draft', {}, { gdprArt22OptOut: true, deliberativeReviewTagged: true });
    const factor = result.factors.find(f => f.name === 'gdpr-art22-optout');
    assert.strictEqual(factor.impact, 20);
  });

  it('scores high magnitude allocation change', () => {
    const result = model.score('draft', {}, { allocationChangePct: 25 });
    const factor = result.factors.find(f => f.name === 'high-magnitude');
    assert.strictEqual(factor.impact, 30);
  });

  it('scores high magnitude with model deviation', () => {
    const result = model.score('draft', {}, { allocationChangePct: 25, deviationFromModelSigma: 3 });
    const factor = result.factors.find(f => f.name === 'high-magnitude');
    assert.strictEqual(factor.impact, 45);
  });

  it('scores cross-selling indicator', () => {
    const result = model.score('draft', {}, { crossSellingDetected: true });
    const factor = result.factors.find(f => f.name === 'cross-selling');
    assert.strictEqual(factor.impact, 35);
  });

  it('scores critical for Art.52 disclosure missing', () => {
    const result = model.score('draft', {}, { art52DisclosureMissing: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores critical for suitability check bypassed', () => {
    const result = model.score('draft', {}, { suitabilityCheckBypassed: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores critical for delivery path write attempt', () => {
    const result = model.score('write advisory/proposals/delivered', {}, { deliveryPathWriteAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('flags EU AI Act Art.52 for missing disclosure', () => {
    const result = model.score('draft', {}, { art52DisclosureMissing: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'EU-AI-Act-Art.52');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });

  it('flags ERISA for ERISA client', () => {
    const result = model.score('draft', {}, { proposalType: 'erisa-client' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'ERISA');
    assert.ok(flag);
  });

  it('flags GDPR Art.22 for opt-out client', () => {
    const result = model.score('draft', {}, { gdprArt22OptOut: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'GDPR-Art.22');
    assert.ok(flag);
  });

  it('flags EU AI Act Art.14 for delivery attempt', () => {
    const result = model.score('write', {}, { deliveryPathWriteAttempt: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'EU-AI-Act-Art.14');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });

  it('flags MiFID II Art.24 for cross-selling', () => {
    const result = model.score('draft', {}, { crossSellingDetected: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'MiFID-II-Art.24');
    assert.ok(flag);
  });
});

// ── Client Reporter ──────────────────────────────────────────────────────

describe('ClientReporterRiskModel', () => {
  const model = new ClientReporterRiskModel();

  it('has correct risk budget (300/day, freeze on breach)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 300);
    assert.strictEqual(model.riskBudget.freezeOnBreach, true);
  });

  it('scores green for quarterly report', () => {
    const result = model.score('report', {}, { reportType: 'quarterly' });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores annual report', () => {
    const result = model.score('report', {}, { reportType: 'annual' });
    const factor = result.factors.find(f => f.name === 'annual-report');
    assert.strictEqual(factor.impact, 15);
  });

  it('scores SFDR Art.9 report', () => {
    const result = model.score('report', {}, { reportType: 'sfdr-art9' });
    const factor = result.factors.find(f => f.name === 'sfdr-report');
    assert.strictEqual(factor.impact, 15);
  });

  it('scores critical for Art.52 disclosure missing', () => {
    const result = model.score('report', {}, { art52DisclosureMissing: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores critical for cross-client access attempt', () => {
    const result = model.score('read portfolios/other-client', {}, { crossClientAccessAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores pre-publication access attempt', () => {
    const result = model.score('read research/pre-publication', {}, { prePublicationAccessAttempt: true });
    const factor = result.factors.find(f => f.name === 'pre-pub-access');
    assert.strictEqual(factor.impact, 80);
  });

  it('scores CRM write attempt', () => {
    const result = model.score('write crm', {}, { crmWriteAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores proposal write attempt', () => {
    const result = model.score('write advisory/proposals', {}, { proposalWriteAttempt: true });
    const factor = result.factors.find(f => f.name === 'proposal-write-attempt');
    assert.strictEqual(factor.impact, 60);
  });

  it('flags EU AI Act Art.52 for missing disclosure', () => {
    const result = model.score('report', {}, { art52DisclosureMissing: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'EU-AI-Act-Art.52');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });

  it('flags GDPR Art.5 for cross-client access', () => {
    const result = model.score('read', {}, { crossClientAccessAttempt: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'GDPR-Art.5');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });

  it('flags SFDR Art.9 for sustainability report', () => {
    const result = model.score('report', {}, { reportType: 'sfdr-art9' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SFDR-Art.9');
    assert.ok(flag);
  });

  it('always flags MiFID II Art.24', () => {
    const result = model.score('report', {}, {});
    const flag = result.regulatoryFlags.find(f => f.flag === 'MiFID-II-Art.24');
    assert.ok(flag);
  });
});

// ── Cumulative Scenarios ─────────────────────────────────────────────────

describe('Cumulative Scenarios', () => {
  it('normal suitability check stays Green', () => {
    const model = createRiskModel('suitability-checker');
    const result = model.score('check', {}, { suitabilityDetermination: 'suitable' });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('retail requires-review with risk deviation goes Yellow+', () => {
    const model = createRiskModel('suitability-checker');
    const result = model.score('check', {}, {
      suitabilityDetermination: 'requires-review',
      clientCategory: 'retail',
      riskProfileDeviationBands: 3,
    });
    assert.ok(result.riskScore > 60, `Expected Red+ but got ${result.riskScore}`);
  });

  it('ERISA proposal with GDPR opt-out goes Yellow+', () => {
    const model = createRiskModel('proposal-generator');
    const result = model.score('draft', {}, {
      proposalType: 'erisa-client',
      gdprArt22OptOut: true,
      deliberativeReviewTagged: false,
    });
    assert.ok(result.riskScore > 60, `Expected Red+ but got ${result.riskScore}`);
  });

  it('Art.52 missing in any agent is always Critical', () => {
    for (const agentId of ['proposal-generator', 'client-reporter']) {
      const model = createRiskModel(agentId);
      const result = model.score('write', {}, { art52DisclosureMissing: true });
      assert.strictEqual(result.riskTier, 'critical', `${agentId} should go critical on Art.52 missing`);
    }
  });
});

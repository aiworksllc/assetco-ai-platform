import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseRiskModel,
  TradeSurveillerRiskModel,
  PositionReporterRiskModel,
  BreachDetectorRiskModel,
  RegulatoryFilerRiskModel,
  createRiskModel,
  listModels,
} from '../../platform/models/compliance-shield/risk-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('ComplianceShield Risk Models — Factory', () => {
  it('lists all 4 agent models', () => {
    assert.deepStrictEqual(listModels(), ['trade-surveiller', 'position-reporter', 'breach-detector', 'regulatory-filer']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createRiskModel('trade-surveiller') instanceof TradeSurveillerRiskModel);
    assert.ok(createRiskModel('position-reporter') instanceof PositionReporterRiskModel);
    assert.ok(createRiskModel('breach-detector') instanceof BreachDetectorRiskModel);
    assert.ok(createRiskModel('regulatory-filer') instanceof RegulatoryFilerRiskModel);
  });

  it('returns BaseRiskModel for unknown agent', () => {
    assert.ok(createRiskModel('unknown') instanceof BaseRiskModel);
  });
});

// ── Score Structure ──────────────────────────────────────────────────────

describe('Score Structure', () => {
  it('returns all required fields', () => {
    const model = createRiskModel('trade-surveiller');
    const result = model.score('alert-generator', {}, {});
    assert.ok('riskScore' in result);
    assert.ok('riskTier' in result);
    assert.ok('factors' in result);
    assert.ok('regulatoryFlags' in result);
    assert.ok('explanation' in result);
    assert.ok('model' in result);
    assert.strictEqual(result.modelVersion, '1.0.0');
  });

  it('riskScore clamped 0-100', () => {
    const model = createRiskModel('trade-surveiller');
    const result = model.score('test', {}, {});
    assert.ok(result.riskScore >= 0 && result.riskScore <= 100);
  });
});

// ── Trade Surveiller ─────────────────────────────────────────────────────

describe('TradeSurveillerRiskModel', () => {
  const model = new TradeSurveillerRiskModel();

  it('has correct risk budget (500/day, no freeze)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 500);
    assert.strictEqual(model.riskBudget.escalateAt, 300);
    assert.strictEqual(model.riskBudget.freezeOnBreach, false);
  });

  it('scores green for normal surveillance', () => {
    const result = model.score('pattern-detector', {}, {});
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores surveillance gap >3min', () => {
    const result = model.score('heartbeat', {}, { heartbeatGapMinutes: 5 });
    const factor = result.factors.find(f => f.name === 'surveillance-gap');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 40);
  });

  it('scores heartbeat delay 1-3min', () => {
    const result = model.score('heartbeat', {}, { heartbeatGapMinutes: 2 });
    const factor = result.factors.find(f => f.name === 'heartbeat-delay');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 10);
  });

  it('scores source system outage', () => {
    const result = model.score('monitor', {}, { sourceSystemsDown: 2 });
    const factor = result.factors.find(f => f.name === 'source-system-outage');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 60);
  });

  it('scores high false positive rate >40%', () => {
    const result = model.score('report', {}, { falsePositiveRatePct: 45 });
    const factor = result.factors.find(f => f.name === 'high-false-positive-rate');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 25);
  });

  it('scores elevated false positive rate 25-40%', () => {
    const result = model.score('report', {}, { falsePositiveRatePct: 30 });
    const factor = result.factors.find(f => f.name === 'elevated-false-positive-rate');
    assert.strictEqual(factor.impact, 10);
  });

  it('scores pattern detection', () => {
    const result = model.score('anomaly-detector', {}, { patternDetected: true, patternType: 'SPOOFING', patternSeverity: 'high' });
    const factor = result.factors.find(f => f.name === 'pattern-detected');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 20);
  });

  it('scores STR candidate generation', () => {
    const result = model.score('str-writer', {}, { strCandidateGenerated: true });
    const factor = result.factors.find(f => f.name === 'str-candidate');
    assert.strictEqual(factor.impact, 15);
  });

  it('scores critical for trading system write attempt', () => {
    const result = model.score('write trading/orders', {}, { tradingSystemWriteAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'trading-write-attempt');
    assert.strictEqual(factor.impact, 95);
  });

  it('scores critical for evidence tamper attempt', () => {
    const result = model.score('modify evidence', {}, { evidenceTamperAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores PII access attempt', () => {
    const result = model.score('read client-pii', {}, { piiAccessAttempt: true });
    const factor = result.factors.find(f => f.name === 'pii-access');
    assert.strictEqual(factor.impact, 50);
  });

  it('always flags FINRA 3110', () => {
    const result = model.score('test', {}, {});
    const flag = result.regulatoryFlags.find(f => f.flag === 'FINRA-3110');
    assert.ok(flag);
  });

  it('flags MAR Art.12 for pattern detection', () => {
    const result = model.score('detector', {}, { patternDetected: true, patternType: 'WASH_TRADING' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'MAR-Art.12');
    assert.ok(flag);
  });

  it('flags MAR Art.16 for STR candidate', () => {
    const result = model.score('str-writer', {}, { strCandidateGenerated: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'MAR-Art.16');
    assert.ok(flag);
  });

  it('flags DORA Art.10 for surveillance gap', () => {
    const result = model.score('heartbeat', {}, { heartbeatGapMinutes: 5 });
    const flag = result.regulatoryFlags.find(f => f.flag === 'DORA-Art.10');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });
});

// ── Position Reporter ────────────────────────────────────────────────────

describe('PositionReporterRiskModel', () => {
  const model = new PositionReporterRiskModel();

  it('has correct risk budget (200/day, freeze on breach)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 200);
    assert.strictEqual(model.riskBudget.freezeOnBreach, true);
  });

  it('scores green for small report', () => {
    const result = model.score('report-gen', {}, { recordCount: 50 });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores large report >10K records', () => {
    const result = model.score('report-gen', {}, { recordCount: 15000 });
    const factor = result.factors.find(f => f.name === 'large-report');
    assert.strictEqual(factor.impact, 10);
  });

  it('scores critical deadline proximity <=2hr', () => {
    const result = model.score('report-gen', {}, { hoursToDeadline: 1.5 });
    const factor = result.factors.find(f => f.name === 'critical-deadline');
    assert.strictEqual(factor.impact, 40);
  });

  it('scores near deadline 2-4hr', () => {
    const result = model.score('report-gen', {}, { hoursToDeadline: 3 });
    const factor = result.factors.find(f => f.name === 'near-deadline');
    assert.strictEqual(factor.impact, 20);
  });

  it('scores validation failure', () => {
    const result = model.score('report-gen', {}, { validationFailed: true });
    const factor = result.factors.find(f => f.name === 'validation-failure');
    assert.strictEqual(factor.impact, 30);
  });

  it('scores checksum mismatch', () => {
    const result = model.score('report-gen', {}, { sourceDataChecksumMismatch: true });
    const factor = result.factors.find(f => f.name === 'checksum-mismatch');
    assert.strictEqual(factor.impact, 50);
  });

  it('scores critical for source data write attempt', () => {
    const result = model.score('write positions', {}, { sourceDataWriteAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('flags EMIR Art.9 for EMIR report', () => {
    const result = model.score('report', {}, { reportType: 'EMIR_TR' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'EMIR-Art.9');
    assert.ok(flag);
  });

  it('flags SEC-13F for 13F report', () => {
    const result = model.score('report', {}, { reportType: 'SEC_13F' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SEC-13F');
    assert.ok(flag);
  });

  it('flags critical for deadline under 2hr', () => {
    const result = model.score('report', {}, { hoursToDeadline: 1 });
    const flag = result.regulatoryFlags.find(f => f.flag === 'MiFIR-RTS25');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });
});

// ── Breach Detector ──────────────────────────────────────────────────────

describe('BreachDetectorRiskModel', () => {
  const model = new BreachDetectorRiskModel();

  it('has correct risk budget (300/day, no freeze)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 300);
    assert.strictEqual(model.riskBudget.freezeOnBreach, false);
  });

  it('scores green for normal monitoring', () => {
    const result = model.score('monitor', {}, {});
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores critical breach detection', () => {
    const result = model.score('alert', {}, { breachSeverity: 'critical' });
    const factor = result.factors.find(f => f.name === 'critical-breach');
    assert.strictEqual(factor.impact, 25);
  });

  it('scores information barrier crossing', () => {
    const result = model.score('alert', {}, { informationBarrierCrossing: true });
    const factor = result.factors.find(f => f.name === 'info-barrier-crossing');
    assert.strictEqual(factor.impact, 40);
  });

  it('scores SOE violation detection', () => {
    const result = model.score('alert', {}, { soeViolationDetected: true });
    const factor = result.factors.find(f => f.name === 'soe-violation');
    assert.strictEqual(factor.impact, 20);
  });

  it('scores risk limit breach', () => {
    const result = model.score('alert', {}, { riskLimitBreach: true });
    const factor = result.factors.find(f => f.name === 'risk-limit-breach');
    assert.strictEqual(factor.impact, 15);
  });

  it('scores escalation SLA breach', () => {
    const result = model.score('alert', {}, { escalationSlaBreached: true });
    const factor = result.factors.find(f => f.name === 'sla-breach');
    assert.strictEqual(factor.impact, 30);
  });

  it('scores critical for SOE modification attempt', () => {
    const result = model.score('modify-soe', {}, { soeModificationAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores critical for risk limit modify attempt', () => {
    const result = model.score('update-risk-limit', {}, { riskLimitModifyAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores critical for evidence deletion attempt', () => {
    const result = model.score('delete evidence', {}, { evidenceDeletionAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('flags SOX-302 for information barrier crossing', () => {
    const result = model.score('alert', {}, { informationBarrierCrossing: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SOX-302');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });

  it('flags DORA Art.10 for SOE violation', () => {
    const result = model.score('alert', {}, { soeViolationDetected: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'DORA-Art.10');
    assert.ok(flag);
  });

  it('flags SOX-404 for controls modification attempt', () => {
    const result = model.score('modify', {}, { soeModificationAttempt: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SOX-404');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });

  it('flags SEC-17a-4 for evidence deletion', () => {
    const result = model.score('delete', {}, { evidenceDeletionAttempt: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SEC-17a-4');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });
});

// ── Regulatory Filer ─────────────────────────────────────────────────────

describe('RegulatoryFilerRiskModel', () => {
  const model = new RegulatoryFilerRiskModel();

  it('has correct risk budget (150/day, freeze on breach)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 150);
    assert.strictEqual(model.riskBudget.escalateAt, 100);
    assert.strictEqual(model.riskBudget.freezeOnBreach, true);
  });

  it('scores green for standard filing', () => {
    const result = model.score('formatter', {}, { filingType: 'SEC_13F' });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores EU filing (EMIR)', () => {
    const result = model.score('formatter', {}, { filingType: 'EMIR_TR' });
    const factor = result.factors.find(f => f.name === 'eu-filing');
    assert.strictEqual(factor.impact, 10);
  });

  it('scores complex filing (FORM_PF)', () => {
    const result = model.score('formatter', {}, { filingType: 'FORM_PF' });
    const factor = result.factors.find(f => f.name === 'complex-filing');
    assert.strictEqual(factor.impact, 15);
  });

  it('scores validation failure', () => {
    const result = model.score('validation', {}, { validationFailed: true });
    const factor = result.factors.find(f => f.name === 'validation-failure');
    assert.strictEqual(factor.impact, 30);
  });

  it('scores critical deadline <=2hr', () => {
    const result = model.score('formatter', {}, { hoursToDeadline: 1 });
    const factor = result.factors.find(f => f.name === 'critical-deadline');
    assert.strictEqual(factor.impact, 40);
  });

  it('scores filing rejection', () => {
    const result = model.score('re-file', {}, { filingRejected: true });
    const factor = result.factors.find(f => f.name === 'filing-rejected');
    assert.strictEqual(factor.impact, 50);
  });

  it('scores critical for SUBMITTED status attempt', () => {
    const result = model.score('status-updater', {}, { statusTransition: 'SUBMITTED' });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores critical for APPROVED status attempt', () => {
    const result = model.score('status-updater', {}, { statusTransition: 'APPROVED' });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores critical for source report modify attempt', () => {
    const result = model.score('write compliance/reports', {}, { sourceReportModifyAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores critical for regulatory portal access', () => {
    const result = model.score('curl regulatory-portal', {}, { regulatoryPortalAccessAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('flags EMIR-Art.9 for EMIR filing', () => {
    const result = model.score('formatter', {}, { filingType: 'EMIR_TR' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'EMIR-Art.9');
    assert.ok(flag);
  });

  it('flags SOX-302 for SOX filing', () => {
    const result = model.score('formatter', {}, { filingType: 'SOX_302' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SOX-302');
    assert.ok(flag);
  });

  it('flags FINRA-4511 for filing rejection', () => {
    const result = model.score('re-file', {}, { filingRejected: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'FINRA-4511');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });

  it('flags SOX-404 for unauthorized status transition', () => {
    const result = model.score('status', {}, { statusTransition: 'SUBMITTED' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SOX-404');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });
});

// ── Cumulative Scenarios ─────────────────────────────────────────────────

describe('Cumulative Scenarios', () => {
  it('normal surveillance stays Green', () => {
    const model = createRiskModel('trade-surveiller');
    const result = model.score('pattern-detector', {}, {});
    assert.strictEqual(result.riskTier, 'green');
  });

  it('surveillance gap + pattern detection goes Yellow+', () => {
    const model = createRiskModel('trade-surveiller');
    const result = model.score('monitor', {}, {
      heartbeatGapMinutes: 4,
      patternDetected: true,
      patternType: 'SPOOFING',
      patternSeverity: 'high',
    });
    assert.ok(result.riskScore > 60, `Expected Red+ but got ${result.riskScore}`);
  });

  it('near-deadline report with validation failure goes Yellow+', () => {
    const model = createRiskModel('position-reporter');
    const result = model.score('report', {}, {
      recordCount: 15000,
      hoursToDeadline: 3,
      validationFailed: true,
    });
    assert.ok(result.riskScore > 50, `Expected Yellow+ but got ${result.riskScore}`);
  });

  it('information barrier + SOE violation goes Red+', () => {
    const model = createRiskModel('breach-detector');
    const result = model.score('alert', {}, {
      informationBarrierCrossing: true,
      soeViolationDetected: true,
    });
    assert.ok(result.riskScore > 60, `Expected Red+ but got ${result.riskScore}`);
  });

  it('filing rejection + deadline proximity goes Red+', () => {
    const model = createRiskModel('regulatory-filer');
    const result = model.score('re-file', {}, {
      filingRejected: true,
      hoursToDeadline: 1.5,
      filingType: 'EMIR_TR',
    });
    assert.ok(result.riskScore > 85, `Expected Critical but got ${result.riskScore}`);
  });
});

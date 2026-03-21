import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseAuditModel,
  TradeSurveillerAuditModel,
  PositionReporterAuditModel,
  BreachDetectorAuditModel,
  RegulatoryFilerAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
} from '../../platform/models/compliance-shield/audit-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('ComplianceShield Audit Models — Factory', () => {
  it('lists all 4 agent audit models', () => {
    assert.deepStrictEqual(listAuditModels(), ['trade-surveiller', 'position-reporter', 'breach-detector', 'regulatory-filer']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createAuditModel('trade-surveiller') instanceof TradeSurveillerAuditModel);
    assert.ok(createAuditModel('position-reporter') instanceof PositionReporterAuditModel);
    assert.ok(createAuditModel('breach-detector') instanceof BreachDetectorAuditModel);
    assert.ok(createAuditModel('regulatory-filer') instanceof RegulatoryFilerAuditModel);
  });

  it('returns BaseAuditModel for unknown agent', () => {
    assert.ok(createAuditModel('unknown') instanceof BaseAuditModel);
  });
});

// ── Record Structure ─────────────────────────────────────────────────────

describe('Audit Record Structure', () => {
  it('returns all required fields', () => {
    const model = createAuditModel('trade-surveiller');
    const record = model.classify({
      decision: 'allow', toolName: 'alert-generator', toolInput: {}, riskScore: 10,
    });
    assert.ok(record.recordId.startsWith('aud-'));
    assert.ok(record.timestamp);
    assert.strictEqual(record.agentId, 'trade-surveiller');
    assert.ok(record.auditCategory);
    assert.ok(record.severity);
    assert.ok(record.retention);
  });

  it('sanitizes context to allowed keys only', () => {
    const model = createAuditModel('trade-surveiller');
    const record = model.classify(
      { decision: 'allow', toolName: 'test', toolInput: {}, riskScore: 5 },
      { patternType: 'SPOOFING', secretKey: 'should-not-appear', alertType: 'SURVEILLANCE' }
    );
    assert.strictEqual(record.context.patternType, 'SPOOFING');
    assert.strictEqual(record.context.alertType, 'SURVEILLANCE');
    assert.strictEqual(record.context.secretKey, undefined);
  });
});

// ── Retention ────────────────────────────────────────────────────────────

describe('Retention Schedule', () => {
  it('trade-surveillance-alert: 10 years', () => {
    assert.strictEqual(RETENTION['trade-surveillance-alert'].years, 10);
  });

  it('str-candidate: 7 years', () => {
    assert.strictEqual(RETENTION['str-candidate'].years, 7);
  });

  it('position-report-generation: 7 years', () => {
    assert.strictEqual(RETENTION['position-report-generation'].years, 7);
  });

  it('breach-escalation: 7 years', () => {
    assert.strictEqual(RETENTION['breach-escalation'].years, 7);
  });

  it('breach-escalation-fraud: 99 years (indefinite)', () => {
    assert.strictEqual(RETENTION['breach-escalation-fraud'].years, 99);
  });

  it('information-barrier-violation: 10 years', () => {
    assert.strictEqual(RETENTION['information-barrier-violation'].years, 10);
  });

  it('regulatory-filing-preparation: 7 years', () => {
    assert.strictEqual(RETENTION['regulatory-filing-preparation'].years, 7);
  });

  it('sox-evidence: 10 years', () => {
    assert.strictEqual(RETENTION['sox-evidence'].years, 10);
  });

  it('dora-operational: 7 years', () => {
    assert.strictEqual(RETENTION['dora-operational'].years, 7);
  });
});

// ── Trade Surveiller Audit ───────────────────────────────────────────────

describe('TradeSurveillerAuditModel', () => {
  const model = new TradeSurveillerAuditModel();

  it('categorizes pattern detection', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'pattern-detector', toolInput: {}, riskScore: 20 },
      { patternDetected: true, patternType: 'SPOOFING' }
    );
    assert.strictEqual(record.auditCategory, 'trade-surveillance-alert');
    assert.strictEqual(record.eventType, 'pattern-detected');
  });

  it('categorizes STR candidate generation', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'str-writer', toolInput: {}, riskScore: 15 },
      { strCandidateGenerated: true }
    );
    assert.strictEqual(record.auditCategory, 'str-candidate');
    assert.strictEqual(record.eventType, 'str-candidate-generated');
  });

  it('categorizes trading system write attempt as SOX evidence', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write trading/orders', toolInput: {}, riskScore: 95 },
      { tradingSystemWriteAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'sox-evidence');
    assert.strictEqual(record.eventType, 'integrity-violation-attempt');
  });

  it('categorizes PII access as surveillance alert', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read client-pii', toolInput: {}, riskScore: 50 },
      { piiAccessAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'trade-surveillance-alert');
    assert.strictEqual(record.eventType, 'pii-access-blocked');
  });

  it('maps FINRA 3110 compliance', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'alert-generator', toolInput: {}, riskScore: 10 }
    );
    const finra = record.compliance.find(f => f.framework === 'FINRA 3110');
    assert.ok(finra);
    assert.ok(finra.articles.some(a => a.ref === 'Rule-3110'));
  });

  it('maps MAR Art.12 for pattern detection', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'detector', toolInput: {}, riskScore: 20 },
      { patternDetected: true, patternType: 'WASH_TRADING' }
    );
    const mar = record.compliance.find(f => f.framework === 'MAR');
    assert.ok(mar);
    assert.ok(mar.articles.some(a => a.ref === 'Art.12'));
  });

  it('maps MAR Art.16 for STR candidate', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'str-writer', toolInput: {}, riskScore: 15 },
      { strCandidateGenerated: true }
    );
    const mar = record.compliance.find(f => f.framework === 'MAR');
    assert.ok(mar);
    assert.ok(mar.articles.some(a => a.ref === 'Art.16'));
  });
});

// ── Position Reporter Audit ──────────────────────────────────────────────

describe('PositionReporterAuditModel', () => {
  const model = new PositionReporterAuditModel();

  it('categorizes report generation', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'emir-tr-generator', toolInput: {}, riskScore: 10 },
      { reportType: 'EMIR_TR' }
    );
    assert.strictEqual(record.auditCategory, 'position-report-generation');
    assert.strictEqual(record.eventType, 'report-generated');
  });

  it('categorizes checksum mismatch', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'report-gen', toolInput: {}, riskScore: 50 },
      { sourceDataChecksumMismatch: true }
    );
    assert.strictEqual(record.eventType, 'checksum-mismatch-detected');
  });

  it('categorizes source data write attempt as SOX evidence', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write positions', toolInput: {}, riskScore: 95 },
      { sourceDataWriteAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'sox-evidence');
  });

  it('maps EMIR Art.9 for EMIR report', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'generator', toolInput: {}, riskScore: 10 },
      { reportType: 'EMIR_TR' }
    );
    const emir = record.compliance.find(f => f.framework === 'EMIR');
    assert.ok(emir);
    assert.ok(emir.articles.some(a => a.ref === 'Art.9'));
  });

  it('maps FINRA 4511 for FOCUS report', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'generator', toolInput: {}, riskScore: 5 },
      { reportType: 'FINRA_FOCUS' }
    );
    const finra = record.compliance.find(f => f.framework === 'FINRA 4511');
    assert.ok(finra);
  });
});

// ── Breach Detector Audit ────────────────────────────────────────────────

describe('BreachDetectorAuditModel', () => {
  const model = new BreachDetectorAuditModel();

  it('categorizes information barrier crossing as critical', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'alert-writer', toolInput: {}, riskScore: 40 },
      { informationBarrierCrossing: true }
    );
    assert.strictEqual(record.auditCategory, 'information-barrier-violation');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes SOE violation escalation', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'escalation-generator', toolInput: {}, riskScore: 20 },
      { soeViolationDetected: true }
    );
    assert.strictEqual(record.auditCategory, 'breach-escalation');
    assert.strictEqual(record.eventType, 'soe-violation-escalated');
  });

  it('categorizes risk limit breach', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'alert', toolInput: {}, riskScore: 15 },
      { riskLimitBreach: true }
    );
    assert.strictEqual(record.auditCategory, 'breach-escalation');
    assert.strictEqual(record.eventType, 'risk-limit-breach-escalated');
  });

  it('categorizes escalation SLA breach as DORA operational', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'alert', toolInput: {}, riskScore: 30 },
      { escalationSlaBreached: true }
    );
    assert.strictEqual(record.auditCategory, 'dora-operational');
    assert.strictEqual(record.eventType, 'escalation-sla-breached');
  });

  it('categorizes SOE modification attempt as SOX evidence', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'modify-soe', toolInput: {}, riskScore: 95 },
      { soeModificationAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'sox-evidence');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes evidence deletion attempt as SOX evidence', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'delete', toolInput: {}, riskScore: 95 },
      { evidenceDeletionAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'sox-evidence');
    assert.strictEqual(record.eventType, 'evidence-deletion-blocked');
  });

  it('maps SOX Section-302 for info barrier crossing', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'alert', toolInput: {}, riskScore: 40 },
      { informationBarrierCrossing: true }
    );
    const sox = record.compliance.find(f => f.framework === 'SOX');
    assert.ok(sox);
    assert.ok(sox.articles.some(a => a.ref === 'Section-302'));
  });

  it('maps DORA Art.10 for SOE violation', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'alert', toolInput: {}, riskScore: 20 },
      { soeViolationDetected: true }
    );
    const dora = record.compliance.find(f => f.framework === 'DORA');
    assert.ok(dora);
    assert.ok(dora.articles.some(a => a.ref === 'Art.10'));
  });

  it('maps SEC 17a-4 for evidence deletion', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'delete', toolInput: {}, riskScore: 95 },
      { evidenceDeletionAttempt: true }
    );
    const sec = record.compliance.find(f => f.framework === 'SEC Rule 17a-4');
    assert.ok(sec);
    assert.ok(sec.articles.some(a => a.ref === 'Rule-17a-4'));
  });
});

// ── Regulatory Filer Audit ───────────────────────────────────────────────

describe('RegulatoryFilerAuditModel', () => {
  const model = new RegulatoryFilerAuditModel();

  it('categorizes EMIR filing preparation', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'emir-tr-formatter', toolInput: {}, riskScore: 10 },
      { filingType: 'EMIR_TR' }
    );
    assert.strictEqual(record.auditCategory, 'regulatory-filing-preparation');
    assert.strictEqual(record.eventType, 'filing-prepared');
  });

  it('categorizes validation failure', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'validation-runner', toolInput: {}, riskScore: 30 },
      { validationFailed: true }
    );
    assert.strictEqual(record.eventType, 'validation-failed');
  });

  it('categorizes filing rejection', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 're-file', toolInput: {}, riskScore: 50 },
      { filingRejected: true }
    );
    assert.strictEqual(record.eventType, 'filing-rejected');
  });

  it('categorizes unauthorized SUBMITTED transition as SOX evidence', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'status-updater', toolInput: {}, riskScore: 95 },
      { statusTransition: 'SUBMITTED' }
    );
    assert.strictEqual(record.auditCategory, 'sox-evidence');
    assert.strictEqual(record.eventType, 'unauthorized-status-transition-blocked');
  });

  it('categorizes portal access attempt as SOX evidence', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'curl regulatory-portal', toolInput: {}, riskScore: 95 },
      { regulatoryPortalAccessAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'sox-evidence');
    assert.strictEqual(record.eventType, 'portal-access-blocked');
  });

  it('maps EMIR Art.9 for EMIR filing', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'formatter', toolInput: {}, riskScore: 10 },
      { filingType: 'EMIR_TR' }
    );
    const emir = record.compliance.find(f => f.framework === 'EMIR');
    assert.ok(emir);
    assert.ok(emir.articles.some(a => a.ref === 'Art.9'));
  });

  it('maps SOX for SOX filing', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'formatter', toolInput: {}, riskScore: 15 },
      { filingType: 'SOX_302' }
    );
    const sox = record.compliance.find(f => f.framework === 'SOX');
    assert.ok(sox);
    assert.ok(sox.articles.some(a => a.ref === 'Section-302'));
  });

  it('maps SOX Section-404 for unauthorized status transition', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'status', toolInput: {}, riskScore: 95 },
      { statusTransition: 'APPROVED' }
    );
    const sox = record.compliance.find(f => f.framework === 'SOX');
    assert.ok(sox);
    assert.ok(sox.articles.some(a => a.ref === 'Section-404'));
  });
});

// ── Severity Assessment ──────────────────────────────────────────────────

describe('Severity Assessment', () => {
  it('critical at riskScore >= 86', () => {
    const model = createAuditModel('trade-surveiller');
    const record = model.classify({ decision: 'allow', toolName: 'test', toolInput: {}, riskScore: 90 });
    assert.strictEqual(record.severity, 'critical');
  });

  it('high for deny decisions', () => {
    const model = createAuditModel('regulatory-filer');
    const record = model.classify({ decision: 'deny', toolName: 'test', toolInput: {}, riskScore: 30 });
    assert.strictEqual(record.severity, 'high');
  });

  it('information barrier violation always critical regardless of score', () => {
    const model = createAuditModel('breach-detector');
    const record = model.classify(
      { decision: 'allow', toolName: 'alert', toolInput: {}, riskScore: 10 },
      { informationBarrierCrossing: true }
    );
    assert.strictEqual(record.severity, 'critical');
  });

  it('fraud-related breach gets indefinite retention', () => {
    const model = createAuditModel('breach-detector');
    const record = model.classify(
      { decision: 'allow', toolName: 'alert', toolInput: {}, riskScore: 25 },
      { soeViolationDetected: true, fraudRelated: true }
    );
    assert.strictEqual(record.retention.years, 99);
  });
});

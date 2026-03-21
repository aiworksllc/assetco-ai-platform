import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseAuditModel,
  SuitabilityCheckerAuditModel,
  ProposalGeneratorAuditModel,
  ClientReporterAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
} from '../../platform/models/advisor-lens/audit-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('AdvisorLens Audit Models — Factory', () => {
  it('lists all 3 agent audit models', () => {
    assert.deepStrictEqual(listAuditModels(), ['suitability-checker', 'proposal-generator', 'client-reporter']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createAuditModel('suitability-checker') instanceof SuitabilityCheckerAuditModel);
    assert.ok(createAuditModel('proposal-generator') instanceof ProposalGeneratorAuditModel);
    assert.ok(createAuditModel('client-reporter') instanceof ClientReporterAuditModel);
  });

  it('returns BaseAuditModel for unknown agent', () => {
    assert.ok(createAuditModel('unknown') instanceof BaseAuditModel);
  });
});

// ── Record Structure ─────────────────────────────────────────────────────

describe('Audit Record Structure', () => {
  it('returns all required fields', () => {
    const model = createAuditModel('suitability-checker');
    const record = model.classify({
      decision: 'allow', toolName: 'check', toolInput: {}, riskScore: 5,
    }, { suitabilityDetermination: 'suitable' });
    assert.ok(record.recordId.startsWith('aud-'));
    assert.ok(record.timestamp);
    assert.strictEqual(record.agentId, 'suitability-checker');
    assert.ok(record.auditCategory);
    assert.ok(record.severity);
    assert.ok(record.retention);
  });

  it('sanitizes context to allowed keys only', () => {
    const model = createAuditModel('suitability-checker');
    const record = model.classify(
      { decision: 'allow', toolName: 'check', toolInput: {}, riskScore: 5 },
      { suitabilityDetermination: 'suitable', secretKey: 'should-not-appear', clientId: 'C001' }
    );
    assert.strictEqual(record.context.suitabilityDetermination, 'suitable');
    assert.strictEqual(record.context.clientId, 'C001');
    assert.strictEqual(record.context.secretKey, undefined);
  });
});

// ── Retention ────────────────────────────────────────────────────────────

describe('Retention Schedule', () => {
  it('suitability-assessment: 7 years', () => {
    assert.strictEqual(RETENTION['suitability-assessment'].years, 7);
  });

  it('suitability-override: 7 years', () => {
    assert.strictEqual(RETENTION['suitability-override'].years, 7);
  });

  it('proposal-generation: 7 years', () => {
    assert.strictEqual(RETENTION['proposal-generation'].years, 7);
  });

  it('client-report-delivery: 7 years', () => {
    assert.strictEqual(RETENTION['client-report-delivery'].years, 7);
  });

  it('art52-disclosure-enforcement: 10 years', () => {
    assert.strictEqual(RETENTION['art52-disclosure-enforcement'].years, 10);
  });

  it('gdpr-opt-out-processing: 10 years', () => {
    assert.strictEqual(RETENTION['gdpr-opt-out-processing'].years, 10);
  });

  it('gdpr-breach-assessment: 10 years', () => {
    assert.strictEqual(RETENTION['gdpr-breach-assessment'].years, 10);
  });

  it('soe-violation: 10 years', () => {
    assert.strictEqual(RETENTION['soe-violation'].years, 10);
  });

  it('human-oversight-gate: 7 years', () => {
    assert.strictEqual(RETENTION['human-oversight-gate'].years, 7);
  });
});

// ── Suitability Checker Audit ────────────────────────────────────────────

describe('SuitabilityCheckerAuditModel', () => {
  const model = new SuitabilityCheckerAuditModel();

  it('categorizes suitable determination', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'check', toolInput: {}, riskScore: 5 },
      { suitabilityDetermination: 'suitable' }
    );
    assert.strictEqual(record.auditCategory, 'suitability-assessment');
    assert.strictEqual(record.eventType, 'determination-suitable');
  });

  it('categorizes unsuitable determination', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'check', toolInput: {}, riskScore: 25 },
      { suitabilityDetermination: 'unsuitable' }
    );
    assert.strictEqual(record.auditCategory, 'suitability-assessment');
    assert.strictEqual(record.eventType, 'determination-unsuitable');
  });

  it('categorizes suitability override', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'check', toolInput: {}, riskScore: 50 },
      { suitabilityOverride: true }
    );
    assert.strictEqual(record.auditCategory, 'suitability-override');
    assert.strictEqual(record.eventType, 'advisor-override');
  });

  it('categorizes GDPR consent not checked', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'check', toolInput: {}, riskScore: 75 },
      { gdprConsentNotChecked: true }
    );
    assert.strictEqual(record.auditCategory, 'gdpr-opt-out-processing');
    assert.strictEqual(record.eventType, 'consent-not-checked');
  });

  it('categorizes CRM write attempt as SOE violation', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write crm', toolInput: {}, riskScore: 90 },
      { crmWriteAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'soe-violation');
  });

  it('categorizes pre-publication access as SOE violation', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read research/pre-publication', toolInput: {}, riskScore: 80 },
      { prePublicationAccessAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'soe-violation');
  });

  it('maps MiFID II Art.25', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'check', toolInput: {}, riskScore: 5 },
      { suitabilityDetermination: 'suitable' }
    );
    const mifid = record.compliance.find(f => f.framework === 'MiFID II');
    assert.ok(mifid);
    assert.ok(mifid.articles.some(a => a.ref === 'Art.25'));
  });

  it('maps SEC Advisers Act for override', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'check', toolInput: {}, riskScore: 50 },
      { suitabilityOverride: true }
    );
    const sec = record.compliance.find(f => f.framework === 'SEC Advisers Act');
    assert.ok(sec);
    assert.ok(sec.articles.some(a => a.ref === 'Rule-204-2'));
  });

  it('maps GDPR Art.6 for consent not checked', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'check', toolInput: {}, riskScore: 75 },
      { gdprConsentNotChecked: true }
    );
    const gdpr = record.compliance.find(f => f.framework === 'GDPR');
    assert.ok(gdpr);
    assert.ok(gdpr.articles.some(a => a.ref === 'Art.6'));
  });
});

// ── Proposal Generator Audit ─────────────────────────────────────────────

describe('ProposalGeneratorAuditModel', () => {
  const model = new ProposalGeneratorAuditModel();

  it('categorizes standard proposal', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'draft', toolInput: {}, riskScore: 10 },
      { proposalType: 'standard' }
    );
    assert.strictEqual(record.auditCategory, 'proposal-generation');
    assert.strictEqual(record.eventType, 'proposal-standard');
  });

  it('categorizes ERISA proposal', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'draft', toolInput: {}, riskScore: 30 },
      { proposalType: 'erisa-client' }
    );
    assert.strictEqual(record.auditCategory, 'proposal-generation');
    assert.strictEqual(record.eventType, 'proposal-erisa-client');
  });

  it('categorizes Art.52 disclosure missing as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write draft', toolInput: {}, riskScore: 95 },
      { art52DisclosureMissing: true }
    );
    assert.strictEqual(record.auditCategory, 'art52-disclosure-enforcement');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes suitability bypass as SOE violation', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'draft', toolInput: {}, riskScore: 95 },
      { suitabilityCheckBypassed: true }
    );
    assert.strictEqual(record.auditCategory, 'soe-violation');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes delivery path write attempt as SOE violation', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write advisory/proposals/delivered', toolInput: {}, riskScore: 95 },
      { deliveryPathWriteAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'soe-violation');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes GDPR Art.22 opt-out', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'draft', toolInput: {}, riskScore: 20 },
      { gdprArt22OptOut: true, deliberativeReviewTagged: true }
    );
    assert.strictEqual(record.auditCategory, 'gdpr-opt-out-processing');
    assert.strictEqual(record.eventType, 'art22-optout-proposal');
  });

  it('maps EU AI Act Art.52 for missing disclosure', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write', toolInput: {}, riskScore: 95 },
      { art52DisclosureMissing: true }
    );
    const euai = record.compliance.find(f => f.framework === 'EU AI Act');
    assert.ok(euai);
    assert.ok(euai.articles.some(a => a.ref === 'Art.52'));
  });

  it('maps ERISA for ERISA client', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'draft', toolInput: {}, riskScore: 30 },
      { proposalType: 'erisa-client' }
    );
    const erisa = record.compliance.find(f => f.framework === 'ERISA');
    assert.ok(erisa);
    assert.ok(erisa.articles.some(a => a.ref === 'Section-406'));
  });

  it('maps GDPR Art.22 for opt-out', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'draft', toolInput: {}, riskScore: 20 },
      { gdprArt22OptOut: true, deliberativeReviewTagged: true }
    );
    const gdpr = record.compliance.find(f => f.framework === 'GDPR');
    assert.ok(gdpr);
    assert.ok(gdpr.articles.some(a => a.ref === 'Art.22'));
  });

  it('maps EU AI Act Art.14 for delivery attempt', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write', toolInput: {}, riskScore: 95 },
      { deliveryPathWriteAttempt: true }
    );
    const euai = record.compliance.find(f => f.framework === 'EU AI Act');
    assert.ok(euai);
    assert.ok(euai.articles.some(a => a.ref === 'Art.14'));
  });

  it('maps MiFID II Art.24 for cross-selling', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'draft', toolInput: {}, riskScore: 35 },
      { crossSellingDetected: true }
    );
    const mifid = record.compliance.find(f => f.framework === 'MiFID II');
    assert.ok(mifid);
    assert.ok(mifid.articles.some(a => a.ref === 'Art.24'));
  });
});

// ── Client Reporter Audit ────────────────────────────────────────────────

describe('ClientReporterAuditModel', () => {
  const model = new ClientReporterAuditModel();

  it('categorizes quarterly report', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'report', toolInput: {}, riskScore: 10 },
      { reportType: 'quarterly' }
    );
    assert.strictEqual(record.auditCategory, 'client-report-delivery');
    assert.strictEqual(record.eventType, 'report-quarterly');
  });

  it('categorizes SFDR Art.9 report', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'report', toolInput: {}, riskScore: 15 },
      { reportType: 'sfdr-art9' }
    );
    assert.strictEqual(record.auditCategory, 'client-report-delivery');
    assert.strictEqual(record.eventType, 'report-sfdr-art9');
  });

  it('categorizes Art.52 disclosure missing as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write report', toolInput: {}, riskScore: 95 },
      { art52DisclosureMissing: true }
    );
    assert.strictEqual(record.auditCategory, 'art52-disclosure-enforcement');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes cross-client access as GDPR breach assessment', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read portfolios/other', toolInput: {}, riskScore: 95 },
      { crossClientAccessAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'gdpr-breach-assessment');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes CRM write attempt as SOE violation', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write crm', toolInput: {}, riskScore: 90 },
      { crmWriteAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'soe-violation');
  });

  it('maps MiFID II Art.24 for client reporting', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'report', toolInput: {}, riskScore: 10 },
      { reportType: 'quarterly' }
    );
    const mifid = record.compliance.find(f => f.framework === 'MiFID II');
    assert.ok(mifid);
    assert.ok(mifid.articles.some(a => a.ref === 'Art.24'));
  });

  it('maps GDPR Art.5(1)(f) for cross-client access', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read', toolInput: {}, riskScore: 95 },
      { crossClientAccessAttempt: true }
    );
    const gdpr = record.compliance.find(f => f.framework === 'GDPR' && f.articles.some(a => a.ref === 'Art.5(1)(f)'));
    assert.ok(gdpr);
  });

  it('maps GDPR Art.33 for cross-client access (breach notification)', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read', toolInput: {}, riskScore: 95 },
      { crossClientAccessAttempt: true }
    );
    const gdpr = record.compliance.find(f => f.framework === 'GDPR' && f.articles.some(a => a.ref === 'Art.33'));
    assert.ok(gdpr);
  });

  it('maps SFDR Art.9 for sustainability report', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'report', toolInput: {}, riskScore: 15 },
      { reportType: 'sfdr-art9' }
    );
    const sfdr = record.compliance.find(f => f.framework === 'SFDR');
    assert.ok(sfdr);
    assert.ok(sfdr.articles.some(a => a.ref === 'Art.9'));
  });
});

// ── Severity Assessment ──────────────────────────────────────────────────

describe('Severity Assessment', () => {
  it('critical at riskScore >= 86', () => {
    const model = createAuditModel('suitability-checker');
    const record = model.classify({ decision: 'allow', toolName: 'test', toolInput: {}, riskScore: 90 });
    assert.strictEqual(record.severity, 'critical');
  });

  it('high for deny decisions', () => {
    const model = createAuditModel('client-reporter');
    const record = model.classify({ decision: 'deny', toolName: 'test', toolInput: {}, riskScore: 30 });
    assert.strictEqual(record.severity, 'high');
  });

  it('Art.52 missing always critical in proposal-generator', () => {
    const model = createAuditModel('proposal-generator');
    const record = model.classify(
      { decision: 'allow', toolName: 'draft', toolInput: {}, riskScore: 10 },
      { art52DisclosureMissing: true }
    );
    assert.strictEqual(record.severity, 'critical');
  });

  it('cross-client access always critical in client-reporter', () => {
    const model = createAuditModel('client-reporter');
    const record = model.classify(
      { decision: 'allow', toolName: 'read', toolInput: {}, riskScore: 10 },
      { crossClientAccessAttempt: true }
    );
    assert.strictEqual(record.severity, 'critical');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseAuditModel,
  SettlementProcessorAuditModel,
  ReconcilerAuditModel,
  NavCalculatorAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
} from '../../platform/models/ops-fabric/audit-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('OpsFabric Audit Models — Factory', () => {
  it('lists all 3 agent audit models', () => {
    assert.deepStrictEqual(listAuditModels(), ['settlement-processor', 'reconciler', 'nav-calculator']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createAuditModel('settlement-processor') instanceof SettlementProcessorAuditModel);
    assert.ok(createAuditModel('reconciler') instanceof ReconcilerAuditModel);
    assert.ok(createAuditModel('nav-calculator') instanceof NavCalculatorAuditModel);
  });

  it('returns BaseAuditModel for unknown agent', () => {
    assert.ok(createAuditModel('unknown') instanceof BaseAuditModel);
  });
});

// ── Record Structure ─────────────────────────────────────────────────────

describe('Audit Record Structure', () => {
  it('returns all required fields', () => {
    const model = createAuditModel('settlement-processor');
    const record = model.classify({
      decision: 'allow',
      toolName: 'bny-mellon/settlement/submit-instruction',
      toolInput: {},
      riskScore: 10,
    });
    assert.ok(record.recordId.startsWith('aud-'));
    assert.ok(record.timestamp);
    assert.strictEqual(record.agentId, 'settlement-processor');
    assert.ok(record.auditCategory);
    assert.ok(record.severity);
    assert.ok(record.retention);
  });

  it('sanitizes context to allowed keys only', () => {
    const model = createAuditModel('nav-calculator');
    const record = model.classify(
      { decision: 'allow', toolName: 'calculate-nav', toolInput: {}, riskScore: 10 },
      { fundId: 'FUND-001', secretKey: 'should-not-appear', navDate: '2026-03-20' }
    );
    assert.strictEqual(record.context.fundId, 'FUND-001');
    assert.strictEqual(record.context.navDate, '2026-03-20');
    assert.strictEqual(record.context.secretKey, undefined);
  });
});

// ── Retention ────────────────────────────────────────────────────────────

describe('Retention Schedule', () => {
  it('NAV calculation records: 7 years', () => {
    assert.strictEqual(RETENTION['nav-calculation'].years, 7);
  });

  it('NAV pricing exceptions: 7 years', () => {
    assert.strictEqual(RETENTION['nav-pricing-exception'].years, 7);
  });

  it('Settlement instructions: 5 years', () => {
    assert.strictEqual(RETENTION['settlement-instruction'].years, 5);
  });

  it('Settlement fails: 5 years', () => {
    assert.strictEqual(RETENTION['settlement-fail'].years, 5);
  });

  it('Reconciliation breaks: 5 years', () => {
    assert.strictEqual(RETENTION['reconciliation-break'].years, 5);
  });

  it('SOE violations: 7 years', () => {
    assert.strictEqual(RETENTION['soe-violation'].years, 7);
  });
});

// ── Settlement Processor Audit ───────────────────────────────────────────

describe('SettlementProcessorAuditModel', () => {
  const model = new SettlementProcessorAuditModel();

  it('categorizes settlement instruction', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'bny-mellon/settlement/submit-instruction',
      toolInput: {},
      riskScore: 5,
    });
    assert.strictEqual(record.auditCategory, 'settlement-instruction');
  });

  it('categorizes CCP routing', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'lch/clearing/submit-novation',
      toolInput: {},
      riskScore: 5,
    });
    assert.strictEqual(record.auditCategory, 'settlement-ccp-routing');
  });

  it('maps EMIR for CCP routing', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'cme/clearing/submit-novation',
      toolInput: {},
      riskScore: 5,
    });
    const emir = record.compliance.find(f => f.framework === 'EMIR');
    assert.ok(emir);
  });

  it('categorizes CSDR penalty calculation', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'calculate-csdr-penalty --isin US1234567890',
      toolInput: {},
      riskScore: 10,
    });
    assert.strictEqual(record.auditCategory, 'settlement-csdr-penalty');
  });

  it('categorizes custodian account management attempt as critical SOE violation', () => {
    const record = model.classify({
      decision: 'deny',
      toolName: 'bny-mellon/account-management/create',
      toolInput: {},
      riskScore: 80,
    });
    assert.strictEqual(record.auditCategory, 'soe-violation');
    assert.strictEqual(record.eventType, 'custodian-account-mgmt-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('maps CSDR Art.29 for settlement instructions', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'state-street/settlement/submit-instruction',
      toolInput: {},
      riskScore: 5,
    });
    const csdr = record.compliance.find(f => f.framework === 'CSDR');
    assert.ok(csdr);
    assert.ok(csdr.articles.some(a => a.ref === 'Art.29'));
  });
});

// ── Reconciler Audit ─────────────────────────────────────────────────────

describe('ReconcilerAuditModel', () => {
  const model = new ReconcilerAuditModel();

  it('categorizes break classification', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'classify-break --category position-mismatch',
      toolInput: {},
      riskScore: 5,
    });
    assert.strictEqual(record.auditCategory, 'reconciliation-break');
  });

  it('categorizes reconciliation report', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'generate-reconciliation-report --date 2026-03-20',
      toolInput: {},
      riskScore: 5,
    });
    assert.strictEqual(record.auditCategory, 'reconciliation-report');
  });

  it('categorizes source record modification attempt as critical', () => {
    const record = model.classify({
      decision: 'deny',
      toolName: 'amend-position --id POS-123',
      toolInput: {},
      riskScore: 90,
    });
    assert.strictEqual(record.auditCategory, 'soe-violation');
    assert.strictEqual(record.eventType, 'source-record-modification-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('maps SOX 404 control failure for source write attempt', () => {
    const record = model.classify({
      decision: 'deny',
      toolName: 'modify-eagle-pace --record REC-001',
      toolInput: {},
      riskScore: 90,
    });
    const sox = record.compliance.find(f => f.framework === 'SOX');
    assert.ok(sox);
    assert.ok(sox.articles.some(a => a.status === 'control-failure'));
  });

  it('maps SOX 404 for normal reconciliation', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'classify-break --category cash-difference',
      toolInput: {},
      riskScore: 5,
    });
    const sox = record.compliance.find(f => f.framework === 'SOX');
    assert.ok(sox);
    assert.ok(sox.articles.some(a => a.status === 'control-evidence'));
  });
});

// ── NAV Calculator Audit ─────────────────────────────────────────────────

describe('NavCalculatorAuditModel', () => {
  const model = new NavCalculatorAuditModel();

  it('categorizes preliminary NAV generation', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'calculate-nav --fund FUND-001 --date 2026-03-20',
      toolInput: {},
      riskScore: 10,
    });
    assert.strictEqual(record.auditCategory, 'nav-calculation');
  });

  it('categorizes pricing validation', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'validate-pricing --isin US1234567890 --source bloomberg',
      toolInput: {},
      riskScore: 8,
    });
    assert.strictEqual(record.auditCategory, 'nav-pricing-exception');
  });

  it('categorizes NAV publication attempt as critical SOE violation', () => {
    const record = model.classify({
      decision: 'deny',
      toolName: 'publish-nav --fund FUND-001',
      toolInput: { path: 'operations/nav/published/fund1' },
      riskScore: 95,
    });
    assert.strictEqual(record.auditCategory, 'soe-violation');
    assert.strictEqual(record.eventType, 'nav-publication-without-dual-approval');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes pricing override attempt as critical', () => {
    const record = model.classify({
      decision: 'deny',
      toolName: 'override-pricing --isin US1234567890',
      toolInput: {},
      riskScore: 85,
    });
    assert.strictEqual(record.auditCategory, 'soe-violation');
    assert.strictEqual(record.eventType, 'pricing-override-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('maps SEC Rule 31a-2 for NAV calculation', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'calculate-nav --fund FUND-001',
      toolInput: {},
      riskScore: 10,
    });
    const sec = record.compliance.find(f => f.framework === 'SEC');
    assert.ok(sec);
  });

  it('maps SOX 404 control failure for publication attempt', () => {
    const record = model.classify({
      decision: 'deny',
      toolName: 'publish-nav',
      toolInput: { path: 'operations/nav/published/daily' },
      riskScore: 95,
    });
    const sox = record.compliance.find(f => f.framework === 'SOX');
    assert.ok(sox);
    assert.ok(sox.articles.some(a => a.status === 'control-failure'));
  });

  it('maps ASC 820 for high Level 3 concentration', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'classify-fair-value-level --isin XS1234567890',
      toolInput: {},
      riskScore: 15,
    }, { level3Pct: 20 });
    const asc = record.compliance.find(f => f.framework === 'ASC 820');
    assert.ok(asc);
  });
});

// ── Severity ─────────────────────────────────────────────────────────────

describe('Severity Assessment', () => {
  it('critical at riskScore >= 86', () => {
    const model = createAuditModel('settlement-processor');
    const record = model.classify({ decision: 'allow', toolName: 'test', toolInput: {}, riskScore: 90 });
    assert.strictEqual(record.severity, 'critical');
  });

  it('high for deny decisions', () => {
    const model = createAuditModel('reconciler');
    const record = model.classify({ decision: 'deny', toolName: 'test', toolInput: {}, riskScore: 30 });
    assert.strictEqual(record.severity, 'high');
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseAuditModel,
  OrderRouterAuditModel,
  ExecutionMonitorAuditModel,
  TcaAnalyzerAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
} from '../../platform/models/trade-sentinel/audit-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('TradeSentinel Audit Models — Factory', () => {
  it('lists all 3 agent audit models', () => {
    assert.deepStrictEqual(listAuditModels(), ['order-router', 'execution-monitor', 'tca-analyzer']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createAuditModel('order-router') instanceof OrderRouterAuditModel);
    assert.ok(createAuditModel('execution-monitor') instanceof ExecutionMonitorAuditModel);
    assert.ok(createAuditModel('tca-analyzer') instanceof TcaAnalyzerAuditModel);
  });

  it('returns BaseAuditModel for unknown agent', () => {
    assert.ok(createAuditModel('unknown') instanceof BaseAuditModel);
  });
});

// ── Record Structure ────────────────────────────────────────────────────

describe('Audit Record Structure', () => {
  it('returns all required fields', () => {
    const model = createAuditModel('order-router');
    const record = model.classify({
      decision: 'allow', toolName: 'flexTrade submit-order --staged-id ORD-001',
      toolInput: {}, riskScore: 10,
    });
    assert.ok(record.recordId.startsWith('aud-'));
    assert.ok(record.timestamp);
    assert.strictEqual(record.agentId, 'order-router');
    assert.ok(record.auditCategory);
    assert.ok(record.severity);
    assert.ok(record.retention);
  });

  it('sanitizes context to allowed keys only', () => {
    const model = createAuditModel('order-router');
    const record = model.classify(
      { decision: 'allow', toolName: 'flexTrade submit-order', toolInput: {}, riskScore: 5 },
      { orderId: 'ORD-001', secretKey: 'should-not-appear', instrument: 'AAPL' }
    );
    assert.strictEqual(record.context.orderId, 'ORD-001');
    assert.strictEqual(record.context.instrument, 'AAPL');
    assert.strictEqual(record.context.secretKey, undefined);
  });
});

// ── Retention ───────────────────────────────────────────────────────────

describe('Retention Schedule', () => {
  it('order execution: 7 years', () => {
    assert.strictEqual(RETENTION['order-execution'].years, 7);
  });

  it('best execution compliance: 7 years', () => {
    assert.strictEqual(RETENTION['best-execution-compliance'].years, 7);
  });

  it('market abuse alert: 7 years', () => {
    assert.strictEqual(RETENTION['market-abuse-alert'].years, 7);
  });

  it('chinese wall violation: 7 years', () => {
    assert.strictEqual(RETENTION['chinese-wall-violation'].years, 7);
  });

  it('human oversight gate: 10 years', () => {
    assert.strictEqual(RETENTION['human-oversight-gate'].years, 10);
  });

  it('separation of duties: 7 years', () => {
    assert.strictEqual(RETENTION['separation-of-duties'].years, 7);
  });

  it('TCA report: 7 years', () => {
    assert.strictEqual(RETENTION['tca-report'].years, 7);
  });
});

// ── Order Router Audit ──────────────────────────────────────────────────

describe('OrderRouterAuditModel', () => {
  const model = new OrderRouterAuditModel();

  it('categorizes order staging', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'flexTrade submit-order --staged-id ORD-001',
      toolInput: {}, riskScore: 5,
    });
    assert.strictEqual(record.auditCategory, 'order-execution');
    assert.strictEqual(record.eventType, 'order-staged');
  });

  it('categorizes NBBO validation', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'nbbo-validator validate --instrument AAPL',
      toolInput: {}, riskScore: 5,
    });
    assert.strictEqual(record.auditCategory, 'best-execution-compliance');
    assert.strictEqual(record.eventType, 'nbbo-validation');
  });

  it('categorizes mandate check failure', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'mandate-check --instrument RESTRICTED-001', toolInput: {}, riskScore: 50 },
      { mandateCheckFail: true }
    );
    assert.strictEqual(record.auditCategory, 'best-execution-compliance');
    assert.strictEqual(record.eventType, 'mandate-check-fail');
    assert.strictEqual(record.severity, 'high');
  });

  it('categorizes Chinese wall violation as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read research-nexus/pre-publication/alpha', toolInput: {}, riskScore: 95 },
      { chineseWallViolation: true }
    );
    assert.strictEqual(record.auditCategory, 'chinese-wall-violation');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes SOE bypass as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'flexTrade submit-order --bypass-soe ORD-001', toolInput: {}, riskScore: 95 },
      { soeBypassAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'separation-of-duties');
    assert.strictEqual(record.eventType, 'soe-bypass-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes human approval bypass', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'flexTrade submit-order', toolInput: {}, riskScore: 90 },
      { humanApprovalBypass: true }
    );
    assert.strictEqual(record.auditCategory, 'human-oversight-gate');
    assert.strictEqual(record.eventType, 'approval-gate-bypass');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes human approval granted', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'flexTrade submit-order', toolInput: {}, riskScore: 10 },
      { humanApprovalGranted: true }
    );
    assert.strictEqual(record.auditCategory, 'human-oversight-gate');
    assert.strictEqual(record.eventType, 'human-approval-granted');
  });

  it('maps Reg NMS Rule 611 for NBBO validation', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'nbbo-validator validate', toolInput: {}, riskScore: 50 },
      { nbboViolationAttempt: true }
    );
    const regNms = record.compliance.find(f => f.framework === 'Reg NMS');
    assert.ok(regNms);
    assert.ok(regNms.articles.some(a => a.ref === 'Rule-611' && a.status === 'violation-blocked'));
  });

  it('maps MiFID II Art.27 for order execution', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'flexTrade submit-order', toolInput: {}, riskScore: 5,
    });
    const mifid = record.compliance.find(f => f.framework === 'MiFID II');
    assert.ok(mifid);
    assert.ok(mifid.articles.some(a => a.ref === 'Art.27'));
  });

  it('maps MAR Art.10 for Chinese wall block', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read research-nexus/pre-publication', toolInput: {}, riskScore: 95 },
      { chineseWallViolation: true }
    );
    const mar = record.compliance.find(f => f.framework === 'MAR');
    assert.ok(mar);
    assert.ok(mar.articles.some(a => a.ref === 'Art.10'));
  });
});

// ── Execution Monitor Audit ─────────────────────────────────────────────

describe('ExecutionMonitorAuditModel', () => {
  const model = new ExecutionMonitorAuditModel();

  it('categorizes MAR pattern detection', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'anomaly-detector run --pattern SPOOFING', toolInput: {}, riskScore: 25 },
      { marPatternDetected: true, marPatternType: 'SPOOFING' }
    );
    assert.strictEqual(record.auditCategory, 'market-abuse-alert');
    assert.strictEqual(record.eventType, 'mar-pattern-detected');
    assert.strictEqual(record.severity, 'high');
  });

  it('categorizes STR draft creation', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'compliance-shield create-str-draft --pattern WASH_TRADING', toolInput: {}, riskScore: 20 },
      { strDraftCreated: true }
    );
    assert.strictEqual(record.auditCategory, 'market-abuse-alert');
    assert.strictEqual(record.eventType, 'str-draft-created');
    assert.strictEqual(record.severity, 'high');
  });

  it('categorizes order modification attempt as critical SoD violation', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'flexTrade modify-active ORD-001', toolInput: {}, riskScore: 95 },
      { orderModifyAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'separation-of-duties');
    assert.strictEqual(record.eventType, 'order-modify-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes Chinese wall violation as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read research-nexus/draft/alpha', toolInput: {}, riskScore: 95 },
      { chineseWallViolation: true }
    );
    assert.strictEqual(record.auditCategory, 'chinese-wall-violation');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes execution quality alert', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'alert-service post --channel trading-desk --severity HIGH',
      toolInput: {}, riskScore: 10,
    });
    assert.strictEqual(record.auditCategory, 'order-execution');
    assert.strictEqual(record.eventType, 'execution-quality-alert');
  });

  it('maps MAR Art.12 for pattern detection', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'anomaly-detector run', toolInput: {}, riskScore: 20 },
      { marPatternDetected: true }
    );
    const mar = record.compliance.find(f => f.framework === 'MAR');
    assert.ok(mar);
    assert.ok(mar.articles.some(a => a.ref === 'Art.12'));
  });

  it('maps MAR Art.16 for STR draft', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'compliance-shield create-str-draft', toolInput: {}, riskScore: 20 },
      { strDraftCreated: true }
    );
    const mar = record.compliance.filter(f => f.framework === 'MAR');
    const art16 = mar.flatMap(f => f.articles).find(a => a.ref === 'Art.16');
    assert.ok(art16);
  });

  it('maps MiFID II Art.17 for SoD violation', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'flexTrade modify-active', toolInput: {}, riskScore: 95 },
      { orderModifyAttempt: true }
    );
    const mifid = record.compliance.find(f => f.framework === 'MiFID II');
    assert.ok(mifid);
    assert.ok(mifid.articles.some(a => a.ref === 'Art.17'));
  });
});

// ── TCA Analyzer Audit ──────────────────────────────────────────────────

describe('TcaAnalyzerAuditModel', () => {
  const model = new TcaAnalyzerAuditModel();

  it('categorizes TCA batch computation', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'tca-engine compute-batch --date-range 2026-Q1',
      toolInput: {}, riskScore: 10,
    });
    assert.strictEqual(record.auditCategory, 'tca-report');
    assert.strictEqual(record.eventType, 'tca-batch-computed');
  });

  it('categorizes RTS 28 report generation', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'rts28-reporter generate --quarter Q1', toolInput: {}, riskScore: 5 },
      { rts28Report: true }
    );
    assert.strictEqual(record.auditCategory, 'tca-report');
    assert.strictEqual(record.eventType, 'rts28-report-generated');
  });

  it('categorizes live data access attempt as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read market-data/live/quotes', toolInput: {}, riskScore: 95 },
      { liveDataAccessAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'separation-of-duties');
    assert.strictEqual(record.eventType, 'live-data-access-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes order write attempt as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write trading/orders/staged/ORD-001', toolInput: {}, riskScore: 95 },
      { orderWriteAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'separation-of-duties');
    assert.strictEqual(record.eventType, 'order-write-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes Chinese wall violation as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read research-nexus/published/reports', toolInput: {}, riskScore: 95 },
      { chineseWallViolation: true }
    );
    assert.strictEqual(record.auditCategory, 'chinese-wall-violation');
    assert.strictEqual(record.severity, 'critical');
  });

  it('maps MiFID II RTS28 for report generation', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'rts28-reporter generate', toolInput: {}, riskScore: 5 },
      { rts28Report: true }
    );
    const mifid = record.compliance.find(f => f.framework === 'MiFID II' && f.articles.some(a => a.ref === 'RTS28'));
    assert.ok(mifid);
  });

  it('maps SR 11-7 for TCA analysis', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'tca-engine compute-batch', toolInput: {}, riskScore: 10,
    });
    const sr = record.compliance.find(f => f.framework === 'SR 11-7');
    assert.ok(sr);
  });

  it('maps MiFID II Art.17 for SoD violation', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write trading/orders', toolInput: {}, riskScore: 95 },
      { orderWriteAttempt: true }
    );
    const mifid = record.compliance.find(f => f.framework === 'MiFID II');
    assert.ok(mifid);
    assert.ok(mifid.articles.some(a => a.ref === 'Art.17'));
  });
});

// ── Severity Assessment ─────────────────────────────────────────────────

describe('Severity Assessment', () => {
  it('critical at riskScore >= 86', () => {
    const model = createAuditModel('order-router');
    const record = model.classify({ decision: 'allow', toolName: 'test', toolInput: {}, riskScore: 90 });
    assert.strictEqual(record.severity, 'critical');
  });

  it('high for deny decisions', () => {
    const model = createAuditModel('tca-analyzer');
    const record = model.classify({ decision: 'deny', toolName: 'test', toolInput: {}, riskScore: 30 });
    assert.strictEqual(record.severity, 'high');
  });
});

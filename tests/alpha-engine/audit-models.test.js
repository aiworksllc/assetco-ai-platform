import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseAuditModel,
  PortfolioOptimizerAuditModel,
  RebalancerAuditModel,
  AllocationAdvisorAuditModel,
  FactorAnalystAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
} from '../../platform/models/alpha-engine/audit-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('AlphaEngine Audit Models — Factory', () => {
  it('lists all 4 agent audit models', () => {
    assert.deepStrictEqual(listAuditModels(), ['portfolio-optimizer', 'rebalancer', 'allocation-advisor', 'factor-analyst']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createAuditModel('portfolio-optimizer') instanceof PortfolioOptimizerAuditModel);
    assert.ok(createAuditModel('rebalancer') instanceof RebalancerAuditModel);
    assert.ok(createAuditModel('allocation-advisor') instanceof AllocationAdvisorAuditModel);
    assert.ok(createAuditModel('factor-analyst') instanceof FactorAnalystAuditModel);
  });

  it('returns BaseAuditModel for unknown agent', () => {
    assert.ok(createAuditModel('unknown') instanceof BaseAuditModel);
  });
});

// ── Record Structure ────────────────────────────────────────────────────

describe('Audit Record Structure', () => {
  it('returns all required fields', () => {
    const model = createAuditModel('portfolio-optimizer');
    const record = model.classify({
      decision: 'allow',
      toolName: 'optimization.run --mandate MAND-001',
      toolInput: {},
      riskScore: 10,
    });
    assert.ok(record.recordId.startsWith('aud-'));
    assert.ok(record.timestamp);
    assert.strictEqual(record.agentId, 'portfolio-optimizer');
    assert.ok(record.auditCategory);
    assert.ok(record.severity);
    assert.ok(record.retention);
  });

  it('sanitizes context to allowed keys only', () => {
    const model = createAuditModel('portfolio-optimizer');
    const record = model.classify(
      { decision: 'allow', toolName: 'optimization.run', toolInput: {}, riskScore: 10 },
      { mandateId: 'MAND-001', secretKey: 'should-not-appear', erisaMandate: true }
    );
    assert.strictEqual(record.context.mandateId, 'MAND-001');
    assert.strictEqual(record.context.erisaMandate, true);
    assert.strictEqual(record.context.secretKey, undefined);
  });
});

// ── Retention ───────────────────────────────────────────────────────────

describe('Retention Schedule', () => {
  it('portfolio optimization: 7 years', () => {
    assert.strictEqual(RETENTION['portfolio-optimization'].years, 7);
  });

  it('rebalance trigger: 7 years', () => {
    assert.strictEqual(RETENTION['rebalance-trigger'].years, 7);
  });

  it('allocation proposal: 7 years', () => {
    assert.strictEqual(RETENTION['allocation-proposal'].years, 7);
  });

  it('factor analysis: 5 years', () => {
    assert.strictEqual(RETENTION['factor-analysis'].years, 5);
  });

  it('fiduciary constraint enforced: 7 years', () => {
    assert.strictEqual(RETENTION['fiduciary-constraint-enforced'].years, 7);
  });

  it('IPS violation attempt: 7 years', () => {
    assert.strictEqual(RETENTION['ips-violation-attempt'].years, 7);
  });

  it('Chinese wall block: 7 years', () => {
    assert.strictEqual(RETENTION['chinese-wall-block'].years, 7);
  });

  it('SFDR compliance: 10 years', () => {
    assert.strictEqual(RETENTION['sfdr-compliance'].years, 10);
  });
});

// ── Portfolio Optimizer Audit ───────────────────────────────────────────

describe('PortfolioOptimizerAuditModel', () => {
  const model = new PortfolioOptimizerAuditModel();

  it('categorizes normal optimization', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'optimization.run --mandate MAND-001',
      toolInput: {}, riskScore: 10,
    });
    assert.strictEqual(record.auditCategory, 'portfolio-optimization');
    assert.strictEqual(record.eventType, 'optimization-run');
  });

  it('categorizes Chinese wall violation as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read pre-publication/signals', toolInput: {}, riskScore: 90 },
      { chineseWallViolation: true }
    );
    assert.strictEqual(record.auditCategory, 'chinese-wall-block');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes IPS concentration breach', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'optimization.run', toolInput: {}, riskScore: 90 },
      { ipsConcentrationProximityPct: 100 }
    );
    assert.strictEqual(record.auditCategory, 'ips-violation-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes ESG floor enforcement', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'optimization.run', toolInput: {}, riskScore: 90 },
      { esgScoreMarginAboveMin: 0 }
    );
    assert.strictEqual(record.auditCategory, 'fiduciary-constraint-enforced');
    assert.strictEqual(record.eventType, 'esg-floor-enforced');
    assert.strictEqual(record.severity, 'critical');
  });

  it('maps SEC Reg FD for Chinese wall block', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'read pre-publication', toolInput: {}, riskScore: 90 },
      { chineseWallViolation: true }
    );
    const sec = record.compliance.find(f => f.framework === 'SEC');
    assert.ok(sec);
    assert.ok(sec.articles.some(a => a.ref === 'Reg-FD'));
  });

  it('maps SEC Rule 204-2 for optimization', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'optimization.run', toolInput: {}, riskScore: 10 },
    );
    const sec = record.compliance.find(f => f.framework === 'SEC');
    assert.ok(sec);
    assert.ok(sec.articles.some(a => a.ref === 'Rule-204-2'));
  });

  it('maps ERISA for ERISA mandate', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'optimization.run', toolInput: {}, riskScore: 10 },
      { erisaMandate: true }
    );
    const erisa = record.compliance.find(f => f.framework === 'ERISA');
    assert.ok(erisa);
  });

  it('maps SFDR for SFDR article', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'optimization.run', toolInput: {}, riskScore: 10 },
      { sfdrArticle: 8 }
    );
    const sfdr = record.compliance.find(f => f.framework === 'SFDR');
    assert.ok(sfdr);
  });
});

// ── Rebalancer Audit ────────────────────────────────────────────────────

describe('RebalancerAuditModel', () => {
  const model = new RebalancerAuditModel();

  it('categorizes trade list generation', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'generate-trade-list --mandate MAND-001',
      toolInput: {}, riskScore: 10,
    });
    assert.strictEqual(record.auditCategory, 'rebalance-trigger');
    assert.strictEqual(record.eventType, 'trade-list-generated');
  });

  it('categorizes drift check', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'compute-drift --mandate MAND-001',
      toolInput: {}, riskScore: 5,
    });
    assert.strictEqual(record.auditCategory, 'rebalance-trigger');
    assert.strictEqual(record.eventType, 'drift-check');
  });

  it('categorizes order submission attempt as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'order.submit --venue NYSE', toolInput: {}, riskScore: 90 },
      { orderSubmitAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'fiduciary-constraint-enforced');
    assert.strictEqual(record.eventType, 'authority-breach-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('maps ERISA for ERISA mandate', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'generate-trade-list', toolInput: {}, riskScore: 10 },
      { erisaTaxLotSelection: true }
    );
    const erisa = record.compliance.find(f => f.framework === 'ERISA');
    assert.ok(erisa);
  });

  it('maps MiFID II Art.27 for high tx cost', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'generate-trade-list', toolInput: {}, riskScore: 10 },
      { estimatedTxCostBps: 40 }
    );
    const mifid = record.compliance.find(f => f.framework === 'MiFID II');
    assert.ok(mifid);
    assert.ok(mifid.articles.some(a => a.ref === 'Art.27'));
  });
});

// ── Allocation Advisor Audit ────────────────────────────────────────────

describe('AllocationAdvisorAuditModel', () => {
  const model = new AllocationAdvisorAuditModel();

  it('categorizes proposal generation', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'generate-proposal --mandate MAND-001',
      toolInput: {}, riskScore: 10,
    });
    assert.strictEqual(record.auditCategory, 'allocation-proposal');
    assert.strictEqual(record.eventType, 'proposal-generated');
  });

  it('categorizes proposal approval', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'proposal-approved', toolInput: {}, riskScore: 5 },
      { approvalTimestamp: '2026-03-20T12:00:00Z' }
    );
    assert.strictEqual(record.auditCategory, 'allocation-proposal');
    assert.strictEqual(record.eventType, 'proposal-approved');
  });

  it('categorizes ERISA rationale', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'erisa-rationale --mandate MAND-001',
      toolInput: {}, riskScore: 10,
    });
    assert.strictEqual(record.auditCategory, 'allocation-proposal');
    assert.strictEqual(record.eventType, 'erisa-rationale-generated');
  });

  it('categorizes approval bypass as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'activate-allocation', toolInput: {}, riskScore: 95 },
      { approvalBypassAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'fiduciary-constraint-enforced');
    assert.strictEqual(record.eventType, 'approval-gate-bypass-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('categorizes self-promotion as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'promote-to-active', toolInput: {}, riskScore: 95 },
      { selfPromotionAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'ips-violation-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('maps EU AI Act Art.14 for proposals', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'generate-proposal', toolInput: {}, riskScore: 10 },
    );
    const euAi = record.compliance.filter(f => f.framework === 'EU AI Act');
    const art14 = euAi.flatMap(f => f.articles).find(a => a.ref === 'Art.14');
    assert.ok(art14);
    assert.strictEqual(art14.status, 'pending-human-approval');
  });

  it('maps human-approval-logged for approved proposals', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'proposal-approved', toolInput: {}, riskScore: 5 },
      { approvalTimestamp: '2026-03-20T12:00:00Z' }
    );
    const euAi = record.compliance.filter(f => f.framework === 'EU AI Act');
    const art14 = euAi.flatMap(f => f.articles).find(a => a.ref === 'Art.14' && a.status === 'human-approval-logged');
    assert.ok(art14);
  });

  it('maps ERISA with rationale status', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'generate-proposal', toolInput: {}, riskScore: 10 },
      { erisaMandate: true, erisaRationaleIncluded: true }
    );
    const erisa = record.compliance.find(f => f.framework === 'ERISA');
    assert.ok(erisa);
    assert.ok(erisa.articles.some(a => a.status === 'rationale-attached'));
  });
});

// ── Factor Analyst Audit ────────────────────────────────────────────────

describe('FactorAnalystAuditModel', () => {
  const model = new FactorAnalystAuditModel();

  it('categorizes factor exposure computation', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'compute-exposures --portfolio FUND-001',
      toolInput: {}, riskScore: 5,
    });
    assert.strictEqual(record.auditCategory, 'factor-analysis');
    assert.strictEqual(record.eventType, 'factor-exposure-computation');
  });

  it('categorizes factor report', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'factor-report --portfolio FUND-001',
      toolInput: {}, riskScore: 5,
    });
    assert.strictEqual(record.auditCategory, 'factor-analysis');
    assert.strictEqual(record.eventType, 'factor-report');
  });

  it('categorizes return attribution', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'attribution --portfolio FUND-001',
      toolInput: {}, riskScore: 5,
    });
    assert.strictEqual(record.auditCategory, 'factor-analysis');
    assert.strictEqual(record.eventType, 'return-attribution');
  });

  it('categorizes production write attempt as critical', () => {
    const record = model.classify(
      { decision: 'deny', toolName: 'write --path portfolios/live/fund1', toolInput: {}, riskScore: 90 },
      { productionWriteAttempt: true }
    );
    assert.strictEqual(record.auditCategory, 'fiduciary-constraint-enforced');
    assert.strictEqual(record.eventType, 'production-write-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('maps SR 11-7 for factor analysis', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'compute-exposures', toolInput: {}, riskScore: 5,
    });
    const sr = record.compliance.find(f => f.framework === 'SR 11-7');
    assert.ok(sr);
    assert.ok(sr.articles.some(a => a.ref === 'ongoing-monitoring'));
  });

  it('flags unapproved model version', () => {
    const record = model.classify(
      { decision: 'allow', toolName: 'compute-exposures', toolInput: {}, riskScore: 5 },
      { factorModelVersion: '2.1.0', approvedFactorModelVersion: '2.0.0' }
    );
    const sr = record.compliance.filter(f => f.framework === 'SR 11-7');
    const validation = sr.flatMap(f => f.articles).find(a => a.ref === 'model-validation');
    assert.ok(validation);
    assert.strictEqual(validation.status, 'unapproved-model-flagged');
  });
});

// ── Severity Assessment ─────────────────────────────────────────────────

describe('Severity Assessment', () => {
  it('critical at riskScore >= 86', () => {
    const model = createAuditModel('portfolio-optimizer');
    const record = model.classify({ decision: 'allow', toolName: 'test', toolInput: {}, riskScore: 90 });
    assert.strictEqual(record.severity, 'critical');
  });

  it('high for deny decisions', () => {
    const model = createAuditModel('rebalancer');
    const record = model.classify({ decision: 'deny', toolName: 'test', toolInput: {}, riskScore: 30 });
    assert.strictEqual(record.severity, 'high');
  });

  it('medium for escalate decisions', () => {
    const model = createAuditModel('factor-analyst');
    const record = model.classify({ decision: 'escalate', toolName: 'test', toolInput: {}, riskScore: 30 });
    assert.strictEqual(record.severity, 'medium');
  });
});

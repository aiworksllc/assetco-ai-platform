import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseAuditModel,
  VarCalculatorAuditModel,
  StressTesterAuditModel,
  ExposureMonitorAuditModel,
  LimitEnforcerAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
} from '../../platform/models/risk-compass/audit-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('RiskCompass Audit Models — Factory', () => {
  it('lists all 4 agent audit models', () => {
    assert.deepStrictEqual(listAuditModels(), ['var-calculator', 'stress-tester', 'exposure-monitor', 'limit-enforcer']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createAuditModel('var-calculator') instanceof VarCalculatorAuditModel);
    assert.ok(createAuditModel('stress-tester') instanceof StressTesterAuditModel);
    assert.ok(createAuditModel('exposure-monitor') instanceof ExposureMonitorAuditModel);
    assert.ok(createAuditModel('limit-enforcer') instanceof LimitEnforcerAuditModel);
  });

  it('returns BaseAuditModel for unknown agent', () => {
    assert.ok(createAuditModel('unknown') instanceof BaseAuditModel);
  });
});

// ── Record Structure ─────────────────────────────────────────────────────

describe('Audit Record Structure', () => {
  it('returns all required fields from classify()', () => {
    const model = createAuditModel('var-calculator');
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.publish_var_report',
      toolInput: {},
      riskScore: 15,
      reason: 'Within SOE',
    });

    assert.ok(record.recordId.startsWith('aud-'));
    assert.ok(record.timestamp);
    assert.strictEqual(record.agentId, 'var-calculator');
    assert.ok(record.model.includes('var-calculator'));
    assert.ok(record.event);
    assert.ok(record.auditCategory);
    assert.ok(record.severity);
    assert.ok(record.compliance);
    assert.ok(record.retention);
  });

  it('sanitizes long content in toolInput', () => {
    const model = createAuditModel('var-calculator');
    const record = model.classify({
      decision: 'allow',
      toolName: 'read',
      toolInput: { content: 'x'.repeat(1000) },
      riskScore: 10,
    });
    assert.ok(record.event.toolInput.content.includes('truncated'));
  });

  it('only includes allowed context keys', () => {
    const model = createAuditModel('var-calculator');
    const record = model.classify(
      { decision: 'allow', toolName: 'read', toolInput: {}, riskScore: 10 },
      { calculationId: 'CALC-001', secretKey: 'should-not-appear', modelId: 'MDL-VAR-001' }
    );
    assert.strictEqual(record.context.calculationId, 'CALC-001');
    assert.strictEqual(record.context.modelId, 'MDL-VAR-001');
    assert.strictEqual(record.context.secretKey, undefined);
  });
});

// ── Retention Schedule ───────────────────────────────────────────────────

describe('Retention Schedule', () => {
  it('risk-calculation retains for 7 years', () => {
    assert.strictEqual(RETENTION['risk-calculation'].years, 7);
  });

  it('stress-scenario-execution retains for 7 years', () => {
    assert.strictEqual(RETENTION['stress-scenario-execution'].years, 7);
  });

  it('limit-breach-detection retains for 7 years', () => {
    assert.strictEqual(RETENTION['limit-breach-detection'].years, 7);
  });

  it('exposure-alert retains for 5 years', () => {
    assert.strictEqual(RETENTION['exposure-alert'].years, 5);
  });

  it('cross-fund-aggregation retains for 5 years', () => {
    assert.strictEqual(RETENTION['cross-fund-aggregation'].years, 5);
  });
});

// ── VaR Calculator Audit ─────────────────────────────────────────────────

describe('VarCalculatorAuditModel', () => {
  const model = new VarCalculatorAuditModel();

  it('categorizes VaR report as risk-calculation', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.publish_var_report',
      toolInput: {},
      riskScore: 15,
    }, { methodology: 'parametric' });
    assert.strictEqual(record.auditCategory, 'risk-calculation');
    assert.strictEqual(record.event.toolInput !== undefined, true);
  });

  it('maps Monte Carlo methodology to correct eventType', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.publish_var_report',
      toolInput: {},
      riskScore: 15,
    }, { methodology: 'monte-carlo' });
    assert.strictEqual(record.eventType, 'monte-carlo-var');
  });

  it('categorizes backtesting exception', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'chronicle.log_backtesting_exception',
      toolInput: {},
      riskScore: 20,
    });
    assert.strictEqual(record.auditCategory, 'risk-calculation');
    assert.strictEqual(record.eventType, 'backtesting-exception');
  });

  it('includes Basel III compliance mapping for risk calculations', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.publish_var_report',
      toolInput: {},
      riskScore: 15,
    });
    const baselFramework = record.compliance.find(f => f.framework === 'Basel III');
    assert.ok(baselFramework);
  });

  it('includes SR 11-7 for backtesting exceptions', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'chronicle.log_backtesting_exception',
      toolInput: {},
      riskScore: 20,
    });
    const srFramework = record.compliance.find(f => f.framework === 'SR 11-7');
    assert.ok(srFramework);
  });
});

// ── Stress Tester Audit ──────────────────────────────────────────────────

describe('StressTesterAuditModel', () => {
  const model = new StressTesterAuditModel();

  it('categorizes stress scenario run', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.run_stress_scenario',
      toolInput: {},
      riskScore: 10,
    });
    assert.strictEqual(record.auditCategory, 'stress-scenario-execution');
  });

  it('identifies AIFMD quarterly trigger', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.run_stress_scenario',
      toolInput: {},
      riskScore: 10,
    }, { trigger: 'aifmd-quarterly' });
    assert.strictEqual(record.eventType, 'aifmd-liquidity-stress');
  });

  it('maps AIFMD Art.16 for quarterly trigger', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.run_stress_scenario',
      toolInput: {},
      riskScore: 10,
    }, { trigger: 'aifmd-quarterly' });
    const aifmd = record.compliance.find(f => f.framework === 'AIFMD');
    assert.ok(aifmd);
    assert.ok(aifmd.articles.some(a => a.ref === 'Art.16(1)'));
  });

  it('includes Basel III stressed VaR evidence', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.run_stress_scenario',
      toolInput: {},
      riskScore: 10,
    });
    const basel = record.compliance.find(f => f.framework === 'Basel III');
    assert.ok(basel);
  });

  it('includes Dodd-Frank Title II', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.run_stress_scenario',
      toolInput: {},
      riskScore: 10,
    });
    const df = record.compliance.find(f => f.framework === 'Dodd-Frank');
    assert.ok(df);
  });
});

// ── Exposure Monitor Audit ───────────────────────────────────────────────

describe('ExposureMonitorAuditModel', () => {
  const model = new ExposureMonitorAuditModel();

  it('categorizes cross-fund aggregation', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.aggregate_exposure',
      toolInput: {},
      riskScore: 15,
    }, { crossFund: true });
    assert.strictEqual(record.auditCategory, 'cross-fund-aggregation');
  });

  it('categorizes concentration alert as exposure-alert', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.publish_concentration_alert',
      toolInput: {},
      riskScore: 20,
    });
    assert.strictEqual(record.auditCategory, 'exposure-alert');
    assert.strictEqual(record.eventType, 'concentration-warning');
  });

  it('categorizes downstream feed', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'limit_enforcer.feed_exposure_metrics',
      toolInput: {},
      riskScore: 10,
    });
    assert.strictEqual(record.auditCategory, 'cross-fund-aggregation');
    assert.strictEqual(record.eventType, 'downstream-feed');
  });

  it('maps AIFMD + Basel III for cross-fund aggregation', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.aggregate_exposure',
      toolInput: {},
      riskScore: 15,
    }, { crossFund: true });
    const aifmd = record.compliance.find(f => f.framework === 'AIFMD');
    const basel = record.compliance.find(f => f.framework === 'Basel III');
    assert.ok(aifmd);
    assert.ok(basel);
  });

  it('maps Dodd-Frank Title I for full firm aggregation', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.aggregate_exposure',
      toolInput: {},
      riskScore: 15,
    }, { crossFund: true, businessLinesAggregated: 5 });
    const df = record.compliance.find(f => f.framework === 'Dodd-Frank');
    assert.ok(df);
  });
});

// ── Limit Enforcer Audit ─────────────────────────────────────────────────

describe('LimitEnforcerAuditModel', () => {
  const model = new LimitEnforcerAuditModel();

  it('categorizes breach event', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.generate_breach_event',
      toolInput: {},
      riskScore: 25,
    });
    assert.strictEqual(record.auditCategory, 'limit-breach-detection');
    assert.strictEqual(record.eventType, 'limit-breach');
    assert.strictEqual(record.severity, 'high');
  });

  it('categorizes near-breach warning', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.generate_near_breach_alert',
      toolInput: {},
      riskScore: 15,
    });
    assert.strictEqual(record.auditCategory, 'limit-breach-detection');
    assert.strictEqual(record.eventType, 'near-breach-warning');
    assert.strictEqual(record.severity, 'medium');
  });

  it('categorizes escalation notification', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'escalation.notify_cro',
      toolInput: {},
      riskScore: 30,
    });
    assert.strictEqual(record.auditCategory, 'limit-breach-detection');
    assert.strictEqual(record.eventType, 'escalation-notification');
  });

  it('categorizes unauthorized modification attempt as critical', () => {
    const record = model.classify({
      decision: 'deny',
      toolName: 'riskcompass.modify_limit',
      toolInput: {},
      riskScore: 80,
    });
    assert.strictEqual(record.eventType, 'unauthorized-modification-attempt');
    assert.strictEqual(record.severity, 'critical');
  });

  it('maps AIFMD for leverage limits', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.generate_breach_event',
      toolInput: {},
      riskScore: 25,
    }, { limitType: 'leverage-aifmd-gross' });
    const aifmd = record.compliance.find(f => f.framework === 'AIFMD');
    assert.ok(aifmd);
  });

  it('maps Dodd-Frank for counterparty limits', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.generate_breach_event',
      toolInput: {},
      riskScore: 25,
    }, { limitType: 'counterparty-limit' });
    const df = record.compliance.find(f => f.framework === 'Dodd-Frank');
    assert.ok(df);
  });

  it('includes EU AI Act Art.14 for breach events', () => {
    const record = model.classify({
      decision: 'allow',
      toolName: 'riskcompass.generate_breach_event',
      toolInput: {},
      riskScore: 25,
    });
    const eu = record.compliance.filter(f => f.framework === 'EU AI Act');
    const art14 = eu.flatMap(f => f.articles).find(a => a.ref === 'Art.14');
    assert.ok(art14);
  });
});

// ── Severity Assessment ──────────────────────────────────────────────────

describe('Severity Assessment', () => {
  const model = createAuditModel('var-calculator');

  it('critical at riskScore >= 86', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'test', toolInput: {}, riskScore: 90,
    });
    assert.strictEqual(record.severity, 'critical');
  });

  it('high at riskScore 61-85', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'test', toolInput: {}, riskScore: 70,
    });
    assert.strictEqual(record.severity, 'high');
  });

  it('high for deny decisions', () => {
    const record = model.classify({
      decision: 'deny', toolName: 'test', toolInput: {}, riskScore: 30,
    });
    assert.strictEqual(record.severity, 'high');
  });

  it('medium for escalate decisions', () => {
    const record = model.classify({
      decision: 'escalate', toolName: 'test', toolInput: {}, riskScore: 30,
    });
    assert.strictEqual(record.severity, 'medium');
  });

  it('low for normal allow decisions', () => {
    const record = model.classify({
      decision: 'allow', toolName: 'test', toolInput: {}, riskScore: 15,
    });
    assert.strictEqual(record.severity, 'low');
  });
});

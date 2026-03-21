import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseRiskModel,
  OrderRouterRiskModel,
  ExecutionMonitorRiskModel,
  TcaAnalyzerRiskModel,
  createRiskModel,
  listModels,
} from '../../platform/models/trade-sentinel/risk-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('TradeSentinel Risk Models — Factory', () => {
  it('lists all 3 agent models', () => {
    assert.deepStrictEqual(listModels(), ['order-router', 'execution-monitor', 'tca-analyzer']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createRiskModel('order-router') instanceof OrderRouterRiskModel);
    assert.ok(createRiskModel('execution-monitor') instanceof ExecutionMonitorRiskModel);
    assert.ok(createRiskModel('tca-analyzer') instanceof TcaAnalyzerRiskModel);
  });

  it('returns BaseRiskModel for unknown agent', () => {
    assert.ok(createRiskModel('unknown') instanceof BaseRiskModel);
  });
});

// ── Score Structure ──────────────────────────────────────────────────────

describe('Score Structure', () => {
  it('returns all required fields', () => {
    const model = createRiskModel('order-router');
    const result = model.score('flexTrade submit-order', {}, { orderNotional: 50000 });
    assert.ok('riskScore' in result);
    assert.ok('riskTier' in result);
    assert.ok('factors' in result);
    assert.ok('regulatoryFlags' in result);
    assert.ok('explanation' in result);
    assert.ok('model' in result);
    assert.strictEqual(result.modelVersion, '1.0.0');
  });

  it('riskScore clamped 0-100', () => {
    const model = createRiskModel('order-router');
    const result = model.score('flexTrade submit-order', {}, {});
    assert.ok(result.riskScore >= 0 && result.riskScore <= 100);
  });
});

// ── Order Router ────────────────────────────────────────────────────────

describe('OrderRouterRiskModel', () => {
  const model = new OrderRouterRiskModel();

  it('has correct risk budget (1000/day)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 1000);
    assert.strictEqual(model.riskBudget.escalateAt, 800);
    assert.strictEqual(model.riskBudget.freezeOnBreach, true);
  });

  it('scores green for standard order', () => {
    const result = model.score('flexTrade submit-order', {}, { orderNotional: 50000 });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores order size for block-level order ($1M-$10M)', () => {
    const result = model.score('flexTrade submit-order', {}, { orderNotional: 5000000 });
    const factor = result.factors.find(f => f.name === 'order-size');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 10);
  });

  it('scores order size for institutional order (>$10M)', () => {
    const result = model.score('flexTrade submit-order', {}, { orderNotional: 15000000 });
    const factor = result.factors.find(f => f.name === 'order-size');
    assert.strictEqual(factor.impact, 25);
  });

  it('scores ADV concentration', () => {
    const result = model.score('flexTrade submit-order', {}, { orderPctOfAdv: 8 });
    const factor = result.factors.find(f => f.name === 'adv-concentration');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 15);
  });

  it('scores venue concentration', () => {
    const result = model.score('flexTrade submit-order', {}, { singleVenueConcentrationPct: 90 });
    const factor = result.factors.find(f => f.name === 'venue-concentration');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 20);
  });

  it('scores NBBO violation attempt', () => {
    const result = model.score('nbbo-validator validate', {}, { nbboViolationAttempt: true });
    const factor = result.factors.find(f => f.name === 'nbbo-violation');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 50);
  });

  it('scores mandate check failure', () => {
    const result = model.score('mandate-check', {}, { mandateCheckFail: true });
    const factor = result.factors.find(f => f.name === 'mandate-check-fail');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 50);
  });

  it('scores critical for human approval bypass', () => {
    const result = model.score('flexTrade submit-order', {}, { humanApprovalBypass: true });
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'approval-bypass');
    assert.strictEqual(factor.impact, 90);
  });

  it('scores critical for Chinese wall violation', () => {
    const result = model.score('read research-nexus/pre-publication', {}, { chineseWallViolation: true });
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'chinese-wall-violation');
    assert.strictEqual(factor.impact, 95);
  });

  it('scores critical for SOE bypass attempt', () => {
    const result = model.score('flexTrade submit-order --bypass-soe', {}, { soeBypassAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores restricted security attempt', () => {
    const result = model.score('flexTrade submit-order', {}, { restrictedSecurityAttempt: true });
    const factor = result.factors.find(f => f.name === 'restricted-security');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 50);
  });

  it('always flags MiFID II Art.27', () => {
    const result = model.score('flexTrade submit-order', {}, {});
    const flag = result.regulatoryFlags.find(f => f.flag === 'MiFID-II-Art.27');
    assert.ok(flag);
  });

  it('flags Reg NMS Rule 611 for NBBO violation', () => {
    const result = model.score('nbbo-validator', {}, { nbboViolationAttempt: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'Reg-NMS-Rule-611');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });

  it('flags EU AI Act Art.14 for approval bypass', () => {
    const result = model.score('flexTrade submit-order', {}, { humanApprovalBypass: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'EU-AI-Act-Art.14');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });

  it('flags MAR Art.10 for Chinese wall violation', () => {
    const result = model.score('read', {}, { chineseWallViolation: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'MAR-Art.10');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });
});

// ── Execution Monitor ───────────────────────────────────────────────────

describe('ExecutionMonitorRiskModel', () => {
  const model = new ExecutionMonitorRiskModel();

  it('has correct risk budget (500/day, no freeze)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 500);
    assert.strictEqual(model.riskBudget.freezeOnBreach, false);
  });

  it('scores green for normal monitoring', () => {
    const result = model.score('benchmark-calculator vwap', {}, {});
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores slippage >10bp', () => {
    const result = model.score('monitor', {}, { slippageVsVwapBps: 15 });
    const factor = result.factors.find(f => f.name === 'slippage');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 5);
  });

  it('scores severe slippage >25bp', () => {
    const result = model.score('monitor', {}, { slippageVsVwapBps: 30 });
    const factor = result.factors.find(f => f.name === 'severe-slippage');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 20);
  });

  it('scores daily IS cost >15bp', () => {
    const result = model.score('monitor', {}, { cumulativeDailyIsCostBps: 20 });
    const factor = result.factors.find(f => f.name === 'daily-is-cost');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 30);
  });

  it('scores low fill rate', () => {
    const result = model.score('monitor', {}, { venueFillRatePct: 30 });
    const factor = result.factors.find(f => f.name === 'low-fill-rate');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 10);
  });

  it('scores slow fill', () => {
    const result = model.score('monitor', {}, { fillTimeVsHistorical: 4 });
    const factor = result.factors.find(f => f.name === 'slow-fill');
    assert.strictEqual(factor.impact, 8);
  });

  it('scores partial fill with TIF expired', () => {
    const result = model.score('monitor', {}, { partialFillPct: 30, tifExpired: true });
    const factor = result.factors.find(f => f.name === 'partial-fill-expired');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 12);
  });

  it('scores MAR pattern detection', () => {
    const result = model.score('anomaly-detector run', {}, { marPatternDetected: true, marPatternType: 'SPOOFING', marPatternSeverity: 'high' });
    const factor = result.factors.find(f => f.name === 'mar-pattern');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 25);
  });

  it('scores STR draft creation', () => {
    const result = model.score('compliance-shield create-str-draft', {}, { strDraftCreated: true });
    const factor = result.factors.find(f => f.name === 'str-draft');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 20);
  });

  it('scores critical for Chinese wall violation', () => {
    const result = model.score('read', {}, { chineseWallViolation: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores critical for order modification attempt', () => {
    const result = model.score('flexTrade modify-active', {}, { orderModifyAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'sod-violation');
    assert.strictEqual(factor.impact, 95);
  });

  it('flags MAR Art.12 for pattern detection', () => {
    const result = model.score('anomaly-detector', {}, { marPatternDetected: true, marPatternType: 'WASH_TRADING' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'MAR-Art.12');
    assert.ok(flag);
  });

  it('flags MAR Art.16 for STR draft', () => {
    const result = model.score('create-str-draft', {}, { strDraftCreated: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'MAR-Art.16');
    assert.ok(flag);
  });

  it('flags MiFID II Art.27 for systematic IS cost', () => {
    const result = model.score('monitor', {}, { cumulativeDailyIsCostBps: 20 });
    const flag = result.regulatoryFlags.find(f => f.flag === 'MiFID-II-Art.27');
    assert.ok(flag);
  });
});

// ── TCA Analyzer ────────────────────────────────────────────────────────

describe('TcaAnalyzerRiskModel', () => {
  const model = new TcaAnalyzerRiskModel();

  it('has correct risk budget (100/day, freeze on breach)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 100);
    assert.strictEqual(model.riskBudget.escalateAt, 70);
    assert.strictEqual(model.riskBudget.freezeOnBreach, true);
  });

  it('scores green for small batch analysis', () => {
    const result = model.score('tca-engine compute', {}, { ordersAnalysed: 50 });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores batch scope for large analysis', () => {
    const result = model.score('tca-engine compute-batch', {}, { ordersAnalysed: 15000 });
    const factor = result.factors.find(f => f.name === 'batch-scope');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 10);
  });

  it('scores RTS 28 report generation', () => {
    const result = model.score('rts28-reporter generate', {}, { rts28Report: true });
    const factor = result.factors.find(f => f.name === 'rts28-report');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 5);
  });

  it('scores critical for Chinese wall violation', () => {
    const result = model.score('read research-nexus', {}, { chineseWallViolation: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores critical for live data access attempt', () => {
    const result = model.score('read market-data/live', {}, { liveDataAccessAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'live-data-access');
    assert.strictEqual(factor.impact, 95);
  });

  it('scores critical for order write attempt', () => {
    const result = model.score('write trading/orders', {}, { orderWriteAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('scores critical for SOE bypass attempt', () => {
    const result = model.score('test --bypass-soe', {}, { soeBypassAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('flags MiFID II RTS28 for report generation', () => {
    const result = model.score('rts28-reporter', {}, { rts28Report: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'MiFID-II-RTS28');
    assert.ok(flag);
  });

  it('always flags SR 11-7', () => {
    const result = model.score('tca-engine', {}, {});
    const flag = result.regulatoryFlags.find(f => f.flag === 'SR-11-7');
    assert.ok(flag);
  });

  it('flags MAR Art.10 for Chinese wall violation', () => {
    const result = model.score('read', {}, { chineseWallViolation: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'MAR-Art.10');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });
});

// ── Cumulative Scenarios ────────────────────────────────────────────────

describe('Cumulative Scenarios', () => {
  it('normal trading day stays Green', () => {
    const model = createRiskModel('order-router');
    const result = model.score('flexTrade submit-order', {}, {
      orderNotional: 200000,
    });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('large order with venue concentration goes Yellow+', () => {
    const model = createRiskModel('order-router');
    const result = model.score('flexTrade submit-order', {}, {
      orderNotional: 5000000,
      singleVenueConcentrationPct: 85,
      orderPctOfAdv: 6,
    });
    assert.ok(result.riskScore > 30, `Expected Yellow+ but got ${result.riskScore}`);
  });

  it('execution quality crisis goes Red+', () => {
    const model = createRiskModel('execution-monitor');
    const result = model.score('monitor', {}, {
      slippageVsVwapBps: 30,
      cumulativeDailyIsCostBps: 20,
      venueFillRatePct: 25,
    });
    assert.ok(result.riskScore > 60, `Expected Red+ but got ${result.riskScore}`);
  });

  it('Chinese wall violation freezes any agent', () => {
    for (const agentId of ['order-router', 'execution-monitor', 'tca-analyzer']) {
      const model = createRiskModel(agentId);
      const result = model.score('read research-nexus/pre-publication', {}, { chineseWallViolation: true });
      assert.strictEqual(result.riskTier, 'critical', `${agentId} should go critical on Chinese wall violation`);
    }
  });
});

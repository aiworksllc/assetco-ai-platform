import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseRiskModel,
  SettlementProcessorRiskModel,
  ReconcilerRiskModel,
  NavCalculatorRiskModel,
  createRiskModel,
  listModels,
} from '../../platform/models/ops-fabric/risk-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('OpsFabric Risk Models — Factory', () => {
  it('lists all 3 agent models', () => {
    assert.deepStrictEqual(listModels(), ['settlement-processor', 'reconciler', 'nav-calculator']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createRiskModel('settlement-processor') instanceof SettlementProcessorRiskModel);
    assert.ok(createRiskModel('reconciler') instanceof ReconcilerRiskModel);
    assert.ok(createRiskModel('nav-calculator') instanceof NavCalculatorRiskModel);
  });

  it('returns BaseRiskModel for unknown agent', () => {
    assert.ok(createRiskModel('unknown') instanceof BaseRiskModel);
  });
});

// ── Score Structure ──────────────────────────────────────────────────────

describe('Score Structure', () => {
  it('returns all required fields', () => {
    const model = createRiskModel('settlement-processor');
    const result = model.score('bny-mellon/settlement/submit-instruction', {}, {});
    assert.ok('riskScore' in result);
    assert.ok('riskTier' in result);
    assert.ok('factors' in result);
    assert.ok('regulatoryFlags' in result);
    assert.ok('explanation' in result);
    assert.ok('model' in result);
    assert.strictEqual(result.modelVersion, '1.0.0');
  });

  it('riskScore clamped 0-100', () => {
    const model = createRiskModel('nav-calculator');
    const result = model.score('publish-nav', { destination: 'operations/nav/published/fund1' }, {});
    assert.ok(result.riskScore >= 0 && result.riskScore <= 100);
  });
});

// ── Settlement Processor ─────────────────────────────────────────────────

describe('SettlementProcessorRiskModel', () => {
  const model = new SettlementProcessorRiskModel();

  it('has correct risk budget (800/day)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 800);
    assert.strictEqual(model.riskBudget.hourlyLimit, 100);
  });

  it('scores low for normal operation well before cutoff', () => {
    const result = model.score('bny-mellon/settlement/submit-instruction', {}, {
      minutesToT1Cutoff: 300,
    });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores high for deadline proximity <= 30min', () => {
    const result = model.score('bny-mellon/settlement/submit-instruction', {}, {
      minutesToT1Cutoff: 20,
    });
    const factor = result.factors.find(f => f.name === 'deadline-proximity');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 20);
  });

  it('scores critical when past T+1 cutoff', () => {
    const result = model.score('bny-mellon/settlement/submit-instruction', {}, {
      minutesToT1Cutoff: 0,
    });
    const factor = result.factors.find(f => f.name === 'deadline-proximity');
    assert.strictEqual(factor.impact, 25);
  });

  it('scores fail rate above COO escalation threshold', () => {
    const result = model.score('dtcc/settlement/submit', {}, { openFailRatePct: 4.0 });
    const factor = result.factors.find(f => f.name === 'fail-rate');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 20);
  });

  it('scores CSDR buy-in at T+4 (equity threshold)', () => {
    const result = model.score('dtcc/settlement/query', {}, { businessDaysSinceFail: 4 });
    const factor = result.factors.find(f => f.name === 'csdr-buyin');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 20);
  });

  it('scores CSDR buy-in at T+7 (bond threshold)', () => {
    const result = model.score('dtcc/settlement/query', {}, { businessDaysSinceFail: 7 });
    const factor = result.factors.find(f => f.name === 'csdr-buyin');
    assert.strictEqual(factor.impact, 25);
  });

  it('flags CSDR Art.7 for buy-in', () => {
    const result = model.score('dtcc/settlement/query', {}, { businessDaysSinceFail: 5 });
    const flag = result.regulatoryFlags.find(f => f.flag === 'CSDR-Art.7-buyin');
    assert.ok(flag);
  });

  it('scores CCP routing errors with EMIR flag', () => {
    const result = model.score('lch/clearing/submit-novation', {}, { ccpRoutingErrors: 2 });
    const factor = result.factors.find(f => f.name === 'ccp-routing-error');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 30);
    const flag = result.regulatoryFlags.find(f => f.flag === 'EMIR-Art.20');
    assert.ok(flag);
  });

  it('scores critical for custodian account management attempt', () => {
    const result = model.score('bny-mellon/custody/amend-position', {}, { accountManagementAttempt: true });
    const factor = result.factors.find(f => f.name === 'account-mgmt-attempt');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 90);
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('flags CSDR penalty threshold', () => {
    const result = model.score('calculate-csdr-penalty', {}, { dailyCsdrPenaltyUSD: 15000 });
    const flag = result.regulatoryFlags.find(f => f.flag === 'CSDR-Art.7-penalty');
    assert.ok(flag);
  });
});

// ── Reconciler ───────────────────────────────────────────────────────────

describe('ReconcilerRiskModel', () => {
  const model = new ReconcilerRiskModel();

  it('has correct risk budget (500/day)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 500);
  });

  it('scores low for normal break classification', () => {
    const result = model.score('classify-break', {}, {
      maxBreakAgeDays: 1,
      maxBreakValueUSD: 5000,
    });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores high for aged break > 5 days', () => {
    const result = model.score('classify-break', {}, { maxBreakAgeDays: 8 });
    const factor = result.factors.find(f => f.name === 'break-age');
    assert.strictEqual(factor.impact, 20);
  });

  it('scores high for break > $500K', () => {
    const result = model.score('route-to-queue', {}, { maxBreakValueUSD: 750000 });
    const factor = result.factors.find(f => f.name === 'break-value');
    assert.strictEqual(factor.impact, 20);
  });

  it('scores break volume spike', () => {
    const result = model.score('identify-breaks', {}, { breakCountVs4WeekAvg: 1.8 });
    const factor = result.factors.find(f => f.name === 'break-volume-trend');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 12);
  });

  it('scores unclassified breaks above threshold', () => {
    const result = model.score('classify-break', {}, { unclassifiedBreakPct: 8 });
    const factor = result.factors.find(f => f.name === 'unclassified-breaks');
    assert.ok(factor);
  });

  it('scores custodian concentration', () => {
    const result = model.score('compare-positions', {}, { custodianConcentrationPct: 75 });
    const factor = result.factors.find(f => f.name === 'custodian-concentration');
    assert.ok(factor);
  });

  it('scores critical for source record write attempt', () => {
    const result = model.score('amend-position', {}, { sourceRecordWriteAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
    const flag = result.regulatoryFlags.find(f => f.flag === 'SOX-404-control-failure');
    assert.ok(flag);
  });

  it('flags SOX 404 for material break', () => {
    const result = model.score('route-to-queue', {}, { maxBreakValueUSD: 600000 });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SOX-404-material-misstatement');
    assert.ok(flag);
  });
});

// ── NAV Calculator ───────────────────────────────────────────────────────

describe('NavCalculatorRiskModel', () => {
  const model = new NavCalculatorRiskModel();

  it('has correct risk budget (300/day)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 300);
  });

  it('scores low for normal preliminary NAV generation', () => {
    const result = model.score('calculate-nav', {}, {});
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores CRITICAL for publish-nav attempt', () => {
    const result = model.score('publish-nav', { destination: 'operations/nav/published/fund1' }, {});
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'nav-publication-attempt');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 95);
  });

  it('scores CRITICAL for write to nav/published path', () => {
    const result = model.score('write', { path: 'operations/nav/published/daily' }, {});
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('flags SOX 404 for NAV publication attempt', () => {
    const result = model.score('publish-nav', { destination: 'operations/nav/published/fund1' }, {});
    const flag = result.regulatoryFlags.find(f => f.flag === 'SOX-404-dual-approval');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });

  it('scores stale prices above threshold', () => {
    const result = model.score('validate-pricing', {}, { stalePriceByNavWeightPct: 3.5 });
    const factor = result.factors.find(f => f.name === 'stale-prices');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 15);
  });

  it('scores Level 3 concentration above AIFMD threshold', () => {
    const result = model.score('classify-fair-value-level', {}, { level3PctOfNav: 18 });
    const factor = result.factors.find(f => f.name === 'level3-concentration');
    assert.strictEqual(factor.impact, 15);
    const flag = result.regulatoryFlags.find(f => f.flag === 'ASC-820-Level3');
    assert.ok(flag);
  });

  it('scores NAV delivery past target', () => {
    const result = model.score('generate-preliminary-nav-package', {}, { minutesToNavTarget: 0 });
    const factor = result.factors.find(f => f.name === 'nav-delivery');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 20);
  });

  it('scores dual-approval pending > 60min', () => {
    const result = model.score('submit-to-review-queue', {}, { dualApprovalPendingMinutes: 75 });
    const factor = result.factors.find(f => f.name === 'approval-pending');
    assert.strictEqual(factor.impact, 15);
  });

  it('scores pricing feed down', () => {
    const result = model.score('fetch-pricing', {}, { pricingFeedDown: 'bloomberg' });
    const factor = result.factors.find(f => f.name === 'feed-unavailable');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 20);
  });

  it('scores critical for pricing override attempt', () => {
    const result = model.score('override-pricing', {}, { pricingOverrideAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('flags SEC Rule 31a-2 for stale prices', () => {
    const result = model.score('validate-pricing', {}, { stalePriceByNavWeightPct: 3 });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SEC-Rule-31a-2');
    assert.ok(flag);
  });
});

// ── Cumulative Scenarios ─────────────────────────────────────────────────

describe('Cumulative Scenarios', () => {
  it('normal settlement day stays Green', () => {
    const model = createRiskModel('settlement-processor');
    const result = model.score('bny-mellon/settlement/submit-instruction', {}, {
      minutesToT1Cutoff: 240,
      openFailRatePct: 0.5,
    });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('settlement crisis goes Red/Critical', () => {
    const model = createRiskModel('settlement-processor');
    const result = model.score('dtcc/settlement/submit', {}, {
      minutesToT1Cutoff: 15,
      openFailRatePct: 4.0,
      businessDaysSinceFail: 5,
      ccpRoutingErrors: 2,
    });
    assert.ok(result.riskScore > 60, `Expected Red+ but got ${result.riskScore}`);
  });

  it('reconciler with aged material break goes Yellow+', () => {
    const model = createRiskModel('reconciler');
    const result = model.score('classify-break', {}, {
      maxBreakAgeDays: 7,
      maxBreakValueUSD: 600000,
      breakCountVs4WeekAvg: 1.6,
    });
    assert.ok(result.riskScore > 30, `Expected Yellow+ but got ${result.riskScore}`);
  });
});

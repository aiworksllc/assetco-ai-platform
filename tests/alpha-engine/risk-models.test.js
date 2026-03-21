import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseRiskModel,
  PortfolioOptimizerRiskModel,
  RebalancerRiskModel,
  AllocationAdvisorRiskModel,
  FactorAnalystRiskModel,
  createRiskModel,
  listModels,
  scoreAllocationMagnitude,
  scoreConcentrationChange,
  scoreEsgProximity,
  scoreMandateDeviation,
  scoreFactorTilt,
  scoreCrossMandateCorrelation,
} from '../../platform/models/alpha-engine/risk-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('AlphaEngine Risk Models — Factory', () => {
  it('lists all 4 agent models', () => {
    assert.deepStrictEqual(listModels(), ['portfolio-optimizer', 'rebalancer', 'allocation-advisor', 'factor-analyst']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createRiskModel('portfolio-optimizer') instanceof PortfolioOptimizerRiskModel);
    assert.ok(createRiskModel('rebalancer') instanceof RebalancerRiskModel);
    assert.ok(createRiskModel('allocation-advisor') instanceof AllocationAdvisorRiskModel);
    assert.ok(createRiskModel('factor-analyst') instanceof FactorAnalystRiskModel);
  });

  it('returns BaseRiskModel for unknown agent', () => {
    assert.ok(createRiskModel('unknown') instanceof BaseRiskModel);
  });
});

// ── Score Structure ──────────────────────────────────────────────────────

describe('Score Structure', () => {
  it('returns all required fields', () => {
    const model = createRiskModel('portfolio-optimizer');
    const result = model.score('optimization.run', {}, {});
    assert.ok('riskScore' in result);
    assert.ok('riskTier' in result);
    assert.ok('factors' in result);
    assert.ok('regulatoryFlags' in result);
    assert.ok('explanation' in result);
    assert.ok('model' in result);
    assert.strictEqual(result.modelVersion, '1.0.0');
  });

  it('riskScore clamped 0-100', () => {
    const model = createRiskModel('portfolio-optimizer');
    const result = model.score('optimization.run', {}, { aggregateWeightChangePct: 1 });
    assert.ok(result.riskScore >= 0 && result.riskScore <= 100);
  });
});

// ── Shared Factor: Allocation Magnitude ─────────────────────────────────

describe('Factor: Allocation Magnitude', () => {
  it('scores low for incremental adjustment (<2%)', () => {
    const f = scoreAllocationMagnitude({ aggregateWeightChangePct: 1 });
    assert.strictEqual(f.impact, 2);
  });

  it('scores moderate for 2-10% change', () => {
    const f = scoreAllocationMagnitude({ aggregateWeightChangePct: 7 });
    assert.strictEqual(f.impact, 5);
  });

  it('scores high for 10-25% change', () => {
    const f = scoreAllocationMagnitude({ aggregateWeightChangePct: 18 });
    assert.strictEqual(f.impact, 12);
  });

  it('scores maximum for >25% (major restructuring)', () => {
    const f = scoreAllocationMagnitude({ aggregateWeightChangePct: 35 });
    assert.strictEqual(f.impact, 25);
  });
});

// ── Shared Factor: Concentration Change ─────────────────────────────────

describe('Factor: Concentration Change', () => {
  it('scores 0 for <50% of IPS limit', () => {
    const f = scoreConcentrationChange({ ipsConcentrationProximityPct: 30 });
    assert.strictEqual(f.impact, 0);
  });

  it('scores low for 50-75%', () => {
    const f = scoreConcentrationChange({ ipsConcentrationProximityPct: 60 });
    assert.strictEqual(f.impact, 2);
  });

  it('scores moderate for 75-90%', () => {
    const f = scoreConcentrationChange({ ipsConcentrationProximityPct: 80 });
    assert.strictEqual(f.impact, 6);
  });

  it('scores high for 90-99% (near-breach)', () => {
    const f = scoreConcentrationChange({ ipsConcentrationProximityPct: 95 });
    assert.strictEqual(f.impact, 15);
  });

  it('HARD DENY at 100% (IPS limit breach)', () => {
    const f = scoreConcentrationChange({ ipsConcentrationProximityPct: 100 });
    assert.strictEqual(f.impact, 90);
  });
});

// ── Shared Factor: ESG Proximity ────────────────────────────────────────

describe('Factor: ESG Constraint Proximity', () => {
  it('scores 0 when no ESG constraint', () => {
    const f = scoreEsgProximity({});
    assert.strictEqual(f.impact, 0);
  });

  it('scores 0 for >20pts margin', () => {
    const f = scoreEsgProximity({ esgScoreMarginAboveMin: 25 });
    assert.strictEqual(f.impact, 0);
  });

  it('scores moderate for 5-10pts margin', () => {
    const f = scoreEsgProximity({ esgScoreMarginAboveMin: 7 });
    assert.strictEqual(f.impact, 3);
  });

  it('scores high for 1-5pts (near-breach)', () => {
    const f = scoreEsgProximity({ esgScoreMarginAboveMin: 3 });
    assert.strictEqual(f.impact, 8);
  });

  it('HARD DENY at 0 or below (floor breach)', () => {
    const f = scoreEsgProximity({ esgScoreMarginAboveMin: 0 });
    assert.strictEqual(f.impact, 90);
  });
});

// ── Shared Factor: Mandate Deviation ────────────────────────────────────

describe('Factor: Mandate Deviation', () => {
  it('scores 0 for <50% of tracking error budget', () => {
    const f = scoreMandateDeviation({ trackingErrorBudgetUsedPct: 30 });
    assert.strictEqual(f.impact, 0);
  });

  it('scores moderate for 75-90%', () => {
    const f = scoreMandateDeviation({ trackingErrorBudgetUsedPct: 80 });
    assert.strictEqual(f.impact, 6);
  });

  it('scores high for 90-100%', () => {
    const f = scoreMandateDeviation({ trackingErrorBudgetUsedPct: 95 });
    assert.strictEqual(f.impact, 12);
  });

  it('HARD DENY for >100%', () => {
    const f = scoreMandateDeviation({ trackingErrorBudgetUsedPct: 110 });
    assert.strictEqual(f.impact, 90);
  });
});

// ── Shared Factor: Factor Tilt ──────────────────────────────────────────

describe('Factor: Factor Tilt', () => {
  it('scores 0 for within 0.1 SD', () => {
    const f = scoreFactorTilt({ maxFactorTiltSD: 0.05 });
    assert.strictEqual(f.impact, 0);
  });

  it('scores moderate for 0.2-0.4 SD', () => {
    const f = scoreFactorTilt({ maxFactorTiltSD: 0.3 });
    assert.strictEqual(f.impact, 5);
  });

  it('scores high for >0.4 SD', () => {
    const f = scoreFactorTilt({ maxFactorTiltSD: 0.6 });
    assert.strictEqual(f.impact, 10);
  });
});

// ── Shared Factor: Cross-Mandate Correlation ────────────────────────────

describe('Factor: Cross-Mandate Correlation', () => {
  it('scores 0 for no correlation', () => {
    const f = scoreCrossMandateCorrelation({});
    assert.strictEqual(f.impact, 0);
  });

  it('scores moderate for 25-50% mandates correlated', () => {
    const f = scoreCrossMandateCorrelation({ correlatedMandatesPct: 35 });
    assert.strictEqual(f.impact, 4);
  });

  it('scores high for >50% mandates correlated', () => {
    const f = scoreCrossMandateCorrelation({ correlatedMandatesPct: 60 });
    assert.strictEqual(f.impact, 10);
  });

  it('scores systemic for >$5B correlated AUM', () => {
    const f = scoreCrossMandateCorrelation({ correlatedAumBillions: 8 });
    assert.strictEqual(f.impact, 18);
  });
});

// ── Portfolio Optimizer ─────────────────────────────────────────────────

describe('PortfolioOptimizerRiskModel', () => {
  const model = new PortfolioOptimizerRiskModel();

  it('has correct risk budget (500/day)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 500);
  });

  it('scores green for normal optimization', () => {
    const result = model.score('optimization.run', {}, {
      aggregateWeightChangePct: 1,
    });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores critical for Chinese wall violation', () => {
    const result = model.score('read pre-publication', {}, { chineseWallViolation: true });
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'chinese-wall-violation');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 90);
  });

  it('scores critical for order submission attempt', () => {
    const result = model.score('order.submit', {}, { orderSubmitAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('flags SFDR for near-breach ESG', () => {
    const result = model.score('optimization.run', {}, { esgScoreMarginAboveMin: 3 });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SFDR-Art.8/9');
    assert.ok(flag);
  });

  it('flags ERISA for ERISA mandate', () => {
    const result = model.score('optimization.run', {}, { erisaMandate: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'ERISA-fiduciary');
    assert.ok(flag);
  });

  it('flags SEC Reg FD for Chinese wall violation', () => {
    const result = model.score('read', {}, { chineseWallViolation: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SEC-Reg-FD');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });

  it('adds full reconstruction factor', () => {
    const result = model.score('optimization.run', {}, { fullReconstruction: true });
    const factor = result.factors.find(f => f.name === 'full-reconstruction');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 20);
  });

  it('flags SR 11-7 for full reconstruction', () => {
    const result = model.score('optimization.run', {}, { fullReconstruction: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SR-11-7');
    assert.ok(flag);
  });
});

// ── Rebalancer ──────────────────────────────────────────────────────────

describe('RebalancerRiskModel', () => {
  const model = new RebalancerRiskModel();

  it('has correct risk budget (300/day)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 300);
  });

  it('scores green for normal drift check', () => {
    const result = model.score('compute-drift', {}, {
      aggregateWeightChangePct: 1,
      maxDriftPct: 2,
    });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores drift magnitude for high drift', () => {
    const result = model.score('compute-drift', {}, { maxDriftPct: 15 });
    const factor = result.factors.find(f => f.name === 'drift-magnitude');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 12);
  });

  it('scores transaction cost for high cost', () => {
    const result = model.score('generate-trade-list', {}, { estimatedTxCostBps: 60 });
    const factor = result.factors.find(f => f.name === 'transaction-cost');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 10);
  });

  it('scores critical for order submission attempt', () => {
    const result = model.score('order.submit', {}, { orderSubmitAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'authority-breach');
    assert.ok(factor);
  });

  it('flags ERISA for tax lot selection', () => {
    const result = model.score('generate-trade-list', {}, { erisaTaxLotSelection: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'ERISA-fiduciary');
    assert.ok(flag);
  });

  it('flags MiFID II Art.27 for high tx cost', () => {
    const result = model.score('generate-trade-list', {}, { estimatedTxCostBps: 60 });
    const flag = result.regulatoryFlags.find(f => f.flag === 'MiFID-II-Art.27');
    assert.ok(flag);
  });

  it('adds ERISA tax lot factor', () => {
    const result = model.score('generate-trade-list', {}, { erisaTaxLotSelection: true });
    const factor = result.factors.find(f => f.name === 'erisa-tax-lot');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 3);
  });
});

// ── Allocation Advisor ──────────────────────────────────────────────────

describe('AllocationAdvisorRiskModel', () => {
  const model = new AllocationAdvisorRiskModel();

  it('has correct risk budget (200/day)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 200);
  });

  it('scores green for normal proposal', () => {
    const result = model.score('generate-proposal', {}, {
      aggregateWeightChangePct: 1,
    });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores critical for approval bypass attempt', () => {
    const result = model.score('activate-proposal', {}, { approvalBypassAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'approval-bypass');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 95);
  });

  it('scores critical for self-promotion attempt', () => {
    const result = model.score('promote', {}, { selfPromotionAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'self-promotion');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 95);
  });

  it('scores critical for write outside proposals', () => {
    const result = model.score('write', {}, { writeOutsideProposals: true });
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'write-isolation-breach');
    assert.strictEqual(factor.impact, 90);
  });

  it('adds macro regime shift factor', () => {
    const result = model.score('generate-proposal', {}, { macroRegimeShift: true });
    const factor = result.factors.find(f => f.name === 'macro-regime-shift');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 8);
  });

  it('adds ERISA rationale missing factor', () => {
    const result = model.score('generate-proposal', {}, { erisaMandate: true, erisaRationaleIncluded: false });
    const factor = result.factors.find(f => f.name === 'erisa-rationale-missing');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 12);
  });

  it('always flags EU AI Act Art.14 human oversight', () => {
    const result = model.score('generate-proposal', {}, {});
    const flag = result.regulatoryFlags.find(f => f.flag === 'EU-AI-Act-Art.14');
    assert.ok(flag);
  });

  it('flags ERISA for ERISA mandates', () => {
    const result = model.score('generate-proposal', {}, { erisaMandate: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'ERISA-fiduciary');
    assert.ok(flag);
  });

  it('flags approval bypass as critical EU AI Act violation', () => {
    const result = model.score('activate', {}, { approvalBypassAttempt: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'EU-AI-Act-Art.14-violation');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });
});

// ── Factor Analyst ──────────────────────────────────────────────────────

describe('FactorAnalystRiskModel', () => {
  const model = new FactorAnalystRiskModel();

  it('has correct risk budget (400/day)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 400);
  });

  it('scores green for single portfolio analysis', () => {
    const result = model.score('compute-exposures', {}, { portfoliosAnalyzed: 1 });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('scores critical for production write attempt', () => {
    const result = model.score('write', {}, { productionWriteAttempt: true });
    assert.strictEqual(result.riskTier, 'critical');
    const factor = result.factors.find(f => f.name === 'production-write');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 90);
  });

  it('scores analysis scope for broad sweep', () => {
    const result = model.score('compute-exposures', {}, { portfoliosAnalyzed: 25 });
    const factor = result.factors.find(f => f.name === 'analysis-scope');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 8);
  });

  it('scores unintended tilts', () => {
    const result = model.score('compute-exposures', {}, { unintendedTiltsDetected: 4 });
    const factor = result.factors.find(f => f.name === 'unintended-tilts');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 8);
  });

  it('scores model version mismatch', () => {
    const result = model.score('compute-exposures', {}, {
      factorModelVersion: '2.1.0',
      approvedFactorModelVersion: '2.0.0',
    });
    const factor = result.factors.find(f => f.name === 'model-version-mismatch');
    assert.ok(factor);
    assert.strictEqual(factor.impact, 10);
  });

  it('always flags SR 11-7', () => {
    const result = model.score('compute-exposures', {}, {});
    const flag = result.regulatoryFlags.find(f => f.flag === 'SR-11-7');
    assert.ok(flag);
  });

  it('flags SR 11-7 version for model mismatch', () => {
    const result = model.score('compute-exposures', {}, {
      factorModelVersion: '2.1.0',
      approvedFactorModelVersion: '2.0.0',
    });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SR-11-7-version');
    assert.ok(flag);
  });

  it('flags production write as critical SEC violation', () => {
    const result = model.score('write', {}, { productionWriteAttempt: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'SEC-Advisers-Act-fiduciary');
    assert.ok(flag);
    assert.strictEqual(flag.severity, 'critical');
  });
});

// ── Cumulative Scenarios ────────────────────────────────────────────────

describe('Cumulative Scenarios', () => {
  it('normal optimization stays Green', () => {
    const model = createRiskModel('portfolio-optimizer');
    const result = model.score('optimization.run', {}, {
      aggregateWeightChangePct: 1,
      ipsConcentrationProximityPct: 30,
      esgScoreMarginAboveMin: 25,
      trackingErrorBudgetUsedPct: 30,
    });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('IPS concentration limit breach goes Critical', () => {
    const model = createRiskModel('portfolio-optimizer');
    const result = model.score('optimization.run', {}, {
      aggregateWeightChangePct: 5,
      ipsConcentrationProximityPct: 100,
    });
    assert.strictEqual(result.riskTier, 'critical');
  });

  it('high drift rebalancing goes Yellow', () => {
    const model = createRiskModel('rebalancer');
    const result = model.score('generate-trade-list', {}, {
      aggregateWeightChangePct: 15,
      ipsConcentrationProximityPct: 80,
      maxDriftPct: 15,
      estimatedTxCostBps: 55,
    });
    assert.ok(result.riskScore > 30, `Expected Yellow+ but got ${result.riskScore}`);
  });

  it('allocation-advisor with all safety gates stays Green', () => {
    const model = createRiskModel('allocation-advisor');
    const result = model.score('generate-proposal', {}, {
      aggregateWeightChangePct: 2,
      ipsConcentrationProximityPct: 40,
    });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('factor-analyst multi-mandate analysis stays Green', () => {
    const model = createRiskModel('factor-analyst');
    const result = model.score('compute-exposures', {}, {
      portfoliosAnalyzed: 5,
      maxFactorTiltSD: 0.05,
    });
    assert.strictEqual(result.riskTier, 'green');
  });
});

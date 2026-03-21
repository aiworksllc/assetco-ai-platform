import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BaseRiskModel,
  VarCalculatorRiskModel,
  StressTesterRiskModel,
  ExposureMonitorRiskModel,
  LimitEnforcerRiskModel,
  createRiskModel,
  listModels,
  RISK_DECAY_SCHEDULE,
  scoreDataSensitivity,
  scoreQueryVelocity,
  scoreCrossFundAggregation,
  scoreLimitProximity,
  scoreOutputDestination,
} from '../../platform/models/risk-compass/risk-models.js';

// ── Factory ──────────────────────────────────────────────────────────────

describe('RiskCompass Risk Models — Factory', () => {
  it('lists all 4 agent models', () => {
    assert.deepStrictEqual(listModels(), ['var-calculator', 'stress-tester', 'exposure-monitor', 'limit-enforcer']);
  });

  it('creates correct model class per agent', () => {
    assert.ok(createRiskModel('var-calculator') instanceof VarCalculatorRiskModel);
    assert.ok(createRiskModel('stress-tester') instanceof StressTesterRiskModel);
    assert.ok(createRiskModel('exposure-monitor') instanceof ExposureMonitorRiskModel);
    assert.ok(createRiskModel('limit-enforcer') instanceof LimitEnforcerRiskModel);
  });

  it('returns BaseRiskModel for unknown agent', () => {
    assert.ok(createRiskModel('unknown-agent') instanceof BaseRiskModel);
  });
});

// ── Score Structure ──────────────────────────────────────────────────────

describe('RiskCompass Risk Models — Score Structure', () => {
  it('returns all required fields from score()', () => {
    const model = createRiskModel('var-calculator');
    const result = model.score('riskcompass.publish_var_report', {}, {});
    assert.ok('riskScore' in result);
    assert.ok('riskTier' in result);
    assert.ok('factors' in result);
    assert.ok('regulatoryFlags' in result);
    assert.ok('explanation' in result);
    assert.ok('model' in result);
    assert.ok('modelVersion' in result);
    assert.ok('scoredAt' in result);
  });

  it('riskScore is clamped 0-100', () => {
    const model = createRiskModel('var-calculator');
    const result = model.score('riskcompass.publish_var_report', {}, {});
    assert.ok(result.riskScore >= 0 && result.riskScore <= 100);
  });

  it('riskTier maps correctly to thresholds', () => {
    const model = new BaseRiskModel('test', { baselineScore: 0 });
    // Green: 0-30
    assert.strictEqual(model.score('read', {}, {}).riskTier, 'green');
  });
});

// ── Factor 1: Data Sensitivity ───────────────────────────────────────────

describe('Factor 1: Data Sensitivity', () => {
  it('scores low for single fund/asset class', () => {
    const factor = scoreDataSensitivity({}, { fundsAccessed: 1, assetClassesAccessed: 1 }, 'var-calculator');
    assert.ok(factor.impact <= 5);
  });

  it('scores moderate for multiple funds', () => {
    const factor = scoreDataSensitivity({}, { fundsAccessed: 3 }, 'var-calculator');
    assert.ok(factor.impact >= 3 && factor.impact <= 8);
  });

  it('scores high for all 5 business lines by exposure-monitor (authorized)', () => {
    const factor = scoreDataSensitivity({}, { crossFund: true, assetClassesAccessed: 5 }, 'exposure-monitor');
    assert.ok(factor.impact >= 8 && factor.impact <= 15);
  });

  it('scores higher for all 5 business lines by non-exposure-monitor', () => {
    const factor = scoreDataSensitivity({}, { crossFund: true, assetClassesAccessed: 5 }, 'var-calculator');
    assert.ok(factor.impact >= 15);
  });

  it('scores highest for denied path attempts', () => {
    const factor = scoreDataSensitivity({}, { deniedPathAttempts: 3 }, 'var-calculator');
    assert.ok(factor.impact >= 20);
  });

  it('scores cross-fund + derivatives + counterparty combo', () => {
    const factor = scoreDataSensitivity(
      { dataSources: ['bloomberg-aim/derivative-positions/**', 'bloomberg-aim/counterparty-data/**'] },
      { crossFund: true },
      'exposure-monitor'
    );
    assert.ok(factor.impact >= 15);
  });
});

// ── Factor 2: Query Velocity ─────────────────────────────────────────────

describe('Factor 2: Query Velocity', () => {
  it('scores low within scheduled rate', () => {
    const factor = scoreQueryVelocity({ callsThisHour: 10 }, { hourlyLimit: 25 });
    assert.ok(factor.impact <= 5);
  });

  it('scores moderate at 110-150% of hourly limit', () => {
    const factor = scoreQueryVelocity({ callsThisHour: 30 }, { hourlyLimit: 25 });
    assert.ok(factor.impact >= 5 && factor.impact <= 18);
  });

  it('scores high at >200% of hourly limit', () => {
    const factor = scoreQueryVelocity({ callsThisHour: 55 }, { hourlyLimit: 25 });
    assert.ok(factor.impact >= 18);
  });

  it('scores immediate Yellow on velocity spike >5x', () => {
    const factor = scoreQueryVelocity({ callsThisHour: 10, velocitySpike: 6 }, { hourlyLimit: 25 });
    assert.ok(factor.impact >= 22);
  });
});

// ── Factor 3: Cross-Fund Aggregation ─────────────────────────────────────

describe('Factor 3: Cross-Fund Aggregation', () => {
  it('scores minimal for single fund', () => {
    const factor = scoreCrossFundAggregation({ fundsAggregated: 1, businessLinesAggregated: 0 }, 'var-calculator');
    assert.ok(factor.impact <= 2);
  });

  it('scores moderate for all funds in 1 business line', () => {
    const factor = scoreCrossFundAggregation({ fundsAggregated: 8, businessLinesAggregated: 1 }, 'var-calculator');
    assert.ok(factor.impact >= 5 && factor.impact <= 8);
  });

  it('scores max when non-exposure-monitor aggregates all 5 lines', () => {
    const factor = scoreCrossFundAggregation({ fundsAggregated: 20, businessLinesAggregated: 5 }, 'var-calculator');
    assert.strictEqual(factor.impact, 20);
  });

  it('scores lower for exposure-monitor aggregating all 5 lines (authorized)', () => {
    const factor = scoreCrossFundAggregation({ fundsAggregated: 20, businessLinesAggregated: 5 }, 'exposure-monitor');
    assert.ok(factor.impact < 20);
  });
});

// ── Factor 4: Limit Proximity ────────────────────────────────────────────

describe('Factor 4: Limit Proximity', () => {
  it('scores minimal with no limits approached', () => {
    const factor = scoreLimitProximity({});
    assert.ok(factor.impact <= 2);
  });

  it('scores high with >10 breach events in window', () => {
    const factor = scoreLimitProximity({ breachEventsInWindow: 15 });
    assert.ok(factor.impact >= 12);
  });

  it('scores max for alert to non-approved destination', () => {
    const factor = scoreLimitProximity({ alertToNonApprovedDestination: true });
    assert.strictEqual(factor.impact, 15);
  });
});

// ── Factor 5: Output Destination ─────────────────────────────────────────

describe('Factor 5: Output Destination', () => {
  it('scores zero for approved destinations', () => {
    const factor = scoreOutputDestination('read', {}, {});
    assert.strictEqual(factor.impact, 0);
  });

  it('scores max for successful write (SOE bypass)', () => {
    const factor = scoreOutputDestination('write', {}, { writeSucceeded: true });
    assert.strictEqual(factor.impact, 15);
  });

  it('scores high for attempt to write to trading system', () => {
    const factor = scoreOutputDestination('write', { destination: 'tradesentinel/orders' }, {});
    assert.ok(factor.impact >= 10);
  });

  it('scores high for attempt to write to client PII', () => {
    const factor = scoreOutputDestination('write', { destination: 'client-pii/records' }, {});
    assert.ok(factor.impact >= 10);
  });
});

// ── VaR Calculator Specifics ─────────────────────────────────────────────

describe('VarCalculatorRiskModel', () => {
  const model = new VarCalculatorRiskModel();

  it('has correct baseline and risk budget', () => {
    assert.strictEqual(model.config.baselineScore, 5);
    assert.strictEqual(model.riskBudget.dailyLimit, 200);
    assert.strictEqual(model.riskBudget.hourlyLimit, 25);
  });

  it('flags Basel III FRTB for backtesting exceptions', () => {
    const result = model.score('riskcompass.publish_var_report', {}, { backtestingExceptions: 5 });
    const baselFlag = result.regulatoryFlags.find(f => f.flag === 'Basel-III-FRTB-§183');
    assert.ok(baselFlag);
    assert.strictEqual(baselFlag.severity, 'elevated');
  });

  it('flags critical for 10+ backtesting exceptions', () => {
    const result = model.score('riskcompass.publish_var_report', {}, { backtestingExceptions: 12 });
    const baselFlag = result.regulatoryFlags.find(f => f.flag === 'Basel-III-FRTB-§183');
    assert.strictEqual(baselFlag.severity, 'critical');
  });

  it('flags SR 11-7 for model version mismatch', () => {
    const result = model.score('riskcompass.publish_var_report', {}, { modelVersion: '2.0.0', approvedModelVersion: '1.0.0' });
    const srFlag = result.regulatoryFlags.find(f => f.flag === 'SR-11-7-model-version');
    assert.ok(srFlag);
  });

  it('always includes EU AI Act Art.12 flag', () => {
    const result = model.score('riskcompass.read_positions', {}, {});
    const euFlag = result.regulatoryFlags.find(f => f.flag === 'EU-AI-Act-Art.12');
    assert.ok(euFlag);
  });
});

// ── Stress Tester Specifics ──────────────────────────────────────────────

describe('StressTesterRiskModel', () => {
  const model = new StressTesterRiskModel();

  it('has correct risk budget (100/day, 20/hour)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 100);
    assert.strictEqual(model.riskBudget.hourlyLimit, 20);
  });

  it('adds penalty for custom scenarios', () => {
    const result = model.score('riskcompass.run_stress_scenario', {}, { scenarioType: 'custom' });
    const customFactor = result.factors.find(f => f.name === 'custom-scenario');
    assert.ok(customFactor);
    assert.ok(customFactor.impact > 0);
  });

  it('gives credit for AIFMD quarterly run', () => {
    const result = model.score('riskcompass.run_stress_scenario', {}, { trigger: 'aifmd-quarterly' });
    const aifmdFactor = result.factors.find(f => f.name === 'aifmd-quarterly');
    assert.ok(aifmdFactor);
    assert.ok(aifmdFactor.impact < 0);
  });

  it('flags AIFMD Art.16 for quarterly trigger', () => {
    const result = model.score('riskcompass.run_stress_scenario', {}, { trigger: 'aifmd-quarterly' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'AIFMD-Art.16(1)');
    assert.ok(flag);
  });

  it('flags Basel III for stress methodology', () => {
    const result = model.score('riskcompass.run_stress_scenario', {}, { methodology: 'stress-scenario' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'Basel-III-FRTB-§181(h)');
    assert.ok(flag);
  });
});

// ── Exposure Monitor Specifics ───────────────────────────────────────────

describe('ExposureMonitorRiskModel', () => {
  const model = new ExposureMonitorRiskModel();

  it('has highest baseline (8) and budget (500/day)', () => {
    assert.strictEqual(model.config.baselineScore, 8);
    assert.strictEqual(model.riskBudget.dailyLimit, 500);
    assert.strictEqual(model.riskBudget.hourlyLimit, 60);
  });

  it('adds factor for stale data aggregation', () => {
    const result = model.score('riskcompass.aggregate_exposure', {}, { dataFreshnessSeconds: 7200 });
    const staleFactor = result.factors.find(f => f.name === 'stale-data-aggregation');
    assert.ok(staleFactor);
    assert.ok(staleFactor.impact > 0);
  });

  it('adds factor for rapid aggregation runs (possible scraping)', () => {
    const result = model.score('riskcompass.aggregate_exposure', {}, { aggregationRunsInWindow: 15 });
    const velocityFactor = result.factors.find(f => f.name === 'aggregation-velocity');
    assert.ok(velocityFactor);
    assert.ok(velocityFactor.impact >= 12);
  });

  it('flags AIFMD Art.15 for cross-fund aggregation', () => {
    const result = model.score('riskcompass.aggregate_exposure', {}, { crossFund: true });
    const flag = result.regulatoryFlags.find(f => f.flag === 'AIFMD-Art.15(3)(a)');
    assert.ok(flag);
  });

  it('flags Dodd-Frank Title I for full firm aggregation', () => {
    const result = model.score('riskcompass.aggregate_exposure', {}, { businessLinesAggregated: 5 });
    const flag = result.regulatoryFlags.find(f => f.flag === 'Dodd-Frank-Title-I');
    assert.ok(flag);
  });
});

// ── Limit Enforcer Specifics ─────────────────────────────────────────────

describe('LimitEnforcerRiskModel', () => {
  const model = new LimitEnforcerRiskModel();

  it('has correct risk budget (300/day, 35/hour)', () => {
    assert.strictEqual(model.riskBudget.dailyLimit, 300);
    assert.strictEqual(model.riskBudget.hourlyLimit, 35);
  });

  it('gives dedup credit when duplicates suppressed', () => {
    const result = model.score('riskcompass.generate_breach_event', {}, { duplicateAlertsSuppressed: 10 });
    const dedupFactor = result.factors.find(f => f.name === 'dedup-suppression');
    assert.ok(dedupFactor);
    assert.ok(dedupFactor.impact < 0);
  });

  it('penalizes limit modification attempts', () => {
    const result = model.score('riskcompass.modify_limit', {}, { limitModificationAttempt: true });
    const modFactor = result.factors.find(f => f.name === 'limit-modification-attempt');
    assert.ok(modFactor);
    assert.strictEqual(modFactor.impact, 20);
  });

  it('penalizes alert suppression attempts', () => {
    const result = model.score('riskcompass.suppress_alert', {}, { alertSuppressionAttempt: true });
    const suppressFactor = result.factors.find(f => f.name === 'alert-suppression-attempt');
    assert.ok(suppressFactor);
    assert.strictEqual(suppressFactor.impact, 20);
  });

  it('flags AIFMD Art.15(4) for leverage limits', () => {
    const result = model.score('riskcompass.generate_breach_event', {}, { limitType: 'leverage-aifmd-gross' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'AIFMD-Art.15(4)');
    assert.ok(flag);
  });

  it('flags Dodd-Frank for counterparty limits', () => {
    const result = model.score('riskcompass.generate_breach_event', {}, { limitType: 'counterparty-limit' });
    const flag = result.regulatoryFlags.find(f => f.flag === 'Dodd-Frank-Title-VII-§23.600');
    assert.ok(flag);
  });

  it('flags EU AI Act Art.14 when breach events exist', () => {
    const result = model.score('riskcompass.generate_breach_event', {}, { breachEventsInWindow: 3 });
    const flag = result.regulatoryFlags.find(f => f.flag === 'EU-AI-Act-Art.14');
    assert.ok(flag);
  });
});

// ── Risk Decay ───────────────────────────────────────────────────────────

describe('Risk Decay Schedule', () => {
  it('has 4 decay tiers', () => {
    assert.strictEqual(RISK_DECAY_SCHEDULE.schedule.length, 4);
  });

  it('0-15min has zero decay (maintain monitoring)', () => {
    assert.strictEqual(RISK_DECAY_SCHEDULE.schedule[0].decayRatePer5Min, 0);
  });

  it('15-30min has 20% decay', () => {
    assert.strictEqual(RISK_DECAY_SCHEDULE.schedule[1].decayRatePer5Min, 0.20);
  });

  it('>60min has full reset', () => {
    assert.strictEqual(RISK_DECAY_SCHEDULE.schedule[3].decayRatePer5Min, 1.0);
  });
});

// ── Cumulative Score Scenarios ───────────────────────────────────────────

describe('Cumulative Score Scenarios', () => {
  it('normal var-calculator run stays Green', () => {
    const model = createRiskModel('var-calculator');
    const result = model.score('riskcompass.publish_var_report', {}, {
      fundsAccessed: 1,
      callsThisHour: 5,
      fundsAggregated: 1,
      businessLinesAggregated: 1,
    });
    assert.strictEqual(result.riskTier, 'green');
  });

  it('exposure-monitor full firm aggregation stays Green/Yellow (authorized — elevated but not Red)', () => {
    const model = createRiskModel('exposure-monitor');
    const result = model.score('riskcompass.aggregate_exposure', {}, {
      crossFund: true,
      assetClassesAccessed: 5,
      callsThisHour: 20,
      fundsAggregated: 20,
      businessLinesAggregated: 5,
    });
    // Full firm aggregation is authorized but carries inherent risk — should not exceed Yellow
    assert.ok(result.riskTier === 'green' || result.riskTier === 'yellow',
      `Expected green or yellow but got ${result.riskTier} (score: ${result.riskScore})`);
    assert.ok(result.riskScore <= 60, `Score ${result.riskScore} should not exceed Yellow threshold`);
  });

  it('var-calculator aggregating all 5 lines triggers Yellow+', () => {
    const model = createRiskModel('var-calculator');
    const result = model.score('riskcompass.publish_var_report', {}, {
      crossFund: true,
      assetClassesAccessed: 5,
      callsThisHour: 30,
      fundsAggregated: 20,
      businessLinesAggregated: 5,
    });
    assert.ok(result.riskScore > 30, `Expected Yellow+ but got ${result.riskScore}`);
  });

  it('limit-enforcer with suppression + modification attempt goes Red', () => {
    const model = createRiskModel('limit-enforcer');
    const result = model.score('riskcompass.suppress_alert', {}, {
      alertSuppressionAttempt: true,
      limitModificationAttempt: true,
      callsThisHour: 50,
      breachEventsInWindow: 12,
    });
    assert.ok(result.riskScore > 60, `Expected Red but got ${result.riskScore}`);
  });
});

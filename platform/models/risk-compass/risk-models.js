/**
 * Risk Models — RiskCompass Application
 *
 * Domain-specific Arbiter risk scoring for RiskCompass agents:
 *   - VarCalculatorRiskModel
 *   - StressTesterRiskModel
 *   - ExposureMonitorRiskModel
 *   - LimitEnforcerRiskModel
 *
 * All RiskCompass agents are READ-ONLY. The primary risk dimensions are:
 *   Factor 1: Data Sensitivity of Positions Accessed (0-25)
 *   Factor 2: Query Velocity (0-25)
 *   Factor 3: Cross-Fund Aggregation Scope (0-20)
 *   Factor 4: Limit Proximity and Alert Rate (0-15)
 *   Factor 5: Output Destination Integrity (0-15)
 *
 * Thresholds: Green (0-30), Yellow (31-60), Red (61-85), Critical (86-100)
 *
 * Regulatory basis:
 *   - Basel III FRTB §181-183 (VaR model evidence)
 *   - AIFMD Art.15-16 (risk monitoring, leverage, liquidity stress)
 *   - EU AI Act Art.9 (risk management), Art.12 (record-keeping), Art.14 (human oversight)
 *   - Dodd-Frank Title II, Title VII §23.600 (systemic risk, swap entity limits)
 *   - SR 11-7 (model risk management)
 */

// ── Base Risk Model ──────────────────────────────────────────────────────

class BaseRiskModel {
  constructor(agentId, config = {}) {
    this.agentId = agentId;
    this.config = {
      baselineScore: 5,
      maxScore: 100,
      ...config,
    };
  }

  score(toolName, toolInput, context = {}) {
    const factors = this._computeFactors(toolName, toolInput, context);
    const rawScore = this.config.baselineScore + factors.reduce((sum, f) => sum + f.impact, 0);
    const riskScore = Math.max(0, Math.min(this.config.maxScore, Math.round(rawScore)));
    const regulatoryFlags = this._checkRegulatoryFlags(toolName, toolInput, riskScore, context);

    return {
      riskScore,
      riskTier: riskScore <= 30 ? 'green' : riskScore <= 60 ? 'yellow' : riskScore <= 85 ? 'red' : 'critical',
      factors,
      regulatoryFlags,
      explanation: this._explain(riskScore, factors, regulatoryFlags),
      model: this.agentId,
      modelVersion: '1.0.0',
      scoredAt: new Date().toISOString(),
    };
  }

  _computeFactors(_toolName, _toolInput, _context) {
    return [];
  }

  _checkRegulatoryFlags(_toolName, _toolInput, _riskScore, _context) {
    return [];
  }

  _explain(riskScore, factors, regulatoryFlags) {
    const topFactors = factors
      .filter(f => f.impact !== 0)
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))
      .slice(0, 3)
      .map(f => `${f.name}: ${f.impact > 0 ? '+' : ''}${f.impact} (${f.reason})`)
      .join('; ');
    const flagStr = regulatoryFlags.length > 0
      ? ` Regulatory: ${regulatoryFlags.map(f => f.flag).join(', ')}.`
      : '';
    return `Risk ${riskScore}/100 [${riskScore <= 30 ? 'GREEN' : riskScore <= 60 ? 'YELLOW' : riskScore <= 85 ? 'RED' : 'CRITICAL'}]. ${topFactors || 'No significant factors'}.${flagStr}`;
  }
}

// ── Shared Factors ───────────────────────────────────────────────────────

function scoreDataSensitivity(toolInput, context, agentId) {
  const paths = toolInput?.dataSources || context?.dataSourcesRead || [];
  const pathStr = Array.isArray(paths) ? paths.join(' ') : String(paths);
  const readPath = toolInput?.file_path || toolInput?.path || '';

  // Denied path attempts (Sentinel blocks, Arbiter escalates pattern)
  if (context?.deniedPathAttempts > 0) {
    return { name: 'data-sensitivity', impact: 20 + Math.min(5, context.deniedPathAttempts), reason: `${context.deniedPathAttempts} denied path attempt(s) logged` };
  }

  // Cross-fund + derivatives + counterparty simultaneously
  const hasDerivatives = pathStr.includes('derivative') || pathStr.includes('credit-default-swap');
  const hasCounterparty = pathStr.includes('counterparty');
  const crossFund = context?.crossFund || context?.fundsAccessed > 3;
  if (crossFund && hasDerivatives && hasCounterparty) {
    if (agentId !== 'exposure-monitor') {
      return { name: 'data-sensitivity', impact: 20, reason: 'Cross-fund + derivatives + counterparty data — not authorized for this agent' };
    }
    return { name: 'data-sensitivity', impact: 15, reason: 'Cross-fund + derivatives + counterparty — high-value combination (authorized)' };
  }

  // Cross-fund, cross-asset-class (all 5 business lines)
  const assetClasses = context?.assetClassesAccessed || 0;
  if (crossFund && assetClasses >= 5) {
    return { name: 'data-sensitivity', impact: agentId === 'exposure-monitor' ? 12 : 15, reason: `All ${assetClasses} business lines accessed cross-fund` };
  }

  // Multiple funds, single asset class
  const fundsAccessed = context?.fundsAccessed || 1;
  if (fundsAccessed > 1 && fundsAccessed <= 3) {
    return { name: 'data-sensitivity', impact: 5, reason: `${fundsAccessed} funds accessed — routine for firm-level analytics` };
  }

  // Single fund, single asset class
  return { name: 'data-sensitivity', impact: 2, reason: 'Single fund/asset class — normal scheduled run' };
}

function scoreQueryVelocity(context, riskBudget) {
  const hourlyLimit = riskBudget?.hourlyLimit || 25;
  const callsThisHour = context?.callsThisHour || 0;
  const ratio = callsThisHour / hourlyLimit;

  // Velocity spike: >5x normal rate in <5 minutes
  if (context?.velocitySpike && context.velocitySpike > 5) {
    return { name: 'query-velocity', impact: 23, reason: `${context.velocitySpike}x normal rate in <5min — immediate Yellow` };
  }

  if (ratio > 2.0) {
    return { name: 'query-velocity', impact: 22, reason: `${callsThisHour}/${hourlyLimit} hourly (${Math.round(ratio * 100)}%) — likely loop or retry storm` };
  }
  if (ratio > 1.5) {
    return { name: 'query-velocity', impact: 15, reason: `${callsThisHour}/${hourlyLimit} hourly (${Math.round(ratio * 100)}%) — unusual burst` };
  }
  if (ratio > 1.1) {
    return { name: 'query-velocity', impact: 8, reason: `${callsThisHour}/${hourlyLimit} hourly (${Math.round(ratio * 100)}%) — within burst allowance` };
  }

  return { name: 'query-velocity', impact: 2, reason: `${callsThisHour}/${hourlyLimit} hourly — within scheduled rate` };
}

function scoreCrossFundAggregation(context, agentId) {
  const fundsAggregated = context?.fundsAggregated || 0;
  const businessLines = context?.businessLinesAggregated || 0;

  // All 5 business lines — only exposure-monitor is authorized
  if (businessLines >= 5) {
    if (agentId !== 'exposure-monitor') {
      return { name: 'cross-fund-aggregation', impact: 20, reason: `All ${businessLines} business lines aggregated — UNAUTHORIZED for ${agentId}` };
    }
    return { name: 'cross-fund-aggregation', impact: 14, reason: `All ${businessLines} business lines — authorized for exposure-monitor` };
  }

  // Cross-business-line (2-3 divisions)
  if (businessLines >= 2) {
    if (agentId !== 'exposure-monitor') {
      return { name: 'cross-fund-aggregation', impact: 12, reason: `${businessLines} business lines aggregated — elevated for ${agentId}` };
    }
    return { name: 'cross-fund-aggregation', impact: 10, reason: `${businessLines} business lines — expected for exposure-monitor` };
  }

  // All funds in 1 business line
  if (fundsAggregated > 5) {
    return { name: 'cross-fund-aggregation', impact: 6, reason: `${fundsAggregated} funds in single business line — division-level sweep` };
  }

  // 2-3 funds, same business line
  if (fundsAggregated >= 2) {
    return { name: 'cross-fund-aggregation', impact: 3, reason: `${fundsAggregated} funds same division — normal exposure check` };
  }

  return { name: 'cross-fund-aggregation', impact: 1, reason: 'Single fund/strategy — routine' };
}

function scoreLimitProximity(context) {
  const breachEvents = context?.breachEventsInWindow || 0;
  const limitsApproached = context?.limitsAtThreshold || 0;
  const nonApprovedDestination = context?.alertToNonApprovedDestination || false;

  if (nonApprovedDestination) {
    return { name: 'limit-proximity', impact: 15, reason: 'Alert to non-approved destination — Sentinel blocks, Arbiter escalates' };
  }
  if (breachEvents > 10) {
    return { name: 'limit-proximity', impact: 14, reason: `${breachEvents} breach events in 60min — extreme stress or config error` };
  }
  if (breachEvents > 0) {
    return { name: 'limit-proximity', impact: 10, reason: `${breachEvents} breach event(s) — warrants review` };
  }
  if (limitsApproached > 5) {
    return { name: 'limit-proximity', impact: 8, reason: `${limitsApproached} limits at 80%+ — high market stress` };
  }
  if (limitsApproached > 0) {
    return { name: 'limit-proximity', impact: 4, reason: `${limitsApproached} limit(s) at 80%+ — normal stress monitoring` };
  }

  return { name: 'limit-proximity', impact: 1, reason: 'No limits approached — baseline' };
}

function scoreOutputDestination(toolName, toolInput, context) {
  const destination = toolInput?.destination || context?.outputDestination || '';
  const destStr = String(destination).toLowerCase();

  // Any successful write (impossible under SOE — indicates bypass)
  if (context?.writeSucceeded) {
    return { name: 'output-destination', impact: 15, reason: 'WRITE SUCCEEDED — SOE bypass detected — CRITICAL' };
  }

  // Attempt to write to trading system or client PII
  if (destStr.includes('tradesentinel') || destStr.includes('alphaengine') || destStr.includes('order')) {
    return { name: 'output-destination', impact: 13, reason: 'Attempted write to trading system path — blocked' };
  }
  if (destStr.includes('client-pii') || destStr.includes('advisorlens') || destStr.includes('client-records')) {
    return { name: 'output-destination', impact: 13, reason: 'Attempted write to client PII path — blocked' };
  }

  // Attempt to write to non-risk-dashboard path
  if (destStr && !destStr.includes('dashboard') && !destStr.includes('chronicle') && !destStr.includes('compliance')) {
    return { name: 'output-destination', impact: 7, reason: `Write attempt to non-approved path: ${destination}` };
  }

  return { name: 'output-destination', impact: 0, reason: 'All outputs to approved destinations' };
}

// ── VaR Calculator Risk Model ────────────────────────────────────────────

class VarCalculatorRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('var-calculator', {
      baselineScore: 5,
      ...config,
    });
    this.riskBudget = { dailyLimit: 200, hourlyLimit: 25, onDemandBurst: 10 };
  }

  _computeFactors(toolName, toolInput, context) {
    return [
      scoreDataSensitivity(toolInput, context, 'var-calculator'),
      scoreQueryVelocity(context, this.riskBudget),
      scoreCrossFundAggregation(context, 'var-calculator'),
      scoreLimitProximity(context),
      scoreOutputDestination(toolName, toolInput, context),
    ];
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    // Basel III FRTB — VaR backtesting exceptions
    if (context?.backtestingExceptions > 0) {
      flags.push({
        flag: 'Basel-III-FRTB-§183',
        reason: `${context.backtestingExceptions} backtesting exception(s) — requires model validation review`,
        action: 'escalate-to-mvc',
        severity: context.backtestingExceptions >= 10 ? 'critical' : 'elevated',
      });
    }

    // SR 11-7 — model risk management
    if (context?.modelVersion && context.modelVersion !== context?.approvedModelVersion) {
      flags.push({
        flag: 'SR-11-7-model-version',
        reason: `Running model ${context.modelVersion}, approved is ${context.approvedModelVersion}`,
        action: 'audit',
      });
    }

    // EU AI Act Art.12 — all calculations must be logged
    flags.push({
      flag: 'EU-AI-Act-Art.12',
      reason: 'VaR calculation must be logged with full input/output for regulatory audit trail',
      action: 'log',
    });

    if (riskScore > 85) {
      flags.push({
        flag: 'EU-AI-Act-Art.14',
        reason: 'Critical risk score — human oversight required per Art.14',
        action: 'escalate',
      });
    }

    return flags;
  }
}

// ── Stress Tester Risk Model ─────────────────────────────────────────────

class StressTesterRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('stress-tester', {
      baselineScore: 5,
      ...config,
    });
    this.riskBudget = { dailyLimit: 100, hourlyLimit: 20, onDemandBurst: 5 };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [
      scoreDataSensitivity(toolInput, context, 'stress-tester'),
      scoreQueryVelocity(context, this.riskBudget),
      scoreCrossFundAggregation(context, 'stress-tester'),
      scoreLimitProximity(context),
      scoreOutputDestination(toolName, toolInput, context),
    ];

    // Stress-tester specific: custom scenario execution (higher risk than predefined)
    if (context?.scenarioType === 'custom') {
      factors.push({
        name: 'custom-scenario',
        impact: 8,
        reason: 'Custom stress scenario — not from approved library',
      });
    }

    // AIFMD quarterly stress test — elevated audit attention, lower risk
    if (context?.trigger === 'aifmd-quarterly') {
      factors.push({
        name: 'aifmd-quarterly',
        impact: -3,
        reason: 'AIFMD quarterly scheduled run — expected high data access',
      });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    // AIFMD Art.16 — liquidity stress test
    if (context?.trigger === 'aifmd-quarterly') {
      flags.push({
        flag: 'AIFMD-Art.16(1)',
        reason: 'AIFMD quarterly liquidity stress test — results must be available for NCA review',
        action: 'log-and-retain-7yr',
      });
    }

    // Basel III FRTB — stressed VaR evidence
    if (context?.methodology === 'stress-scenario') {
      flags.push({
        flag: 'Basel-III-FRTB-§181(h)',
        reason: 'Stressed VaR evidence required for FRTB IMA approval',
        action: 'log',
      });
    }

    flags.push({
      flag: 'EU-AI-Act-Art.12',
      reason: 'Stress test execution must be logged with scenario parameters and results',
      action: 'log',
    });

    if (riskScore > 85) {
      flags.push({
        flag: 'EU-AI-Act-Art.14',
        reason: 'Critical risk — human oversight required',
        action: 'escalate',
      });
    }

    return flags;
  }
}

// ── Exposure Monitor Risk Model ──────────────────────────────────────────

class ExposureMonitorRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('exposure-monitor', {
      baselineScore: 8, // higher baseline — broadest read access in the firm
      ...config,
    });
    this.riskBudget = { dailyLimit: 500, hourlyLimit: 60, onDemandBurst: 20 };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [
      scoreDataSensitivity(toolInput, context, 'exposure-monitor'),
      scoreQueryVelocity(context, this.riskBudget),
      scoreCrossFundAggregation(context, 'exposure-monitor'),
      scoreLimitProximity(context),
      scoreOutputDestination(toolName, toolInput, context),
    ];

    // Exposure-monitor specific: data freshness concern
    if (context?.dataFreshnessSeconds > 3600) {
      factors.push({
        name: 'stale-data-aggregation',
        impact: 5,
        reason: `Aggregating positions ${Math.round(context.dataFreshnessSeconds / 60)}min stale — risk of misleading exposure report`,
      });
    }

    // Pattern: rapid successive aggregation runs (possible scraping)
    if (context?.aggregationRunsInWindow > 10) {
      factors.push({
        name: 'aggregation-velocity',
        impact: 12,
        reason: `${context.aggregationRunsInWindow} aggregation runs in window — possible data exfiltration pattern`,
      });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    // AIFMD Art.15 — ongoing risk monitoring evidence
    if (context?.crossFund) {
      flags.push({
        flag: 'AIFMD-Art.15(3)(a)',
        reason: 'Cross-fund exposure aggregation — AIFMD ongoing monitoring evidence',
        action: 'log',
      });
    }

    // Basel III CRR2 — consolidated exposure reporting
    if (context?.businessLinesAggregated >= 3) {
      flags.push({
        flag: 'Basel-III-CRR2-Art.395',
        reason: 'Firm-level consolidated exposure — large exposure reporting',
        action: 'log',
      });
    }

    // Dodd-Frank — systemic risk monitoring
    if (context?.businessLinesAggregated >= 5) {
      flags.push({
        flag: 'Dodd-Frank-Title-I',
        reason: 'Full firm aggregation — systemic risk monitoring evidence',
        action: 'log',
      });
    }

    flags.push({
      flag: 'EU-AI-Act-Art.12',
      reason: 'Exposure aggregation must be logged for HIGH RISK AI audit trail',
      action: 'log',
    });

    if (riskScore > 85) {
      flags.push({
        flag: 'EU-AI-Act-Art.14',
        reason: 'Critical risk — human oversight required',
        action: 'escalate',
      });
    }

    return flags;
  }
}

// ── Limit Enforcer Risk Model ────────────────────────────────────────────

class LimitEnforcerRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('limit-enforcer', {
      baselineScore: 5,
      ...config,
    });
    this.riskBudget = { dailyLimit: 300, hourlyLimit: 35, onDemandBurst: 15 };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [
      scoreDataSensitivity(toolInput, context, 'limit-enforcer'),
      scoreQueryVelocity(context, this.riskBudget),
      scoreCrossFundAggregation(context, 'limit-enforcer'),
      scoreLimitProximity(context),
      scoreOutputDestination(toolName, toolInput, context),
    ];

    // Limit-enforcer specific: alert deduplication bypass
    if (context?.duplicateAlertsSuppressed > 5) {
      factors.push({
        name: 'dedup-suppression',
        impact: -3,
        reason: `${context.duplicateAlertsSuppressed} duplicate alerts suppressed — deduplication working correctly`,
      });
    }

    // Limit modification attempt (Sentinel blocks, but Arbiter flags pattern)
    if (context?.limitModificationAttempt) {
      factors.push({
        name: 'limit-modification-attempt',
        impact: 20,
        reason: 'Attempted to modify/override limit — DENIED by SOE, flagged by Arbiter',
      });
    }

    // Alert suppression attempt
    if (context?.alertSuppressionAttempt) {
      factors.push({
        name: 'alert-suppression-attempt',
        impact: 20,
        reason: 'Attempted to suppress alert — DENIED by SOE, flagged by Arbiter',
      });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    // AIFMD Art.15(4) — leverage limit enforcement
    if (context?.limitType?.includes('leverage')) {
      flags.push({
        flag: 'AIFMD-Art.15(4)',
        reason: 'Leverage limit monitoring — AIFMD compliance evidence',
        action: 'log',
      });
    }

    // Basel III FRTB — VaR limit enforcement
    if (context?.limitType?.includes('var')) {
      flags.push({
        flag: 'Basel-III-FRTB-§183',
        reason: 'VaR limit check — internal limit framework evidence',
        action: 'log',
      });
    }

    // EU AI Act Art.14 — human oversight for breach events
    if (context?.breachEventsInWindow > 0) {
      flags.push({
        flag: 'EU-AI-Act-Art.14',
        reason: 'Limit breach detected — human risk manager must review remediation',
        action: 'escalate',
      });
    }

    // Dodd-Frank — swap entity limit monitoring
    if (context?.limitType?.includes('counterparty')) {
      flags.push({
        flag: 'Dodd-Frank-Title-VII-§23.600',
        reason: 'Counterparty limit monitoring — swap entity risk management',
        action: 'log',
      });
    }

    flags.push({
      flag: 'EU-AI-Act-Art.12',
      reason: 'Limit check result must be logged for HIGH RISK AI audit trail',
      action: 'log',
    });

    return flags;
  }
}

// ── Risk Decay Configuration ─────────────────────────────────────────────

const RISK_DECAY_SCHEDULE = {
  application: 'RiskCompass',
  description: 'Accelerated decay for read-only analytics agents',
  schedule: [
    { minMinutes: 0, maxMinutes: 15, decayRatePer5Min: 0, reason: 'Maintain elevated monitoring during active stress' },
    { minMinutes: 15, maxMinutes: 30, decayRatePer5Min: 0.20, reason: 'Moderate decay if no further elevated actions' },
    { minMinutes: 30, maxMinutes: 60, decayRatePer5Min: 0.30, reason: 'Faster decay for read-only operations' },
    { minMinutes: 60, maxMinutes: Infinity, decayRatePer5Min: 1.0, reason: 'Full reset — read-only actions do not carry forward-looking risk' },
  ],
};

// ── Factory ──────────────────────────────────────────────────────────────

const MODELS = {
  'var-calculator': VarCalculatorRiskModel,
  'stress-tester': StressTesterRiskModel,
  'exposure-monitor': ExposureMonitorRiskModel,
  'limit-enforcer': LimitEnforcerRiskModel,
};

function createRiskModel(agentId, config = {}) {
  const ModelClass = MODELS[agentId];
  if (!ModelClass) {
    return new BaseRiskModel(agentId, config);
  }
  return new ModelClass(config);
}

function listModels() {
  return Object.keys(MODELS);
}

export {
  BaseRiskModel,
  VarCalculatorRiskModel,
  StressTesterRiskModel,
  ExposureMonitorRiskModel,
  LimitEnforcerRiskModel,
  createRiskModel,
  listModels,
  RISK_DECAY_SCHEDULE,
  // Shared factor functions (exported for testing)
  scoreDataSensitivity,
  scoreQueryVelocity,
  scoreCrossFundAggregation,
  scoreLimitProximity,
  scoreOutputDestination,
};

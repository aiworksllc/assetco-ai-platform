/**
 * Risk Models — AlphaEngine Application
 *
 * Domain-specific Arbiter risk scoring for AlphaEngine agents:
 *   - PortfolioOptimizerRiskModel (propose-only, fiduciary constraints)
 *   - RebalancerRiskModel (trade-list generation, drift computation)
 *   - AllocationAdvisorRiskModel (propose-only, human approval gate)
 *   - FactorAnalystRiskModel (read-only analysis)
 *
 * All AlphaEngine agents are HIGH_RISK. Risk factors:
 *   Factor 1: Allocation Magnitude (0-25)
 *   Factor 2: Concentration Change / IPS proximity (0-15, HARD DENY at limit)
 *   Factor 3: ESG Constraint Proximity (0-10, HARD DENY at floor)
 *   Factor 4: Mandate Deviation / tracking error budget (0-15, HARD DENY at ceiling)
 *   Factor 5: Factor Tilt Magnitude (0-12)
 *   Factor 6: Cross-Mandate Correlation (0-20)
 *
 * Thresholds: Green (0-30), Yellow (31-60), Red (61-85), Critical (86-100)
 *
 * Regulatory basis:
 *   - SEC Advisers Act (fiduciary duty, investment discretion)
 *   - MiFID II Art.25 (suitability), Art.27 (best execution for rebalancer)
 *   - SFDR Art.8/9 (ESG commitment enforcement)
 *   - ERISA (pension fiduciary duty, prudent expert standard)
 *   - SR 11-7 (model risk management)
 *   - EU AI Act Art.14 (human oversight — allocation-advisor gate)
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

  _computeFactors() { return []; }
  _checkRegulatoryFlags() { return []; }

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

// ── Shared Factor Functions ─────────────────────────────────────────────

function scoreAllocationMagnitude(context) {
  const weightChangePct = context?.aggregateWeightChangePct || 0;

  if (weightChangePct > 25) {
    return { name: 'allocation-magnitude', impact: 25, reason: `${weightChangePct}% aggregate weight change — major restructuring` };
  }
  if (weightChangePct > 10) {
    return { name: 'allocation-magnitude', impact: 12, reason: `${weightChangePct}% aggregate weight change — large rebalancing` };
  }
  if (weightChangePct > 2) {
    return { name: 'allocation-magnitude', impact: 5, reason: `${weightChangePct}% aggregate weight change — moderate rebalancing` };
  }
  return { name: 'allocation-magnitude', impact: 2, reason: `${weightChangePct}% aggregate weight change — incremental adjustment` };
}

function scoreConcentrationChange(context) {
  const ipsProximityPct = context?.ipsConcentrationProximityPct || 0;

  // At or above IPS limit — HARD DENY scored as critical
  if (ipsProximityPct >= 100) {
    return { name: 'concentration-change', impact: 90, reason: 'IPS concentration limit breached — HARD DENY' };
  }
  if (ipsProximityPct >= 90) {
    return { name: 'concentration-change', impact: 15, reason: `${ipsProximityPct}% of IPS concentration limit — near-breach` };
  }
  if (ipsProximityPct >= 75) {
    return { name: 'concentration-change', impact: 6, reason: `${ipsProximityPct}% of IPS concentration limit — approaching` };
  }
  if (ipsProximityPct >= 50) {
    return { name: 'concentration-change', impact: 2, reason: `${ipsProximityPct}% of IPS concentration limit — within budget` };
  }
  return { name: 'concentration-change', impact: 0, reason: 'Well within IPS concentration limits' };
}

function scoreEsgProximity(context) {
  const esgMarginPoints = context?.esgScoreMarginAboveMin;
  if (esgMarginPoints === undefined) return { name: 'esg-proximity', impact: 0, reason: 'No ESG constraint for this mandate' };

  // At or below ESG floor — HARD DENY
  if (esgMarginPoints <= 0) {
    return { name: 'esg-proximity', impact: 90, reason: 'SFDR ESG floor breached — HARD DENY' };
  }
  if (esgMarginPoints <= 5) {
    return { name: 'esg-proximity', impact: 8, reason: `ESG score only ${esgMarginPoints}pts above SFDR minimum — near-breach` };
  }
  if (esgMarginPoints <= 10) {
    return { name: 'esg-proximity', impact: 3, reason: `ESG score ${esgMarginPoints}pts above minimum — adequate margin` };
  }
  return { name: 'esg-proximity', impact: 0, reason: `ESG score ${esgMarginPoints}pts above minimum — comfortable margin` };
}

function scoreMandateDeviation(context) {
  const trackingErrorBudgetPct = context?.trackingErrorBudgetUsedPct || 0;

  // Exceeds tracking error ceiling — HARD DENY
  if (trackingErrorBudgetPct > 100) {
    return { name: 'mandate-deviation', impact: 90, reason: 'IPS tracking error ceiling breached — HARD DENY' };
  }
  if (trackingErrorBudgetPct >= 90) {
    return { name: 'mandate-deviation', impact: 12, reason: `${trackingErrorBudgetPct}% of tracking error budget — near-ceiling` };
  }
  if (trackingErrorBudgetPct >= 75) {
    return { name: 'mandate-deviation', impact: 6, reason: `${trackingErrorBudgetPct}% of tracking error budget — elevated` };
  }
  if (trackingErrorBudgetPct >= 50) {
    return { name: 'mandate-deviation', impact: 2, reason: `${trackingErrorBudgetPct}% of tracking error budget — within range` };
  }
  return { name: 'mandate-deviation', impact: 0, reason: 'Active risk well within mandate' };
}

function scoreFactorTilt(context) {
  const maxTiltSD = context?.maxFactorTiltSD || 0;

  if (maxTiltSD > 0.4) {
    return { name: 'factor-tilt', impact: 10, reason: `${maxTiltSD.toFixed(2)} SD max factor tilt — material unintended exposure` };
  }
  if (maxTiltSD > 0.2) {
    return { name: 'factor-tilt', impact: 5, reason: `${maxTiltSD.toFixed(2)} SD max factor tilt — moderate deviation` };
  }
  if (maxTiltSD > 0.1) {
    return { name: 'factor-tilt', impact: 2, reason: `${maxTiltSD.toFixed(2)} SD max factor tilt — minor` };
  }
  return { name: 'factor-tilt', impact: 0, reason: 'All factor exposures within target' };
}

function scoreCrossMandateCorrelation(context) {
  const correlatedMandatesPct = context?.correlatedMandatesPct || 0;
  const correlatedAumBillions = context?.correlatedAumBillions || 0;

  // Systemic concentration
  if (correlatedAumBillions > 5) {
    return { name: 'cross-mandate-correlation', impact: 18, reason: `$${correlatedAumBillions}B correlated AUM — systemic concentration risk + Beacon alert` };
  }
  if (correlatedMandatesPct > 50) {
    return { name: 'cross-mandate-correlation', impact: 10, reason: `${correlatedMandatesPct}% of mandates correlated (r>0.7) — high firm-level risk` };
  }
  if (correlatedMandatesPct > 25) {
    return { name: 'cross-mandate-correlation', impact: 4, reason: `${correlatedMandatesPct}% of mandates correlated (r>0.4) — moderate` };
  }
  return { name: 'cross-mandate-correlation', impact: 0, reason: 'No significant cross-mandate correlation' };
}

// ── Portfolio Optimizer Risk Model ──────────────────────────────────────

class PortfolioOptimizerRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('portfolio-optimizer', { baselineScore: 5, ...config });
    this.riskBudget = { dailyLimit: 500, hourlyLimit: 50, softThreshold: 25 };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [
      scoreAllocationMagnitude(context),
      scoreConcentrationChange(context),
      scoreEsgProximity(context),
      scoreMandateDeviation(context),
      scoreFactorTilt(context),
      scoreCrossMandateCorrelation(context),
    ];

    // Chinese wall violation attempt
    if (context?.chineseWallViolation) {
      factors.push({ name: 'chinese-wall-violation', impact: 90, reason: 'Attempted access to pre-publication research — CHINESE WALL breach' });
    }

    // Order submission attempt (outside authority)
    if (context?.orderSubmitAttempt) {
      factors.push({ name: 'authority-breach', impact: 90, reason: 'Attempted direct order submission — propose-only authority violated' });
    }

    // Full portfolio reconstruction
    if (context?.fullReconstruction) {
      factors.push({ name: 'full-reconstruction', impact: 20, reason: 'Full portfolio reconstruction — escalate to Sentinel AI' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    // SEC Advisers Act fiduciary
    if (context?.ipsConcentrationProximityPct >= 90) {
      flags.push({
        flag: 'SEC-Advisers-Act-fiduciary',
        reason: 'Near IPS concentration limit — fiduciary duty requires PM review',
        action: 'escalate-to-pm',
      });
    }

    // SFDR Art.8/9
    if (context?.esgScoreMarginAboveMin !== undefined && context.esgScoreMarginAboveMin <= 5) {
      flags.push({
        flag: 'SFDR-Art.8/9',
        reason: `ESG margin only ${context.esgScoreMarginAboveMin}pts — near SFDR commitment breach`,
        action: 'escalate-to-cco',
        severity: context.esgScoreMarginAboveMin <= 0 ? 'critical' : 'elevated',
      });
    }

    // SR 11-7 model risk
    if (context?.fullReconstruction) {
      flags.push({
        flag: 'SR-11-7',
        reason: 'Full portfolio reconstruction — model risk review required',
        action: 'log-and-review',
      });
    }

    // Chinese wall
    if (context?.chineseWallViolation) {
      flags.push({
        flag: 'SEC-Reg-FD',
        reason: 'Pre-publication research access attempt — information barrier breach',
        action: 'critical-escalate-cco',
        severity: 'critical',
      });
    }

    // ERISA
    if (context?.erisaMandate) {
      flags.push({
        flag: 'ERISA-fiduciary',
        reason: 'ERISA mandate — prudent expert standard applies to optimization output',
        action: 'log',
      });
    }

    return flags;
  }
}

// ── Rebalancer Risk Model ───────────────────────────────────────────────

class RebalancerRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('rebalancer', { baselineScore: 3, ...config });
    this.riskBudget = { dailyLimit: 300, hourlyLimit: 30, softThreshold: 15 };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [
      scoreAllocationMagnitude(context),
      scoreConcentrationChange(context),
    ];

    // Drift measurement
    const driftPct = context?.maxDriftPct || 0;
    if (driftPct > 10) {
      factors.push({ name: 'drift-magnitude', impact: 12, reason: `${driftPct}% max drift — significant deviation from target` });
    } else if (driftPct > 5) {
      factors.push({ name: 'drift-magnitude', impact: 5, reason: `${driftPct}% max drift — moderate` });
    } else {
      factors.push({ name: 'drift-magnitude', impact: 1, reason: `${driftPct}% max drift — within threshold` });
    }

    // Transaction cost estimate
    const txCostBps = context?.estimatedTxCostBps || 0;
    if (txCostBps > 50) {
      factors.push({ name: 'transaction-cost', impact: 10, reason: `${txCostBps}bps estimated cost — exceeds cost budget` });
    } else if (txCostBps > 20) {
      factors.push({ name: 'transaction-cost', impact: 4, reason: `${txCostBps}bps estimated cost — moderate` });
    }

    // Order submission attempt
    if (context?.orderSubmitAttempt) {
      factors.push({ name: 'authority-breach', impact: 90, reason: 'Attempted direct order submission — trade-list-only authority violated' });
    }

    // Tax lot selection for ERISA mandate
    if (context?.erisaTaxLotSelection) {
      factors.push({ name: 'erisa-tax-lot', impact: 3, reason: 'ERISA mandate tax lot optimization — elevated audit attention' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    if (context?.erisaTaxLotSelection) {
      flags.push({
        flag: 'ERISA-fiduciary',
        reason: 'ERISA mandate rebalancing — tax lot method must be documented',
        action: 'log',
      });
    }

    if (context?.estimatedTxCostBps > 50) {
      flags.push({
        flag: 'MiFID-II-Art.27',
        reason: `${context.estimatedTxCostBps}bps cost estimate — best execution documentation required`,
        action: 'log',
      });
    }

    if (context?.orderSubmitAttempt) {
      flags.push({
        flag: 'SEC-Advisers-Act-fiduciary',
        reason: 'Direct order submission attempt — rebalancer has no execution authority',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Allocation Advisor Risk Model ───────────────────────────────────────

class AllocationAdvisorRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('allocation-advisor', { baselineScore: 5, ...config });
    this.riskBudget = { dailyLimit: 200, hourlyLimit: 20, softThreshold: 20 };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [
      scoreAllocationMagnitude(context),
      scoreConcentrationChange(context),
      scoreEsgProximity(context),
    ];

    // Human approval gate bypass attempt
    if (context?.approvalBypassAttempt) {
      factors.push({ name: 'approval-bypass', impact: 95, reason: 'Attempted to bypass human approval gate — EU AI Act Art.14 violation' });
    }

    // Self-promotion to active allocation
    if (context?.selfPromotionAttempt) {
      factors.push({ name: 'self-promotion', impact: 95, reason: 'Attempted to promote own proposal to active allocation — SOE boundary violated' });
    }

    // Write to non-proposals path
    if (context?.writeOutsideProposals) {
      factors.push({ name: 'write-isolation-breach', impact: 90, reason: 'Attempted write outside proposals directory — write isolation violated' });
    }

    // Macro regime change
    if (context?.macroRegimeShift) {
      factors.push({ name: 'macro-regime-shift', impact: 8, reason: 'Proposal during macro regime transition — elevated review needed' });
    }

    // ERISA rationale requirement
    if (context?.erisaMandate && !context?.erisaRationaleIncluded) {
      factors.push({ name: 'erisa-rationale-missing', impact: 12, reason: 'ERISA mandate proposal without rationale document — compliance gap' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    // EU AI Act Art.14 — human oversight
    flags.push({
      flag: 'EU-AI-Act-Art.14',
      reason: 'All allocation proposals require human approval per Art.14 human oversight',
      action: 'enforce-approval-gate',
    });

    if (context?.approvalBypassAttempt) {
      flags.push({
        flag: 'EU-AI-Act-Art.14-violation',
        reason: 'Human approval gate bypass attempted — CRITICAL compliance violation',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.erisaMandate) {
      flags.push({
        flag: 'ERISA-fiduciary',
        reason: 'ERISA mandate — prudent expert rationale required with every proposal',
        action: context?.erisaRationaleIncluded ? 'log' : 'block-until-rationale',
      });
    }

    if (context?.selfPromotionAttempt) {
      flags.push({
        flag: 'SEC-Advisers-Act-fiduciary',
        reason: 'Self-promotion of proposal to active — separation of duties violated',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Factor Analyst Risk Model ───────────────────────────────────────────

class FactorAnalystRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('factor-analyst', { baselineScore: 3, ...config });
    this.riskBudget = { dailyLimit: 400, hourlyLimit: 40, softThreshold: 10 };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [
      scoreFactorTilt(context),
    ];

    // Production write attempt (should be impossible)
    if (context?.productionWriteAttempt) {
      factors.push({ name: 'production-write', impact: 90, reason: 'Attempted write to production system — read-only authority violated' });
    }

    // Cross-portfolio attribution scope
    const portfoliosAnalyzed = context?.portfoliosAnalyzed || 1;
    if (portfoliosAnalyzed > 20) {
      factors.push({ name: 'analysis-scope', impact: 8, reason: `${portfoliosAnalyzed} portfolios analyzed — broad firm-level sweep` });
    } else if (portfoliosAnalyzed > 5) {
      factors.push({ name: 'analysis-scope', impact: 3, reason: `${portfoliosAnalyzed} portfolios analyzed — multi-mandate analysis` });
    } else {
      factors.push({ name: 'analysis-scope', impact: 0, reason: 'Single/few portfolio analysis — routine' });
    }

    // Unintended tilt detection
    const unintendedTilts = context?.unintendedTiltsDetected || 0;
    if (unintendedTilts > 3) {
      factors.push({ name: 'unintended-tilts', impact: 8, reason: `${unintendedTilts} unintended factor tilts detected — optimizer may need constraint update` });
    } else if (unintendedTilts > 0) {
      factors.push({ name: 'unintended-tilts', impact: 3, reason: `${unintendedTilts} unintended tilt(s) — flagged for optimizer review` });
    }

    // Model version mismatch
    if (context?.factorModelVersion !== context?.approvedFactorModelVersion && context?.approvedFactorModelVersion) {
      factors.push({ name: 'model-version-mismatch', impact: 10, reason: `Running factor model ${context.factorModelVersion}, approved is ${context.approvedFactorModelVersion}` });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    // SR 11-7 model risk management
    flags.push({
      flag: 'SR-11-7',
      reason: 'Factor analysis — model performance monitoring evidence',
      action: 'log',
    });

    if (context?.factorModelVersion !== context?.approvedFactorModelVersion && context?.approvedFactorModelVersion) {
      flags.push({
        flag: 'SR-11-7-version',
        reason: `Unapproved factor model version ${context.factorModelVersion}`,
        action: 'escalate-to-mvc',
      });
    }

    if (context?.productionWriteAttempt) {
      flags.push({
        flag: 'SEC-Advisers-Act-fiduciary',
        reason: 'Factor-analyst attempted production write — read-only authority violated',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const MODELS = {
  'portfolio-optimizer': PortfolioOptimizerRiskModel,
  'rebalancer': RebalancerRiskModel,
  'allocation-advisor': AllocationAdvisorRiskModel,
  'factor-analyst': FactorAnalystRiskModel,
};

function createRiskModel(agentId, config = {}) {
  const ModelClass = MODELS[agentId];
  if (!ModelClass) return new BaseRiskModel(agentId, config);
  return new ModelClass(config);
}

function listModels() {
  return Object.keys(MODELS);
}

export {
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
};

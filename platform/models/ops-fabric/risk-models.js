/**
 * Risk Models — OpsFabric Application
 *
 * Domain-specific Arbiter risk scoring for OpsFabric agents:
 *   - SettlementProcessorRiskModel (high-volume, deadline-driven)
 *   - ReconcilerRiskModel (read-only analysis, source immutability)
 *   - NavCalculatorRiskModel (preliminary NAV only, dual-approval gate)
 *
 * EU AI Act: LIMITED risk classification, but financial accuracy requirements
 * make governance critical regardless. A wrong SWIFT BIC creates a fail.
 * A stale price creates a NAV restatement.
 *
 * Regulatory basis:
 *   - CSDR Art.7 (settlement discipline, buy-in), Art.29 (settlement instruction records)
 *   - EMIR Art.20 (CCP clearing records)
 *   - SOX 404 (internal controls — NAV, reconciliation)
 *   - SEC Rule 31a-2 (fund books and records)
 *   - ASC 820 / IFRS 13 (fair value measurement)
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

// ── Settlement Processor Risk Model ──────────────────────────────────────

class SettlementProcessorRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('settlement-processor', { baselineScore: 3, ...config });
    this.riskBudget = { dailyLimit: 800, hourlyLimit: 100, onDemandBurst: 30 };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Factor 1: Settlement deadline proximity
    const minutesToCutoff = context?.minutesToT1Cutoff;
    if (minutesToCutoff !== undefined) {
      if (minutesToCutoff <= 0) {
        factors.push({ name: 'deadline-proximity', impact: 25, reason: 'Past T+1 cutoff — instructions may fail' });
      } else if (minutesToCutoff <= 30) {
        factors.push({ name: 'deadline-proximity', impact: 20, reason: `${minutesToCutoff}min to T+1 cutoff — critical window` });
      } else if (minutesToCutoff <= 60) {
        factors.push({ name: 'deadline-proximity', impact: 12, reason: `${minutesToCutoff}min to cutoff — escalation threshold` });
      } else {
        factors.push({ name: 'deadline-proximity', impact: 0, reason: 'Well before T+1 cutoff' });
      }
    }

    // Factor 2: Open fail rate (trailing 5 days)
    const failRate = context?.openFailRatePct || 0;
    if (failRate > 3) {
      factors.push({ name: 'fail-rate', impact: 20, reason: `${failRate}% fail rate — COO escalation threshold` });
    } else if (failRate > 1.5) {
      factors.push({ name: 'fail-rate', impact: 12, reason: `${failRate}% fail rate — ops team alert` });
    } else if (failRate > 0) {
      factors.push({ name: 'fail-rate', impact: 3, reason: `${failRate}% fail rate — within tolerance` });
    }

    // Factor 3: CSDR buy-in proximity
    const daysSinceFail = context?.businessDaysSinceFail || 0;
    if (daysSinceFail >= 7) {
      factors.push({ name: 'csdr-buyin', impact: 25, reason: `T+${daysSinceFail} — bond buy-in threshold reached` });
    } else if (daysSinceFail >= 4) {
      factors.push({ name: 'csdr-buyin', impact: 20, reason: `T+${daysSinceFail} — equity buy-in threshold / bond escalation` });
    } else if (daysSinceFail >= 3) {
      factors.push({ name: 'csdr-buyin', impact: 10, reason: `T+${daysSinceFail} — CSDR escalation threshold` });
    }

    // Factor 4: SSI match failure rate
    const ssiMismatchRate = context?.ssiMismatchRatePct || 0;
    if (ssiMismatchRate > 2) {
      factors.push({ name: 'ssi-mismatch', impact: 10, reason: `${ssiMismatchRate}% SSI mismatch rate — above daily threshold` });
    }

    // Factor 5: CCP routing error
    if (context?.ccpRoutingErrors > 0) {
      factors.push({ name: 'ccp-routing-error', impact: 15 * Math.min(context.ccpRoutingErrors, 3), reason: `${context.ccpRoutingErrors} CCP routing error(s) — EMIR implications` });
    }

    // Factor 6: CSDR penalty accrual
    const dailyPenalty = context?.dailyCsdrPenaltyUSD || 0;
    if (dailyPenalty > 10000) {
      factors.push({ name: 'penalty-accrual', impact: 10, reason: `$${dailyPenalty.toLocaleString()} daily CSDR penalty — above threshold` });
    } else if (dailyPenalty > 0) {
      factors.push({ name: 'penalty-accrual', impact: 3, reason: `$${dailyPenalty.toLocaleString()} daily CSDR penalty` });
    }

    // Custodian account management attempt (CRITICAL)
    if (context?.accountManagementAttempt) {
      factors.push({ name: 'account-mgmt-attempt', impact: 90, reason: 'Attempted custodian account management — outside authorized scope' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    if (context?.businessDaysSinceFail >= 4) {
      flags.push({
        flag: 'CSDR-Art.7-buyin',
        reason: `Settlement fail at T+${context.businessDaysSinceFail} — buy-in procedure required`,
        action: 'escalate-buyin-workflow',
      });
    }

    if (context?.ccpRoutingErrors > 0) {
      flags.push({
        flag: 'EMIR-Art.20',
        reason: 'CCP routing failure — EMIR clearing record requirements',
        action: 'log-and-alert',
      });
    }

    if (context?.dailyCsdrPenaltyUSD > 10000) {
      flags.push({
        flag: 'CSDR-Art.7-penalty',
        reason: `Daily penalty $${context.dailyCsdrPenaltyUSD.toLocaleString()} — accelerated accrual`,
        action: 'alert-coo',
      });
    }

    return flags;
  }
}

// ── Reconciler Risk Model ────────────────────────────────────────────────

class ReconcilerRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('reconciler', { baselineScore: 2, ...config });
    this.riskBudget = { dailyLimit: 500, hourlyLimit: 60, onDemandBurst: 15 };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Factor 1: Break age
    const maxBreakAgeDays = context?.maxBreakAgeDays || 0;
    if (maxBreakAgeDays > 5) {
      factors.push({ name: 'break-age', impact: 20, reason: `Oldest break is ${maxBreakAgeDays} days — immediate escalation` });
    } else if (maxBreakAgeDays > 3) {
      factors.push({ name: 'break-age', impact: 10, reason: `Oldest break is ${maxBreakAgeDays} days — aging concern` });
    } else if (maxBreakAgeDays > 0) {
      factors.push({ name: 'break-age', impact: 3, reason: `Oldest break is ${maxBreakAgeDays} days` });
    }

    // Factor 2: Break dollar value
    const maxBreakValueUSD = context?.maxBreakValueUSD || 0;
    if (maxBreakValueUSD > 500000) {
      factors.push({ name: 'break-value', impact: 20, reason: `$${maxBreakValueUSD.toLocaleString()} break — immediate escalation` });
    } else if (maxBreakValueUSD > 100000) {
      factors.push({ name: 'break-value', impact: 10, reason: `$${maxBreakValueUSD.toLocaleString()} break — elevated` });
    } else if (maxBreakValueUSD > 0) {
      factors.push({ name: 'break-value', impact: 2, reason: `$${maxBreakValueUSD.toLocaleString()} break — within tolerance` });
    }

    // Factor 3: Break volume trend
    const breakCountRatio = context?.breakCountVs4WeekAvg || 1.0;
    if (breakCountRatio > 1.5) {
      factors.push({ name: 'break-volume-trend', impact: 12, reason: `${Math.round(breakCountRatio * 100)}% of 4-week average — spike detected` });
    } else if (breakCountRatio > 1.2) {
      factors.push({ name: 'break-volume-trend', impact: 5, reason: `${Math.round(breakCountRatio * 100)}% of 4-week average — slightly elevated` });
    }

    // Factor 4: Unclassified break rate
    const unclassifiedPct = context?.unclassifiedBreakPct || 0;
    if (unclassifiedPct > 5) {
      factors.push({ name: 'unclassified-breaks', impact: 10, reason: `${unclassifiedPct}% unclassifiable — possible new break type` });
    }

    // Factor 5: Corporate action miss rate
    const caMissRate = context?.caMissRatePct || 0;
    if (caMissRate > 2) {
      factors.push({ name: 'ca-miss-rate', impact: 12, reason: `${caMissRate}% CA miss rate — above threshold` });
    }

    // Factor 6: Custodian concentration
    const custodianConcentrationPct = context?.custodianConcentrationPct || 0;
    if (custodianConcentrationPct > 60) {
      factors.push({ name: 'custodian-concentration', impact: 10, reason: `${custodianConcentrationPct}% breaks at one custodian — systemic issue` });
    }

    // Source record modification attempt (CRITICAL)
    if (context?.sourceRecordWriteAttempt) {
      factors.push({ name: 'source-record-write', impact: 85, reason: 'Attempted write to source records — compromises reconciliation integrity' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    if (context?.sourceRecordWriteAttempt) {
      flags.push({
        flag: 'SOX-404-control-failure',
        reason: 'Source record modification attempt — reconciliation integrity compromised',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.maxBreakValueUSD > 500000) {
      flags.push({
        flag: 'SOX-404-material-misstatement',
        reason: `$${context.maxBreakValueUSD.toLocaleString()} break may indicate material misstatement`,
        action: 'escalate-to-coo',
      });
    }

    return flags;
  }
}

// ── NAV Calculator Risk Model ────────────────────────────────────────────

class NavCalculatorRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('nav-calculator', { baselineScore: 5, ...config });
    this.riskBudget = { dailyLimit: 300, hourlyLimit: 40, onDemandBurst: 10 };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];
    const destination = toolInput?.destination || toolInput?.path || '';

    // CRITICAL: Any attempt to write to published NAV path
    if (destination.includes('nav/published') || toolName.includes('publish-nav') || toolName.includes('approve-nav') || toolName.includes('distribute-nav')) {
      return [{ name: 'nav-publication-attempt', impact: 95, reason: 'CRITICAL — attempted write to published NAV path. Dual-approval gate violated.' }];
    }

    // Factor 1: Stale price count
    const stalePricePct = context?.stalePriceByNavWeightPct || 0;
    if (stalePricePct > 2) {
      factors.push({ name: 'stale-prices', impact: 15, reason: `${stalePricePct}% of NAV weight has stale prices — fund accountant alert` });
    } else if (stalePricePct > 0) {
      factors.push({ name: 'stale-prices', impact: 5, reason: `${stalePricePct}% stale prices — within tolerance` });
    }

    // Factor 2: Level 3 concentration
    const level3Pct = context?.level3PctOfNav || 0;
    if (level3Pct > 15) {
      factors.push({ name: 'level3-concentration', impact: 15, reason: `${level3Pct}% Level 3 — exceeds AIFMD disclosure threshold` });
    } else if (level3Pct > 5) {
      factors.push({ name: 'level3-concentration', impact: 8, reason: `${level3Pct}% Level 3 — elevated fair value uncertainty` });
    }

    // Factor 3: Pricing source fallback rate increase
    const fallbackRateIncrease = context?.pricingFallbackRateIncreasePct || 0;
    if (fallbackRateIncrease > 20) {
      factors.push({ name: 'pricing-fallback', impact: 10, reason: `${fallbackRateIncrease}% increase in pricing fallbacks week-over-week` });
    }

    // Factor 4: NAV delivery timeline
    const minutesToTarget = context?.minutesToNavTarget;
    if (minutesToTarget !== undefined) {
      if (minutesToTarget <= 0) {
        factors.push({ name: 'nav-delivery', impact: 20, reason: 'Past 4:30 PM target — preliminary NAV delayed' });
      } else if (minutesToTarget <= 30) {
        factors.push({ name: 'nav-delivery', impact: 12, reason: `${minutesToTarget}min to 4:30 PM target — escalation` });
      }
    }

    // Factor 5: Dual-approval pending duration
    const pendingMinutes = context?.dualApprovalPendingMinutes || 0;
    if (pendingMinutes > 60) {
      factors.push({ name: 'approval-pending', impact: 15, reason: `NAV pending review for ${pendingMinutes}min — COO escalation` });
    } else if (pendingMinutes > 30) {
      factors.push({ name: 'approval-pending', impact: 8, reason: `NAV pending review for ${pendingMinutes}min` });
    }

    // Factor 6: Pricing data feed availability
    if (context?.pricingFeedDown) {
      factors.push({ name: 'feed-unavailable', impact: 20, reason: `Pricing feed ${context.pricingFeedDown} unavailable during NAV window` });
    }

    // Pricing override attempt (CRITICAL)
    if (context?.pricingOverrideAttempt) {
      factors.push({ name: 'pricing-override', impact: 90, reason: 'Attempted to override pricing data — integrity violation' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];
    const destination = toolInput?.destination || toolInput?.path || '';

    if (destination.includes('nav/published') || toolName.includes('publish-nav')) {
      flags.push({
        flag: 'SOX-404-dual-approval',
        reason: 'NAV publication without dual approval — SOX 404 control failure',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.level3PctOfNav > 15) {
      flags.push({
        flag: 'ASC-820-Level3',
        reason: `${context.level3PctOfNav}% Level 3 assets — ASC 820/IFRS 13 disclosure required`,
        action: 'flag-for-disclosure',
      });
    }

    if (context?.stalePriceByNavWeightPct > 2) {
      flags.push({
        flag: 'SEC-Rule-31a-2',
        reason: 'Stale pricing exceptions must be documented in fund records',
        action: 'log',
      });
    }

    return flags;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const MODELS = {
  'settlement-processor': SettlementProcessorRiskModel,
  'reconciler': ReconcilerRiskModel,
  'nav-calculator': NavCalculatorRiskModel,
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
  SettlementProcessorRiskModel,
  ReconcilerRiskModel,
  NavCalculatorRiskModel,
  createRiskModel,
  listModels,
};

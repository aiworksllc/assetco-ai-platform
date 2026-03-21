/**
 * Risk Models — TradeSentinel Application
 *
 * Domain-specific Arbiter risk scoring for TradeSentinel agents:
 *   - OrderRouterRiskModel (order-routing-only, EUR 500K human approval gate)
 *   - ExecutionMonitorRiskModel (alert-only, MAR Art.12 abuse detection)
 *   - TcaAnalyzerRiskModel (read-only-post-trade, batch analysis)
 *
 * Risk is cumulative and non-decreasing during trading day. Full reset at market open.
 * Category D events (chinese wall, SoD violation, bypass attempts) = 500 units = immediate freeze.
 *
 * Risk Categories:
 *   A: Execution Volume (order size, frequency, venue concentration)
 *   B: Execution Quality Deviation (slippage, IS cost, fill rate)
 *   C: Compliance Signals (NBBO failure, mandate fail, approval bypass)
 *   D: Security & Integrity (chinese wall, SoD violation, injection, bypass)
 *
 * Thresholds: Green (0-30), Yellow (31-60), Red (61-85), Critical (86-100)
 *
 * Regulatory basis:
 *   - MiFID II Art.27 (best execution), Art.25 (suitability)
 *   - Reg NMS Rule 611 (NBBO trade-through prohibition)
 *   - MAR Art.12 (market manipulation), Art.16 (STR obligation)
 *   - EU AI Act Art.14 (human oversight)
 *   - SR 11-7 (model risk management)
 */

// ── Base Risk Model ──────────────────────────────────────────────────────

class BaseRiskModel {
  constructor(agentId, config = {}) {
    this.agentId = agentId;
    this.config = {
      baselineScore: 3,
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

// ── Order Router Risk Model ─────────────────────────────────────────────

class OrderRouterRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('order-router', { baselineScore: 3, ...config });
    this.riskBudget = { dailyLimit: 1000, escalateAt: 800, freezeOnBreach: true };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Category A: Execution Volume
    const notional = context?.orderNotional || 0;
    if (notional > 10000000) {
      factors.push({ name: 'order-size', impact: 25, reason: `$${(notional / 1e6).toFixed(1)}M notional — institutional-size order` });
    } else if (notional > 1000000) {
      factors.push({ name: 'order-size', impact: 10, reason: `$${(notional / 1e6).toFixed(1)}M notional — block-level order` });
    } else if (notional > 100000) {
      factors.push({ name: 'order-size', impact: 5, reason: `$${(notional / 1000).toFixed(0)}K notional — elevated impact potential` });
    } else {
      factors.push({ name: 'order-size', impact: 2, reason: 'Standard order size' });
    }

    // ADV concentration
    const advPct = context?.orderPctOfAdv || 0;
    if (advPct > 5) {
      factors.push({ name: 'adv-concentration', impact: 15, reason: `${advPct}% of instrument ADV — market impact escalation` });
    }

    // Venue concentration
    const venueConcentrationPct = context?.singleVenueConcentrationPct || 0;
    if (venueConcentrationPct > 80) {
      factors.push({ name: 'venue-concentration', impact: 20, reason: `${venueConcentrationPct}% to single venue — routing anomaly` });
    }

    // Category C: Compliance Signals
    if (context?.nbboViolationAttempt) {
      factors.push({ name: 'nbbo-violation', impact: 50, reason: 'NBBO trade-through attempt — Reg NMS Rule 611 violation blocked' });
    }

    if (context?.mandateCheckFail) {
      factors.push({ name: 'mandate-check-fail', impact: 50, reason: 'Mandate compliance failure — restricted instrument or concentration breach' });
    }

    if (context?.mandateConcentrationBreach) {
      factors.push({ name: 'mandate-concentration', impact: 40, reason: 'Order would breach mandate concentration limit' });
    }

    if (context?.humanApprovalBypass) {
      factors.push({ name: 'approval-bypass', impact: 90, reason: '>EUR 500K order without human approval — EU AI Act Art.14 violation' });
    }

    // Category D: Security
    if (context?.chineseWallViolation) {
      factors.push({ name: 'chinese-wall-violation', impact: 95, reason: 'Attempted read of pre-publication research — CHINESE WALL breach' });
    }

    if (context?.soeBypassAttempt) {
      factors.push({ name: 'soe-bypass', impact: 95, reason: 'SOE bypass flag detected in tool call — integrity violation' });
    }

    if (context?.restrictedSecurityAttempt) {
      factors.push({ name: 'restricted-security', impact: 50, reason: 'Attempted trade of restricted security — blocked' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    // MiFID II Art.27 best execution
    flags.push({
      flag: 'MiFID-II-Art.27',
      reason: 'Best execution documentation required for all order routing decisions',
      action: 'log',
    });

    if (context?.nbboViolationAttempt) {
      flags.push({
        flag: 'Reg-NMS-Rule-611',
        reason: 'NBBO trade-through attempt blocked — trade-through prohibition',
        action: 'block-and-log',
        severity: 'critical',
      });
    }

    if (context?.mandateCheckFail) {
      flags.push({
        flag: 'MiFID-II-Art.25',
        reason: 'Mandate compliance failure — suitability control triggered',
        action: 'block-and-escalate',
      });
    }

    if (context?.humanApprovalBypass) {
      flags.push({
        flag: 'EU-AI-Act-Art.14',
        reason: 'Human approval gate bypassed — Art.14 oversight violation',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.chineseWallViolation) {
      flags.push({
        flag: 'MAR-Art.10',
        reason: 'Pre-publication research access — information barrier breach',
        action: 'critical-escalate-cco',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Execution Monitor Risk Model ────────────────────────────────────────

class ExecutionMonitorRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('execution-monitor', { baselineScore: 2, ...config });
    this.riskBudget = { dailyLimit: 500, escalateAt: 400, freezeOnBreach: false };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Category B: Execution Quality
    const slippageBps = context?.slippageVsVwapBps || 0;
    if (slippageBps > 25) {
      factors.push({ name: 'severe-slippage', impact: 20, reason: `${slippageBps}bp slippage vs VWAP — severe execution deterioration` });
    } else if (slippageBps > 10) {
      factors.push({ name: 'slippage', impact: 5, reason: `${slippageBps}bp slippage vs VWAP — above threshold` });
    }

    const dailyIsCostBps = context?.cumulativeDailyIsCostBps || 0;
    if (dailyIsCostBps > 15) {
      factors.push({ name: 'daily-is-cost', impact: 30, reason: `${dailyIsCostBps}bp cumulative daily IS cost — systematic quality problem` });
    }

    const fillRate = context?.venueFillRatePct;
    if (fillRate !== undefined && fillRate < 40) {
      factors.push({ name: 'low-fill-rate', impact: 10, reason: `${fillRate}% venue fill rate — below 40% threshold` });
    }

    const fillTimeMultiple = context?.fillTimeVsHistorical || 1;
    if (fillTimeMultiple > 3) {
      factors.push({ name: 'slow-fill', impact: 8, reason: `${fillTimeMultiple}x historical fill time — execution timing anomaly` });
    }

    const partialFillPct = context?.partialFillPct;
    if (partialFillPct !== undefined && partialFillPct < 50 && context?.tifExpired) {
      factors.push({ name: 'partial-fill-expired', impact: 12, reason: `${partialFillPct}% filled with TIF expired — opportunity cost` });
    }

    // Market abuse pattern detection (MAR Art.12)
    if (context?.marPatternDetected) {
      const patternCost = context.marPatternSeverity === 'high' ? 25 : 15;
      factors.push({ name: 'mar-pattern', impact: patternCost, reason: `MAR Art.12 pattern: ${context.marPatternType || 'unknown'} — STR candidate` });
    }

    // STR draft creation
    if (context?.strDraftCreated) {
      factors.push({ name: 'str-draft', impact: 20, reason: 'STR draft created — MAR Art.16 filing obligation triggered' });
    }

    // Category D: Security
    if (context?.chineseWallViolation) {
      factors.push({ name: 'chinese-wall-violation', impact: 95, reason: 'Attempted read of pre-publication research — CHINESE WALL breach' });
    }

    if (context?.orderModifyAttempt) {
      factors.push({ name: 'sod-violation', impact: 95, reason: 'Attempted order modification — alert-only authority violated' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    if (context?.marPatternDetected) {
      flags.push({
        flag: 'MAR-Art.12',
        reason: `Market abuse pattern detected: ${context.marPatternType || 'unknown'}`,
        action: 'create-str-draft',
        severity: context.marPatternSeverity === 'high' ? 'critical' : 'elevated',
      });
    }

    if (context?.strDraftCreated) {
      flags.push({
        flag: 'MAR-Art.16',
        reason: 'STR draft created — compliance officer review within 15min SLA',
        action: 'route-to-compliance',
      });
    }

    if (context?.chineseWallViolation) {
      flags.push({
        flag: 'MAR-Art.10',
        reason: 'Information barrier breach attempt — pre-publication research access',
        action: 'critical-escalate-cco',
        severity: 'critical',
      });
    }

    if (context?.orderModifyAttempt) {
      flags.push({
        flag: 'MiFID-II-Art.17',
        reason: 'Surveillance agent attempted order modification — separation of duties violated',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.cumulativeDailyIsCostBps > 15) {
      flags.push({
        flag: 'MiFID-II-Art.27',
        reason: `${context.cumulativeDailyIsCostBps}bp daily IS cost — systematic best execution concern`,
        action: 'escalate-head-of-trading',
      });
    }

    return flags;
  }
}

// ── TCA Analyzer Risk Model ─────────────────────────────────────────────

class TcaAnalyzerRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('tca-analyzer', { baselineScore: 2, ...config });
    this.riskBudget = { dailyLimit: 100, escalateAt: 70, freezeOnBreach: true };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Report generation
    const ordersAnalysed = context?.ordersAnalysed || 0;
    if (ordersAnalysed > 10000) {
      factors.push({ name: 'batch-scope', impact: 10, reason: `${ordersAnalysed} orders in batch — large analysis scope` });
    } else if (ordersAnalysed > 1000) {
      factors.push({ name: 'batch-scope', impact: 5, reason: `${ordersAnalysed} orders in batch — standard scope` });
    } else {
      factors.push({ name: 'batch-scope', impact: 1, reason: 'Small batch or single order analysis' });
    }

    // RTS 28 report generation
    if (context?.rts28Report) {
      factors.push({ name: 'rts28-report', impact: 5, reason: 'RTS 28 regulatory report generated — requires human review before publication' });
    }

    // Category D: Security
    if (context?.chineseWallViolation) {
      factors.push({ name: 'chinese-wall-violation', impact: 95, reason: 'Attempted access to research data — CHINESE WALL breach' });
    }

    if (context?.liveDataAccessAttempt) {
      factors.push({ name: 'live-data-access', impact: 95, reason: 'Attempted access to live market data or active orders — post-trade-only authority violated' });
    }

    if (context?.orderWriteAttempt) {
      factors.push({ name: 'sod-violation', impact: 95, reason: 'Attempted write to trading path — read-only authority violated' });
    }

    if (context?.soeBypassAttempt) {
      factors.push({ name: 'soe-bypass', impact: 95, reason: 'SOE bypass flag detected — integrity violation' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    if (context?.rts28Report) {
      flags.push({
        flag: 'MiFID-II-RTS28',
        reason: 'RTS 28 quarterly report generated — requires compliance officer review before regulatory filing',
        action: 'require-human-review',
      });
    }

    // SR 11-7 ongoing monitoring
    flags.push({
      flag: 'SR-11-7',
      reason: 'TCA analysis — execution model performance monitoring evidence',
      action: 'log',
    });

    if (context?.chineseWallViolation) {
      flags.push({
        flag: 'MAR-Art.10',
        reason: 'Chinese wall breach attempt by post-trade analyst',
        action: 'critical-escalate-cco',
        severity: 'critical',
      });
    }

    if (context?.liveDataAccessAttempt || context?.orderWriteAttempt) {
      flags.push({
        flag: 'MiFID-II-Art.17',
        reason: 'Post-trade agent attempted live/write access — separation of duties violated',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const MODELS = {
  'order-router': OrderRouterRiskModel,
  'execution-monitor': ExecutionMonitorRiskModel,
  'tca-analyzer': TcaAnalyzerRiskModel,
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
  OrderRouterRiskModel,
  ExecutionMonitorRiskModel,
  TcaAnalyzerRiskModel,
  createRiskModel,
  listModels,
};

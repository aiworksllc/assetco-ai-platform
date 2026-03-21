/**
 * Risk Models — ResearchNexus Application
 *
 * Domain-specific Arbiter risk scoring for ResearchNexus agents:
 *   - MarketAnalystRiskModel (NLP processing, SEC filings, earnings analysis)
 *   - EsgScorerRiskModel (PAI computation, SFDR disclosures, ESG provider data quality)
 *   - SentimentAnalyzerRiskModel (news/social sentiment, signal manipulation detection)
 *   - FairValueModelerRiskModel (Level 2/3 valuation, ASC 820, NAV impact)
 *
 * ResearchNexus has the most consequential information barrier risk profile:
 * Chinese wall violations propagate into front-running liability and regulatory enforcement.
 * Any trading-related data access attempt is unconditionally CRITICAL.
 *
 * Risk Categories:
 *   A: Chinese Wall Proximity (unconditionally CRITICAL — all agents)
 *   B: Pre-Publication Leakage (HIGH — attempt to expose pre-pub data)
 *   C: Data Quality & Integrity (MEDIUM-HIGH — ESG gaps, valuation deviations, sentiment anomalies)
 *   D: Security & Integrity (CRITICAL — NAV write, accounting access, evidence tampering)
 *
 * Thresholds: Green (0-30), Yellow (31-60), Red (61-85), Critical (86-100)
 *
 * Regulatory basis:
 *   - MAR Art.10 (information barriers / Chinese wall)
 *   - Reg FD (fair disclosure — pre-publication controls)
 *   - SFDR Art.4/6/8/9 (sustainability disclosures)
 *   - ASC 820 / IFRS 13 (fair value measurement)
 *   - EU AI Act Art.12 (traceability)
 *   - SEC Rule 204-2 (investment adviser books and records)
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
      explanation: this._explain(factors, regulatoryFlags),
      model: this.constructor.name,
      modelVersion: '1.0.0',
      scoredAt: new Date().toISOString(),
    };
  }

  _computeFactors(_toolName, _toolInput, _context) { return []; }
  _checkRegulatoryFlags(_toolName, _toolInput, _riskScore, _context) { return []; }

  _explain(factors, regulatoryFlags) {
    const parts = factors.filter(f => f.impact > 0).map(f => `${f.name}: +${f.impact}`);
    if (regulatoryFlags.length) parts.push(`flags: ${regulatoryFlags.join(', ')}`);
    return parts.join('; ') || 'baseline only';
  }
}

// ── Chinese Wall Detection (shared across all agents) ────────────────────

const CHINESE_WALL_PATTERNS = [
  /^(read|glob|list)\s+(trading|orders|executions|positions)\//i,
  /^(read|glob|list)\s+portfolios\/model\//i,
  /^(write|edit)\s+(trading|orders|executions|positions)\//i,
  /curl\s+.*\b(trading|positions|orders|bloomberg-oms|flextrade)\b/i,
];

function isChineseWallViolation(toolName) {
  return CHINESE_WALL_PATTERNS.some(p => p.test(toolName));
}

// ── Pre-Publication Leakage Detection ────────────────────────────────────

const LEAKAGE_PATTERNS = [
  /^(write|edit)\s+research\/published\//i,
  /^(cp|mv|ln)\s+.*research\/pre-publication\/.*\s+(?!research\/pre-publication\/)/i,
  /^bash\s+.*research\/pre-publication\/.*\|\s*/i,
];

function isPrePublicationLeakage(toolName) {
  return LEAKAGE_PATTERNS.some(p => p.test(toolName));
}

// ── Market Analyst Risk Model ────────────────────────────────────────────

class MarketAnalystRiskModel extends BaseRiskModel {
  constructor(config) {
    super('market-analyst', { baselineScore: 3, ...config });
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Category A: Chinese wall
    if (isChineseWallViolation(toolName)) {
      factors.push({ name: 'chinese-wall-violation', impact: 95, category: 'A' });
      return factors; // short-circuit — nothing else matters
    }

    // Category B: Pre-publication leakage
    if (isPrePublicationLeakage(toolName)) {
      factors.push({ name: 'pre-publication-leakage', impact: 80, category: 'B' });
      return factors;
    }

    // Category C: Research operations
    if (/nlp_processor|transcript_parser|filing_analyzer/.test(toolName)) {
      factors.push({ name: 'nlp-processing', impact: 2, category: 'C' });
    }

    if (/curl\s+https:\/\/(efts\.sec\.gov|data\.sec\.gov)/.test(toolName)) {
      factors.push({ name: 'sec-edgar-api', impact: 3, category: 'C' });
    }

    if (/^write\s+research\/pre-publication\/analysis\//.test(toolName)) {
      factors.push({ name: 'analysis-write', impact: 5, category: 'C' });
    }

    if (/^read\s+data\/broker-research\//.test(toolName)) {
      factors.push({ name: 'broker-research-read', impact: 2, category: 'C' });
    }

    // Category C: Volume tracking
    if (context.sessionCallCount > 200) {
      factors.push({ name: 'high-call-volume', impact: 10, category: 'C' });
    }

    // Earnings season burst
    if (context.earningsSeason) {
      factors.push({ name: 'earnings-season-burst', impact: 5, category: 'C' });
    }

    // Category D: ESG data access (denied for market-analyst)
    if (/^read\s+data\/esg-(providers|pai)\//.test(toolName)) {
      factors.push({ name: 'esg-data-unauthorized', impact: 40, category: 'D' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, _toolInput, riskScore, _context) {
    const flags = [];
    if (isChineseWallViolation(toolName)) flags.push('MAR_ART10', 'REG_FD', 'SEC_204A');
    if (isPrePublicationLeakage(toolName)) flags.push('REG_FD');
    if (riskScore > 85) flags.push('EU_AI_ACT_ART12');
    return flags;
  }
}

// ── ESG Scorer Risk Model ────────────────────────────────────────────────

class EsgScorerRiskModel extends BaseRiskModel {
  constructor(config) {
    super('esg-scorer', { baselineScore: 3, ...config });
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Category A: Chinese wall
    if (isChineseWallViolation(toolName)) {
      factors.push({ name: 'chinese-wall-violation', impact: 95, category: 'A' });
      return factors;
    }

    // Category B: Pre-publication leakage
    if (isPrePublicationLeakage(toolName)) {
      factors.push({ name: 'pre-publication-leakage', impact: 80, category: 'B' });
      return factors;
    }

    // Category C: ESG operations
    if (/pai_calculator|taxonomy_mapper|esg_scorer/.test(toolName)) {
      factors.push({ name: 'esg-computation', impact: 3, category: 'C' });
    }

    if (/curl\s+https:\/\/api\.(msci|sustainalytics|cdp)/.test(toolName)) {
      factors.push({ name: 'esg-provider-api', impact: 5, category: 'C' });
    }

    if (/^write\s+compliance\/sfdr\//.test(toolName)) {
      factors.push({ name: 'sfdr-disclosure-write', impact: 10, category: 'C' });
    }

    if (/^write\s+research\/pre-publication\/esg\//.test(toolName)) {
      factors.push({ name: 'esg-score-write', impact: 5, category: 'C' });
    }

    // Category C: Data quality
    if (context.dataCoverage !== undefined && context.dataCoverage < 70) {
      factors.push({ name: 'low-data-coverage', impact: 25, category: 'C' });
      if (context.dataCoverage < 50) {
        factors.push({ name: 'critical-data-gap', impact: 30, category: 'C' });
      }
    }

    if (context.staleData) {
      factors.push({ name: 'stale-esg-data', impact: 15, category: 'C' });
    }

    if (context.providerOutage) {
      factors.push({ name: 'esg-provider-outage', impact: 20, category: 'C' });
    }

    if (context.dataVersionMismatch) {
      factors.push({ name: 'data-version-mismatch', impact: 25, category: 'C' });
    }

    // Category D: Portfolio write attempt
    if (/^(write|edit)\s+portfolios\//.test(toolName)) {
      factors.push({ name: 'portfolio-write-attempt', impact: 95, category: 'D' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, _toolInput, riskScore, context) {
    const flags = [];
    if (isChineseWallViolation(toolName)) flags.push('MAR_ART10', 'REG_FD');
    if (isPrePublicationLeakage(toolName)) flags.push('REG_FD');
    if (/sfdr/.test(toolName)) flags.push('SFDR_ART4');
    if (context.dataCoverage !== undefined && context.dataCoverage < 50) flags.push('SFDR_DATA_QUALITY');
    if (riskScore > 85) flags.push('EU_AI_ACT_ART12');
    return flags;
  }
}

// ── Sentiment Analyzer Risk Model ────────────────────────────────────────

class SentimentAnalyzerRiskModel extends BaseRiskModel {
  constructor(config) {
    super('sentiment-analyzer', { baselineScore: 3, ...config });
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Category A: Chinese wall
    if (isChineseWallViolation(toolName)) {
      factors.push({ name: 'chinese-wall-violation', impact: 95, category: 'A' });
      return factors;
    }

    // Category B: Pre-publication leakage
    if (isPrePublicationLeakage(toolName)) {
      factors.push({ name: 'pre-publication-leakage', impact: 80, category: 'B' });
      return factors;
    }

    // Category C: Sentiment operations
    if (/sentiment_analyzer|consensus_tracker|social_signal_processor/.test(toolName)) {
      factors.push({ name: 'sentiment-processing', impact: 2, category: 'C' });
    }

    if (/curl\s+https:\/\/(stream\.twitter|oauth\.reddit)/.test(toolName)) {
      factors.push({ name: 'social-media-api', impact: 3, category: 'C' });
    }

    if (/^write\s+research\/pre-publication\/sentiment\//.test(toolName)) {
      factors.push({ name: 'sentiment-signal-write', impact: 5, category: 'C' });
    }

    // Category C: Anomaly detection (Beacon signals)
    if (context.sentimentReversalPct > 80) {
      factors.push({ name: 'sentiment-reversal-anomaly', impact: 40, category: 'C' });
    }

    if (context.extremeValueCluster) {
      factors.push({ name: 'extreme-value-cluster', impact: 35, category: 'C' });
    }

    if (context.anomalousSocialVolume) {
      factors.push({ name: 'anomalous-social-volume', impact: 30, category: 'C' });
    }

    if (context.promptInjectionDetected) {
      factors.push({ name: 'prompt-injection-detected', impact: 50, category: 'C' });
    }

    // Category C: Volume
    if (context.newsBurst) {
      factors.push({ name: 'news-burst', impact: 5, category: 'C' });
    }

    // Category D: Order flow access (extra deny)
    if (/^read\s+data\/market-data\/orderflow\//.test(toolName)) {
      factors.push({ name: 'orderflow-access-attempt', impact: 60, category: 'D' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, _toolInput, riskScore, context) {
    const flags = [];
    if (isChineseWallViolation(toolName)) flags.push('MAR_ART10', 'REG_FD');
    if (isPrePublicationLeakage(toolName)) flags.push('REG_FD');
    if (context.promptInjectionDetected) flags.push('EU_AI_ACT_ART15');
    if (context.sentimentReversalPct > 80) flags.push('MAR_ART12');
    if (riskScore > 85) flags.push('EU_AI_ACT_ART12');
    return flags;
  }
}

// ── Fair Value Modeler Risk Model ────────────────────────────────────────

class FairValueModelerRiskModel extends BaseRiskModel {
  constructor(config) {
    super('fair-value-modeler', { baselineScore: 3, ...config });
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Category A: Chinese wall
    if (isChineseWallViolation(toolName)) {
      factors.push({ name: 'chinese-wall-violation', impact: 95, category: 'A' });
      return factors;
    }

    // Category B: Pre-publication leakage
    if (isPrePublicationLeakage(toolName)) {
      factors.push({ name: 'pre-publication-leakage', impact: 80, category: 'B' });
      return factors;
    }

    // Category C: Valuation operations
    if (/dcf_model|comparables_analysis|fair_value_calculator|level3_rollforward/.test(toolName)) {
      factors.push({ name: 'valuation-computation', impact: 5, category: 'C' });
    }

    if (/^write\s+research\/pre-publication\/valuations\//.test(toolName)) {
      factors.push({ name: 'valuation-write', impact: 8, category: 'C' });
    }

    // Category C: Deviation thresholds
    if (context.level2DeviationPct > 5) {
      factors.push({ name: 'level2-deviation', impact: 25, category: 'C' });
    }

    if (context.level3DeviationPct > 10) {
      factors.push({ name: 'level3-deviation', impact: 35, category: 'C' });
    }

    if (context.navImpactPct > 0.5) {
      factors.push({ name: 'material-nav-impact', impact: 45, category: 'C' });
    }

    if (context.fvHierarchyLevel === 3) {
      factors.push({ name: 'level3-asset', impact: 10, category: 'C' });
    }

    // Category D: NAV/accounting write attempt
    if (/^(write|edit)\s+(portfolios\/nav|accounting)\//i.test(toolName)) {
      factors.push({ name: 'nav-accounting-write', impact: 95, category: 'D' });
    }

    if (/^(write|edit)\s+portfolios\//.test(toolName)) {
      factors.push({ name: 'portfolio-write-attempt', impact: 95, category: 'D' });
    }

    if (/curl\s+.*(nav-system|portfolio-accounting)/i.test(toolName)) {
      factors.push({ name: 'nav-system-access', impact: 90, category: 'D' });
    }

    if (/INSERT INTO.*nav|UPDATE.*nav/i.test(toolName)) {
      factors.push({ name: 'nav-database-write', impact: 95, category: 'D' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, _toolInput, riskScore, context) {
    const flags = [];
    if (isChineseWallViolation(toolName)) flags.push('MAR_ART10', 'REG_FD');
    if (isPrePublicationLeakage(toolName)) flags.push('REG_FD');
    if (context.fvHierarchyLevel === 3) flags.push('ASC_820_LEVEL3');
    if (context.level2DeviationPct > 5 || context.level3DeviationPct > 10) flags.push('ASC_820_DEVIATION');
    if (context.navImpactPct > 0.5) flags.push('ICA_RULE_22C1');
    if (/nav|accounting/i.test(toolName)) flags.push('ICA_RULE_22C1');
    if (riskScore > 85) flags.push('EU_AI_ACT_ART12');
    return flags;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const MODELS = {
  'market-analyst': MarketAnalystRiskModel,
  'esg-scorer': EsgScorerRiskModel,
  'sentiment-analyzer': SentimentAnalyzerRiskModel,
  'fair-value-modeler': FairValueModelerRiskModel,
};

function createRiskModel(agentId, config) {
  const ModelClass = MODELS[agentId];
  if (!ModelClass) throw new Error(`Unknown ResearchNexus agent: ${agentId}`);
  return new ModelClass(config);
}

function listModels() { return Object.keys(MODELS); }

export {
  BaseRiskModel,
  MarketAnalystRiskModel,
  EsgScorerRiskModel,
  SentimentAnalyzerRiskModel,
  FairValueModelerRiskModel,
  createRiskModel,
  listModels,
  isChineseWallViolation,
  isPrePublicationLeakage,
};

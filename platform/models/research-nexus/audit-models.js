/**
 * Audit Models — ResearchNexus Application
 *
 * Domain-specific Chronicle audit classification for ResearchNexus agents:
 *   - MarketAnalystAuditModel (research generation, SEC filing analysis, earnings analysis)
 *   - EsgScorerAuditModel (PAI computation, SFDR disclosures, ESG data quality)
 *   - SentimentAnalyzerAuditModel (sentiment signals, anomaly detection)
 *   - FairValueModelerAuditModel (Level 2/3 valuations, ASC 820 documentation)
 *
 * Audit Categories:
 *   - research-generation (5yr — SEC Rule 204-2)
 *   - esg-scoring (7yr — SFDR Art.4)
 *   - sentiment-signal (5yr — SEC Rule 204-2)
 *   - fair-value-estimate (10yr — ASC 820 / IFRS 13)
 *   - publication-gate-transition (5yr — SEC Rule 204-2)
 *   - chinese-wall-violation-attempt (10yr — MAR Art.7/8, Reg FD)
 *   - pre-publication-leakage-attempt (10yr — Reg FD, securities law)
 *   - esg-data-quality-alert (7yr — SFDR, ESMA guidelines)
 *   - fair-value-deviation-alert (10yr — ASC 820 / IFRS 13)
 *   - sentiment-anomaly (5yr — SEC Rule 204-2)
 *   - agent-suspension (10yr — EU AI Act Art.12)
 *   - model-version-change (deployment + 5yr — EU AI Act Art.12)
 */

import { randomUUID } from 'node:crypto';

// ── Retention Schedule ───────────────────────────────────────────────────

const RETENTION = {
  'research-generation':             { years: 5,  reason: 'SEC Rule 204-2 — investment adviser books and records' },
  'esg-scoring':                     { years: 7,  reason: 'SFDR Art.4 PAI disclosure retention; ESMA sustainability guidelines' },
  'sentiment-signal':                { years: 5,  reason: 'SEC Rule 204-2 — investment adviser books and records' },
  'fair-value-estimate':             { years: 10, reason: 'ASC 820 / IFRS 13 fair value documentation' },
  'publication-gate-transition':     { years: 5,  reason: 'SEC Rule 204-2 — research publication workflow' },
  'chinese-wall-violation-attempt':  { years: 10, reason: 'MAR Art.7/8 insider dealing investigation; Reg FD enforcement' },
  'pre-publication-leakage-attempt': { years: 10, reason: 'Reg FD — potential securities law violation record' },
  'esg-data-quality-alert':          { years: 7,  reason: 'SFDR, ESMA guidelines — sustainability data quality' },
  'fair-value-deviation-alert':      { years: 10, reason: 'ASC 820 / IFRS 13 — model deviation evidence' },
  'sentiment-anomaly':               { years: 5,  reason: 'SEC Rule 204-2 — sentiment manipulation investigation' },
  'agent-suspension':                { years: 10, reason: 'EU AI Act Art.12 — traceability; internal investigation record' },
  'model-version-change':            { years: 5,  reason: 'EU AI Act Art.12 — model version traceability' },
};

// ── Regulatory Frameworks ────────────────────────────────────────────────

const FRAMEWORKS = {
  MAR_ART10: { framework: 'MAR', articles: [{ ref: 'Art.10', scope: 'information-barrier' }] },
  MAR_ART12: { framework: 'MAR', articles: [{ ref: 'Art.12', scope: 'market-manipulation' }] },
  REG_FD: { framework: 'Reg FD', articles: [{ ref: 'Reg-FD', scope: 'fair-disclosure' }] },
  SEC_204_2: { framework: 'SEC Rule 204-2', articles: [{ ref: 'Rule-204-2', scope: 'books-and-records' }] },
  SEC_204A: { framework: 'SEC Advisers Act', articles: [{ ref: 'Section-204A', scope: 'insider-trading-prevention' }] },
  SFDR_ART4: { framework: 'SFDR', articles: [{ ref: 'Art.4', scope: 'principal-adverse-impact' }] },
  SFDR_ART8: { framework: 'SFDR', articles: [{ ref: 'Art.8', scope: 'environmental-social-characteristics' }] },
  EU_TAXONOMY: { framework: 'EU Taxonomy', articles: [{ ref: 'Art.8', scope: 'taxonomy-alignment' }] },
  ASC_820: { framework: 'ASC 820', articles: [{ ref: 'ASC-820', scope: 'fair-value-measurement' }] },
  IFRS_13: { framework: 'IFRS 13', articles: [{ ref: 'IFRS-13', scope: 'fair-value-measurement' }] },
  EU_AI_ACT_ART12: { framework: 'EU AI Act', articles: [{ ref: 'Art.12', scope: 'traceability' }] },
  EU_AI_ACT_ART15: { framework: 'EU AI Act', articles: [{ ref: 'Art.15', scope: 'accuracy-robustness-cybersecurity' }] },
  ICA_22C1: { framework: 'Investment Company Act', articles: [{ ref: 'Rule-22c-1', scope: 'nav-publication' }] },
};

// ── Base Audit Model ─────────────────────────────────────────────────────

class BaseAuditModel {
  constructor(agentId) {
    this.agentId = agentId;
    this.allowedContextKeys = [
      'chineseWallViolation', 'attemptedPath', 'pathCategory', 'matchedDenyRule', 'denySource',
      'prePublicationLeakageAttempt', 'leakageVector',
      'researchItemId', 'security', 'itemType', 'fromState', 'toState',
      'paiIndicatorId', 'fundId', 'dataCoverage', 'staleData', 'providerOutage', 'dataVersionMismatch',
      'fvHierarchyLevel', 'fairValueEstimate', 'valuationTechnique', 'deviationPct', 'navImpactPct',
      'sentimentReversalPct', 'extremeValueCluster', 'anomalousSocialVolume', 'promptInjectionDetected',
      'sessionRiskScore', 'suspensionReason',
    ];
  }

  classify(event, context = {}) {
    const { auditCategory, eventType, severity, impactArea, compliance } = this._classify(event, context);
    const retention = RETENTION[auditCategory] || { years: 5, reason: 'default retention' };
    const safeContext = {};
    for (const key of this.allowedContextKeys) {
      if (context[key] !== undefined) safeContext[key] = context[key];
    }

    return {
      recordId: `aud-${randomUUID().slice(0, 12)}`,
      timestamp: new Date().toISOString(),
      agentId: this.agentId,
      model: this.constructor.name,
      event: {
        decision: event.decision || 'allow',
        toolName: event.toolName || '',
        riskScore: event.riskScore ?? 0,
        reason: event.reason || null,
      },
      auditCategory,
      eventType,
      severity,
      impactArea,
      compliance,
      retention,
      context: safeContext,
    };
  }

  _classify(_event, _context) {
    return {
      auditCategory: 'research-generation',
      eventType: 'generic',
      severity: 'low',
      impactArea: 'research',
      compliance: [],
    };
  }

  _buildCompliance(...frameworkKeys) {
    return frameworkKeys
      .filter(k => FRAMEWORKS[k])
      .map(k => FRAMEWORKS[k]);
  }
}

// ── Market Analyst Audit Model ───────────────────────────────────────────

class MarketAnalystAuditModel extends BaseAuditModel {
  constructor() { super('market-analyst'); }

  _classify(event, context) {
    const tool = event.toolName || '';

    // Chinese wall violation
    if (context.chineseWallViolation) {
      return {
        auditCategory: 'chinese-wall-violation-attempt',
        eventType: 'chinese-wall-violation-attempt',
        severity: 'critical',
        impactArea: 'information-security',
        compliance: this._buildCompliance('MAR_ART10', 'SEC_204A', 'REG_FD'),
      };
    }

    // Pre-publication leakage
    if (context.prePublicationLeakageAttempt) {
      return {
        auditCategory: 'pre-publication-leakage-attempt',
        eventType: 'pre-publication-leakage-blocked',
        severity: 'high',
        impactArea: 'information-security',
        compliance: this._buildCompliance('REG_FD', 'SEC_204_2'),
      };
    }

    // Publication gate transition
    if (context.fromState && context.toState) {
      return {
        auditCategory: 'publication-gate-transition',
        eventType: `transition-${context.fromState}-to-${context.toState}`,
        severity: context.toState === 'published' ? 'high' : 'low',
        impactArea: 'research',
        compliance: this._buildCompliance('SEC_204_2', 'REG_FD'),
      };
    }

    // Research generation
    if (/^write\s+research\/pre-publication\/analysis\//.test(tool)) {
      return {
        auditCategory: 'research-generation',
        eventType: 'analysis-written',
        severity: 'low',
        impactArea: 'research',
        compliance: this._buildCompliance('SEC_204_2'),
      };
    }

    // SEC EDGAR access
    if (/curl\s+https:\/\/(efts\.sec\.gov|data\.sec\.gov)/.test(tool)) {
      return {
        auditCategory: 'research-generation',
        eventType: 'sec-edgar-query',
        severity: 'low',
        impactArea: 'research',
        compliance: this._buildCompliance('SEC_204_2'),
      };
    }

    return {
      auditCategory: 'research-generation',
      eventType: 'general-research-operation',
      severity: 'low',
      impactArea: 'research',
      compliance: this._buildCompliance('SEC_204_2'),
    };
  }
}

// ── ESG Scorer Audit Model ───────────────────────────────────────────────

class EsgScorerAuditModel extends BaseAuditModel {
  constructor() { super('esg-scorer'); }

  _classify(event, context) {
    const tool = event.toolName || '';

    // Chinese wall violation
    if (context.chineseWallViolation) {
      return {
        auditCategory: 'chinese-wall-violation-attempt',
        eventType: 'chinese-wall-violation-attempt',
        severity: 'critical',
        impactArea: 'information-security',
        compliance: this._buildCompliance('MAR_ART10', 'SEC_204A', 'REG_FD'),
      };
    }

    // Pre-publication leakage
    if (context.prePublicationLeakageAttempt) {
      return {
        auditCategory: 'pre-publication-leakage-attempt',
        eventType: 'pre-publication-leakage-blocked',
        severity: 'high',
        impactArea: 'information-security',
        compliance: this._buildCompliance('REG_FD', 'SEC_204_2'),
      };
    }

    // ESG data quality alert
    if (context.dataCoverage !== undefined && context.dataCoverage < 70) {
      const severity = context.dataCoverage < 50 ? 'critical' : 'medium';
      return {
        auditCategory: 'esg-data-quality-alert',
        eventType: context.dataCoverage < 50 ? 'critical-data-gap' : 'low-data-coverage',
        severity,
        impactArea: 'esg-data-quality',
        compliance: this._buildCompliance('SFDR_ART4', 'EU_TAXONOMY'),
      };
    }

    if (context.staleData) {
      return {
        auditCategory: 'esg-data-quality-alert',
        eventType: 'stale-data-detected',
        severity: 'medium',
        impactArea: 'esg-data-quality',
        compliance: this._buildCompliance('SFDR_ART4'),
      };
    }

    if (context.providerOutage) {
      return {
        auditCategory: 'esg-data-quality-alert',
        eventType: 'provider-outage',
        severity: 'medium',
        impactArea: 'esg-data-quality',
        compliance: this._buildCompliance('SFDR_ART4'),
      };
    }

    // SFDR disclosure write
    if (/^write\s+compliance\/sfdr\//.test(tool)) {
      return {
        auditCategory: 'esg-scoring',
        eventType: 'sfdr-disclosure-written',
        severity: 'medium',
        impactArea: 'esg-compliance',
        compliance: this._buildCompliance('SFDR_ART4', 'SFDR_ART8', 'EU_TAXONOMY'),
      };
    }

    // ESG scoring
    if (/^write\s+research\/pre-publication\/esg\//.test(tool) || /esg_scorer|pai_calculator|taxonomy_mapper/.test(tool)) {
      return {
        auditCategory: 'esg-scoring',
        eventType: 'esg-score-computed',
        severity: 'low',
        impactArea: 'esg-research',
        compliance: this._buildCompliance('SFDR_ART4', 'EU_TAXONOMY'),
      };
    }

    return {
      auditCategory: 'esg-scoring',
      eventType: 'general-esg-operation',
      severity: 'low',
      impactArea: 'esg-research',
      compliance: this._buildCompliance('SFDR_ART4'),
    };
  }
}

// ── Sentiment Analyzer Audit Model ───────────────────────────────────────

class SentimentAnalyzerAuditModel extends BaseAuditModel {
  constructor() { super('sentiment-analyzer'); }

  _classify(event, context) {
    const tool = event.toolName || '';

    // Chinese wall violation
    if (context.chineseWallViolation) {
      return {
        auditCategory: 'chinese-wall-violation-attempt',
        eventType: 'chinese-wall-violation-attempt',
        severity: 'critical',
        impactArea: 'information-security',
        compliance: this._buildCompliance('MAR_ART10', 'SEC_204A', 'REG_FD'),
      };
    }

    // Pre-publication leakage
    if (context.prePublicationLeakageAttempt) {
      return {
        auditCategory: 'pre-publication-leakage-attempt',
        eventType: 'pre-publication-leakage-blocked',
        severity: 'high',
        impactArea: 'information-security',
        compliance: this._buildCompliance('REG_FD', 'SEC_204_2'),
      };
    }

    // Sentiment anomaly
    if (context.sentimentReversalPct > 80 || context.extremeValueCluster || context.anomalousSocialVolume) {
      return {
        auditCategory: 'sentiment-anomaly',
        eventType: context.promptInjectionDetected ? 'prompt-injection-detected' : 'sentiment-signal-anomaly',
        severity: context.promptInjectionDetected ? 'critical' : 'high',
        impactArea: 'signal-integrity',
        compliance: this._buildCompliance('SEC_204_2', context.promptInjectionDetected ? 'EU_AI_ACT_ART15' : 'MAR_ART12'),
      };
    }

    if (context.promptInjectionDetected) {
      return {
        auditCategory: 'sentiment-anomaly',
        eventType: 'prompt-injection-detected',
        severity: 'critical',
        impactArea: 'signal-integrity',
        compliance: this._buildCompliance('EU_AI_ACT_ART15', 'SEC_204_2'),
      };
    }

    // Sentiment signal generation
    if (/^write\s+research\/pre-publication\/sentiment\//.test(tool)) {
      return {
        auditCategory: 'sentiment-signal',
        eventType: 'sentiment-signal-generated',
        severity: 'low',
        impactArea: 'research',
        compliance: this._buildCompliance('SEC_204_2'),
      };
    }

    return {
      auditCategory: 'sentiment-signal',
      eventType: 'general-sentiment-operation',
      severity: 'low',
      impactArea: 'research',
      compliance: this._buildCompliance('SEC_204_2'),
    };
  }
}

// ── Fair Value Modeler Audit Model ───────────────────────────────────────

class FairValueModelerAuditModel extends BaseAuditModel {
  constructor() { super('fair-value-modeler'); }

  _classify(event, context) {
    const tool = event.toolName || '';

    // Chinese wall violation
    if (context.chineseWallViolation) {
      return {
        auditCategory: 'chinese-wall-violation-attempt',
        eventType: 'chinese-wall-violation-attempt',
        severity: 'critical',
        impactArea: 'information-security',
        compliance: this._buildCompliance('MAR_ART10', 'SEC_204A', 'REG_FD'),
      };
    }

    // Pre-publication leakage
    if (context.prePublicationLeakageAttempt) {
      return {
        auditCategory: 'pre-publication-leakage-attempt',
        eventType: 'pre-publication-leakage-blocked',
        severity: 'high',
        impactArea: 'information-security',
        compliance: this._buildCompliance('REG_FD', 'SEC_204_2'),
      };
    }

    // Fair value deviation alert
    if (context.deviationPct !== undefined) {
      const isLevel3 = context.fvHierarchyLevel === 3;
      const threshold = isLevel3 ? 10 : 5;
      if (context.deviationPct > threshold) {
        return {
          auditCategory: 'fair-value-deviation-alert',
          eventType: isLevel3 ? 'level3-deviation-alert' : 'level2-deviation-alert',
          severity: context.navImpactPct > 0.5 ? 'critical' : 'high',
          impactArea: 'valuation-integrity',
          compliance: this._buildCompliance('ASC_820', 'IFRS_13', context.navImpactPct > 0.5 ? 'ICA_22C1' : 'SEC_204_2'),
        };
      }
    }

    // NAV write attempt
    if (/^(write|edit)\s+(portfolios\/nav|accounting)\//i.test(tool)) {
      return {
        auditCategory: 'agent-suspension',
        eventType: 'nav-accounting-write-blocked',
        severity: 'critical',
        impactArea: 'fund-operations',
        compliance: this._buildCompliance('ICA_22C1', 'ASC_820'),
      };
    }

    // Fair value estimate
    if (/^write\s+research\/pre-publication\/valuations\//.test(tool) || /dcf_model|comparables_analysis|fair_value_calculator|level3_rollforward/.test(tool)) {
      const severity = context.fvHierarchyLevel === 3 ? 'medium' : 'low';
      return {
        auditCategory: 'fair-value-estimate',
        eventType: context.fvHierarchyLevel === 3 ? 'level3-fair-value-computed' : 'fair-value-computed',
        severity,
        impactArea: 'valuation',
        compliance: this._buildCompliance('ASC_820', 'IFRS_13', 'SEC_204_2'),
      };
    }

    return {
      auditCategory: 'fair-value-estimate',
      eventType: 'general-valuation-operation',
      severity: 'low',
      impactArea: 'valuation',
      compliance: this._buildCompliance('ASC_820', 'SEC_204_2'),
    };
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const MODELS = {
  'market-analyst': MarketAnalystAuditModel,
  'esg-scorer': EsgScorerAuditModel,
  'sentiment-analyzer': SentimentAnalyzerAuditModel,
  'fair-value-modeler': FairValueModelerAuditModel,
};

function createAuditModel(agentId) {
  const ModelClass = MODELS[agentId];
  if (!ModelClass) throw new Error(`Unknown ResearchNexus agent: ${agentId}`);
  return new ModelClass();
}

function listModels() { return Object.keys(MODELS); }

export {
  BaseAuditModel,
  MarketAnalystAuditModel,
  EsgScorerAuditModel,
  SentimentAnalyzerAuditModel,
  FairValueModelerAuditModel,
  createAuditModel,
  listModels,
  RETENTION,
  FRAMEWORKS,
};

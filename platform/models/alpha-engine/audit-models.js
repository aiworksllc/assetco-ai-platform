/**
 * Audit Models — AlphaEngine Application
 *
 * Chronicle audit classification for AlphaEngine agents. Each event is classified
 * into one of 7 audit categories with structured schemas and retention policies.
 *
 * Audit Categories:
 *   1. portfolio-optimization — optimizer run with full input/output (7yr)
 *   2. rebalance-trigger — drift detection and trade list generation (7yr)
 *   3. allocation-proposal — advisor proposals pending human approval (7yr)
 *   4. factor-analysis — factor exposure reports and attribution (5yr)
 *   5. fiduciary-constraint-enforced — IPS/ESG/TE limit enforcement (7yr)
 *   6. ips-violation-attempt — IPS breach attempts (7yr)
 *   7. chinese-wall-block — information barrier enforcement (7yr)
 *
 * Regulatory basis:
 *   - SEC Advisers Act / Rule 204-2 (books and records, 7yr)
 *   - MiFID II Art.25 (suitability records)
 *   - SFDR Art.8/9 (ESG commitment evidence)
 *   - ERISA §107 (records retention)
 *   - SR 11-7 (model risk management)
 *   - EU AI Act Art.12 (record-keeping), Art.14 (human oversight)
 */

// ── Regulatory Framework Mappings ────────────────────────────────────────

const SEC_ADVISERS = {
  'Rule-204-2': { title: 'Books and records — investment decision documentation' },
  'Reg-FD':     { title: 'Fair disclosure — information barrier requirements' },
};

const MIFID_II = {
  'Art.25':  { title: 'Suitability — assessment records' },
  'Art.27':  { title: 'Best execution — transaction cost documentation' },
};

const SFDR = {
  'Art.8':  { title: 'SFDR Article 8 — environmental/social promotion' },
  'Art.9':  { title: 'SFDR Article 9 — sustainable investment objective' },
};

const ERISA = {
  '§107':  { title: 'ERISA records retention — 6yr minimum' },
  '§404':  { title: 'ERISA fiduciary duty — prudent expert standard' },
};

const SR_11_7 = {
  'ongoing-monitoring': { title: 'Model performance monitoring' },
  'model-validation':   { title: 'Independent model validation evidence' },
};

const EU_AI_ACT = {
  'Art.12': { title: 'Record-keeping — HIGH RISK AI systems' },
  'Art.14': { title: 'Human oversight — human-in-the-loop requirement' },
};

// ── Retention Schedule ──────────────────────────────────────────────────

const RETENTION = {
  'portfolio-optimization':        { days: 2555, years: 7, tier: 'S3 Glacier after 2yr', reason: 'SEC Rule 204-2; MiFID II Art.25 suitability' },
  'rebalance-trigger':             { days: 2555, years: 7, tier: 'S3 Glacier after 2yr', reason: 'SEC Rule 204-2; ERISA §107' },
  'allocation-proposal':           { days: 2555, years: 7, tier: 'S3 Glacier after 2yr', reason: 'SEC Rule 204-2; EU AI Act Art.14 oversight evidence' },
  'factor-analysis':               { days: 1825, years: 5, tier: 'S3 Glacier after 1yr', reason: 'SR 11-7 model performance monitoring' },
  'fiduciary-constraint-enforced': { days: 2555, years: 7, tier: 'S3 Standard', reason: 'SEC fiduciary duty documentation' },
  'ips-violation-attempt':         { days: 2555, years: 7, tier: 'S3 Standard', reason: 'SEC Rule 204-2 + model risk' },
  'chinese-wall-block':            { days: 2555, years: 7, tier: 'S3 Standard', reason: 'SEC information barrier program' },
  'sfdr-compliance':               { days: 3650, years: 10, tier: 'S3 Glacier after 2yr', reason: 'SFDR RTS retention requirement' },
};

// ── Base Audit Model ────────────────────────────────────────────────────

class BaseAuditModel {
  constructor(agentId) {
    this.agentId = agentId;
  }

  classify(event, context = {}) {
    const category = this._categorize(event, context);
    const compliance = this._mapCompliance(event, category, context);
    const severity = this._assessSeverity(event, category);
    const retention = this._retentionPolicy(category);

    return {
      recordId: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      agentId: this.agentId,
      model: `alpha-engine-${this.agentId}-audit-v1`,

      event: {
        decision: event.decision,
        toolName: event.toolName,
        toolInput: this._sanitizeInput(event.toolInput),
        riskScore: event.riskScore,
        reason: event.reason,
      },

      auditCategory: category.name,
      eventType: category.eventType,
      severity,
      impactArea: category.impactArea,

      compliance,
      retention,
      context: this._sanitizeContext(context),
    };
  }

  _categorize(event, _context) {
    if (event.decision === 'deny') {
      return { name: 'fiduciary-constraint-enforced', eventType: 'policy-enforcement', impactArea: 'compliance' };
    }
    if (event.decision === 'escalate') {
      return { name: 'fiduciary-constraint-enforced', eventType: 'human-oversight-required', impactArea: 'compliance' };
    }
    return { name: 'portfolio-optimization', eventType: 'normal-operation', impactArea: 'investment' };
  }

  _mapCompliance(event, _category, _context) {
    const frameworks = [];

    // EU AI Act Art.12 — always logged for HIGH RISK
    frameworks.push({
      framework: 'EU AI Act',
      articles: [{ ref: 'Art.12', ...EU_AI_ACT['Art.12'], status: 'compliant' }],
    });

    if (event.decision === 'deny' || event.decision === 'escalate') {
      frameworks.push({
        framework: 'EU AI Act',
        articles: [{ ref: 'Art.14', ...EU_AI_ACT['Art.14'], status: event.decision === 'escalate' ? 'escalated-to-human' : 'auto-blocked' }],
      });
    }

    return frameworks;
  }

  _assessSeverity(event, _category) {
    if (event.riskScore >= 86) return 'critical';
    if (event.riskScore >= 61) return 'high';
    if (event.decision === 'deny') return 'high';
    if (event.decision === 'escalate') return 'medium';
    return 'low';
  }

  _retentionPolicy(category) {
    return RETENTION[category.name] || { days: 2555, years: 7, tier: 'S3 Standard', reason: 'SEC Rule 204-2 minimum' };
  }

  _sanitizeInput(toolInput) {
    if (!toolInput) return {};
    const sanitized = { ...toolInput };
    if (sanitized.content && typeof sanitized.content === 'string' && sanitized.content.length > 500) {
      sanitized.content = `[${sanitized.content.length} chars — truncated for audit]`;
    }
    return sanitized;
  }

  _sanitizeContext(context) {
    const safe = {};
    const allowedKeys = [
      'mandateId', 'optimizationRunId', 'rebalanceRunId', 'proposalId',
      'reportId', 'portfolioId', 'tradeListId',
      'aggregateWeightChangePct', 'ipsConcentrationProximityPct',
      'esgScoreMarginAboveMin', 'trackingErrorBudgetUsedPct',
      'maxFactorTiltSD', 'correlatedMandatesPct',
      'driftPct', 'estimatedTxCostBps', 'taxLotMethod',
      'macroRegime', 'erisaMandate', 'erisaRationaleIncluded',
      'humanApprovalRequired', 'approverIdentity', 'approvalTimestamp',
      'factorModelVersion', 'portfoliosAnalyzed', 'unintendedTiltsDetected',
      'level3Pct', 'sfdrArticle',
    ];
    for (const key of allowedKeys) {
      if (context[key] !== undefined) safe[key] = context[key];
    }
    return safe;
  }
}

// ── Portfolio Optimizer Audit Model ─────────────────────────────────────

class PortfolioOptimizerAuditModel extends BaseAuditModel {
  constructor() { super('portfolio-optimizer'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // Chinese wall violation attempt
    if (toolName.includes('pre-publication') || toolName.includes('research-nexus/staging') || context?.chineseWallViolation) {
      return { name: 'chinese-wall-block', eventType: 'information-barrier-breach-attempt', impactArea: 'compliance' };
    }

    // IPS violation attempt (concentration or tracking error breach)
    if (context?.ipsConcentrationProximityPct >= 100 || context?.trackingErrorBudgetUsedPct > 100) {
      return { name: 'ips-violation-attempt', eventType: 'ips-limit-breach', impactArea: 'fiduciary' };
    }

    // ESG floor breach
    if (context?.esgScoreMarginAboveMin !== undefined && context.esgScoreMarginAboveMin <= 0) {
      return { name: 'fiduciary-constraint-enforced', eventType: 'esg-floor-enforced', impactArea: 'compliance' };
    }

    // Normal optimization
    if (toolName.includes('optimization') || toolName.includes('optimize') || toolName.includes('backtest')) {
      return { name: 'portfolio-optimization', eventType: 'optimization-run', impactArea: 'investment' };
    }

    // Factor computation
    if (toolName.includes('factor.compute')) {
      return { name: 'portfolio-optimization', eventType: 'factor-computation', impactArea: 'investment' };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = super._mapCompliance(event, category, context);

    if (category.name === 'portfolio-optimization') {
      frameworks.push({
        framework: 'SEC',
        articles: [{ ref: 'Rule-204-2', ...SEC_ADVISERS['Rule-204-2'], status: 'investment-decision-logged' }],
      });
      if (context?.erisaMandate) {
        frameworks.push({
          framework: 'ERISA',
          articles: [{ ref: '§107', ...ERISA['§107'], status: 'fiduciary-record' }],
        });
      }
      if (context?.sfdrArticle) {
        frameworks.push({
          framework: 'SFDR',
          articles: [{ ref: `Art.${context.sfdrArticle}`, title: `SFDR Article ${context.sfdrArticle} commitment`, status: 'esg-evidence-logged' }],
        });
      }
    }

    if (category.name === 'chinese-wall-block') {
      frameworks.push({
        framework: 'SEC',
        articles: [{ ref: 'Reg-FD', ...SEC_ADVISERS['Reg-FD'], status: 'barrier-enforced' }],
      });
    }

    if (category.name === 'ips-violation-attempt' || category.name === 'fiduciary-constraint-enforced') {
      frameworks.push({
        framework: 'SEC',
        articles: [{ ref: 'Rule-204-2', ...SEC_ADVISERS['Rule-204-2'], status: 'constraint-enforcement-logged' }],
      });
    }

    return frameworks;
  }

  _assessSeverity(event, category) {
    if (category.name === 'chinese-wall-block') return 'critical';
    if (category.name === 'ips-violation-attempt') return 'critical';
    if (category.eventType === 'esg-floor-enforced') return 'critical';
    return super._assessSeverity(event, category);
  }
}

// ── Rebalancer Audit Model ──────────────────────────────────────────────

class RebalancerAuditModel extends BaseAuditModel {
  constructor() { super('rebalancer'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // Order submission attempt (authority breach)
    if (context?.orderSubmitAttempt || toolName.includes('order.submit') || toolName.includes('fix.session')) {
      return { name: 'fiduciary-constraint-enforced', eventType: 'authority-breach-attempt', impactArea: 'compliance' };
    }

    // Trade list generation
    if (toolName.includes('trade-list') || toolName.includes('generate-trade-list')) {
      return { name: 'rebalance-trigger', eventType: 'trade-list-generated', impactArea: 'execution-prep' };
    }

    // Drift check
    if (toolName.includes('drift') || toolName.includes('compute-drift')) {
      return { name: 'rebalance-trigger', eventType: 'drift-check', impactArea: 'monitoring' };
    }

    // Rebalance event
    if (toolName.includes('rebalance')) {
      return { name: 'rebalance-trigger', eventType: 'rebalance-event', impactArea: 'investment' };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = super._mapCompliance(event, category, context);

    if (category.name === 'rebalance-trigger') {
      frameworks.push({
        framework: 'SEC',
        articles: [{ ref: 'Rule-204-2', ...SEC_ADVISERS['Rule-204-2'], status: 'rebalance-logged' }],
      });
      if (context?.erisaTaxLotSelection || context?.erisaMandate) {
        frameworks.push({
          framework: 'ERISA',
          articles: [
            { ref: '§107', ...ERISA['§107'], status: 'rebalance-record' },
            { ref: '§404', ...ERISA['§404'], status: 'tax-lot-documented' },
          ],
        });
      }
      if (context?.estimatedTxCostBps > 20) {
        frameworks.push({
          framework: 'MiFID II',
          articles: [{ ref: 'Art.27', ...MIFID_II['Art.27'], status: 'cost-estimate-logged' }],
        });
      }
    }

    if (category.eventType === 'authority-breach-attempt') {
      frameworks.push({
        framework: 'SEC',
        articles: [{ ref: 'Rule-204-2', ...SEC_ADVISERS['Rule-204-2'], status: 'control-failure' }],
      });
    }

    return frameworks;
  }

  _assessSeverity(event, category) {
    if (category.eventType === 'authority-breach-attempt') return 'critical';
    return super._assessSeverity(event, category);
  }
}

// ── Allocation Advisor Audit Model ──────────────────────────────────────

class AllocationAdvisorAuditModel extends BaseAuditModel {
  constructor() { super('allocation-advisor'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // Human approval bypass attempt
    if (context?.approvalBypassAttempt) {
      return { name: 'fiduciary-constraint-enforced', eventType: 'approval-gate-bypass-attempt', impactArea: 'compliance' };
    }

    // Self-promotion attempt
    if (context?.selfPromotionAttempt) {
      return { name: 'ips-violation-attempt', eventType: 'self-promotion-attempt', impactArea: 'compliance' };
    }

    // Write outside proposals
    if (context?.writeOutsideProposals) {
      return { name: 'fiduciary-constraint-enforced', eventType: 'write-isolation-breach', impactArea: 'security' };
    }

    // Allocation proposal approved (sub-event)
    if (toolName.includes('approved') || context?.approvalTimestamp) {
      return { name: 'allocation-proposal', eventType: 'proposal-approved', impactArea: 'investment' };
    }

    // Proposal generation
    if (toolName.includes('proposal') || toolName.includes('generate-proposal') || toolName.includes('advisor')) {
      return { name: 'allocation-proposal', eventType: 'proposal-generated', impactArea: 'investment' };
    }

    // ERISA rationale
    if (toolName.includes('erisa-rationale')) {
      return { name: 'allocation-proposal', eventType: 'erisa-rationale-generated', impactArea: 'compliance' };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = super._mapCompliance(event, category, context);

    if (category.name === 'allocation-proposal') {
      // EU AI Act Art.14 — human oversight evidence
      frameworks.push({
        framework: 'EU AI Act',
        articles: [{ ref: 'Art.14', ...EU_AI_ACT['Art.14'], status: category.eventType === 'proposal-approved' ? 'human-approval-logged' : 'pending-human-approval' }],
      });
      frameworks.push({
        framework: 'SEC',
        articles: [{ ref: 'Rule-204-2', ...SEC_ADVISERS['Rule-204-2'], status: 'proposal-logged' }],
      });
      if (context?.erisaMandate) {
        frameworks.push({
          framework: 'ERISA',
          articles: [
            { ref: '§107', ...ERISA['§107'], status: 'proposal-record' },
            { ref: '§404', ...ERISA['§404'], status: context?.erisaRationaleIncluded ? 'rationale-attached' : 'rationale-missing' },
          ],
        });
      }
    }

    if (category.eventType === 'approval-gate-bypass-attempt' || category.eventType === 'self-promotion-attempt') {
      frameworks.push({
        framework: 'EU AI Act',
        articles: [{ ref: 'Art.14', ...EU_AI_ACT['Art.14'], status: 'control-failure' }],
      });
    }

    return frameworks;
  }

  _assessSeverity(event, category) {
    if (category.eventType === 'approval-gate-bypass-attempt') return 'critical';
    if (category.eventType === 'self-promotion-attempt') return 'critical';
    if (category.eventType === 'write-isolation-breach') return 'critical';
    return super._assessSeverity(event, category);
  }
}

// ── Factor Analyst Audit Model ──────────────────────────────────────────

class FactorAnalystAuditModel extends BaseAuditModel {
  constructor() { super('factor-analyst'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // Production write attempt
    if (context?.productionWriteAttempt) {
      return { name: 'fiduciary-constraint-enforced', eventType: 'production-write-attempt', impactArea: 'security' };
    }

    // Factor report generation
    if (toolName.includes('report') || toolName.includes('factor-report')) {
      return { name: 'factor-analysis', eventType: 'factor-report', impactArea: 'analytics' };
    }

    // Return attribution
    if (toolName.includes('attribution')) {
      return { name: 'factor-analysis', eventType: 'return-attribution', impactArea: 'analytics' };
    }

    // Factor exposure computation
    if (toolName.includes('exposure') || toolName.includes('compute-exposures') || toolName.includes('factor')) {
      return { name: 'factor-analysis', eventType: 'factor-exposure-computation', impactArea: 'analytics' };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = super._mapCompliance(event, category, context);

    if (category.name === 'factor-analysis') {
      frameworks.push({
        framework: 'SR 11-7',
        articles: [{ ref: 'ongoing-monitoring', ...SR_11_7['ongoing-monitoring'], status: 'analysis-logged' }],
      });
      if (context?.factorModelVersion !== context?.approvedFactorModelVersion && context?.approvedFactorModelVersion) {
        frameworks.push({
          framework: 'SR 11-7',
          articles: [{ ref: 'model-validation', ...SR_11_7['model-validation'], status: 'unapproved-model-flagged' }],
        });
      }
    }

    if (category.eventType === 'production-write-attempt') {
      frameworks.push({
        framework: 'SEC',
        articles: [{ ref: 'Rule-204-2', ...SEC_ADVISERS['Rule-204-2'], status: 'control-failure' }],
      });
    }

    return frameworks;
  }

  _assessSeverity(event, category) {
    if (category.eventType === 'production-write-attempt') return 'critical';
    return super._assessSeverity(event, category);
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const AUDIT_MODELS = {
  'portfolio-optimizer': PortfolioOptimizerAuditModel,
  'rebalancer': RebalancerAuditModel,
  'allocation-advisor': AllocationAdvisorAuditModel,
  'factor-analyst': FactorAnalystAuditModel,
};

function createAuditModel(agentId) {
  const ModelClass = AUDIT_MODELS[agentId];
  if (!ModelClass) return new BaseAuditModel(agentId);
  return new ModelClass();
}

function listAuditModels() {
  return Object.keys(AUDIT_MODELS);
}

export {
  BaseAuditModel,
  PortfolioOptimizerAuditModel,
  RebalancerAuditModel,
  AllocationAdvisorAuditModel,
  FactorAnalystAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
  SEC_ADVISERS,
  MIFID_II,
  SFDR,
  ERISA,
  SR_11_7,
  EU_AI_ACT,
};

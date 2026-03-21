/**
 * Audit Models — RiskCompass Application
 *
 * Chronicle audit classification for RiskCompass agents. Each event is classified
 * into one of 5 audit categories with structured schemas and retention policies.
 *
 * Audit Categories:
 *   1. risk-calculation — VaR, ES, stress tests (7yr retention)
 *   2. stress-scenario-execution — individual stress scenario runs (7yr)
 *   3. exposure-alert — concentration/velocity/counterparty alerts (5yr)
 *   4. limit-breach-detection — breach events + escalation chain (7yr)
 *   5. cross-fund-aggregation — firm-level exposure aggregation (5yr)
 *
 * Regulatory basis:
 *   - Basel III FRTB §181-183 (VaR model evidence, backtesting)
 *   - AIFMD Art.15-16 (risk monitoring, leverage, liquidity stress)
 *   - EU AI Act Art.12 (record-keeping for HIGH RISK systems)
 *   - EU AI Act Art.14 (human oversight)
 *   - Dodd-Frank Title I (systemic risk), Title VII §23.600 (swap entity limits)
 *   - SR 11-7 (model risk management — ongoing monitoring)
 *   - SEC Rule 204-2 (books and records, 5yr minimum)
 */

// ── Regulatory Framework Mappings ────────────────────────────────────────

const BASEL_III = {
  'FRTB-§181':    { title: 'Market Risk Capital — VaR model requirements' },
  'FRTB-§183':    { title: 'VaR backtesting & internal limit framework' },
  'FRTB-§181(h)': { title: 'Stressed VaR evidence' },
  'CRR2-Art.395': { title: 'Large exposure reporting — consolidated' },
};

const AIFMD = {
  'Art.15(3)(a)': { title: 'Risk monitoring — exposure tracking systems' },
  'Art.15(3)(b)': { title: 'Risk monitoring — VaR and ES computation' },
  'Art.15(4)':    { title: 'Leverage limits — gross & commitment methods' },
  'Art.16(1)':    { title: 'Liquidity stress testing — quarterly' },
  'Art.24(4)':    { title: 'AIFM annual leverage reporting to NCA' },
};

const EU_AI_ACT = {
  'Art.9':  { title: 'Risk Management System' },
  'Art.12': { title: 'Record-Keeping — HIGH RISK AI systems' },
  'Art.14': { title: 'Human Oversight' },
};

const DODD_FRANK = {
  'Title-I':        { title: 'Systemic risk monitoring — firm-level aggregation' },
  'Title-II':       { title: 'Orderly liquidation authority — stress test evidence' },
  'Title-VII-§23.600': { title: 'Swap entity risk management — counterparty limits' },
};

const SR_11_7 = {
  'ongoing-monitoring': { title: 'Model performance monitoring — backtesting, exceptions' },
  'model-validation':   { title: 'Independent model validation evidence' },
};

const SEC = {
  'Rule-204-2': { title: 'Books and records — 5yr minimum retention' },
};

// ── Retention Schedule ───────────────────────────────────────────────────

const RETENTION = {
  'risk-calculation':         { days: 2555, years: 7, tier: 'S3 Glacier after 2yr', reason: 'Basel III FRTB model evidence; AIFMD Art.15(3)(b)' },
  'stress-scenario-execution':{ days: 2555, years: 7, tier: 'S3 Glacier after 2yr', reason: 'AIFMD Art.16 liquidity stress evidence; Basel III stressed VaR' },
  'limit-breach-detection':   { days: 2555, years: 7, tier: 'S3 Standard 1yr hot, Glacier 6yr', reason: 'AIFMD limit framework; Basel III FRTB IMA; EU AI Act Art.12' },
  'exposure-alert':           { days: 1825, years: 5, tier: 'S3 Standard 6mo hot, Glacier 4.5yr', reason: 'SEC Rule 204-2 books and records' },
  'cross-fund-aggregation':   { days: 1825, years: 5, tier: 'S3 Standard 6mo hot, Glacier 4.5yr', reason: 'SEC Rule 204-2; AIFMD Art.15 demonstration' },
};

// ── Base Audit Model ─────────────────────────────────────────────────────

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
      model: `riskcompass-${this.agentId}-audit-v1`,

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
      return { name: 'access-denied', eventType: 'policy-enforcement', impactArea: 'security' };
    }
    if (event.decision === 'escalate') {
      return { name: 'escalation', eventType: 'human-oversight-required', impactArea: 'compliance' };
    }
    return { name: 'access-granted', eventType: 'normal-operation', impactArea: 'operational' };
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
    return RETENTION[category.name] || { days: 1825, years: 5, tier: 'S3 Standard', reason: 'SEC Rule 204-2 minimum' };
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
      'calculationId', 'sessionId', 'modelId', 'modelVersion', 'methodology',
      'fundId', 'funds', 'assetClasses', 'crossFund', 'level',
      'scenarioId', 'scenarioName', 'trigger',
      'alertId', 'dimension', 'entityId', 'thresholdPct',
      'breachEventId', 'limitId', 'limitType',
      'aggregationRunId', 'totalPositionsRead',
    ];
    for (const key of allowedKeys) {
      if (context[key] !== undefined) safe[key] = context[key];
    }
    return safe;
  }
}

// ── VaR Calculator Audit Model ───────────────────────────────────────────

class VarCalculatorAuditModel extends BaseAuditModel {
  constructor() { super('var-calculator'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // VaR computation events
    if (toolName.includes('publish_var_report') || toolName.includes('var')) {
      return {
        name: 'risk-calculation',
        eventType: context?.methodology === 'monte-carlo' ? 'monte-carlo-var' :
                   context?.methodology === 'historical-simulation' ? 'historical-var' :
                   'parametric-var',
        impactArea: 'risk-analytics',
      };
    }

    // Backtesting exception logging
    if (toolName.includes('backtesting_exception')) {
      return {
        name: 'risk-calculation',
        eventType: 'backtesting-exception',
        impactArea: 'model-validation',
      };
    }

    // Risk factor / covariance reads (supporting VaR computation)
    if (toolName.includes('read_risk_factors') || toolName.includes('read_covariance')) {
      return {
        name: 'risk-calculation',
        eventType: 'var-data-input',
        impactArea: 'risk-analytics',
      };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = super._mapCompliance(event, category, context);

    if (category.name === 'risk-calculation') {
      frameworks.push({
        framework: 'Basel III',
        articles: [
          { ref: 'FRTB-§181', ...BASEL_III['FRTB-§181'], status: 'model-evidence-logged' },
        ],
      });

      if (category.eventType === 'backtesting-exception') {
        frameworks.push({
          framework: 'Basel III',
          articles: [{ ref: 'FRTB-§183', ...BASEL_III['FRTB-§183'], status: 'exception-logged' }],
        });
        frameworks.push({
          framework: 'SR 11-7',
          articles: [{ ref: 'ongoing-monitoring', ...SR_11_7['ongoing-monitoring'], status: 'exception-flagged' }],
        });
      }

      frameworks.push({
        framework: 'AIFMD',
        articles: [{ ref: 'Art.15(3)(b)', ...AIFMD['Art.15(3)(b)'], status: 'evidence-logged' }],
      });
    }

    return frameworks;
  }
}

// ── Stress Tester Audit Model ────────────────────────────────────────────

class StressTesterAuditModel extends BaseAuditModel {
  constructor() { super('stress-tester'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // Stress scenario execution
    if (toolName.includes('run_stress_scenario') || toolName.includes('stress')) {
      const eventType = context?.trigger === 'aifmd-quarterly' ? 'aifmd-liquidity-stress' :
                        context?.scenarioType === 'custom' ? 'custom-scenario' :
                        'predefined-scenario';
      return {
        name: 'stress-scenario-execution',
        eventType,
        impactArea: 'risk-analytics',
      };
    }

    // Stress report publishing
    if (toolName.includes('publish_stress_report')) {
      return {
        name: 'stress-scenario-execution',
        eventType: 'stress-report-published',
        impactArea: 'risk-reporting',
      };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = super._mapCompliance(event, category, context);

    if (category.name === 'stress-scenario-execution') {
      // AIFMD Art.16 — liquidity stress testing
      if (context?.trigger === 'aifmd-quarterly') {
        frameworks.push({
          framework: 'AIFMD',
          articles: [{ ref: 'Art.16(1)', ...AIFMD['Art.16(1)'], status: 'quarterly-test-logged' }],
        });
      }

      // Basel III stressed VaR
      frameworks.push({
        framework: 'Basel III',
        articles: [{ ref: 'FRTB-§181(h)', ...BASEL_III['FRTB-§181(h)'], status: 'stress-evidence-logged' }],
      });

      // Dodd-Frank orderly liquidation
      frameworks.push({
        framework: 'Dodd-Frank',
        articles: [{ ref: 'Title-II', ...DODD_FRANK['Title-II'], status: 'stress-test-evidence' }],
      });
    }

    return frameworks;
  }
}

// ── Exposure Monitor Audit Model ─────────────────────────────────────────

class ExposureMonitorAuditModel extends BaseAuditModel {
  constructor() { super('exposure-monitor'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // Firm-level cross-fund aggregation
    if (toolName.includes('aggregate_exposure') && context?.crossFund) {
      return {
        name: 'cross-fund-aggregation',
        eventType: context?.trigger === 'on-demand' ? 'on-demand-query' :
                   context?.trigger === 'intraday' ? 'intraday-snap' :
                   'firm-level-aggregation',
        impactArea: 'firm-exposure',
      };
    }

    // Concentration / drift / velocity alerts
    if (toolName.includes('concentration_alert') || toolName.includes('drift_alert')) {
      const alertType = toolName.includes('concentration') ? 'concentration-warning' :
                        toolName.includes('drift') ? 'velocity-alert' :
                        'factor-alert';
      return {
        name: 'exposure-alert',
        eventType: alertType,
        impactArea: 'risk-monitoring',
      };
    }

    // Feeding metrics to limit-enforcer
    if (toolName.includes('feed_exposure_metrics')) {
      return {
        name: 'cross-fund-aggregation',
        eventType: 'downstream-feed',
        impactArea: 'inter-agent',
      };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = super._mapCompliance(event, category, context);

    if (category.name === 'cross-fund-aggregation') {
      frameworks.push({
        framework: 'AIFMD',
        articles: [{ ref: 'Art.15(3)(a)', ...AIFMD['Art.15(3)(a)'], status: 'aggregation-logged' }],
      });
      frameworks.push({
        framework: 'Basel III',
        articles: [{ ref: 'CRR2-Art.395', ...BASEL_III['CRR2-Art.395'], status: 'consolidated-exposure-logged' }],
      });

      if (context?.businessLinesAggregated >= 5) {
        frameworks.push({
          framework: 'Dodd-Frank',
          articles: [{ ref: 'Title-I', ...DODD_FRANK['Title-I'], status: 'firm-level-aggregation-evidence' }],
        });
      }
    }

    if (category.name === 'exposure-alert') {
      frameworks.push({
        framework: 'SEC',
        articles: [{ ref: 'Rule-204-2', ...SEC['Rule-204-2'], status: 'alert-logged' }],
      });
    }

    return frameworks;
  }
}

// ── Limit Enforcer Audit Model ───────────────────────────────────────────

class LimitEnforcerAuditModel extends BaseAuditModel {
  constructor() { super('limit-enforcer'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // Near-breach warnings (check before breach — 'near_breach' contains 'breach')
    if (toolName.includes('near_breach')) {
      return {
        name: 'limit-breach-detection',
        eventType: 'near-breach-warning',
        impactArea: 'limit-enforcement',
      };
    }

    // Limit breach events
    if (toolName.includes('breach_event') || toolName.includes('breach')) {
      return {
        name: 'limit-breach-detection',
        eventType: 'limit-breach',
        impactArea: 'limit-enforcement',
      };
    }

    // Escalation notifications
    if (toolName.includes('notify_cro') || toolName.includes('notify_risk_manager') || toolName.includes('notify_cco')) {
      return {
        name: 'limit-breach-detection',
        eventType: 'escalation-notification',
        impactArea: 'human-oversight',
      };
    }

    // Limit check results (routine)
    if (toolName.includes('log_limit_check')) {
      return {
        name: 'limit-breach-detection',
        eventType: 'limit-check-result',
        impactArea: 'routine-monitoring',
      };
    }

    // Denied tool attempts (limit modification, alert suppression)
    if (event.decision === 'deny' && (toolName.includes('modify_limit') || toolName.includes('override_limit') || toolName.includes('suppress_alert'))) {
      return {
        name: 'limit-breach-detection',
        eventType: 'unauthorized-modification-attempt',
        impactArea: 'security',
      };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = super._mapCompliance(event, category, context);

    if (category.name === 'limit-breach-detection') {
      // AIFMD Art.15(4) — leverage limits
      if (context?.limitType?.includes('leverage')) {
        frameworks.push({
          framework: 'AIFMD',
          articles: [{ ref: 'Art.15(4)', ...AIFMD['Art.15(4)'], status: 'limit-monitored' }],
        });
      }

      // Basel III FRTB — VaR limits
      if (context?.limitType?.includes('var')) {
        frameworks.push({
          framework: 'Basel III',
          articles: [{ ref: 'FRTB-§183', ...BASEL_III['FRTB-§183'], status: 'limit-enforced' }],
        });
      }

      // Dodd-Frank — counterparty limits
      if (context?.limitType?.includes('counterparty')) {
        frameworks.push({
          framework: 'Dodd-Frank',
          articles: [{ ref: 'Title-VII-§23.600', ...DODD_FRANK['Title-VII-§23.600'], status: 'limit-monitored' }],
        });
      }

      // EU AI Act Art.14 — human oversight for breach events
      if (category.eventType === 'limit-breach' || category.eventType === 'escalation-notification') {
        const euFramework = frameworks.find(f => f.framework === 'EU AI Act' && f.articles.some(a => a.ref === 'Art.14'));
        if (!euFramework) {
          frameworks.push({
            framework: 'EU AI Act',
            articles: [{ ref: 'Art.14', ...EU_AI_ACT['Art.14'], status: 'human-review-required' }],
          });
        }
      }
    }

    return frameworks;
  }

  _assessSeverity(event, category) {
    if (category.eventType === 'unauthorized-modification-attempt') return 'critical';
    if (category.eventType === 'limit-breach') return 'high';
    if (category.eventType === 'near-breach-warning') return 'medium';
    if (category.eventType === 'escalation-notification') return 'medium';
    return super._assessSeverity(event, category);
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const AUDIT_MODELS = {
  'var-calculator': VarCalculatorAuditModel,
  'stress-tester': StressTesterAuditModel,
  'exposure-monitor': ExposureMonitorAuditModel,
  'limit-enforcer': LimitEnforcerAuditModel,
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
  VarCalculatorAuditModel,
  StressTesterAuditModel,
  ExposureMonitorAuditModel,
  LimitEnforcerAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
  BASEL_III,
  AIFMD,
  EU_AI_ACT,
  DODD_FRANK,
  SR_11_7,
  SEC,
};

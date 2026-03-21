/**
 * Audit Models — TradeSentinel Application
 *
 * Chronicle audit classification for TradeSentinel agents. Each event is classified
 * into one of 6 audit event groups with structured schemas and retention policies.
 *
 * Audit Event Groups:
 *   1. order-execution — order staging, submission, fill, cancel (7yr)
 *   2. best-execution-compliance — venue selection rationale, RTS 28 (7yr)
 *   3. market-abuse-alert — MAR Art.12 pattern detection, STR drafts (7yr)
 *   4. chinese-wall-violation — information barrier enforcement (7yr)
 *   5. human-oversight-gate — approval gates, kill switch, risk budget (10yr)
 *   6. separation-of-duties — SoD violation attempts, SOE bypass (7yr)
 *
 * Regulatory basis:
 *   - MiFID II Art.27 (best execution), Art.25 (suitability)
 *   - Reg NMS Rule 611 (NBBO), FINRA Rule 4511
 *   - MAR Art.12 (market manipulation), Art.16 (STR filing)
 *   - EU AI Act Art.12 (record-keeping), Art.14 (human oversight)
 *   - SR 11-7 (model risk management)
 */

// ── Regulatory Framework Mappings ────────────────────────────────────────

const MIFID_II = {
  'Art.25':   { title: 'Suitability — mandate compliance' },
  'Art.27':   { title: 'Best execution — venue selection rationale' },
  'Art.27(6)': { title: 'Best execution — documentation obligation' },
  'Art.17':   { title: 'Algorithmic trading controls' },
  'RTS28':    { title: 'Quarterly best execution venue report' },
};

const REG_NMS = {
  'Rule-611': { title: 'NBBO trade-through prohibition' },
};

const FINRA = {
  'Rule-4511': { title: 'Books and records — 6yr retention' },
};

const MAR = {
  'Art.10':  { title: 'Unlawful disclosure of inside information' },
  'Art.12':  { title: 'Market manipulation prohibition' },
  'Art.16':  { title: 'STR filing obligation' },
};

const EU_AI_ACT = {
  'Art.12': { title: 'Record-keeping — HIGH RISK AI systems' },
  'Art.14': { title: 'Human oversight — intervention capability' },
};

const SR_11_7 = {
  'ongoing-monitoring': { title: 'Model performance monitoring' },
};

// ── Retention Schedule ──────────────────────────────────────────────────

const RETENTION = {
  'order-execution':            { days: 2555, years: 7, tier: 'S3 Standard 2yr, Glacier 5yr', reason: 'MiFID II (5yr) + FINRA 4511 (6yr) + buffer' },
  'best-execution-compliance':  { days: 2555, years: 7, tier: 'S3 Standard 2yr, Glacier 5yr', reason: 'MiFID II Art.27(6): 5yr + buffer' },
  'market-abuse-alert':         { days: 2555, years: 7, tier: 'S3 Standard', reason: 'MAR Art.16: 5yr + FINRA buffer' },
  'chinese-wall-violation':     { days: 2555, years: 7, tier: 'S3 Standard', reason: 'Reg FD; MAR Art.10; MiFID II Art.23' },
  'human-oversight-gate':       { days: 3650, years: 10, tier: 'S3 Standard', reason: 'EU AI Act Art.12: lifetime of system' },
  'separation-of-duties':       { days: 2555, years: 7, tier: 'S3 Standard', reason: 'MiFID II Art.17; internal controls' },
  'tca-report':                 { days: 2555, years: 7, tier: 'S3 Glacier after 2yr', reason: 'MiFID II Art.27; SEC Rule 204-2' },
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
      model: `trade-sentinel-${this.agentId}-audit-v1`,

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
      return { name: 'separation-of-duties', eventType: 'policy-enforcement', impactArea: 'compliance' };
    }
    return { name: 'order-execution', eventType: 'normal-operation', impactArea: 'trading' };
  }

  _mapCompliance(event, _category, _context) {
    const frameworks = [];
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
    return RETENTION[category.name] || { days: 2555, years: 7, tier: 'S3 Standard', reason: 'Default 7yr retention' };
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
      'orderId', 'instrument', 'notional', 'currency', 'side',
      'venueSelected', 'nbboAtDecision', 'arrivalPrice',
      'fillPrice', 'fillQuantity', 'slippageVsVwap',
      'alertId', 'alertType', 'marPatternType', 'strDraftId',
      'reportId', 'quarter', 'assetClass', 'ordersAnalysed',
      'mandateId', 'failedCheck', 'batchId', 'dateRange',
    ];
    for (const key of allowedKeys) {
      if (context[key] !== undefined) safe[key] = context[key];
    }
    return safe;
  }
}

// ── Order Router Audit Model ────────────────────────────────────────────

class OrderRouterAuditModel extends BaseAuditModel {
  constructor() { super('order-router'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // Chinese wall
    if (context?.chineseWallViolation || toolName.includes('research-nexus/pre-publication')) {
      return { name: 'chinese-wall-violation', eventType: 'chinese-wall-violation-attempt', impactArea: 'compliance' };
    }

    // SOE bypass attempt
    if (context?.soeBypassAttempt || toolName.includes('--bypass-soe')) {
      return { name: 'separation-of-duties', eventType: 'soe-bypass-attempt', impactArea: 'security' };
    }

    // Human approval gate
    if (context?.humanApprovalBypass) {
      return { name: 'human-oversight-gate', eventType: 'approval-gate-bypass', impactArea: 'compliance' };
    }

    if (context?.humanApprovalGranted) {
      return { name: 'human-oversight-gate', eventType: 'human-approval-granted', impactArea: 'oversight' };
    }

    // NBBO validation
    if (toolName.includes('nbbo') || context?.nbboViolationAttempt) {
      return { name: 'best-execution-compliance', eventType: 'nbbo-validation', impactArea: 'compliance' };
    }

    // Mandate check
    if (toolName.includes('mandate') || context?.mandateCheckFail) {
      const eventType = context?.mandateCheckFail ? 'mandate-check-fail' : 'mandate-check-pass';
      return { name: 'best-execution-compliance', eventType, impactArea: 'compliance' };
    }

    // Restricted security
    if (context?.restrictedSecurityAttempt) {
      return { name: 'best-execution-compliance', eventType: 'restricted-security-blocked', impactArea: 'compliance' };
    }

    // Order staging / submission
    if (toolName.includes('submit-order') || toolName.includes('staged')) {
      return { name: 'order-execution', eventType: 'order-staged', impactArea: 'trading' };
    }

    // Best execution rationale
    if (toolName.includes('venue') || toolName.includes('best-execution')) {
      return { name: 'best-execution-compliance', eventType: 'best-execution-rationale', impactArea: 'compliance' };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = super._mapCompliance(event, category, context);

    if (category.name === 'order-execution' || category.name === 'best-execution-compliance') {
      frameworks.push({
        framework: 'MiFID II',
        articles: [{ ref: 'Art.27', ...MIFID_II['Art.27'], status: 'execution-logged' }],
      });
    }

    if (category.eventType === 'nbbo-validation') {
      frameworks.push({
        framework: 'Reg NMS',
        articles: [{ ref: 'Rule-611', ...REG_NMS['Rule-611'], status: context?.nbboViolationAttempt ? 'violation-blocked' : 'validated' }],
      });
    }

    if (category.eventType === 'mandate-check-fail' || category.eventType === 'mandate-check-pass') {
      frameworks.push({
        framework: 'MiFID II',
        articles: [{ ref: 'Art.25', ...MIFID_II['Art.25'], status: category.eventType === 'mandate-check-fail' ? 'control-triggered' : 'compliant' }],
      });
    }

    if (category.name === 'chinese-wall-violation') {
      frameworks.push({
        framework: 'MAR',
        articles: [{ ref: 'Art.10', ...MAR['Art.10'], status: 'barrier-enforced' }],
      });
    }

    if (category.name === 'human-oversight-gate') {
      frameworks.push({
        framework: 'EU AI Act',
        articles: [{ ref: 'Art.14', ...EU_AI_ACT['Art.14'], status: category.eventType === 'human-approval-granted' ? 'human-approved' : 'control-failure' }],
      });
    }

    return frameworks;
  }

  _assessSeverity(event, category) {
    if (category.name === 'chinese-wall-violation') return 'critical';
    if (category.eventType === 'soe-bypass-attempt') return 'critical';
    if (category.eventType === 'approval-gate-bypass') return 'critical';
    if (category.eventType === 'mandate-check-fail') return 'high';
    if (category.eventType === 'nbbo-validation' && event.decision === 'deny') return 'high';
    return super._assessSeverity(event, category);
  }
}

// ── Execution Monitor Audit Model ───────────────────────────────────────

class ExecutionMonitorAuditModel extends BaseAuditModel {
  constructor() { super('execution-monitor'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // Chinese wall
    if (context?.chineseWallViolation) {
      return { name: 'chinese-wall-violation', eventType: 'chinese-wall-violation-attempt', impactArea: 'compliance' };
    }

    // Order modification attempt (SoD violation)
    if (context?.orderModifyAttempt || toolName.includes('flexTrade')) {
      return { name: 'separation-of-duties', eventType: 'order-modify-attempt', impactArea: 'security' };
    }

    // MAR pattern / STR
    if (context?.marPatternDetected || toolName.includes('anomaly-detector')) {
      return { name: 'market-abuse-alert', eventType: 'mar-pattern-detected', impactArea: 'surveillance' };
    }

    if (toolName.includes('str-draft') || context?.strDraftCreated) {
      return { name: 'market-abuse-alert', eventType: 'str-draft-created', impactArea: 'compliance' };
    }

    // Execution quality alert
    if (toolName.includes('alert-service')) {
      return { name: 'order-execution', eventType: 'execution-quality-alert', impactArea: 'monitoring' };
    }

    // Benchmark calculation
    if (toolName.includes('benchmark') || toolName.includes('vwap') || toolName.includes('implementation-shortfall')) {
      return { name: 'order-execution', eventType: 'benchmark-computation', impactArea: 'analytics' };
    }

    // Fill monitoring
    if (toolName.includes('fill') || toolName.includes('execution')) {
      return { name: 'order-execution', eventType: 'fill-monitoring', impactArea: 'trading' };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = super._mapCompliance(event, category, context);

    if (category.name === 'market-abuse-alert') {
      frameworks.push({
        framework: 'MAR',
        articles: [{ ref: 'Art.12', ...MAR['Art.12'], status: 'pattern-detected' }],
      });
      if (category.eventType === 'str-draft-created') {
        frameworks.push({
          framework: 'MAR',
          articles: [{ ref: 'Art.16', ...MAR['Art.16'], status: 'str-draft-routed' }],
        });
      }
    }

    if (category.name === 'chinese-wall-violation') {
      frameworks.push({
        framework: 'MAR',
        articles: [{ ref: 'Art.10', ...MAR['Art.10'], status: 'barrier-enforced' }],
      });
    }

    if (category.name === 'separation-of-duties') {
      frameworks.push({
        framework: 'MiFID II',
        articles: [{ ref: 'Art.17', ...MIFID_II['Art.17'], status: 'control-failure' }],
      });
    }

    if (category.name === 'order-execution') {
      frameworks.push({
        framework: 'SR 11-7',
        articles: [{ ref: 'ongoing-monitoring', ...SR_11_7['ongoing-monitoring'], status: 'execution-monitored' }],
      });
    }

    return frameworks;
  }

  _assessSeverity(event, category) {
    if (category.name === 'chinese-wall-violation') return 'critical';
    if (category.eventType === 'order-modify-attempt') return 'critical';
    if (category.eventType === 'str-draft-created') return 'high';
    if (category.eventType === 'mar-pattern-detected') return 'high';
    return super._assessSeverity(event, category);
  }
}

// ── TCA Analyzer Audit Model ────────────────────────────────────────────

class TcaAnalyzerAuditModel extends BaseAuditModel {
  constructor() { super('tca-analyzer'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // Chinese wall
    if (context?.chineseWallViolation) {
      return { name: 'chinese-wall-violation', eventType: 'chinese-wall-violation-attempt', impactArea: 'compliance' };
    }

    // Live data access attempt (SoD violation — post-trade only)
    if (context?.liveDataAccessAttempt) {
      return { name: 'separation-of-duties', eventType: 'live-data-access-attempt', impactArea: 'security' };
    }

    // Order write attempt
    if (context?.orderWriteAttempt) {
      return { name: 'separation-of-duties', eventType: 'order-write-attempt', impactArea: 'security' };
    }

    // RTS 28 report
    if (toolName.includes('rts28') || context?.rts28Report) {
      return { name: 'tca-report', eventType: 'rts28-report-generated', impactArea: 'regulatory-filing' };
    }

    // TCA batch computation
    if (toolName.includes('tca-engine') || toolName.includes('compute-batch')) {
      return { name: 'tca-report', eventType: 'tca-batch-computed', impactArea: 'analytics' };
    }

    // Benchmark calculation
    if (toolName.includes('benchmark')) {
      return { name: 'tca-report', eventType: 'benchmark-computation', impactArea: 'analytics' };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = super._mapCompliance(event, category, context);

    if (category.name === 'tca-report') {
      frameworks.push({
        framework: 'MiFID II',
        articles: [{ ref: 'Art.27', ...MIFID_II['Art.27'], status: 'tca-evidence-logged' }],
      });
      if (category.eventType === 'rts28-report-generated') {
        frameworks.push({
          framework: 'MiFID II',
          articles: [{ ref: 'RTS28', ...MIFID_II['RTS28'], status: 'report-pending-human-review' }],
        });
      }
      frameworks.push({
        framework: 'SR 11-7',
        articles: [{ ref: 'ongoing-monitoring', ...SR_11_7['ongoing-monitoring'], status: 'model-monitoring-evidence' }],
      });
    }

    if (category.name === 'chinese-wall-violation') {
      frameworks.push({
        framework: 'MAR',
        articles: [{ ref: 'Art.10', ...MAR['Art.10'], status: 'barrier-enforced' }],
      });
    }

    if (category.name === 'separation-of-duties') {
      frameworks.push({
        framework: 'MiFID II',
        articles: [{ ref: 'Art.17', ...MIFID_II['Art.17'], status: 'control-failure' }],
      });
    }

    return frameworks;
  }

  _assessSeverity(event, category) {
    if (category.name === 'chinese-wall-violation') return 'critical';
    if (category.eventType === 'live-data-access-attempt') return 'critical';
    if (category.eventType === 'order-write-attempt') return 'critical';
    return super._assessSeverity(event, category);
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const AUDIT_MODELS = {
  'order-router': OrderRouterAuditModel,
  'execution-monitor': ExecutionMonitorAuditModel,
  'tca-analyzer': TcaAnalyzerAuditModel,
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
  OrderRouterAuditModel,
  ExecutionMonitorAuditModel,
  TcaAnalyzerAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
  MIFID_II,
  REG_NMS,
  FINRA,
  MAR,
  EU_AI_ACT,
  SR_11_7,
};

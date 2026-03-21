/**
 * Audit Models — OpsFabric Application
 *
 * Chronicle audit classification for OpsFabric agents. 15 event categories
 * covering settlement, reconciliation, and NAV calculation workflows.
 *
 * Critical severity events trigger immediate COO + security notification:
 *   - NAV publication without dual approval
 *   - Source record modification attempt (reconciler)
 *   - Custodian account management action
 *   - Risk budget override attempt
 *   - Pricing override without authorization
 *
 * Regulatory basis:
 *   - CSDR Art.7, Art.29 (settlement discipline, records)
 *   - EMIR Art.20 (CCP clearing records)
 *   - SOX 404 (internal controls)
 *   - SEC Rule 31a-2 (fund books and records, 7yr)
 *   - ASC 820 / IFRS 13 (fair value measurement)
 */

// ── Regulatory Framework Mappings ────────────────────────────────────────

const CSDR = {
  'Art.7':  { title: 'Settlement discipline — fail prevention and buy-in' },
  'Art.29': { title: 'Settlement instruction records' },
};

const EMIR = {
  'Art.20': { title: 'CCP clearing record-keeping' },
};

const SOX = {
  '404': { title: 'Internal controls over financial reporting' },
};

const SEC_RULES = {
  'Rule-31a-2': { title: 'Fund books and records — 7yr retention' },
};

const ASC_820 = {
  'Level3': { title: 'Fair value measurement — Level 3 disclosure' },
};

// ── Retention Schedule ───────────────────────────────────────────────────

const RETENTION = {
  'nav-calculation':              { days: 2555, years: 7, tier: 'S3 Standard 1yr, Glacier 6yr', reason: 'SEC Rule 31a-2 fund books and records' },
  'nav-pricing-exception':       { days: 2555, years: 7, tier: 'S3 Standard 1yr, Glacier 6yr', reason: 'SEC Rule 31a-2; SOX 404 supporting documentation' },
  'settlement-instruction':      { days: 1825, years: 5, tier: 'S3 Standard 6mo, Glacier 4.5yr', reason: 'CSDR Art.29; EMIR Art.20' },
  'settlement-fail':             { days: 1825, years: 5, tier: 'S3 Standard 6mo, Glacier 4.5yr', reason: 'CSDR Art.7 documentation' },
  'reconciliation-break':        { days: 1825, years: 5, tier: 'S3 Standard 6mo, Glacier 4.5yr', reason: 'SOX 404; 10yr if material misstatement' },
  'reconciliation-report':       { days: 1825, years: 5, tier: 'S3 Glacier after 1yr', reason: 'SOX 404' },
  'soe-violation':               { days: 2555, years: 7, tier: 'S3 Standard 2yr, Glacier 5yr', reason: 'Security policy; regulatory examination readiness' },
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
      model: `opsfabric-${this.agentId}-audit-v1`,

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
      return { name: 'soe-violation', eventType: 'policy-enforcement', impactArea: 'security' };
    }
    return { name: 'operational', eventType: 'normal-operation', impactArea: 'operations' };
  }

  _mapCompliance(_event, _category, _context) {
    return [];
  }

  _assessSeverity(event, category) {
    if (event.riskScore >= 86) return 'critical';
    if (event.riskScore >= 61) return 'high';
    if (event.decision === 'deny') return 'high';
    if (event.decision === 'escalate') return 'medium';
    return 'low';
  }

  _retentionPolicy(category) {
    return RETENTION[category.name] || { days: 1825, years: 5, tier: 'S3 Standard', reason: 'Default 5yr' };
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
      'tradeId', 'isin', 'fundId', 'counterparty', 'custodian',
      'breakId', 'breakCategory', 'breakValueUSD', 'breakAgeDays',
      'navDate', 'pricingSource', 'stalePriceCount', 'level3Pct',
      'settlementDate', 'csdrPenaltyUSD', 'failAgeDays',
    ];
    for (const key of allowedKeys) {
      if (context[key] !== undefined) safe[key] = context[key];
    }
    return safe;
  }
}

// ── Settlement Processor Audit Model ─────────────────────────────────────

class SettlementProcessorAuditModel extends BaseAuditModel {
  constructor() { super('settlement-processor'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // CCP routing
    if (toolName.includes('lch/') || toolName.includes('cme/') || toolName.includes('ccp')) {
      if (event.decision === 'deny') {
        return { name: 'soe-violation', eventType: 'ccp-routing-denied', impactArea: 'security' };
      }
      return { name: 'settlement-ccp-routing', eventType: 'ccp-novation', impactArea: 'clearing' };
    }

    // Settlement instruction generation
    if (toolName.includes('submit-instruction') || toolName.includes('settlement/submit') || toolName.includes('generate-mt54x')) {
      return { name: 'settlement-instruction', eventType: 'instruction-generated', impactArea: 'settlement' };
    }

    // SSI exception
    if (toolName.includes('query-ssi') && context?.ssiMismatch) {
      return { name: 'settlement-ssi-exception', eventType: 'ssi-mismatch', impactArea: 'settlement' };
    }

    // CSDR penalty calculation
    if (toolName.includes('csdr-penalty') || toolName.includes('calculate-csdr')) {
      return { name: 'settlement-csdr-penalty', eventType: 'penalty-calculation', impactArea: 'regulatory' };
    }

    // Settlement fail escalation
    if (context?.failEscalation || context?.businessDaysSinceFail >= 3) {
      return { name: 'settlement-fail-escalation', eventType: 'fail-escalated', impactArea: 'settlement' };
    }

    // Buy-in workflow
    if (context?.buyinWorkflow || context?.businessDaysSinceFail >= 4) {
      return { name: 'settlement-buyin-workflow', eventType: 'buyin-initiated', impactArea: 'settlement' };
    }

    // Custodian account management attempt (CRITICAL)
    if (toolName.includes('account-management') || toolName.includes('client-instruction')) {
      return { name: 'soe-violation', eventType: 'custodian-account-mgmt-attempt', impactArea: 'security' };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = [];

    if (category.name === 'settlement-instruction' || category.name === 'settlement-fail') {
      frameworks.push({ framework: 'CSDR', articles: [{ ref: 'Art.29', ...CSDR['Art.29'], status: 'logged' }] });
    }

    if (category.name === 'settlement-ccp-routing') {
      frameworks.push({ framework: 'EMIR', articles: [{ ref: 'Art.20', ...EMIR['Art.20'], status: 'logged' }] });
    }

    if (category.name.includes('fail') || category.name.includes('buyin') || category.name.includes('penalty')) {
      frameworks.push({ framework: 'CSDR', articles: [{ ref: 'Art.7', ...CSDR['Art.7'], status: 'discipline-event' }] });
    }

    return frameworks;
  }

  _assessSeverity(event, category) {
    if (category.eventType === 'custodian-account-mgmt-attempt') return 'critical';
    if (category.eventType === 'buyin-initiated') return 'high';
    if (category.eventType === 'fail-escalated') return 'medium';
    return super._assessSeverity(event, category);
  }
}

// ── Reconciler Audit Model ───────────────────────────────────────────────

class ReconcilerAuditModel extends BaseAuditModel {
  constructor() { super('reconciler'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';

    // Source record write attempt (CRITICAL)
    if (event.decision === 'deny' && (
      toolName.includes('amend-position') ||
      toolName.includes('delete-position') ||
      toolName.includes('modify-eagle-pace') ||
      toolName.includes('correct-record') ||
      toolName.includes('submit-custodian-instruction')
    )) {
      return { name: 'soe-violation', eventType: 'source-record-modification-attempt', impactArea: 'security' };
    }

    // Break classification
    if (toolName.includes('classify-break') || toolName.includes('route-to-queue') || toolName.includes('calculate-break-priority')) {
      return { name: 'reconciliation-break', eventType: 'break-classified', impactArea: 'reconciliation' };
    }

    // Reconciliation report
    if (toolName.includes('generate-reconciliation-report') || toolName.includes('export-break-report')) {
      return { name: 'reconciliation-report', eventType: 'report-generated', impactArea: 'reporting' };
    }

    // Escalation
    if (context?.breakEscalation || (context?.breakValueUSD > 500000) || (context?.breakAgeDays > 5)) {
      return { name: 'reconciliation-escalation', eventType: 'break-escalated', impactArea: 'reconciliation' };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = [];

    if (category.name.startsWith('reconciliation')) {
      frameworks.push({ framework: 'SOX', articles: [{ ref: '404', ...SOX['404'], status: 'control-evidence' }] });
    }

    if (category.eventType === 'source-record-modification-attempt') {
      frameworks.push({
        framework: 'SOX',
        articles: [{ ref: '404', ...SOX['404'], status: 'control-failure' }],
      });
    }

    return frameworks;
  }

  _assessSeverity(event, category) {
    if (category.eventType === 'source-record-modification-attempt') return 'critical';
    if (category.eventType === 'break-escalated') return 'high';
    return super._assessSeverity(event, category);
  }
}

// ── NAV Calculator Audit Model ───────────────────────────────────────────

class NavCalculatorAuditModel extends BaseAuditModel {
  constructor() { super('nav-calculator'); }

  _categorize(event, context) {
    const toolName = event.toolName || '';
    const path = event.toolInput?.path || event.toolInput?.destination || '';

    // NAV publication attempt (CRITICAL)
    if (path.includes('nav/published') || toolName.includes('publish-nav') || toolName.includes('approve-nav') || toolName.includes('distribute-nav')) {
      return { name: 'soe-violation', eventType: 'nav-publication-without-dual-approval', impactArea: 'security' };
    }

    // Pricing override attempt (CRITICAL)
    if (toolName.includes('override-pricing') || (event.decision === 'deny' && path.includes('pricing/'))) {
      return { name: 'soe-violation', eventType: 'pricing-override-attempt', impactArea: 'security' };
    }

    // Preliminary NAV generation
    if (toolName.includes('calculate-nav') || toolName.includes('generate-preliminary-nav') || toolName.includes('submit-to-review-queue')) {
      return { name: 'nav-calculation', eventType: 'preliminary-nav-generated', impactArea: 'nav' };
    }

    // Pricing validation
    if (toolName.includes('validate-pricing') || toolName.includes('flag-stale-price') || toolName.includes('classify-fair-value-level')) {
      return { name: 'nav-pricing-exception', eventType: 'pricing-validation', impactArea: 'pricing' };
    }

    // Fee accrual / corporate action
    if (toolName.includes('apply-fee-accrual') || toolName.includes('apply-corporate-action')) {
      return { name: 'nav-calculation', eventType: 'nav-adjustment', impactArea: 'nav' };
    }

    return super._categorize(event, context);
  }

  _mapCompliance(event, category, context) {
    const frameworks = [];

    if (category.name === 'nav-calculation' || category.name === 'nav-pricing-exception') {
      frameworks.push({ framework: 'SEC', articles: [{ ref: 'Rule-31a-2', ...SEC_RULES['Rule-31a-2'], status: 'logged' }] });
      frameworks.push({ framework: 'SOX', articles: [{ ref: '404', ...SOX['404'], status: 'control-evidence' }] });
    }

    if (category.eventType === 'nav-publication-without-dual-approval') {
      frameworks.push({
        framework: 'SOX',
        articles: [{ ref: '404', ...SOX['404'], status: 'control-failure' }],
      });
    }

    if (context?.level3Pct > 15) {
      frameworks.push({ framework: 'ASC 820', articles: [{ ref: 'Level3', ...ASC_820['Level3'], status: 'disclosure-required' }] });
    }

    return frameworks;
  }

  _assessSeverity(event, category) {
    if (category.eventType === 'nav-publication-without-dual-approval') return 'critical';
    if (category.eventType === 'pricing-override-attempt') return 'critical';
    return super._assessSeverity(event, category);
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const AUDIT_MODELS = {
  'settlement-processor': SettlementProcessorAuditModel,
  'reconciler': ReconcilerAuditModel,
  'nav-calculator': NavCalculatorAuditModel,
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
  SettlementProcessorAuditModel,
  ReconcilerAuditModel,
  NavCalculatorAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
  CSDR,
  EMIR,
  SOX,
  SEC_RULES,
  ASC_820,
};

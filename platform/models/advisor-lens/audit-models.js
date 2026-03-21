/**
 * Audit Models — AdvisorLens Application
 *
 * Domain-specific Chronicle audit classification for AdvisorLens agents:
 *   - SuitabilityCheckerAuditModel (suitability assessments, overrides, risk profile deviations)
 *   - ProposalGeneratorAuditModel (proposal drafts, Art.52 enforcement, human approval gate)
 *   - ClientReporterAuditModel (client reports, client isolation, SFDR disclosures)
 *
 * Audit Categories:
 *   - suitability-assessment (7yr — MiFID II Art.25)
 *   - suitability-override (7yr — MiFID II, SEC Advisers Act)
 *   - proposal-generation (7yr — MiFID II, SEC Advisers Act)
 *   - client-report-delivery (7yr — MiFID II Art.24)
 *   - art52-disclosure-enforcement (10yr — EU AI Act)
 *   - gdpr-opt-out-processing (10yr — GDPR Art.30)
 *   - gdpr-breach-assessment (10yr — GDPR Art.33)
 *   - soe-violation (10yr — EU AI Act, regulatory evidence)
 *   - human-oversight-gate (7yr — EU AI Act Art.14)
 */

import { randomUUID } from 'node:crypto';

// ── Retention Schedule ───────────────────────────────────────────────────

const RETENTION = {
  'suitability-assessment':       { years: 7,  reason: 'MiFID II Art.25(6) — suitability records' },
  'suitability-override':         { years: 7,  reason: 'MiFID II, SEC Advisers Act Rule 204-2 — override records' },
  'proposal-generation':          { years: 7,  reason: 'MiFID II, SEC Advisers Act Rule 204-2 — recommendation records' },
  'client-report-delivery':       { years: 7,  reason: 'MiFID II Art.24(4), SEC Advisers Act Rule 204-3' },
  'art52-disclosure-enforcement': { years: 10, reason: 'EU AI Act Art.26(5) — compliance evidence for high-risk AI' },
  'gdpr-opt-out-processing':      { years: 10, reason: 'GDPR Art.30 — records of processing activities' },
  'gdpr-breach-assessment':       { years: 10, reason: 'GDPR Art.33(5) — breach notification records' },
  'soe-violation':                { years: 10, reason: 'EU AI Act Art.26(5) — regulatory examination evidence' },
  'human-oversight-gate':         { years: 7,  reason: 'EU AI Act Art.14 — human oversight records' },
};

// ── Base Audit Model ─────────────────────────────────────────────────────

class BaseAuditModel {
  constructor(agentId) {
    this.agentId = agentId;
    this.allowedContextKeys = [
      'suitabilityDetermination', 'productComplexityClass', 'clientCategory',
      'riskProfileDeviationBands', 'suitabilityOverride', 'complianceSignOff',
      'proposalType', 'suitabilityMismatch', 'gdprArt22OptOut', 'deliberativeReviewTagged',
      'allocationChangePct', 'deviationFromModelSigma', 'crossSellingDetected',
      'art52DisclosureMissing', 'suitabilityCheckBypassed', 'deliveryPathWriteAttempt',
      'crossClientAccessAttempt', 'prePublicationAccessAttempt', 'reportType',
      'clientId', 'proposalId', 'reportId', 'instrumentId', 'gdprConsentNotChecked',
      'crmWriteAttempt', 'piiAccessAttempt', 'proposalWriteAttempt',
    ];
  }

  classify(event, context = {}) {
    const { auditCategory, eventType } = this._classifyEvent(event, context);
    const severity = this._assessSeverity(event, context, auditCategory);
    const compliance = this._mapCompliance(event, context, auditCategory);
    const retention = this._getRetention(auditCategory);

    return {
      recordId: `aud-${randomUUID().slice(0, 12)}`,
      timestamp: new Date().toISOString(),
      agentId: this.agentId,
      model: `${this.agentId}-audit-v1`,
      event: {
        decision: event.decision,
        toolName: event.toolName,
        riskScore: event.riskScore,
        reason: event.reason || null,
      },
      auditCategory,
      eventType,
      severity,
      impactArea: this._getImpactArea(auditCategory),
      compliance,
      retention,
      context: this._sanitizeContext(context),
    };
  }

  _classifyEvent() {
    return { auditCategory: 'general', eventType: 'unknown' };
  }

  _assessSeverity(event, context, auditCategory) {
    if (event.riskScore >= 86) return 'critical';
    if (event.decision === 'deny') return 'high';
    if (event.riskScore >= 61) return 'high';
    if (event.riskScore >= 31) return 'medium';
    return 'low';
  }

  _mapCompliance() { return []; }

  _getImpactArea(auditCategory) {
    const areas = {
      'suitability-assessment': 'client-protection',
      'suitability-override': 'client-protection',
      'proposal-generation': 'client-protection',
      'client-report-delivery': 'client-communication',
      'art52-disclosure-enforcement': 'ai-transparency',
      'gdpr-opt-out-processing': 'data-protection',
      'gdpr-breach-assessment': 'data-protection',
      'soe-violation': 'security',
      'human-oversight-gate': 'ai-governance',
    };
    return areas[auditCategory] || 'advisory';
  }

  _getRetention(auditCategory) {
    return RETENTION[auditCategory] || { years: 7, reason: 'Default advisory retention' };
  }

  _sanitizeContext(context) {
    const clean = {};
    for (const key of this.allowedContextKeys) {
      if (context[key] !== undefined) clean[key] = context[key];
    }
    return clean;
  }
}

// ── Suitability Checker Audit Model ──────────────────────────────────────

class SuitabilityCheckerAuditModel extends BaseAuditModel {
  constructor() { super('suitability-checker'); }

  _classifyEvent(event, context) {
    if (context?.suitabilityOverride) {
      return { auditCategory: 'suitability-override', eventType: 'advisor-override' };
    }
    if (context?.gdprConsentNotChecked) {
      return { auditCategory: 'gdpr-opt-out-processing', eventType: 'consent-not-checked' };
    }
    if (context?.prePublicationAccessAttempt || context?.crmWriteAttempt) {
      return { auditCategory: 'soe-violation', eventType: 'unauthorized-access-blocked' };
    }
    if (context?.piiAccessAttempt) {
      return { auditCategory: 'soe-violation', eventType: 'pii-access-blocked' };
    }
    if (context?.suitabilityDetermination) {
      return { auditCategory: 'suitability-assessment', eventType: `determination-${context.suitabilityDetermination}` };
    }
    return { auditCategory: 'suitability-assessment', eventType: 'suitability-action' };
  }

  _mapCompliance(event, context, auditCategory) {
    const compliance = [];

    compliance.push({
      framework: 'MiFID II',
      articles: [{ ref: 'Art.25', status: 'compliant', scope: 'suitability-assessment' }],
    });

    if (context?.suitabilityOverride) {
      compliance.push({
        framework: 'SEC Advisers Act',
        articles: [{ ref: 'Rule-204-2', status: 'override-documented', scope: 'fiduciary-duty' }],
      });
    }

    if (context?.gdprConsentNotChecked) {
      compliance.push({
        framework: 'GDPR',
        articles: [{ ref: 'Art.6', status: 'consent-not-verified', scope: 'lawful-basis' }],
      });
    }

    if (context?.prePublicationAccessAttempt) {
      compliance.push({
        framework: 'MAR',
        articles: [{ ref: 'Art.10', status: 'violation-blocked', scope: 'MNPI-isolation' }],
      });
    }

    return compliance;
  }
}

// ── Proposal Generator Audit Model ───────────────────────────────────────

class ProposalGeneratorAuditModel extends BaseAuditModel {
  constructor() { super('proposal-generator'); }

  _classifyEvent(event, context) {
    if (context?.art52DisclosureMissing) {
      return { auditCategory: 'art52-disclosure-enforcement', eventType: 'disclosure-missing-blocked' };
    }
    if (context?.suitabilityCheckBypassed) {
      return { auditCategory: 'soe-violation', eventType: 'suitability-bypass-blocked' };
    }
    if (context?.deliveryPathWriteAttempt) {
      return { auditCategory: 'soe-violation', eventType: 'delivery-path-write-blocked' };
    }
    if (context?.prePublicationAccessAttempt) {
      return { auditCategory: 'soe-violation', eventType: 'pre-publication-access-blocked' };
    }
    if (context?.gdprArt22OptOut) {
      return { auditCategory: 'gdpr-opt-out-processing', eventType: 'art22-optout-proposal' };
    }
    if (context?.proposalType) {
      return { auditCategory: 'proposal-generation', eventType: `proposal-${context.proposalType}` };
    }
    return { auditCategory: 'proposal-generation', eventType: 'proposal-action' };
  }

  _assessSeverity(event, context, auditCategory) {
    // Art.52 missing is always critical
    if (context?.art52DisclosureMissing) return 'critical';
    if (context?.deliveryPathWriteAttempt) return 'critical';
    if (context?.suitabilityCheckBypassed) return 'critical';
    return super._assessSeverity(event, context, auditCategory);
  }

  _mapCompliance(event, context, auditCategory) {
    const compliance = [];

    if (context?.art52DisclosureMissing) {
      compliance.push({
        framework: 'EU AI Act',
        articles: [{ ref: 'Art.52', status: 'violation-blocked', scope: 'ai-transparency' }],
      });
    }

    if (context?.proposalType === 'erisa-client') {
      compliance.push({
        framework: 'ERISA',
        articles: [{ ref: 'Section-406', status: 'prohibited-transaction-check', scope: 'fiduciary' }],
      });
    }

    if (context?.gdprArt22OptOut) {
      compliance.push({
        framework: 'GDPR',
        articles: [{ ref: 'Art.22', status: context?.deliberativeReviewTagged ? 'opt-out-handled' : 'opt-out-review-missing', scope: 'automated-decision' }],
      });
    }

    if (context?.deliveryPathWriteAttempt) {
      compliance.push({
        framework: 'EU AI Act',
        articles: [{ ref: 'Art.14', status: 'violation-blocked', scope: 'human-oversight' }],
      });
    }

    if (context?.suitabilityCheckBypassed) {
      compliance.push({
        framework: 'MiFID II',
        articles: [{ ref: 'Art.25', status: 'violation-blocked', scope: 'suitability-gate' }],
      });
    }

    if (context?.crossSellingDetected) {
      compliance.push({
        framework: 'MiFID II',
        articles: [{ ref: 'Art.24', status: 'cross-selling-flagged', scope: 'conduct-of-business' }],
      });
    }

    return compliance;
  }
}

// ── Client Reporter Audit Model ──────────────────────────────────────────

class ClientReporterAuditModel extends BaseAuditModel {
  constructor() { super('client-reporter'); }

  _classifyEvent(event, context) {
    if (context?.art52DisclosureMissing) {
      return { auditCategory: 'art52-disclosure-enforcement', eventType: 'report-disclosure-missing-blocked' };
    }
    if (context?.crossClientAccessAttempt) {
      return { auditCategory: 'gdpr-breach-assessment', eventType: 'cross-client-access-blocked' };
    }
    if (context?.prePublicationAccessAttempt || context?.crmWriteAttempt) {
      return { auditCategory: 'soe-violation', eventType: 'unauthorized-access-blocked' };
    }
    if (context?.reportType) {
      return { auditCategory: 'client-report-delivery', eventType: `report-${context.reportType}` };
    }
    return { auditCategory: 'client-report-delivery', eventType: 'reporting-action' };
  }

  _assessSeverity(event, context, auditCategory) {
    if (context?.crossClientAccessAttempt) return 'critical';
    if (context?.art52DisclosureMissing) return 'critical';
    return super._assessSeverity(event, context, auditCategory);
  }

  _mapCompliance(event, context, auditCategory) {
    const compliance = [];

    compliance.push({
      framework: 'MiFID II',
      articles: [{ ref: 'Art.24', status: 'compliant', scope: 'client-reporting' }],
    });

    if (context?.art52DisclosureMissing) {
      compliance.push({
        framework: 'EU AI Act',
        articles: [{ ref: 'Art.52', status: 'violation-blocked', scope: 'ai-transparency' }],
      });
    }

    if (context?.crossClientAccessAttempt) {
      compliance.push({
        framework: 'GDPR',
        articles: [{ ref: 'Art.5(1)(f)', status: 'breach-assessment-triggered', scope: 'integrity-confidentiality' }],
      });
      compliance.push({
        framework: 'GDPR',
        articles: [{ ref: 'Art.33', status: 'breach-assessment-required', scope: 'notification' }],
      });
    }

    if (context?.reportType === 'sfdr-art9') {
      compliance.push({
        framework: 'SFDR',
        articles: [{ ref: 'Art.9', status: 'disclosure-generated', scope: 'sustainability' }],
      });
    }

    return compliance;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const MODELS = {
  'suitability-checker': SuitabilityCheckerAuditModel,
  'proposal-generator': ProposalGeneratorAuditModel,
  'client-reporter': ClientReporterAuditModel,
};

function createAuditModel(agentId) {
  const ModelClass = MODELS[agentId];
  if (!ModelClass) return new BaseAuditModel(agentId);
  return new ModelClass();
}

function listAuditModels() {
  return Object.keys(MODELS);
}

export {
  BaseAuditModel,
  SuitabilityCheckerAuditModel,
  ProposalGeneratorAuditModel,
  ClientReporterAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
};

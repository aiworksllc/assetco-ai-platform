/**
 * Audit Models — ComplianceShield Application
 *
 * Domain-specific Chronicle audit classification for ComplianceShield agents:
 *   - TradeSurveillerAuditModel (surveillance alerts, STR candidates, pattern logs)
 *   - PositionReporterAuditModel (report generation, deadline tracking)
 *   - BreachDetectorAuditModel (breach escalation, info barrier violations)
 *   - RegulatoryFilerAuditModel (filing preparation, validation, status transitions)
 *
 * Audit Categories:
 *   - trade-surveillance-alert (10yr — FINRA 3110)
 *   - str-candidate (7yr — MAR Art.16)
 *   - position-report-generation (7yr — MiFIR RTS 25, EMIR Art.9)
 *   - breach-escalation (7yr, fraud=indefinite — SOX)
 *   - information-barrier-violation (10yr — SOX, SEC 17a-4)
 *   - regulatory-filing-preparation (7yr — SEC 17a-4, FINRA 4511)
 *   - sox-evidence (10yr — SOX Section 802)
 *   - dora-operational (7yr — DORA Art.12)
 */

import { randomUUID } from 'node:crypto';

// ── Retention Schedule ───────────────────────────────────────────────────

const RETENTION = {
  'trade-surveillance-alert':       { years: 10, reason: 'FINRA Rule 3110 — supervisory system records (7yr) + AssetCo buffer' },
  'str-candidate':                  { years: 7,  reason: 'MAR Art.16 — STOR records (5yr) + FINRA buffer' },
  'position-report-generation':     { years: 7,  reason: 'MiFIR RTS 25 — transaction records (5yr) + buffer' },
  'breach-escalation':              { years: 7,  reason: 'SOX — internal controls evidence (7yr)' },
  'breach-escalation-fraud':        { years: 99, reason: 'SOX Section 802 — fraud-related document retention (indefinite)' },
  'information-barrier-violation':  { years: 10, reason: 'SOX, SEC Rule 17a-4 — information barrier evidence' },
  'regulatory-filing-preparation':  { years: 7,  reason: 'SEC Rule 17a-4, FINRA 4511 — filing records' },
  'sox-evidence':                   { years: 10, reason: 'SOX Section 802 — internal controls evidence packages' },
  'dora-operational':               { years: 7,  reason: 'DORA Art.12 — operational resilience logs (5yr) + buffer' },
};

// ── Regulatory Frameworks ────────────────────────────────────────────────

const FRAMEWORKS = {
  FINRA_3110:  { name: 'FINRA Rule 3110', scope: 'Supervisory systems and procedures' },
  MAR:         { name: 'MAR', scope: 'Market abuse regulation — Art.12, Art.16' },
  EMIR:        { name: 'EMIR', scope: 'Art.9 — trade reporting obligation' },
  MIFIR:       { name: 'MiFIR', scope: 'RTS 25 — transaction reporting' },
  SOX:         { name: 'SOX', scope: 'Section 302/404 — internal controls; Section 802 — document retention' },
  DORA:        { name: 'DORA', scope: 'Art.10/12 — operational resilience' },
  SEC_17a4:    { name: 'SEC Rule 17a-4', scope: 'Books and records retention' },
  FINRA_4511:  { name: 'FINRA 4511', scope: 'Books and records — general retention' },
};

// ── Base Audit Model ─────────────────────────────────────────────────────

class BaseAuditModel {
  constructor(agentId) {
    this.agentId = agentId;
    this.allowedContextKeys = [
      'alertType', 'patternType', 'patternSeverity', 'instrumentId', 'sourceAgent',
      'evidencePaths', 'alertFilePath', 'reportType', 'recordCount', 'reportingPeriod',
      'regulatoryDeadline', 'completionLeadTime', 'sourceDataChecksum', 'outputFilePath',
      'breachType', 'sourceEventId', 'notifiedPersons', 'acknowledgmentTimestamp',
      'filingType', 'status', 'validationResult', 'rejectionCode', 'barrierName',
      'violatingAgent', 'attemptedPath', 'strCandidateGenerated', 'soeDecision',
      'dispositionStatus', 'hoursToDeadline', 'falsePositiveRatePct',
    ];
  }

  classify(event, context = {}) {
    const { auditCategory, eventType } = this._classifyEvent(event, context);
    const severity = this._assessSeverity(event, context, auditCategory);
    const compliance = this._mapCompliance(event, context, auditCategory);
    const retention = this._getRetention(auditCategory, context);

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

  _classifyEvent(event) {
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
      'trade-surveillance-alert': 'market-integrity',
      'str-candidate': 'market-integrity',
      'position-report-generation': 'regulatory-reporting',
      'breach-escalation': 'internal-controls',
      'breach-escalation-fraud': 'internal-controls',
      'information-barrier-violation': 'information-security',
      'regulatory-filing-preparation': 'regulatory-reporting',
      'sox-evidence': 'internal-controls',
      'dora-operational': 'operational-resilience',
    };
    return areas[auditCategory] || 'compliance';
  }

  _getRetention(auditCategory, context) {
    // Fraud-related breach escalations get indefinite retention
    if (auditCategory === 'breach-escalation' && context?.fraudRelated) {
      return RETENTION['breach-escalation-fraud'];
    }
    return RETENTION[auditCategory] || { years: 7, reason: 'Default compliance retention' };
  }

  _sanitizeContext(context) {
    const clean = {};
    for (const key of this.allowedContextKeys) {
      if (context[key] !== undefined) clean[key] = context[key];
    }
    return clean;
  }
}

// ── Trade Surveiller Audit Model ─────────────────────────────────────────

class TradeSurveillerAuditModel extends BaseAuditModel {
  constructor() { super('trade-surveiller'); }

  _classifyEvent(event, context) {
    if (context?.strCandidateGenerated) {
      return { auditCategory: 'str-candidate', eventType: 'str-candidate-generated' };
    }
    if (context?.patternDetected) {
      return { auditCategory: 'trade-surveillance-alert', eventType: 'pattern-detected' };
    }
    if (context?.tradingSystemWriteAttempt || context?.evidenceTamperAttempt) {
      return { auditCategory: 'sox-evidence', eventType: 'integrity-violation-attempt' };
    }
    if (context?.piiAccessAttempt) {
      return { auditCategory: 'trade-surveillance-alert', eventType: 'pii-access-blocked' };
    }
    if (event.toolName?.includes('alert-generator') || event.toolName?.includes('alert')) {
      return { auditCategory: 'trade-surveillance-alert', eventType: 'surveillance-alert-generated' };
    }
    if (event.toolName?.includes('pattern-detector') || event.toolName?.includes('pattern')) {
      return { auditCategory: 'trade-surveillance-alert', eventType: 'pattern-scan-completed' };
    }
    return { auditCategory: 'trade-surveillance-alert', eventType: 'surveillance-action' };
  }

  _mapCompliance(event, context, auditCategory) {
    const compliance = [];
    compliance.push({
      framework: 'FINRA 3110',
      articles: [{ ref: 'Rule-3110', status: 'compliant', scope: 'supervisory-system' }],
    });

    if (context?.patternDetected) {
      compliance.push({
        framework: 'MAR',
        articles: [{ ref: 'Art.12', status: 'pattern-detected', scope: context.patternType || 'unknown' }],
      });
    }
    if (context?.strCandidateGenerated) {
      compliance.push({
        framework: 'MAR',
        articles: [{ ref: 'Art.16', status: 'str-candidate-created', scope: 'filing-obligation' }],
      });
    }
    if (context?.tradingSystemWriteAttempt) {
      compliance.push({
        framework: 'SOX',
        articles: [{ ref: 'Section-302', status: 'violation-blocked', scope: 'internal-controls' }],
      });
    }
    return compliance;
  }
}

// ── Position Reporter Audit Model ────────────────────────────────────────

class PositionReporterAuditModel extends BaseAuditModel {
  constructor() { super('position-reporter'); }

  _classifyEvent(event, context) {
    if (context?.sourceDataWriteAttempt) {
      return { auditCategory: 'sox-evidence', eventType: 'source-data-write-blocked' };
    }
    if (context?.sourceDataChecksumMismatch) {
      return { auditCategory: 'position-report-generation', eventType: 'checksum-mismatch-detected' };
    }
    if (context?.reportType) {
      return { auditCategory: 'position-report-generation', eventType: 'report-generated' };
    }
    if (event.toolName?.includes('generator') || event.toolName?.includes('report')) {
      return { auditCategory: 'position-report-generation', eventType: 'report-generated' };
    }
    return { auditCategory: 'position-report-generation', eventType: 'reporting-action' };
  }

  _mapCompliance(event, context, auditCategory) {
    const compliance = [];
    const reportType = context?.reportType;

    if (reportType === 'EMIR_TR') {
      compliance.push({
        framework: 'EMIR',
        articles: [{ ref: 'Art.9', status: 'report-generated', scope: 'trade-reporting' }],
      });
    }
    if (reportType === 'MIFIR_RTS25') {
      compliance.push({
        framework: 'MiFIR',
        articles: [{ ref: 'RTS-25', status: 'report-generated', scope: 'transaction-reporting' }],
      });
    }
    if (reportType === 'SEC_13F') {
      compliance.push({
        framework: 'SEC Rule 17a-4',
        articles: [{ ref: 'Rule-17a-4', status: 'report-generated', scope: 'position-reporting' }],
      });
    }
    if (reportType === 'FINRA_FOCUS') {
      compliance.push({
        framework: 'FINRA 4511',
        articles: [{ ref: 'Rule-4511', status: 'report-generated', scope: 'FOCUS-report' }],
      });
    }
    if (context?.sourceDataWriteAttempt) {
      compliance.push({
        framework: 'SEC Rule 17a-4',
        articles: [{ ref: 'Rule-17a-4', status: 'violation-blocked', scope: 'records-integrity' }],
      });
    }
    return compliance;
  }
}

// ── Breach Detector Audit Model ──────────────────────────────────────────

class BreachDetectorAuditModel extends BaseAuditModel {
  constructor() { super('breach-detector'); }

  _classifyEvent(event, context) {
    if (context?.informationBarrierCrossing) {
      return { auditCategory: 'information-barrier-violation', eventType: 'barrier-crossing-detected' };
    }
    if (context?.soeModificationAttempt || context?.riskLimitModifyAttempt) {
      return { auditCategory: 'sox-evidence', eventType: 'controls-modification-blocked' };
    }
    if (context?.evidenceDeletionAttempt) {
      return { auditCategory: 'sox-evidence', eventType: 'evidence-deletion-blocked' };
    }
    if (context?.soeViolationDetected) {
      return { auditCategory: 'breach-escalation', eventType: 'soe-violation-escalated' };
    }
    if (context?.riskLimitBreach) {
      return { auditCategory: 'breach-escalation', eventType: 'risk-limit-breach-escalated' };
    }
    if (context?.escalationSlaBreached) {
      return { auditCategory: 'dora-operational', eventType: 'escalation-sla-breached' };
    }
    if (event.toolName?.includes('escalation') || event.toolName?.includes('alert')) {
      return { auditCategory: 'breach-escalation', eventType: 'breach-alert-generated' };
    }
    return { auditCategory: 'breach-escalation', eventType: 'monitoring-action' };
  }

  _assessSeverity(event, context, auditCategory) {
    // Information barrier violations are always critical
    if (auditCategory === 'information-barrier-violation') return 'critical';
    if (context?.soeModificationAttempt || context?.riskLimitModifyAttempt || context?.evidenceDeletionAttempt) return 'critical';
    return super._assessSeverity(event, context, auditCategory);
  }

  _mapCompliance(event, context, auditCategory) {
    const compliance = [];

    if (context?.informationBarrierCrossing) {
      compliance.push({
        framework: 'SOX',
        articles: [{ ref: 'Section-302', status: 'barrier-crossing-detected', scope: 'information-barriers' }],
      });
      compliance.push({
        framework: 'SEC Rule 17a-4',
        articles: [{ ref: 'Rule-17a-4', status: 'violation-logged', scope: 'information-barrier-evidence' }],
      });
    }
    if (context?.soeViolationDetected) {
      compliance.push({
        framework: 'DORA',
        articles: [{ ref: 'Art.10', status: 'violation-detected', scope: 'operational-resilience' }],
      });
    }
    if (context?.soeModificationAttempt || context?.riskLimitModifyAttempt) {
      compliance.push({
        framework: 'SOX',
        articles: [{ ref: 'Section-404', status: 'violation-blocked', scope: 'internal-controls-integrity' }],
      });
    }
    if (context?.evidenceDeletionAttempt) {
      compliance.push({
        framework: 'SEC Rule 17a-4',
        articles: [{ ref: 'Rule-17a-4', status: 'violation-blocked', scope: 'records-retention' }],
      });
    }
    if (context?.escalationSlaBreached) {
      compliance.push({
        framework: 'DORA',
        articles: [{ ref: 'Art.10', status: 'sla-breached', scope: 'notification-timeliness' }],
      });
    }
    return compliance;
  }
}

// ── Regulatory Filer Audit Model ─────────────────────────────────────────

class RegulatoryFilerAuditModel extends BaseAuditModel {
  constructor() { super('regulatory-filer'); }

  _classifyEvent(event, context) {
    if (context?.statusTransition === 'SUBMITTED' || context?.statusTransition === 'APPROVED') {
      return { auditCategory: 'sox-evidence', eventType: 'unauthorized-status-transition-blocked' };
    }
    if (context?.regulatoryPortalAccessAttempt) {
      return { auditCategory: 'sox-evidence', eventType: 'portal-access-blocked' };
    }
    if (context?.sourceReportModifyAttempt) {
      return { auditCategory: 'sox-evidence', eventType: 'source-report-modify-blocked' };
    }
    if (context?.filingRejected) {
      return { auditCategory: 'regulatory-filing-preparation', eventType: 'filing-rejected' };
    }
    if (context?.validationFailed) {
      return { auditCategory: 'regulatory-filing-preparation', eventType: 'validation-failed' };
    }
    if (context?.filingType) {
      return { auditCategory: 'regulatory-filing-preparation', eventType: 'filing-prepared' };
    }
    if (event.toolName?.includes('formatter') || event.toolName?.includes('filer')) {
      return { auditCategory: 'regulatory-filing-preparation', eventType: 'filing-formatted' };
    }
    if (event.toolName?.includes('validation')) {
      return { auditCategory: 'regulatory-filing-preparation', eventType: 'validation-run' };
    }
    return { auditCategory: 'regulatory-filing-preparation', eventType: 'filing-action' };
  }

  _mapCompliance(event, context, auditCategory) {
    const compliance = [];
    const filingType = context?.filingType;

    if (filingType === 'EMIR_TR') {
      compliance.push({
        framework: 'EMIR',
        articles: [{ ref: 'Art.9', status: 'filing-prepared', scope: 'trade-reporting' }],
      });
    }
    if (filingType === 'MIFIR_RTS25') {
      compliance.push({
        framework: 'MiFIR',
        articles: [{ ref: 'RTS-25', status: 'filing-prepared', scope: 'transaction-reporting' }],
      });
    }
    if (filingType === 'SOX_302' || filingType === 'SOX_404') {
      compliance.push({
        framework: 'SOX',
        articles: [{ ref: filingType === 'SOX_302' ? 'Section-302' : 'Section-404', status: 'filing-prepared', scope: 'internal-controls' }],
      });
    }
    if (filingType === 'SEC_13F') {
      compliance.push({
        framework: 'SEC Rule 17a-4',
        articles: [{ ref: 'Rule-17a-4', status: 'filing-prepared', scope: '13F-quarterly' }],
      });
    }
    if (filingType === 'FINRA_FOCUS') {
      compliance.push({
        framework: 'FINRA 4511',
        articles: [{ ref: 'Rule-4511', status: 'filing-prepared', scope: 'FOCUS-report' }],
      });
    }
    if (context?.statusTransition === 'SUBMITTED' || context?.statusTransition === 'APPROVED') {
      compliance.push({
        framework: 'SOX',
        articles: [{ ref: 'Section-404', status: 'violation-blocked', scope: 'human-only-transition' }],
      });
    }
    if (context?.regulatoryPortalAccessAttempt) {
      compliance.push({
        framework: 'SOX',
        articles: [{ ref: 'Section-302', status: 'violation-blocked', scope: 'submission-authority' }],
      });
    }
    return compliance;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const MODELS = {
  'trade-surveiller': TradeSurveillerAuditModel,
  'position-reporter': PositionReporterAuditModel,
  'breach-detector': BreachDetectorAuditModel,
  'regulatory-filer': RegulatoryFilerAuditModel,
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
  TradeSurveillerAuditModel,
  PositionReporterAuditModel,
  BreachDetectorAuditModel,
  RegulatoryFilerAuditModel,
  createAuditModel,
  listAuditModels,
  RETENTION,
};

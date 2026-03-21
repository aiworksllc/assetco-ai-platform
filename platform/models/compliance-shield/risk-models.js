/**
 * Risk Models — ComplianceShield Application
 *
 * Domain-specific Arbiter risk scoring for ComplianceShield agents:
 *   - TradeSurveillerRiskModel (broadest read, zero write to trading, continuous monitoring)
 *   - PositionReporterRiskModel (batch report generation, T+1 deadline tracking)
 *   - BreachDetectorRiskModel (SOE/risk breach monitoring, escalation generation)
 *   - RegulatoryFilerRiskModel (filing preparation, validation, status transitions)
 *
 * ComplianceShield risk philosophy differs from trading agents: risk is calibrated
 * around surveillance gaps and reporting failures, not harmful actions.
 *
 * Risk Categories:
 *   A: Surveillance Coverage (gaps, heartbeat failures, source system connectivity)
 *   B: Reporting Quality (timeliness, accuracy, false positive rate)
 *   C: Escalation Effectiveness (response time, acknowledgment SLA)
 *   D: Security & Integrity (evidence tampering, SOE modification, trading system write)
 *
 * Thresholds: Green (0-30), Yellow (31-60), Red (61-85), Critical (86-100)
 *
 * Regulatory basis:
 *   - FINRA Rule 3110 (supervision)
 *   - MAR Art.16 (STR obligation)
 *   - EMIR Art.9 (trade reporting)
 *   - MiFIR RTS 25 (transaction reporting)
 *   - SOX Section 302/404 (internal controls)
 *   - DORA Art.10/12 (operational resilience)
 *   - SEC Rule 17a-4 (records retention)
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

// ── Trade Surveiller Risk Model ──────────────────────────────────────────

class TradeSurveillerRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('trade-surveiller', { baselineScore: 2, ...config });
    this.riskBudget = { dailyLimit: 500, escalateAt: 300, freezeOnBreach: false };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Category A: Surveillance Coverage
    const heartbeatGapMinutes = context?.heartbeatGapMinutes || 0;
    if (heartbeatGapMinutes > 3) {
      factors.push({ name: 'surveillance-gap', impact: 40, reason: `${heartbeatGapMinutes}min heartbeat gap — FINRA 3110 continuous supervision requirement at risk` });
    } else if (heartbeatGapMinutes > 1) {
      factors.push({ name: 'heartbeat-delay', impact: 10, reason: `${heartbeatGapMinutes}min heartbeat delay — monitoring` });
    }

    const sourceSystemsDown = context?.sourceSystemsDown || 0;
    if (sourceSystemsDown > 0) {
      factors.push({ name: 'source-system-outage', impact: 30 * sourceSystemsDown, reason: `${sourceSystemsDown} source system(s) offline — surveillance coverage degraded` });
    }

    // Category B: Reporting Quality
    const falsePositiveRatePct = context?.falsePositiveRatePct || 0;
    if (falsePositiveRatePct > 40) {
      factors.push({ name: 'high-false-positive-rate', impact: 25, reason: `${falsePositiveRatePct}% false positive rate — alert fatigue risk per FINRA 3110` });
    } else if (falsePositiveRatePct > 25) {
      factors.push({ name: 'elevated-false-positive-rate', impact: 10, reason: `${falsePositiveRatePct}% false positive rate — above target threshold` });
    }

    // Pattern detection
    if (context?.patternDetected) {
      const severity = context.patternSeverity === 'high' ? 20 : 10;
      factors.push({ name: 'pattern-detected', impact: severity, reason: `Surveillance pattern: ${context.patternType || 'unknown'} — STR candidate evaluation required` });
    }

    if (context?.strCandidateGenerated) {
      factors.push({ name: 'str-candidate', impact: 15, reason: 'STR candidate generated — MAR Art.16 filing obligation assessment' });
    }

    // Category D: Security
    if (context?.tradingSystemWriteAttempt) {
      factors.push({ name: 'trading-write-attempt', impact: 95, reason: 'Attempted write to trading system — surveillance read-only authority violated' });
    }

    if (context?.evidenceTamperAttempt) {
      factors.push({ name: 'evidence-tampering', impact: 95, reason: 'Attempted modification of surveillance evidence — integrity violation' });
    }

    if (context?.piiAccessAttempt) {
      factors.push({ name: 'pii-access', impact: 50, reason: 'Attempted access to client PII — surveillance does not require biographical PII' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    flags.push({
      flag: 'FINRA-3110',
      reason: 'Trade surveillance — supervisory system compliance',
      action: 'log',
    });

    if (context?.patternDetected) {
      flags.push({
        flag: 'MAR-Art.12',
        reason: `Market abuse pattern detected: ${context.patternType || 'unknown'}`,
        action: 'create-str-candidate',
        severity: context.patternSeverity === 'high' ? 'critical' : 'elevated',
      });
    }

    if (context?.strCandidateGenerated) {
      flags.push({
        flag: 'MAR-Art.16',
        reason: 'STR candidate generated — compliance officer review required',
        action: 'route-to-compliance',
      });
    }

    if (context?.heartbeatGapMinutes > 3) {
      flags.push({
        flag: 'DORA-Art.10',
        reason: `Surveillance gap of ${context.heartbeatGapMinutes}min — operational resilience concern`,
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.tradingSystemWriteAttempt) {
      flags.push({
        flag: 'SOX-302',
        reason: 'Surveillance agent attempted trading system write — internal controls violation',
        action: 'critical-escalate-cco',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Position Reporter Risk Model ─────────────────────────────────────────

class PositionReporterRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('position-reporter', { baselineScore: 2, ...config });
    this.riskBudget = { dailyLimit: 200, escalateAt: 150, freezeOnBreach: true };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Category B: Reporting Quality
    const recordCount = context?.recordCount || 0;
    if (recordCount > 10000) {
      factors.push({ name: 'large-report', impact: 10, reason: `${recordCount} records — large report scope` });
    } else if (recordCount > 1000) {
      factors.push({ name: 'medium-report', impact: 5, reason: `${recordCount} records — standard report scope` });
    } else {
      factors.push({ name: 'small-report', impact: 1, reason: 'Small report scope' });
    }

    // Deadline proximity
    const hoursToDeadline = context?.hoursToDeadline;
    if (hoursToDeadline !== undefined && hoursToDeadline <= 2) {
      factors.push({ name: 'critical-deadline', impact: 40, reason: `${hoursToDeadline}hr to regulatory deadline — CRITICAL proximity` });
    } else if (hoursToDeadline !== undefined && hoursToDeadline <= 4) {
      factors.push({ name: 'near-deadline', impact: 20, reason: `${hoursToDeadline}hr to regulatory deadline — HIGH proximity` });
    }

    // Validation failure
    if (context?.validationFailed) {
      factors.push({ name: 'validation-failure', impact: 30, reason: 'Report schema validation failed — cannot proceed to PENDING_REVIEW' });
    }

    // Source data checksum mismatch
    if (context?.sourceDataChecksumMismatch) {
      factors.push({ name: 'checksum-mismatch', impact: 50, reason: 'Source data checksum mismatch — data may have been modified since report generation began' });
    }

    // Category D: Security
    if (context?.sourceDataWriteAttempt) {
      factors.push({ name: 'source-write-attempt', impact: 95, reason: 'Attempted write to source position data — reporting agent is read-only' });
    }

    if (context?.filingPathWriteAttempt) {
      factors.push({ name: 'filing-write-attempt', impact: 60, reason: 'Attempted write to compliance/filings/ — position-reporter writes to compliance/reports/ only' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    // Determine report type
    const reportType = context?.reportType;
    if (reportType === 'EMIR_TR' || reportType === 'MIFIR_RTS25') {
      flags.push({
        flag: 'EMIR-Art.9',
        reason: `${reportType} report — T+1 hard deadline`,
        action: 'log',
      });
    }

    if (reportType === 'SEC_13F') {
      flags.push({
        flag: 'SEC-13F',
        reason: 'SEC 13F quarterly position report',
        action: 'log',
      });
    }

    if (reportType === 'FINRA_FOCUS') {
      flags.push({
        flag: 'FINRA-FOCUS',
        reason: 'FINRA FOCUS report generation',
        action: 'log',
      });
    }

    if (context?.hoursToDeadline !== undefined && context.hoursToDeadline <= 2) {
      flags.push({
        flag: 'MiFIR-RTS25',
        reason: `Critical deadline proximity — ${context.hoursToDeadline}hr remaining`,
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.sourceDataWriteAttempt) {
      flags.push({
        flag: 'SEC-17a-4',
        reason: 'Reporting agent attempted source data modification — records integrity violation',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Breach Detector Risk Model ───────────────────────────────────────────

class BreachDetectorRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('breach-detector', { baselineScore: 2, ...config });
    this.riskBudget = { dailyLimit: 300, escalateAt: 200, freezeOnBreach: false };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Breach severity
    const breachSeverity = context?.breachSeverity;
    if (breachSeverity === 'critical') {
      factors.push({ name: 'critical-breach', impact: 25, reason: 'CRITICAL severity breach detected — immediate escalation required' });
    } else if (breachSeverity === 'high') {
      factors.push({ name: 'high-breach', impact: 15, reason: 'HIGH severity breach detected — same-day escalation required' });
    } else if (breachSeverity === 'medium') {
      factors.push({ name: 'medium-breach', impact: 5, reason: 'MEDIUM severity breach — standard monitoring' });
    }

    // Breach type
    if (context?.informationBarrierCrossing) {
      factors.push({ name: 'info-barrier-crossing', impact: 40, reason: 'Information barrier crossing attempt detected — CRITICAL alert to CCO' });
    }

    if (context?.soeViolationDetected) {
      factors.push({ name: 'soe-violation', impact: 20, reason: 'SOE violation event detected — breach classification required' });
    }

    if (context?.riskLimitBreach) {
      factors.push({ name: 'risk-limit-breach', impact: 15, reason: 'Risk limit breach detected — escalation to risk committee' });
    }

    // Escalation SLA
    const escalationSlaBreached = context?.escalationSlaBreached;
    if (escalationSlaBreached) {
      factors.push({ name: 'sla-breach', impact: 30, reason: 'Escalation acknowledgment SLA breached — re-escalation triggered' });
    }

    // Category D: Security
    if (context?.soeModificationAttempt) {
      factors.push({ name: 'soe-modify-attempt', impact: 95, reason: 'Attempted modification of SOE definitions — breach-detector is observe-only' });
    }

    if (context?.riskLimitModifyAttempt) {
      factors.push({ name: 'risk-limit-modify', impact: 95, reason: 'Attempted modification of risk limits — breach-detector cannot remediate' });
    }

    if (context?.evidenceDeletionAttempt) {
      factors.push({ name: 'evidence-deletion', impact: 95, reason: 'Attempted deletion of compliance evidence — integrity violation' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    if (context?.informationBarrierCrossing) {
      flags.push({
        flag: 'SOX-302',
        reason: 'Information barrier crossing detected — internal controls assessment required',
        action: 'critical-escalate-cco',
        severity: 'critical',
      });
    }

    if (context?.soeViolationDetected) {
      flags.push({
        flag: 'DORA-Art.10',
        reason: 'SOE violation detected — operational resilience monitoring',
        action: 'log-and-escalate',
      });
    }

    if (context?.escalationSlaBreached) {
      flags.push({
        flag: 'DORA-Art.10',
        reason: 'Escalation SLA breached — notification timeliness failure',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.soeModificationAttempt || context?.riskLimitModifyAttempt) {
      flags.push({
        flag: 'SOX-404',
        reason: 'Breach-detector attempted to modify controls — separation of duties violated',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.evidenceDeletionAttempt) {
      flags.push({
        flag: 'SEC-17a-4',
        reason: 'Evidence deletion attempt — records retention violation',
        action: 'critical-escalate-cco',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Regulatory Filer Risk Model ──────────────────────────────────────────

class RegulatoryFilerRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('regulatory-filer', { baselineScore: 2, ...config });
    this.riskBudget = { dailyLimit: 150, escalateAt: 100, freezeOnBreach: true };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Filing type complexity
    const filingType = context?.filingType;
    if (filingType === 'EMIR_TR' || filingType === 'MIFIR_RTS25') {
      factors.push({ name: 'eu-filing', impact: 10, reason: `${filingType} filing — T+1 hard deadline, zero tolerance for rejection` });
    } else if (filingType === 'FORM_PF' || filingType === 'SOX_302') {
      factors.push({ name: 'complex-filing', impact: 15, reason: `${filingType} filing — complex regulatory format` });
    } else if (filingType) {
      factors.push({ name: 'standard-filing', impact: 5, reason: `${filingType} filing — standard regulatory format` });
    }

    // Validation result
    if (context?.validationFailed) {
      factors.push({ name: 'validation-failure', impact: 30, reason: 'Filing schema validation failed — cannot proceed to PENDING_REVIEW' });
    }

    // Deadline proximity
    const hoursToDeadline = context?.hoursToDeadline;
    if (hoursToDeadline !== undefined && hoursToDeadline <= 2) {
      factors.push({ name: 'critical-deadline', impact: 40, reason: `${hoursToDeadline}hr to filing deadline — CRITICAL` });
    } else if (hoursToDeadline !== undefined && hoursToDeadline <= 4) {
      factors.push({ name: 'near-deadline', impact: 20, reason: `${hoursToDeadline}hr to filing deadline — HIGH priority` });
    }

    // Filing rejection
    if (context?.filingRejected) {
      factors.push({ name: 'filing-rejected', impact: 50, reason: 'Previous filing rejected by regulator — re-filing obligation triggered' });
    }

    // Status transition
    if (context?.statusTransition === 'SUBMITTED') {
      factors.push({ name: 'unauthorized-submit', impact: 95, reason: 'Attempted SUBMITTED status — human-only transition' });
    }
    if (context?.statusTransition === 'APPROVED') {
      factors.push({ name: 'unauthorized-approve', impact: 95, reason: 'Attempted APPROVED status — human-only transition' });
    }

    // Category D: Security
    if (context?.sourceReportModifyAttempt) {
      factors.push({ name: 'source-modify-attempt', impact: 95, reason: 'Attempted modification of source compliance reports — read-only access violated' });
    }

    if (context?.regulatoryPortalAccessAttempt) {
      factors.push({ name: 'portal-access-attempt', impact: 95, reason: 'Attempted direct access to regulatory portal — filing submission is human-only' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    const filingType = context?.filingType;
    if (filingType === 'EMIR_TR') {
      flags.push({ flag: 'EMIR-Art.9', reason: 'EMIR trade report filing preparation', action: 'log' });
    }
    if (filingType === 'MIFIR_RTS25') {
      flags.push({ flag: 'MiFIR-RTS25', reason: 'MiFIR transaction report filing preparation', action: 'log' });
    }
    if (filingType === 'SOX_302' || filingType === 'SOX_404') {
      flags.push({ flag: 'SOX-302', reason: `${filingType} internal controls filing`, action: 'log' });
    }
    if (filingType === 'SEC_13F') {
      flags.push({ flag: 'SEC-13F', reason: 'SEC 13F quarterly filing preparation', action: 'log' });
    }

    if (context?.filingRejected) {
      flags.push({
        flag: 'FINRA-4511',
        reason: 'Filing rejected — records retention and re-filing obligation',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.statusTransition === 'SUBMITTED' || context?.statusTransition === 'APPROVED') {
      flags.push({
        flag: 'SOX-404',
        reason: 'Agent attempted human-only status transition — internal controls violation',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.regulatoryPortalAccessAttempt) {
      flags.push({
        flag: 'SOX-302',
        reason: 'Agent attempted regulatory portal access — submission is human-only',
        action: 'critical-escalate-cco',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const MODELS = {
  'trade-surveiller': TradeSurveillerRiskModel,
  'position-reporter': PositionReporterRiskModel,
  'breach-detector': BreachDetectorRiskModel,
  'regulatory-filer': RegulatoryFilerRiskModel,
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
  TradeSurveillerRiskModel,
  PositionReporterRiskModel,
  BreachDetectorRiskModel,
  RegulatoryFilerRiskModel,
  createRiskModel,
  listModels,
};

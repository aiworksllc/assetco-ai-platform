/**
 * Risk Models — AdvisorLens Application
 *
 * Domain-specific Arbiter risk scoring for AdvisorLens agents:
 *   - SuitabilityCheckerRiskModel (suitability determination, risk profile deviation)
 *   - ProposalGeneratorRiskModel (draft-only, Art.52 enforcement, human approval gate)
 *   - ClientReporterRiskModel (client isolation, Art.52 enforcement, SFDR disclosures)
 *
 * AdvisorLens is the highest-risk regulatory environment in AssetCo:
 * fiduciary duty + GDPR + EU AI Act Art.52 = every error has direct legal consequence.
 *
 * Risk Categories:
 *   A: Suitability Assessment (determination outcome, risk profile deviation, override)
 *   B: Proposal Quality (complexity, ERISA, GDPR Art.22, magnitude)
 *   C: Disclosure Compliance (Art.52 missing, cost disclosure, risk warnings)
 *   D: Security & Integrity (delivery attempt, cross-client access, pre-pub research, CRM write)
 *
 * Thresholds: Green (0-30), Yellow (31-60), Red (61-85), Critical (86-100)
 *
 * Regulatory basis:
 *   - MiFID II Art.25 (suitability), Art.24 (conduct of business)
 *   - SEC Advisers Act (fiduciary duty)
 *   - EU AI Act Art.52 (transparency — AI disclosure)
 *   - GDPR Art.22 (automated decision-making opt-out)
 *   - ERISA (prohibited transactions)
 *   - SFDR Art.8/9 (sustainability disclosures)
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

// ── Suitability Checker Risk Model ───────────────────────────────────────

class SuitabilityCheckerRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('suitability-checker', { baselineScore: 3, ...config });
    this.riskBudget = { dailyLimit: 500, escalateAt: 350, freezeOnBreach: true };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Category A: Suitability Assessment
    const determination = context?.suitabilityDetermination;
    if (determination === 'suitable') {
      const isComplex = context?.productComplexityClass === 'complex';
      factors.push({ name: 'suitability-suitable', impact: isComplex ? 8 : 5, reason: `Suitable determination${isComplex ? ' — complex product, elevated scrutiny' : ''}` });
    } else if (determination === 'requires-review') {
      const isRetail = context?.clientCategory === 'retail';
      factors.push({ name: 'suitability-review', impact: isRetail ? 30 : 15, reason: `Requires-review determination${isRetail ? ' — retail client, MiFID II enhanced protection' : ''}` });
    } else if (determination === 'unsuitable') {
      factors.push({ name: 'suitability-unsuitable', impact: 25, reason: 'Unsuitable determination — high risk, documented rationale required' });
    }

    // Suitability override
    if (context?.suitabilityOverride) {
      const noSignOff = !context?.complianceSignOff;
      factors.push({ name: 'suitability-override', impact: noSignOff ? 75 : 50, reason: `Advisor override of unsuitable determination${noSignOff ? ' — NO compliance sign-off' : ' — with compliance sign-off'}` });
    }

    // Risk profile deviation
    const riskDeviation = context?.riskProfileDeviationBands || 0;
    if (riskDeviation > 2) {
      const multiplier = context?.clientCategory === 'retail' ? 2.0 : 1.0;
      factors.push({ name: 'risk-profile-deviation', impact: Math.round(40 * multiplier), reason: `Product risk exceeds client tolerance by ${riskDeviation} bands — suitability concern` });
    }

    // GDPR consent not checked
    if (context?.gdprConsentNotChecked) {
      factors.push({ name: 'gdpr-consent-missing', impact: 75, reason: 'GDPR processing consent status not verified before suitability assessment' });
    }

    // Category D: Security
    if (context?.prePublicationAccessAttempt) {
      factors.push({ name: 'pre-pub-access', impact: 80, reason: 'Attempted access to pre-publication research — MNPI isolation violated' });
    }

    if (context?.crmWriteAttempt) {
      factors.push({ name: 'crm-write-attempt', impact: 90, reason: 'Attempted write to CRM client records — read-only authority violated' });
    }

    if (context?.piiAccessAttempt) {
      factors.push({ name: 'pii-access', impact: 50, reason: 'Attempted access to financial PII (SSN/tax-id/bank) — GDPR data minimisation violation' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    flags.push({
      flag: 'MiFID-II-Art.25',
      reason: 'Suitability assessment — MiFID II Art.25 compliance',
      action: 'log',
    });

    if (context?.suitabilityDetermination === 'unsuitable') {
      flags.push({
        flag: 'SEC-Advisers-Act',
        reason: 'Unsuitable determination — fiduciary duty documentation required',
        action: 'log-and-escalate',
      });
    }

    if (context?.suitabilityOverride && !context?.complianceSignOff) {
      flags.push({
        flag: 'MiFID-II-Art.25',
        reason: 'Suitability override without compliance sign-off — enhanced scrutiny required',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.riskProfileDeviationBands > 2) {
      flags.push({
        flag: 'MiFID-II-Art.25',
        reason: `Risk profile deviation ${context.riskProfileDeviationBands} bands — client protection concern`,
        action: 'escalate',
        severity: 'high',
      });
    }

    if (context?.gdprConsentNotChecked) {
      flags.push({
        flag: 'GDPR-Art.6',
        reason: 'Processing consent not verified — lawful basis for processing unclear',
        action: 'critical-escalate-dpo',
        severity: 'critical',
      });
    }

    if (context?.prePublicationAccessAttempt) {
      flags.push({
        flag: 'MAR-Art.10',
        reason: 'Pre-publication research access — MNPI exposure risk',
        action: 'critical-escalate-cco',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Proposal Generator Risk Model ────────────────────────────────────────

class ProposalGeneratorRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('proposal-generator', { baselineScore: 3, ...config });
    this.riskBudget = { dailyLimit: 200, escalateAt: 140, freezeOnBreach: true };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Category B: Proposal Quality
    if (context?.proposalType === 'standard') {
      factors.push({ name: 'standard-proposal', impact: 10, reason: 'Standard investment proposal draft' });
    } else if (context?.proposalType === 'complex-product') {
      const hasMismatch = context?.suitabilityMismatch;
      factors.push({ name: 'complex-proposal', impact: hasMismatch ? 38 : 25, reason: `Complex product proposal${hasMismatch ? ' — suitability dimension mismatch detected' : ''}` });
    } else if (context?.proposalType === 'erisa-client') {
      factors.push({ name: 'erisa-proposal', impact: 30, reason: 'ERISA client proposal — prohibited transaction check required' });
    }

    // GDPR Art.22 opt-out
    if (context?.gdprArt22OptOut) {
      const noDeliberativeReview = !context?.deliberativeReviewTagged;
      factors.push({ name: 'gdpr-art22-optout', impact: noDeliberativeReview ? 40 : 20, reason: `GDPR Art.22 opt-out client${noDeliberativeReview ? ' — deliberative review tag ABSENT' : ' — deliberative review tagged'}` });
    }

    // Recommendation magnitude
    if (context?.allocationChangePct > 20) {
      const isOutlier = context?.deviationFromModelSigma > 2;
      factors.push({ name: 'high-magnitude', impact: isOutlier ? 45 : 30, reason: `${context.allocationChangePct}% allocation change${isOutlier ? ' — >2σ deviation from model portfolio' : ''}` });
    }

    // Cross-selling
    if (context?.crossSellingDetected) {
      factors.push({ name: 'cross-selling', impact: 35, reason: 'Multiple high-margin products in single proposal — cross-selling indicator' });
    }

    // Category C: Disclosure Compliance
    if (context?.art52DisclosureMissing) {
      factors.push({ name: 'art52-missing', impact: 95, reason: 'Art.52 AI disclosure absent — EU AI Act violation, write BLOCKED' });
    }

    // Suitability check bypass
    if (context?.suitabilityCheckBypassed) {
      factors.push({ name: 'suitability-bypass', impact: 95, reason: 'Proposal generated without valid suitability determination — BLOCKED' });
    }

    // Category D: Security
    if (context?.deliveryPathWriteAttempt) {
      factors.push({ name: 'delivery-attempt', impact: 95, reason: 'Attempted write to advisory/proposals/delivered/** — human approval gate bypassed' });
    }

    if (context?.prePublicationAccessAttempt) {
      factors.push({ name: 'pre-pub-access', impact: 80, reason: 'Attempted access to pre-publication research — MNPI isolation violated' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    if (context?.art52DisclosureMissing) {
      flags.push({
        flag: 'EU-AI-Act-Art.52',
        reason: 'AI disclosure missing from proposal — Art.52 transparency violation',
        action: 'block-and-critical-alert',
        severity: 'critical',
      });
    }

    if (context?.proposalType === 'erisa-client') {
      flags.push({
        flag: 'ERISA',
        reason: 'ERISA client proposal — prohibited transaction assessment required',
        action: 'log-and-review',
      });
    }

    if (context?.gdprArt22OptOut) {
      flags.push({
        flag: 'GDPR-Art.22',
        reason: 'Client has opted out of automated decision-making — deliberative review required',
        action: context?.deliberativeReviewTagged ? 'log' : 'critical-escalate',
        severity: context?.deliberativeReviewTagged ? undefined : 'critical',
      });
    }

    if (context?.deliveryPathWriteAttempt) {
      flags.push({
        flag: 'EU-AI-Act-Art.14',
        reason: 'Attempted bypass of human approval gate — Art.14 oversight violation',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.suitabilityCheckBypassed) {
      flags.push({
        flag: 'MiFID-II-Art.25',
        reason: 'Suitability check bypassed — proposal cannot be generated without valid determination',
        action: 'critical-escalate',
        severity: 'critical',
      });
    }

    if (context?.crossSellingDetected) {
      flags.push({
        flag: 'MiFID-II-Art.24',
        reason: 'Cross-selling indicator — conduct of business review required',
        action: 'escalate',
      });
    }

    if (context?.prePublicationAccessAttempt) {
      flags.push({
        flag: 'MAR-Art.10',
        reason: 'Pre-publication research access — MNPI exposure risk',
        action: 'critical-escalate-cco',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Client Reporter Risk Model ───────────────────────────────────────────

class ClientReporterRiskModel extends BaseRiskModel {
  constructor(config = {}) {
    super('client-reporter', { baselineScore: 3, ...config });
    this.riskBudget = { dailyLimit: 300, escalateAt: 200, freezeOnBreach: true };
  }

  _computeFactors(toolName, toolInput, context) {
    const factors = [];

    // Category B: Report Generation
    if (context?.reportType === 'quarterly') {
      factors.push({ name: 'quarterly-report', impact: 10, reason: 'Quarterly performance report generation' });
    } else if (context?.reportType === 'annual') {
      factors.push({ name: 'annual-report', impact: 15, reason: 'Annual review report — comprehensive disclosure' });
    } else if (context?.reportType === 'sfdr-art9') {
      factors.push({ name: 'sfdr-report', impact: 15, reason: 'SFDR Art.9 product report — sustainability disclosure required' });
    } else if (context?.reportType) {
      factors.push({ name: 'standard-report', impact: 5, reason: `${context.reportType} report generation` });
    }

    // Category C: Disclosure Compliance
    if (context?.art52DisclosureMissing) {
      factors.push({ name: 'art52-missing', impact: 95, reason: 'Art.52 AI disclosure absent from report — EU AI Act violation, write BLOCKED' });
    }

    // Category D: Security — Client Isolation
    if (context?.crossClientAccessAttempt) {
      factors.push({ name: 'cross-client-access', impact: 95, reason: 'Attempted access to another client data — GDPR breach assessment required' });
    }

    if (context?.prePublicationAccessAttempt) {
      factors.push({ name: 'pre-pub-access', impact: 80, reason: 'Attempted access to pre-publication research — MNPI isolation violated' });
    }

    if (context?.crmWriteAttempt) {
      factors.push({ name: 'crm-write-attempt', impact: 90, reason: 'Attempted write to CRM — read-only authority violated' });
    }

    if (context?.proposalWriteAttempt) {
      factors.push({ name: 'proposal-write-attempt', impact: 60, reason: 'Attempted write to proposals path — client-reporter writes reports only' });
    }

    return factors;
  }

  _checkRegulatoryFlags(toolName, toolInput, riskScore, context) {
    const flags = [];

    if (context?.art52DisclosureMissing) {
      flags.push({
        flag: 'EU-AI-Act-Art.52',
        reason: 'AI disclosure missing from client report — Art.52 violation',
        action: 'block-and-critical-alert',
        severity: 'critical',
      });
    }

    if (context?.crossClientAccessAttempt) {
      flags.push({
        flag: 'GDPR-Art.5',
        reason: 'Cross-client data access — integrity and confidentiality breach (Art.5(1)(f))',
        action: 'critical-escalate-dpo',
        severity: 'critical',
      });
    }

    if (context?.reportType === 'sfdr-art9') {
      flags.push({
        flag: 'SFDR-Art.9',
        reason: 'SFDR Art.9 product sustainability disclosure',
        action: 'log',
      });
    }

    flags.push({
      flag: 'MiFID-II-Art.24',
      reason: 'Client reporting — conduct of business, fair and clear communication',
      action: 'log',
    });

    if (context?.prePublicationAccessAttempt) {
      flags.push({
        flag: 'MAR-Art.10',
        reason: 'Pre-publication research access — MNPI exposure risk',
        action: 'critical-escalate-cco',
        severity: 'critical',
      });
    }

    return flags;
  }
}

// ── Factory ──────────────────────────────────────────────────────────────

const MODELS = {
  'suitability-checker': SuitabilityCheckerRiskModel,
  'proposal-generator': ProposalGeneratorRiskModel,
  'client-reporter': ClientReporterRiskModel,
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
  SuitabilityCheckerRiskModel,
  ProposalGeneratorRiskModel,
  ClientReporterRiskModel,
  createRiskModel,
  listModels,
};

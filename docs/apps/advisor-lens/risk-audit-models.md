# AdvisorLens — Risk and Audit Models

**Application:** AdvisorLens
**Document:** risk-audit-models.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** CCO, DPO, Platform Engineering, AI Safety, Audit

---

## 1. Overview

AdvisorLens carries the most sensitive risk and audit profile in the AssetCo AI Platform. Two factors drive this:

1. **Fiduciary and GDPR obligations** mean that errors in AdvisorLens have direct legal consequences — a missing Art.52 disclosure is not an audit finding, it is a regulatory violation requiring disclosure to the supervisory authority
2. **Client financial impact** means that unsuitable recommendations or incorrectly applied suitability determinations directly harm the clients AssetCo owes a duty of care to

The risk model and audit taxonomy in this document are implemented in the Sentinel-Ops Arbiter and Chronicle engines. Every risk scoring event and audit record written by AdvisorLens agents flows through these engines.

---

## 2. Risk Factor Model

### 2.1 Arbiter Risk Scoring Dimensions

The Arbiter cumulative risk scorer evaluates each AdvisorLens agent action against the following risk factors. Scores are cumulative within a session; when the daily risk budget is exhausted the agent is blocked until reset.

| Risk Factor | Agent | Base Score | Multiplier Conditions |
|---|---|---|---|
| Suitability determination: `suitable` | suitability-checker | 5 | x1.5 if product complexity class = "complex" |
| Suitability determination: `requires-review` | suitability-checker | 15 | x2.0 if MiFID II client category = "retail" |
| Suitability determination: `unsuitable` | suitability-checker | 25 | x1.0 (flat; always high risk) |
| Suitability override (advisor overrides `unsuitable`) | suitability-checker / audit | 50 | x1.5 if override not accompanied by compliance sign-off |
| Proposal draft generated: standard | proposal-generator | 10 | x1.0 |
| Proposal draft generated: complex product | proposal-generator | 25 | x1.5 if suitability dimension had any `mismatch` |
| Proposal draft generated: ERISA client | proposal-generator | 30 | x1.0 |
| Proposal draft: GDPR Art.22 opt-out client | proposal-generator | 20 | x2.0 if deliberative review tag absent |
| Client report generated: standard | client-reporter | 10 | x1.0 |
| Client report generated: SFDR Art.9 product | client-reporter | 15 | x1.0 |
| Recommendation magnitude high (>20% allocation change) | proposal-generator | 30 | x1.5 if recommendation deviates >2 sigma from model portfolio |
| Client risk profile deviation (proposed product risk > client tolerance by >2 bands) | suitability-checker | 40 | x2.0 |
| Cross-selling indicator detected (multiple high-margin products in single proposal) | proposal-generator | 35 | x1.5 |
| Art.52 disclosure missing (SOE block triggered) | Any | 100 (CRITICAL) | No multiplier; flat CRITICAL event |
| GDPR consent status not checked before processing | suitability-checker | 75 | x1.0 |
| Attempted write to `advisory/proposals/delivered/**` (blocked by SOE) | proposal-generator | 100 (CRITICAL) | No multiplier; automatic escalation |
| Cross-client data access attempt (blocked by SOE) | client-reporter | 100 (CRITICAL) | No multiplier; GDPR breach assessment required |
| Pre-publication research access attempt (blocked by SOE) | Any | 80 | x1.0; escalate to CCO |

### 2.2 Trajectory Analysis

Arbiter runs trajectory analysis across rolling 7-day windows per agent. Anomalous patterns that trigger enhanced monitoring:

- More than 5 `requires-review` determinations in a single day for a single advisor's client portfolio (may indicate systematic suitability misalignment in the model portfolios being proposed)
- More than 2 `unsuitable` determinations overridden by the same advisor within 30 days (may indicate advisor override culture undermining the suitability gate)
- Proposal generation rate significantly exceeding suitability check rate (could indicate suitability checker being bypassed or reusing stale determinations beyond their 7-day validity)
- Any Art.52 disclosure block event — immediately triggers enhanced monitoring for that agent session for the remainder of the day
- Any cross-client access attempt — triggers immediate session review and GDPR breach assessment workflow

### 2.3 Dynamic Envelope Tightening

Arbiter can tighten the AdvisorLens operating envelope in response to risk trajectory, up to but not exceeding the meta-SOE limits defined by Compliance Operations:

| Trigger | Tightening Action |
|---|---|
| 2 Art.52 disclosure blocks in 24 hours | Reduce suitability determination validity from 7 days to 1 day; alert Head of Client Services |
| 3 suitability overrides without compliance sign-off in 30 days | Temporarily suspend the override path; require CCO approval to reinstate |
| Any cross-client access attempt | Immediately restrict client-reporter to read-only mode for non-currently-assigned clients; alert DPO |
| Proposal delivery path write attempt blocked | Suspend proposal-generator; require Platform Security sign-off to resume |

Arbiter cannot loosen any of these constraints beyond the meta-SOE definition without human Compliance Operations action.

---

## 3. Audit Event Taxonomy

### 3.1 Audit Categories

Every AdvisorLens event written to the Chronicle audit trail is classified under one of the following categories. Category determines the alerting threshold, escalation path, and retention period.

| Category | Description | Severity Range | Default Retention |
|---|---|---|---|
| `suitability-assessment` | Every suitability determination and its inputs, dimensions, and output | INFO to HIGH | 7 years (MiFID II Art.25(6)) |
| `suitability-override` | Advisor override of an unsuitable determination; includes documenting rationale | HIGH to CRITICAL | 7 years |
| `proposal-generation` | Every draft proposal generation event including disclosures applied | INFO to HIGH | 7 years |
| `proposal-approval-gate` | Advisor approval actions on proposals in draft queue | INFO to HIGH | 7 years |
| `client-report-delivery` | Every report written to advisory/reports/; disclosures verified | INFO to MEDIUM | 7 years |
| `art52-disclosure-enforcement` | SOE content guardrail check on every client-facing write; pass or block | INFO (pass) to CRITICAL (block) | 10 years (EU AI Act compliance evidence) |
| `gdpr-opt-out-processing` | Every event where GDPR Art.22 opt-out status was checked and applied | INFO to HIGH | 10 years (GDPR Art.30 record) |
| `gdpr-breach-assessment` | Triggered on any cross-client access attempt; initiates breach assessment workflow | CRITICAL | 10 years |
| `human-oversight-gate` | Every advisor review and approval action on a proposal | INFO | 7 years |
| `soe-violation` | Any action blocked by the SOE gate | MEDIUM to CRITICAL | 10 years |
| `risk-budget` | Budget consumption events and exhaustion alerts | INFO to HIGH | 3 years |

### 3.2 Severity Definitions

| Severity | Definition | Response SLA |
|---|---|---|
| INFO | Normal operation; no action required | No alert; retained for audit |
| LOW | Minor anomaly; within operational parameters | Daily summary to CCO |
| MEDIUM | Operational concern; warrants review | Next-business-day review |
| HIGH | Significant compliance or risk concern | Same-day review; CCO notified |
| CRITICAL | Regulatory violation or data breach indicator; immediate action required | Immediate escalation to CCO and DPO; max 2-hour response |

### 3.3 CRITICAL Severity Events — Enumerated

The following events are **always** CRITICAL severity in AdvisorLens. No configuration change can reduce their severity.

| Event | Trigger | Immediate Actions |
|---|---|---|
| Art.52 disclosure missing | SOE content guardrail blocks write due to absent disclosure | Block the tool call; log CRITICAL event; alert CCO; freeze agent session pending review |
| Attempted write to delivered proposals path | proposal-generator attempts write to `advisory/proposals/delivered/**` | Block the tool call; log CRITICAL event; alert Platform Security and CCO; suspend proposal-generator session |
| Cross-client data access attempt | client-reporter reads data for a client not assigned to the current task | Block the tool call; log CRITICAL event; alert DPO immediately; initiate GDPR breach assessment workflow |
| Pre-publication research access | Any AdvisorLens agent attempts to read `research/pre-publication/**` | Block the tool call; log CRITICAL event; alert CCO; escalate to Compliance as potential MNPI exposure |
| Suitability check bypassed | Proposal generation attempted without a valid suitability determination | Block the tool call; log CRITICAL event; alert CCO |

---

## 4. Retention Schedule

| Record Type | Retention Period | Legal Basis |
|---|---|---|
| Suitability assessments (all determinations) | 7 years from date of assessment | MiFID II Art.25(6), Commission Delegated Regulation 2017/565 |
| Suitability override records | 7 years from date of override | MiFID II; SEC Advisers Act Rule 204-2 |
| Proposal generation events | 7 years | MiFID II; SEC Advisers Act Rule 204-2 |
| Client report delivery events | 7 years | MiFID II Art.24(4); SEC Advisers Act Rule 204-3 |
| Art.52 disclosure enforcement events (pass and block) | 10 years | EU AI Act compliance evidence; EU AI Act Art.26(5) |
| GDPR processing records (Art.22 opt-out checks, Art.13/14 disclosures) | 10 years | GDPR Art.30 (records of processing activities); limitation period for GDPR complaints |
| GDPR breach assessment records | 10 years from incident date | GDPR Art.33(5); national supervisory authority requirements |
| SOE violation events | 10 years | EU AI Act Art.26(5); regulatory examination evidence |
| Chronicle audit trail (all events) | 10 years | Append-only; longest applicable retention period governs |

**Retention Implementation:** Chronicle implements retention at the storage backend level. Records are written to immutable storage (append-only DynamoDB tables with deletion protection enabled). Retention period expiry triggers archival to S3 Glacier Deep Archive, not deletion — regulatory examination requests may require production of records beyond the nominal retention period.

---

## 5. Compliance Reporting

### 5.1 Periodic Reports Generated by Chronicle for AdvisorLens

| Report | Frequency | Audience | Contents |
|---|---|---|---|
| Art.52 Disclosure Compliance Report | Monthly | CCO, DPO | Count of proposals and reports generated; count of Art.52 guardrail blocks; zero-block target |
| Suitability Determination Quality Report | Quarterly | CCO | Distribution of determinations (suitable/unsuitable/requires-review); override rate; time-to-determination |
| GDPR Art.22 Processing Report | Quarterly | DPO | Count of opt-out clients; count of deliberative review workflows completed; any Art.22 processing anomalies |
| SOE Violation Summary | Monthly | CCO, Platform Security | All CRITICAL events by type; trend analysis; remediation status |
| MiFID II Suitability Record Summary | Annually (and on regulatory request) | CCO | Complete suitability record count; sampling for examination readiness; gap identification |
| EU AI Act Technical Documentation | Annually | CCO, DPO, Board | High-risk system deployment evidence; Art.52 compliance rate; human oversight gate effectiveness; incident history |

### 5.2 Regulatory Examination Readiness

For an SEC or FCA examination request for AdvisorLens suitability records, the Chronicle evidence package for any individual recommendation includes:

1. The original suitability determination record (all input dimensions, determination output, timestamp, agent version)
2. The draft proposal document with all disclosures
3. The human advisor approval record (timestamp, advisor ID, any annotations)
4. The Art.52 guardrail check record (pass confirmation with disclosure text hash)
5. The complete agent session audit trail (Chronicle events for the relevant session)
6. The risk scoring record for the session (Arbiter cumulative score at the time of the recommendation)

All of this can be assembled from Chronicle and exported in PDF or JSON format for examination production within 2 business hours.

---

*This document is part of the AssetCo AI Platform documentation suite. Review cycle: Annually and on any material change to the risk model, regulatory requirements, or audit architecture.*

# ComplianceShield — Risk and Audit Models

**Application:** ComplianceShield
**Audit framework:** Sentinel-Ops Chronicle (immutable append-only trail)
**Retention authority:** CCO David Okonkwo
**Classification:** Internal — Compliance Sensitive

---

## Risk Model

ComplianceShield agents operate under a distinct risk philosophy from other AssetCo AI applications. Where a trading agent's risk budget is calibrated to prevent harmful actions, ComplianceShield's risk model is calibrated around surveillance gaps and reporting failures — the risk that the compliance system is not working, not the risk that it does something harmful.

### Risk Factors

**1. Surveillance Coverage Gaps**

Definition: Any period during market hours where trade-surveiller is not actively processing events from all three source systems (TradeSentinel, AlphaEngine, OpsFabric).

Risk score contribution: HIGH. A surveillance gap during active trading is a regulatory liability regardless of whether a violation actually occurred during the gap. FINRA Rule 3110 requires continuous supervision.

Measurement: trade-surveiller emits a heartbeat event every 60 seconds per source system. Gaps in the heartbeat sequence longer than 3 minutes trigger a CRITICAL breach-detector alert.

Mitigation: trade-surveiller session risk budget is set at 500 (highest in ComplianceShield) with a 0.05 decay rate to allow sustained operation without artificial tightening.

---

**2. Reporting Timeliness (T+1 Deadline Proximity)**

Definition: The elapsed time between position-reporter completing a report and regulatory-filer achieving PENDING_REVIEW status, measured against the regulatory deadline.

Risk score contribution: CRITICAL for EMIR and MiFIR (hard T+1 deadlines with no grace period). HIGH for 13F and Form PF (fixed calendar deadlines).

Measurement: Filing status ledger tracks timestamp at each state transition (DRAFT → PENDING_REVIEW → APPROVED → SUBMITTED). Deadline proximity alerts fire at 4 hours before deadline (HIGH) and 2 hours before deadline (CRITICAL) if status is not yet SUBMITTED.

Mitigation: position-reporter is scheduled to complete by 07:00 local time. regulatory-filer begins formatting immediately upon report completion. Human review window is 07:00–market-open.

---

**3. False Positive Rate (Trade Surveillance)**

Definition: The proportion of trade-surveiller alerts that, upon compliance officer review, are determined to be non-violations.

Risk score contribution: MEDIUM ongoing. If false positive rate exceeds 40%, it creates alert fatigue — compliance officers begin to discount high-volume alert streams, which is itself a regulatory risk (Rule 3110 requires the supervision system to be effective, not merely present).

Measurement: Each trade-surveiller alert receives a disposition tag from the compliance officer (CONFIRMED_VIOLATION, FALSE_POSITIVE, UNDER_INVESTIGATION, ESCALATED). Weekly false positive rate calculated per pattern type (spoofing, wash trading, layering, front-running).

Mitigation: Pattern detection thresholds are tunable per pattern type. Weekly false positive report reviewed by CCO. Threshold adjustment requires CCO approval and is logged to the audit trail.

---

**4. Escalation Response Time**

Definition: Time from breach-detector generating a CRITICAL or HIGH alert to a compliance officer acknowledging the alert.

Regulatory basis: DORA Art.10 requires detection and notification within defined timeframes. MAR Art.16 STR response expectations. Internal SLA: CRITICAL within 60 seconds, HIGH within 4 hours.

Risk score contribution: HIGH for CRITICAL alerts with no acknowledgment within SLA. Unacknowledged escalations represent potential regulatory exposure if the underlying violation is not addressed.

Measurement: breach-detector logs alert generation timestamp. Compliance officer acknowledgment (via alert management interface) logs acknowledgment timestamp. Unacknowledged alerts re-escalate after SLA expiry.

---

**5. Filing Accuracy**

Definition: The proportion of prepared regulatory filings that pass schema validation and are accepted by the receiving regulatory authority without rejection or query.

Risk score contribution: CRITICAL for rejected filings (triggers re-filing obligation and potential late-filing penalty). HIGH for regulatory queries (requires compliance officer response and potential disclosure).

Measurement: regulatory-filer runs validation against current regulatory schemas before setting PENDING_REVIEW status. Post-submission, regulatory authority acknowledgment codes are logged. Rejection codes trigger CRITICAL breach-detector alert.

---

### Risk Budget Summary by Agent

| Agent | Session Limit | Decay Rate | High-Risk Threshold | Rationale |
|---|---|---|---|---|
| trade-surveiller | 500 | 0.05 | 300 | Continuous market-hours operation; broad read requires higher budget with slow decay |
| position-reporter | 200 | 0.10 | 150 | Scheduled batch operation; moderate budget sufficient |
| breach-detector | 300 | 0.08 | 200 | Continuous monitoring but write-constrained; medium budget |
| regulatory-filer | 150 | 0.10 | 100 | Scheduled filing cycle; most constrained write surface; lowest budget |

---

## Audit Model

### Audit Event Categories

All ComplianceShield agent actions are logged to the Sentinel-Ops Chronicle audit trail. The following event categories define the taxonomy for ComplianceShield-specific events.

---

**Category: trade-surveillance-alert**

Logged when: trade-surveiller generates an alert for any detected pattern (spoofing, wash trading, layering, front-running, suitability gap) or STR candidate.

Fields:
- `timestamp`: ISO 8601, millisecond precision
- `agent`: trade-surveiller
- `alertType`: SPOOFING | WASH_TRADING | LAYERING | FRONT_RUNNING | SUITABILITY_GAP | STR_CANDIDATE
- `severity`: CRITICAL | HIGH | MEDIUM | LOW
- `instrumentId`: ISIN or internal instrument identifier
- `sourceAgent`: the managed agent whose activity triggered the alert (e.g., alpha-engine, trade-sentinel)
- `evidencePaths`: array of paths to supporting data (order records, execution records, timestamps)
- `patternSummary`: human-readable description of the detected pattern
- `alertFilePath`: path to the generated alert file in `compliance/surveillance/alerts/`
- `dispositionStatus`: OPEN (initial), updated to CONFIRMED_VIOLATION | FALSE_POSITIVE | UNDER_INVESTIGATION | ESCALATED by compliance officer

---

**Category: position-report-generation**

Logged when: position-reporter completes generation of a regulatory report.

Fields:
- `timestamp`: ISO 8601
- `agent`: position-reporter
- `reportType`: EMIR_TR | MIFIR_RTS25 | CFTC_LARGE_TRADER | SEC_13F | FINRA_FOCUS
- `reportingPeriod`: date or date range covered
- `recordCount`: number of positions/transactions in the report
- `sourceDataChecksum`: SHA-256 of source data consumed (enables post-hoc verification that source data was not modified between report generation and review)
- `outputFilePath`: path in `compliance/reports/**`
- `outputFileChecksum`: SHA-256 of generated report file
- `regulatoryDeadline`: ISO 8601 deadline for this report type
- `completionLeadTime`: minutes before deadline that report was completed

---

**Category: breach-escalation**

Logged when: breach-detector generates an alert and/or escalation to human compliance officers.

Fields:
- `timestamp`: ISO 8601, millisecond precision
- `agent`: breach-detector
- `breachType`: SOE_VIOLATION | RISK_LIMIT_BREACH | INFORMATION_BARRIER_CROSSING | UNAUTHORIZED_DATA_ACCESS | OPERATIONAL_RESILIENCE
- `severity`: CRITICAL | HIGH | MEDIUM | LOW
- `sourceAgent`: the managed agent that triggered the breach
- `sourceEventId`: reference to the underlying SOE audit event
- `alertFilePath`: path in `compliance/alerts/**`
- `escalationPath`: path in `compliance/escalations/**` (CRITICAL and HIGH only)
- `notifiedPersons`: array of compliance officers notified
- `notificationChannels`: Slack channel IDs, email addresses
- `acknowledgmentTimestamp`: null until acknowledged; filled by compliance officer action
- `resolutionStatus`: OPEN | ACKNOWLEDGED | UNDER_INVESTIGATION | RESOLVED | ESCALATED_TO_REGULATOR

---

**Category: regulatory-filing-preparation**

Logged when: regulatory-filer completes each stage of filing preparation.

Fields:
- `timestamp`: ISO 8601
- `agent`: regulatory-filer
- `filingType`: EMIR_TR | MIFIR_RTS25 | FORM_PF | SEC_13F | FINRA_FOCUS | FINRA_3110 | SOX_302 | SOX_404
- `sourceReportPath`: path to position-reporter output consumed
- `outputFilePath`: path in `compliance/filings/**`
- `status`: DRAFT | PENDING_REVIEW | APPROVED | SUBMITTED | ACKNOWLEDGED | REJECTED
- `validationResult`: PASS | FAIL with error details
- `regulatoryDeadline`: ISO 8601 filing deadline
- `reviewerPersonId`: compliance officer who approved (null until APPROVED)
- `submissionTimestamp`: null until SUBMITTED; filled by human submitter
- `regulatoryAcknowledgmentCode`: null until ACKNOWLEDGED; filled upon TR or regulator confirmation
- `rejectionCode`: null unless REJECTED; populated from regulatory authority response

---

**Category: information-barrier-violation-detection**

Logged when: breach-detector detects an attempt by any managed agent to access MNPI-tagged or deal-room data outside their SOE-permitted scope.

Fields:
- `timestamp`: ISO 8601, millisecond precision
- `agent`: breach-detector
- `violatingAgent`: the managed agent that attempted the access
- `attemptedPath`: the data path the agent attempted to access
- `barrierName`: identifier of the information barrier that was tested
- `soeDecision`: DENY (the SOE gate blocked the access — this event records detection, not permission)
- `alertSeverity`: always CRITICAL for information barrier events
- `ccoNotified`: boolean
- `soeEventReference`: Chronicle event ID of the original SOE DENY decision
- `note`: The content of the MNPI data is NOT logged here — only the fact of the crossing attempt. Logging MNPI content in the surveillance system would itself constitute an information barrier breach.

---

## Retention Policy

Retention schedules are regulatory minimums. AssetCo retains beyond minimums where the cost of longer retention is lower than the risk of not having evidence in a late-breaking regulatory inquiry.

| Audit Category | Regulatory Basis | Minimum Retention | AssetCo Retention |
|---|---|---|---|
| trade-surveillance-alert | FINRA Rule 3110 — books and records | 7 years | 10 years |
| STR candidates | MAR Art.16 — STOR records | 5 years | 7 years |
| position-report-generation | MiFIR RTS 25 — transaction records | 5 years | 7 years |
| EMIR TR reports | EMIR Art.9 — reporting records | 5 years | 7 years |
| breach-escalation (non-fraud) | SOX — internal controls evidence | 7 years | 7 years |
| breach-escalation (fraud-related) | SOX Section 802 — document retention | 10 years | Indefinite |
| information-barrier-violation-detection | SOX, SEC Rule 17a-4 | 7 years | 10 years |
| regulatory-filing-preparation | SEC Rule 17a-4, FINRA 4511 | 7 years | 7 years |
| SOX 302/404 evidence packages | SOX Section 802 | 7 years | 10 years |
| DORA operational logs | DORA Art.12 | 5 years | 7 years |

**Storage:** All audit records are stored in the Sentinel-Ops append-only Chronicle store. Deletion is architecturally prevented — the Chronicle storage backend does not expose a delete API. Retention enforcement is implemented as a read-fence: records beyond the retention period are excluded from standard queries but remain in cold storage for regulatory production requests.

**Tamper evidence:** Each audit event includes a hash chain reference to the previous event in the same agent's sequence. Regulators can verify the integrity of the audit trail by validating the hash chain against the Chronicle root hash, which is published daily to an external notarization service.

---

## Regulatory Examination Readiness

ComplianceShield is designed to produce examination-ready evidence packages on demand. When AssetCo receives a regulatory examination notice or subpoena, the following packages can be produced from the audit trail:

- **Trading supervision package (FINRA 3110):** All trade-surveillance-alert events for the examination period, with disposition status and evidence paths, organized by trading agent and instrument.
- **Transaction reporting package (MiFIR/EMIR):** All position-report-generation and regulatory-filing-preparation events, with source data checksums and filing acknowledgment codes, demonstrating T+1 compliance.
- **Information barrier package (SOX/SEC):** All information-barrier-violation-detection events, with SOE DENY evidence, notification records, and resolution status.
- **Internal controls package (SOX 302/404):** All breach-escalation events classified as control failures, with remediation evidence, CCO attestation records, and external auditor access logs.

Package generation does not require ComplianceShield agent involvement — it is a Chronicle audit query operation performed by compliance staff directly against the audit trail.

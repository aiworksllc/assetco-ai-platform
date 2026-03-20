# ComplianceShield — Regulatory Mapping

**Application:** ComplianceShield
**Jurisdictions covered:** US (SEC/FINRA/CFTC), EU (ESMA/EMIR/MiFIR/MAR/EU AI Act), UK (FCA), cross-border (DORA)
**Maintained by:** CCO David Okonkwo

---

## Purpose

This document maps each regulatory obligation to the ComplianceShield agent responsible for satisfying it, the specific SOE controls that enforce the obligation, and the evidence artifacts generated for regulatory examination.

Regulators examining AssetCo's AI-driven compliance program should use this document as the index to ComplianceShield's evidence trail.

---

## US Regulations

### SOX Section 302 — CEO/CFO Attestation of Internal Controls

**Obligation:** Senior officers must personally attest that they have reviewed the firm's internal controls over financial reporting and that no material misstatements exist.

**Agent responsible:** breach-detector (primary), regulatory-filer (evidence assembly)

**How ComplianceShield satisfies it:**
- breach-detector continuously monitors all 25 managed agents for SOE violations, unauthorized data access, and control effectiveness failures
- Any control failure (agent accessing data outside SOE scope, risk limit breach without documented exception, information barrier violation) generates a compliance alert with severity classification
- regulatory-filer assembles quarterly SOX evidence packages in `compliance/filings/sox/` containing: control effectiveness summary, violation log with remediation status, information barrier incident log, and CCO attestation template

**SOE enforcement:** breach-detector has read access to all SOE audit logs. writeDeny on all operational systems ensures breach-detector cannot introduce the control failures it monitors.

**Evidence artifact:** `compliance/filings/sox/Q{n}-YYYY-sox-evidence-package.pdf`

---

### SOX Section 404 — Management Assessment of Internal Controls

**Obligation:** Annual management assessment of internal controls over financial reporting, with external auditor attestation.

**Agent responsible:** breach-detector, regulatory-filer

**How ComplianceShield satisfies it:**
- breach-detector maintains a running control effectiveness ledger across the full year
- Annual 404 assessment package includes: control inventory (mapped to ComplianceShield agents), testing evidence (SOE enforcement logs), deficiency log with remediation timeline, and management assertion narrative
- External auditors can request read access to Sentinel-Ops audit trail for independent verification

**Evidence artifact:** `compliance/filings/sox/YYYY-404-assessment.pdf`

---

### FINRA Rule 3110 — Supervision

**Obligation:** Member firms must establish and maintain a system to supervise the activities of each associated person that is reasonably designed to achieve compliance with applicable securities laws and FINRA rules.

**Agent responsible:** trade-surveiller (automated supervision system)

**How ComplianceShield satisfies it:**
- trade-surveiller constitutes the firm's automated supervision system for AI-generated trading activity
- Continuously monitors all orders and executions for spoofing, wash trading, layering, front-running, and suitability gaps
- Generates daily supervision summary for each AI trading agent, logged to `compliance/surveillance/supervision-logs/`
- Annual FINRA 3110 supervision report assembled by regulatory-filer from the full year of supervision summaries

**SOE control:** trade-surveiller's broad read scope (`trading/**`, `orders/**`, `executions/**`) is explicitly required to satisfy Rule 3110's "all associated persons" coverage mandate. Restricting surveillance scope would create a Rule 3110 deficiency.

**Evidence artifact:** `compliance/filings/finra/YYYY-3110-supervision-report.pdf`

---

### FINRA Rule 2111 — Suitability

**Obligation:** Firms must have a reasonable basis to believe that a recommended transaction or investment strategy is suitable for the customer based on information obtained through reasonable diligence.

**Agent responsible:** trade-surveiller

**How ComplianceShield satisfies it:**
- For every AlphaEngine-generated client order, trade-surveiller verifies that a suitability determination record exists for the relevant account and instrument class
- Flags orders where suitability documentation is absent or expired
- Suitability gap alerts are classified HIGH severity (same-day compliance officer review required)
- Suitability validation log provides evidence of the firm's diligence process for each trade

**Evidence artifact:** `compliance/surveillance/suitability-validation-log/` (daily files)

---

## EU / Cross-Border Regulations

### EMIR Article 9 — Reporting Obligation for OTC Derivatives

**Obligation:** Counterparties to OTC derivative contracts must report details of those contracts to a trade repository. Reports must be submitted by the end of the working day following conclusion, modification, or termination of the contract.

**Agent responsible:** position-reporter (report generation), regulatory-filer (submission preparation)

**How ComplianceShield satisfies it:**
- position-reporter generates daily EMIR TR reports in ESMA ISO 20022 XML format by 18:00 UTC
- Report includes UTI, LEI codes, notional amounts, mark-to-market valuations, and collateral data for all in-scope OTC derivatives
- regulatory-filer formats for DTCC GTR or REGIS-TR submission and routes to `compliance/filings/emir/` with status PENDING_REVIEW
- CCO or designated officer reviews and submits via trade repository portal
- T+1 deadline compliance tracked in filing status ledger; missed deadlines trigger CRITICAL breach-detector alert

**SOE control:** regulatory-filer's tool deny list explicitly blocks direct API calls to DTCC and REGIS-TR. Human submission is not a preference — it is enforced at the SOE gate.

**Evidence artifact:** `compliance/filings/emir/YYYY-MM-DD-emir-tr-submission.xml`

---

### MiFIR RTS 25 — Transaction Reporting

**Obligation:** Investment firms that execute transactions in financial instruments must submit transaction reports to competent authorities by end of the working day following execution (T+1).

**Agent responsible:** position-reporter, regulatory-filer

**How ComplianceShield satisfies it:**
- position-reporter generates MiFIR RTS 25 transaction reports from TradeSentinel execution records by 07:00 local time T+1
- Covers all instruments in scope: equities, bonds, derivatives admitted to trading on EU regulated markets, MTFs, and OTFs
- Includes executing entity LEI, buyer/seller LEI, instrument ISIN, quantity, price, venue, and execution timestamp
- regulatory-filer formats for ESMA TRACE submission

**Evidence artifact:** `compliance/filings/mifir/YYYY-MM-DD-rts25-transaction-report.xml`

---

### DORA Articles 5–14 — ICT Risk Management Framework

**Obligation:** Financial entities must implement a comprehensive ICT risk management framework covering identification, protection, detection, response, and recovery for ICT risks.

**Agent responsible:** breach-detector

**How ComplianceShield satisfies it:**
- breach-detector monitors platform operational resilience by tracking SOE violations, agent failures, and abnormal tool call patterns across all 25 managed agents
- Operational resilience incidents (agent unavailability, repeated SOE gate failures, unusual error rate patterns) are logged to `compliance/alerts/dora/`
- DORA Art.10 (detection): breach-detector's real-time monitoring of SOE audit logs satisfies the detection requirement
- DORA Art.11 (response): escalation pipeline to CCO and compliance team satisfies response notification requirement
- Annual DORA ICT risk report assembled from breach-detector's operational logs

**Evidence artifact:** `compliance/alerts/dora/` (continuous), `compliance/filings/dora/YYYY-dora-ict-risk-report.pdf` (annual)

---

### MAR Article 16 — Suspicious Transaction and Order Reporting (STOR)

**Obligation:** Firms that professionally arrange or execute transactions must have in place effective arrangements, systems and procedures to detect and report suspicious transactions and orders.

**Agent responsible:** trade-surveiller

**How ComplianceShield satisfies it:**
- trade-surveiller's spoofing, layering, and wash trading detection generates STR candidate files in `compliance/surveillance/str-candidates/`
- Each candidate includes: instrument, trading agent, pattern type, supporting evidence (order timestamps, cancellation rates, price impact analysis), and severity classification
- STR candidates are reviewed by the compliance team; confirmed STORs are submitted to NCA by CCO
- trade-surveiller does not submit STORs directly — it generates candidates for human determination

**Evidence artifact:** `compliance/surveillance/str-candidates/YYYY-MM-DD-str-candidates.json`

---

### EU AI Act Article 12 — Record-Keeping for High-Risk AI Systems

**Obligation:** High-risk AI systems must be designed to automatically record logs for the lifetime of the system, to a level that enables post-hoc monitoring of the system's functioning.

**Agent responsible:** All four ComplianceShield agents (collective obligation)

**How ComplianceShield satisfies it:**
- trade-surveiller: logs all surveillance alerts, pattern detection results, and STR candidates with timestamps and input data references
- position-reporter: logs all report generation events with source data checksums and output file hashes
- breach-detector: logs all breach alerts, severity classifications, and escalation events
- regulatory-filer: logs all filing preparation events, validation results, and status transitions
- All logs written to append-only paths under `compliance/` — even ComplianceShield agents cannot delete or modify their own logs (enforced by Sentinel-Ops meta-SOE)
- Retention periods enforced per regulatory minimums (see risk-audit-models.md)

**Evidence artifact:** All `compliance/**` directories constitute the Art.12 record-keeping archive.

---

## Regulatory Obligation Summary Table

| Regulation | Article/Rule | Primary Agent | Filing/Evidence | Frequency |
|---|---|---|---|---|
| SOX | Section 302 | breach-detector | sox-evidence-package | Quarterly |
| SOX | Section 404 | breach-detector, regulatory-filer | 404-assessment | Annual |
| FINRA | Rule 3110 | trade-surveiller | 3110-supervision-report | Daily logs, Annual report |
| FINRA | Rule 2111 | trade-surveiller | suitability-validation-log | Per trade |
| EMIR | Article 9 | position-reporter, regulatory-filer | emir-tr-submission | Daily (T+1) |
| MiFIR | RTS 25 | position-reporter, regulatory-filer | rts25-transaction-report | Daily (T+1) |
| CFTC | Large Trader | position-reporter | cftc-large-trader-report | Daily |
| SEC | Form 13F | position-reporter, regulatory-filer | 13f-filing | Quarterly |
| FINRA | FOCUS | position-reporter, regulatory-filer | finra-focus | Monthly |
| DORA | Art. 5–14 | breach-detector | dora-ict-risk-report | Continuous + Annual |
| MAR | Article 16 | trade-surveiller | str-candidates | Per detection |
| EU AI Act | Article 12 | All agents | All compliance/ logs | Continuous |

# OpsFabric — Risk and Audit Models

**Document:** apps/ops-fabric/risk-audit-models.md
**Application:** OpsFabric — Post-Trade Operations Automation
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** Maria Torres, COO / Sentinel-Ops Team
**Classification:** Internal — Restricted

---

## 1. Risk Model

### 1.1 Risk Philosophy

OpsFabric agents operate in a LIMITED EU AI Act risk category, but the financial accuracy requirements for settlement instructions and NAV calculation make governance critical regardless of classification. A settlement instruction with the wrong SWIFT BIC code creates a fail. A NAV published with a stale price creates a regulatory disclosure problem and potential fund restatement. The risk model is calibrated to these consequences, not just to the AI Act category.

### 1.2 Risk Factors by Agent

**settlement-processor**

| Risk Factor | Weight | Measurement | Escalation Threshold |
|-------------|--------|-------------|----------------------|
| Settlement deadline proximity | High | Minutes remaining to T+1 9:00 PM ET cutoff | Escalate at T-60 minutes for any pending instructions |
| Open fail rate (trailing 5 days) | High | Fails / total instructions | Alert ops team if rolling fail rate > 1.5%; escalate to COO if > 3% |
| CSDR buy-in proximity | Critical | Business days since fail inception | Escalate at T+3; buy-in workflow at T+4 (equities) / T+7 (bonds) |
| SSI match failure rate | Medium | Unmatched SSIs / total instructions (daily) | Alert if unmatched rate > 2% on any day |
| CCP routing error | High | Failed CCP submissions (count) | Immediate alert per occurrence; EMIR reporting implications |
| Penalty accrual acceleration | Medium | Daily CSDR penalty accrual rate vs. prior week | Alert if daily accrual > $10,000 |

**reconciler**

| Risk Factor | Weight | Measurement | Escalation Threshold |
|-------------|--------|-------------|----------------------|
| Break age | High | Business days since break inception | Immediate escalation if break > 5 days old |
| Break dollar value | High | USD equivalent of position discrepancy | Immediate escalation if break > $500,000 |
| Break volume trend | Medium | Total break count vs. prior 4-week average | Alert if break count > 150% of 4-week average |
| Unclassified break rate | Medium | Breaks that cannot be categorized / total breaks | Alert ops manager if > 5% unclassifiable; indicates new break type |
| Corporate action miss rate | High | CA-related breaks / total CA announcements | Alert CA team if > 2% of announcements generate breaks |
| Custodian discrepancy concentration | Medium | Breaks concentrated in single custodian | Alert if > 60% of breaks are with one custodian (indicates systemic issue) |

**nav-calculator**

| Risk Factor | Weight | Measurement | Escalation Threshold |
|-------------|--------|-------------|----------------------|
| Stale price count | High | Securities with price age > threshold / total portfolio | Alert fund accountant if > 2% of securities by NAV weight have stale prices |
| Level 3 concentration | High | Level 3 fair value assets / total fund NAV | Alert if Level 3 > 15% of any fund NAV (AIFMD disclosure threshold) |
| Pricing source fallback rate | Medium | Securities priced at Level 2 or 3 vs. prior week | Alert if fallback rate increases > 20% week-over-week |
| NAV delivery timeline | Critical | Minutes until preliminary NAV delivered vs. 4:30 PM target | Escalate to ops manager if preliminary NAV will miss 4:30 PM ET target |
| Dual-approval pending duration | High | Minutes since preliminary NAV submitted to review queue | Escalate to COO if review queue item pending > 60 minutes without action |
| Pricing data feed availability | Critical | Feed availability for Bloomberg, ICE, BVAL | Immediate alert if any pricing feed is unavailable during NAV window |

### 1.3 Arbiter Risk Scoring

Sentinel-Ops Arbiter computes cumulative risk scores across agent sessions. OpsFabric-specific Arbiter configuration:

- **settlement-processor** base risk per action: 0.08 (routine instruction generation), 0.4 (CCP submission), 1.2 (escalation action)
- **reconciler** base risk per action: 0.05 (break classification), 0.3 (escalation routing)
- **nav-calculator** base risk per action: 0.1 (pricing validation), 0.3 (preliminary NAV generation), 2.0 (any attempt to write outside `operations/nav/preliminary/**`)

Any nav-calculator action attempting to write to `operations/nav/published/**` is assigned risk score 10.0 and triggers immediate DENY + CRITICAL escalation regardless of remaining budget.

---

## 2. Audit Model

### 2.1 Audit Event Categories

Chronicle logs all OpsFabric agent actions. The following categories are defined for event classification, filtering, and compliance reporting:

| Category | Agent | Description |
|----------|-------|-------------|
| `settlement-instruction-generation` | settlement-processor | SWIFT message generated and submitted to custodian or DTCC |
| `settlement-ccp-routing` | settlement-processor | OTC derivative routed to LCH or CME for clearing |
| `settlement-ssi-exception` | settlement-processor | SSI match failure — instruction could not be generated automatically |
| `settlement-fail-escalation` | settlement-processor | Settlement fail escalated per CSDR age threshold |
| `settlement-buyin-workflow` | settlement-processor | Buy-in escalation workflow initiated at T+4/T+7 threshold |
| `settlement-csdr-penalty-calc` | settlement-processor | CSDR cash penalty accrual calculated and logged |
| `reconciliation-break-classification` | reconciler | Break identified, categorized, and assigned to resolution queue |
| `reconciliation-escalation` | reconciler | Break escalated due to dollar value or age threshold |
| `reconciliation-report-generated` | reconciler | Daily reconciliation report produced |
| `nav-pricing-validation` | nav-calculator | Pricing source checked; stale price or fair value level flagged |
| `nav-preliminary-generated` | nav-calculator | Preliminary NAV computed and submitted to review queue |
| `nav-publication-approval` | Human | Fund accountant or operations manager approves preliminary NAV (logged by workflow system to Chronicle) |
| `nav-publication-dual-approved` | Human | Both required approvals received; publication authorized |
| `nav-publication-denied` | Human | Reviewer rejects preliminary NAV; reason logged |
| `soe-violation-attempt` | Any | Agent tool call blocked by Sentinel-Ops SOE gate |

### 2.2 Critical Severity Events

The following events are automatically classified CRITICAL severity, triggering immediate notification to Maria Torres (COO) and the security team:

| Event | Condition | Reason |
|-------|-----------|--------|
| NAV publication without dual approval | nav-calculator writes to `operations/nav/published/**` | Regulatory and financial integrity violation; SOX 404 control failure |
| Source record modification attempt | reconciler attempts write to source position or custodian records | Compromises reconciliation integrity; potential SOX violation |
| Custodian account management action | settlement-processor calls account management or client instruction endpoints | Outside authorized scope; potential unauthorized fund access |
| Risk budget exhaustion with override attempt | Any agent attempts to bypass DENY_AND_ESCALATE after budget exhaustion | Potential runaway agent behavior |
| Pricing override without authorization | nav-calculator attempts to write to pricing data store | Integrity of NAV inputs must be maintained |

### 2.3 Retention Policy

OpsFabric audit records are retained in Chronicle per the following schedule, derived from applicable regulatory requirements:

| Record Type | Retention Period | Regulatory Basis |
|-------------|-----------------|-----------------|
| NAV calculation records and approval chain | 7 years | SEC Rule 31a-2 (fund books and records) |
| NAV pricing exception logs | 7 years | SEC Rule 31a-2; SOX 404 supporting documentation |
| Settlement instruction records | 5 years | CSDR Art.29; EMIR Art.20 |
| Settlement fail records and CSDR penalty calculations | 5 years | CSDR Art.7 documentation requirements |
| Reconciliation break records | 5 years standard; 10 years if material misstatement investigation | SOX 404; external audit requirements |
| Reconciliation reports | 5 years | SOX 404 |
| SOE violation attempts | 7 years | Sentinel-Ops security policy; regulatory examination readiness |
| Chronicle event index | Permanent (metadata only after retention period) | Audit trail integrity |

All Chronicle records are append-only. Retention enforcement is by archival (records become read-only to all systems including SOE agents after 1 year), not deletion. Records are never deleted within the retention period. Deletion after retention expiry requires dual authorization from COO and Legal.

### 2.4 Compliance Reporting

Chronicle supports the following automated reports for OpsFabric:

| Report | Frequency | Audience | Regulatory Purpose |
|--------|-----------|----------|--------------------|
| Settlement fail rate dashboard | Daily | Operations manager, COO | CSDR Art.7 monitoring |
| CSDR penalty accrual report | Weekly | COO, Finance | CSDR cash penalty tracking |
| Reconciliation break aging report | Daily | Operations manager | SOX 404 internal controls |
| NAV exception summary | Daily | Fund accountant, COO | ASC 820/IFRS 13 fair value controls |
| NAV approval chain log | Daily | Compliance, external auditors (on request) | SOX 404 evidence |
| SOE violation log | Weekly | CISO, COO | Internal security monitoring |
| Quarterly reconciliation trend analysis | Quarterly | COO, Board Risk Committee | SOX 404 management assessment |

---

## 3. Incident Response

If a CRITICAL severity event is triggered:

1. **Immediate (< 5 minutes):** Chronicle logs the event; Sentinel-Ops Beacon sends alert to COO, CISO, and operations manager via Slack (#ops-critical) and email
2. **Short-term (< 1 hour):** Affected agent session suspended pending review; operations team assesses whether any downstream action must be reversed
3. **Investigation (< 24 hours):** Chronicle audit trail reviewed; root cause documented; regulatory notification assessment (if event involves potential market integrity issue, CSDR or SEC notification may be required)
4. **Remediation:** SOE definition reviewed and updated if the event reveals a policy gap; change goes through joint COO + CISO approval per SOE governance

---

*Document owner: Maria Torres, COO / Sentinel-Ops Team. Review cycle: Quarterly or on material incident.*

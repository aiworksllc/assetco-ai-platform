# OpsFabric — Regulatory Mapping

**Document:** apps/ops-fabric/regulatory-mapping.md
**Application:** OpsFabric — Post-Trade Operations Automation
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** Maria Torres, COO / Legal & Compliance
**Classification:** Internal — Restricted

---

## 1. EU AI Act Classification

**Classification: LIMITED RISK (Article 52)**

OpsFabric does not qualify as high-risk AI under Annex III of the EU AI Act. Post-trade operations automation — settlement instruction generation, reconciliation break classification, and NAV calculation assistance — is operational automation of rules-based processes, not AI-assisted decision-making that affects investment recommendations, client outcomes, or creditworthiness assessment.

The NAV dual-approval gate and the reconciler's read-only constraint are not compensating controls imposed because the AI is risky — they are correct operating procedures for these functions regardless of whether AI is involved. Humans have always approved final NAV publication; OpsFabric does not change that.

Applicable EU AI Act transparency obligations under Article 52: users interacting with the system must be informed they are interacting with an AI system. Applied in operations team onboarding and the review queue UI.

---

## 2. Regulatory Mapping by Agent

### 2.1 settlement-processor

| Regulation | Article / Rule | Requirement | settlement-processor Implementation |
|------------|---------------|-------------|--------------------------------------|
| CSDR | Art.7(1) | Settlement discipline — member states must take measures to prevent settlement fails | settlement-processor generates T+1-compliant instructions within 30 minutes of execution, eliminating instruction delay as a fail cause |
| CSDR | Art.7(2) | Cash penalties for settlement fails — calculated daily, applied to failing participants | settlement-processor calculates accruing CSDR penalties per ISIN/counterparty; penalty register maintained in `operations/settlement/penalties/**` |
| CSDR | Art.7(3) | Mandatory buy-in — initiated when fail exceeds 4 business days (equities) or 7 business days (bonds) | settlement-processor triggers buy-in escalation workflow at T+4 (equities) and T+7 (bonds) fail age thresholds; escalation logged to Chronicle |
| SEC Rule 15c6-1 (T+1) | — | US equities must settle by T+1 effective May 28, 2024 | settlement-processor generates DTCC-ready instructions within 30 minutes of trade execution; meets 9:00 PM ET affirmation cutoff |
| EMIR | Art.4 | Clearing obligation — eligible OTC derivatives must be centrally cleared via authorized CCPs | settlement-processor routes OTC interest rate swaps, credit default swaps, and index derivatives to LCH or CME per ESMA clearing obligation scope |
| EMIR | Art.11 | Risk mitigation for non-cleared OTC derivatives — timely confirmation, bilateral margin validation | settlement-processor validates bilateral margin adequacy for non-cleared OTC derivatives before instruction generation; flags margin deficiencies |
| EMIR REFIT | Art.9 | Trade reporting — OTC derivative transactions reported to an approved trade repository | settlement-processor provides structured trade data to the DTCC GTR reporting pipeline (reporting submission handled by compliance infrastructure, not OpsFabric directly) |
| SWIFT PMPG | — | Post-trade matching and settlement best practices | settlement-processor generates SWIFT MT540/541/542/543 messages per PMPG standards |

### 2.2 reconciler

| Regulation | Article / Rule | Requirement | reconciler Implementation |
|------------|---------------|-------------|---------------------------|
| SOX | Section 404 | Internal controls over financial reporting — management must assess and attest to control effectiveness | reconciler provides documented, auditable reconciliation process with complete break logs. Chronicle audit trail constitutes internal control evidence for SOX 404 assessment |
| CSDR | Art.7 (indirect) | Settlement discipline — firms must investigate and resolve fails | reconciler identifies fails-in-progress as a category of reconciliation break, routing to operations team with age and value context for CSDR escalation decisions |
| AIFMD | Art.19 | Valuation — assets must be valued using established policies; reconciliation to third-party records | reconciler's daily three-way position reconciliation (internal vs. BNY Mellon vs. State Street) supports AIFMD Art.19 independent valuation requirements |
| UCITS | Art.85 | Liability of depositary — discrepancies between depositary and management company records must be identified | reconciler discrepancy identification against custodian records directly addresses UCITS depositary liability requirements |
| EU AI Act | Art.12 | Logging — high-risk AI systems must log sufficient information to enable post-hoc auditing | Applied even though reconciler is LIMITED risk: Chronicle logs all classification decisions, break categories, and routing actions |

### 2.3 nav-calculator

| Regulation | Article / Rule | Requirement | nav-calculator Implementation |
|------------|---------------|-------------|-------------------------------|
| ASC 820 | Fair value hierarchy | US GAAP fair value measurement — Level 1 (observable), Level 2 (model with observable inputs), Level 3 (unobservable inputs) | nav-calculator classifies each security's pricing source against the three-level hierarchy; Level 2/3 concentrations flagged in preliminary NAV package |
| IFRS 13 | Fair value measurement | IFRS equivalent of ASC 820 — same three-level hierarchy for UCITS and AIFMD-reporting funds | Same implementation; accounting standard applied per fund's jurisdiction and reporting framework |
| SEC Rule 2a-4 | — | Pricing of mutual fund shares — requires good faith fair value determination when market quotations not readily available | nav-calculator stale price detection (>24hr liquid, >7 days illiquid) identifies securities where Rule 2a-4 good faith fair value procedures must apply |
| AIFMD | Art.19(3) | Valuation — NAV must be calculated at least annually; for open-ended funds, at each subscription/redemption | nav-calculator runs daily NAV for all open-ended funds. Dual-approval gate ensures human accountability for each NAV publication |
| UCITS | Art.85(4) | NAV calculation — errors material above 0.5% threshold require restatement and compensation | nav-calculator pricing exception report enables fund accountant to identify pricing errors before publication, reducing restatement risk |
| SOX | Section 404 | Internal controls — NAV calculation is a key financial reporting control | Dual-approval gate (fund accountant + operations manager) with Chronicle audit trail constitutes documented NAV internal control procedure |
| EU AI Act | Art.12 | Logging | Chronicle logs all pricing validation decisions, stale price flags, fair value classifications, and the complete dual-approval chain for every NAV publication |

---

## 3. Cross-Cutting: Chronicle Audit Trail (EU AI Act Art.12)

All OpsFabric agent decisions are logged to Chronicle (Sentinel-Ops) via the SOE audit hook. This satisfies:

- **EU AI Act Art.12** (logging for LIMITED risk systems — applied voluntarily as best practice)
- **CSDR Art.7** documentation requirements for settlement fail investigation
- **SOX Section 404** internal control documentation
- **AIFMD Art.19** independent valuation process documentation

Chronicle records are append-only. No OpsFabric agent, operations staff member, or system administrator can modify or delete Chronicle records. Retention periods are defined in `risk-audit-models.md`.

---

## 4. Jurisdiction Matrix

| Jurisdiction | Settlement Cycle | Primary Regulation | settlement-processor Behavior |
|--------------|-----------------|-------------------|-------------------------------|
| United States | T+1 (equities, May 2024) | SEC Rule 15c6-1 | Instructions to DTCC within 30 min of execution |
| European Union | T+2 (equities, CSDR) | CSDR Regulation | Instructions to BNY Mellon/State Street SWIFT by T+2 cutoff; CSDR fail monitoring |
| United Kingdom | T+2 (equities) | UK CSDR (onshored) | Same as EU; separate UK regulatory reporting |
| APAC | T+2 (most markets), T+3 (some) | Local market rules per exchange | settlement-processor applies market-specific settlement date rules from SSI database |

---

*Document owner: Maria Torres, COO / Legal & Compliance. Review cycle: Quarterly or on regulatory change. This document does not constitute legal advice — all regulatory interpretations subject to review by external counsel.*

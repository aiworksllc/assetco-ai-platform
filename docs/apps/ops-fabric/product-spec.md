# OpsFabric — Product Specification

**Document:** apps/ops-fabric/product-spec.md
**Application:** OpsFabric — Post-Trade Operations Automation
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** Maria Torres, Chief Operating Officer
**Classification:** Internal — Restricted

---

## 1. Executive Summary

OpsFabric is AssetCo's post-trade operations automation platform, handling settlement instruction generation, daily reconciliation, and NAV calculation assistance across all $85 billion in assets under management. It is deployed in Phase 1 alongside RiskCompass because it operates in a well-bounded domain: back-office automation with deterministic rules, no investment decisions, and no client-facing outputs.

OpsFabric exists because the US T+1 settlement mandate (effective May 2024) compressed the operational window by 50%. Processes designed for T+2 — with a full business day of buffer after trade date — do not survive at T+1. AssetCo's operations team of 40 processes over 12,000 transactions per day across four jurisdictions with varying settlement cycles. Without automation, the fail rate would be structurally unmanageable.

---

## 2. Business Context

### 2.1 The T+1 Mandate and Its Operational Consequences

The SEC's amendment to Rule 15c6-1 (effective May 28, 2024) shortened the standard settlement cycle for US equities from T+2 to T+1. For a firm of AssetCo's scale, this was not a marginal change. It required:

- Settlement instructions to custodians submitted by 9:00 PM ET on trade date (vs. end-of-next-day at T+2)
- Affirmation and confirmation completed by 9:00 PM ET on trade date
- SSI (Standard Settlement Instructions) matching and exception resolution within hours, not a day

The T+2 process relied on overnight reconciliation to catch SSI mismatches and routing errors before settlement. At T+1, that overnight buffer is gone. Instructions that are wrong at 9:00 PM on trade date become fails at T+1, triggering CSDR cash penalties and, for larger fails, mandatory buy-in procedures under CSDR Art.7.

AssetCo's operations team averaged 3% settlement fail rate under T+2 — acceptable by industry standards. In the first month of T+1, the fail rate rose to 7.2% before process changes were implemented, generating an estimated $340,000 in CSDR cash penalties in that period alone.

### 2.2 Scope of the Problem

| Dimension | Scale |
|-----------|-------|
| Transactions per day | 12,000+ |
| Jurisdictions | US, EU, UK, APAC |
| Settlement cycles | T+1 (US equities), T+2 (EU equities, CSDR), T+0 (some FX), T+3 (some APAC) |
| Custodians | BNY Mellon (primary), State Street (secondary), DTCC (US clearing) |
| CCPs | LCH (rates/credit), CME (listed futures/options) |
| Corporate actions per month | 300–500 (elections, dividends, splits, mergers) |
| Funds under NAV | 47 active funds |
| NAV calculation deadline | 6:00 PM ET daily |

### 2.3 Why Automation Is the Right Approach

Post-trade operations is a rules-based domain. Settlement instructions follow deterministic logic: match counterparty SSI, route to the correct custodian or CCP, validate SWIFT message format, confirm settlement date against the correct cycle for the security's market. Reconciliation breaks fall into a finite taxonomy of root causes. NAV calculation follows accounting standards and fund structure rules.

These are not judgment-intensive functions — they are precision-at-scale functions. The operations team's expertise is better applied to genuine exceptions, complex corporate actions, and CSDR dispute resolution than to routine SSI matching and reconciliation classification. Automation handles volume; humans handle judgment.

---

## 3. Problem Statement

| Problem | Current Impact | Regulatory Exposure |
|---------|---------------|---------------------|
| T+1 instruction cutoff requires same-day SSI matching | 7.2% fail rate spike when T+1 launched | CSDR Art.7 cash penalties |
| Manual reconciliation across 3 custodians takes 6–8 hours daily | Operations team spends 60% of day on routine matching | Material misstatement risk (SOX 404) |
| NAV pricing validation is manual and error-prone | Stale prices used in 2 NAV publications in 2023 (corrected post-publication) | SEC Rule 2a-4, IFRS 13 |
| No real-time fail rate monitoring | CSDR penalty accumulation not visible until monthly reconciliation | CSDR Art.7(3) |
| Corporate action elections processed manually | Missed election deadline in Q3 2023 (dividend election on merger arb position) | Counterparty dispute |

---

## 4. Solution: The Three-Agent System

OpsFabric deploys three specialized agents with a strict read/write perimeter enforced by the Sentinel-Ops SOE:

```
TradeSentinel (executed trades) ────────► settlement-processor ──► Custodian APIs (BNY, State Street)
                                                                ──► CCP routing (LCH, CME via DTCC)
                                                                ──► operations/settlement/instructions/**

Internal positions ─────────────────────► reconciler ──► operations/reconciliation/breaks/**
Custodian records (read-only) ──────────►                 (classifies breaks; CANNOT modify source)
Corporate action feeds ─────────────────►

Position data ──────────────────────────► nav-calculator ──► operations/nav/preliminary/**
Bloomberg/ICE/BVAL pricing ─────────────►                    (preliminary only; human publishes)
Fund structure + fee schedules ─────────►

                                Human approval (fund accountant + operations manager)
                                         │
                                         ▼
                              operations/nav/published/**
```

No agent can modify source position records, custodian records, or published NAV figures. The SOE enforces these boundaries at the tool-call level.

---

## 5. User Stories — COO Perspective (Maria Torres)

**US-01 — Settlement Instruction Automation**
As COO, I want settlement instructions generated and submitted to custodians within 30 minutes of trade execution, so that we meet the T+1 9:00 PM ET affirmation cutoff without manual intervention on routine trades.

*Acceptance:* settlement-processor generates SWIFT MT54x instructions within 30 minutes of trade data arriving from TradeSentinel. SSI match rate > 98% on routine trades. Exceptions flagged to operations team with root cause within the same 30-minute window.

**US-02 — Fail Rate Visibility and CSDR Escalation**
As COO, I want to know in real time when settlement fails are approaching CSDR buy-in thresholds, so that operations can intervene before a 4-business-day fail triggers mandatory buy-in procedures.

*Acceptance:* settlement-processor tracks fail age for each open fail. Automated escalation to operations team at T+2 (early warning) and T+3 (urgent intervention required). Fail rate dashboard updated hourly.

*Maria Torres, COO:* "We went from 3% fail rate to 0.5% in the first quarter with OpsFabric. That is not an incremental improvement — that is a structural change in how we operate. The system catches SSI mismatches before they become fails, and it escalates the right fails to the right people at the right time."

**US-03 — Reconciliation Break Classification**
As COO, I want reconciliation breaks classified by root cause and routed to the appropriate resolution queue within 2 hours of the daily custodian file landing, so that operations managers can resolve material breaks the same day rather than spending the morning triaging.

*Acceptance:* reconciler completes daily three-way reconciliation (internal vs. BNY Mellon vs. State Street) within 2 hours of custodian files. Breaks classified into taxonomy (timing, pricing, corporate action, tax, FX). Breaks over $500,000 and breaks over 5 days old escalated to senior operations immediately.

**US-04 — NAV Integrity Before Publication**
As COO, I want the system to validate all pricing inputs before NAV is calculated and flag any stale or model-dependent prices, so that the fund accountant reviewing preliminary NAV has a complete exception list before they approve publication.

*Acceptance:* nav-calculator validates all pricing sources against hierarchy (exchange close > evaluated > model). Stale price exceptions (>24hr liquid, >7 days illiquid) listed in preliminary NAV package. Level 2/3 fair value concentrations flagged. Preliminary NAV never published without dual sign-off from fund accountant and operations manager.

**US-05 — NAV Deadline Compliance**
As COO, I want preliminary NAV ready for human review by 4:30 PM ET daily, so that the fund accountant and operations manager have 90 minutes to review, resolve exceptions, and approve publication before the 6:00 PM ET deadline.

*Acceptance:* nav-calculator delivers preliminary NAV package to review queue by 4:30 PM ET on all business days. Deadline compliance tracked and reported weekly. Escalation to COO if preliminary NAV will miss 4:30 PM target.

---

## 6. Functional Requirements Per Agent

### 6.1 settlement-processor

| Requirement | Detail |
|-------------|--------|
| Instruction generation | SWIFT MT540/541/542/543 generation within 30 minutes of trade execution |
| SSI matching | Match against firm SSI database; flag unmatched counterparties for manual entry |
| CCP routing | Route eligible OTC derivatives to LCH (rates/credit) and CME (futures/options) per EMIR Art.4 clearing obligation |
| Fail monitoring | Track fail age per ISIN/counterparty; CSDR cash penalty accrual calculation |
| Buy-in escalation | Automatic escalation workflow when fail reaches T+4 (equities), T+7 (bonds) threshold |
| Corporate action elections | Generate election instructions per fund mandate; deadline tracking |
| Output | Custodian API calls (BNY Mellon, State Street); DTCC submission; operations/settlement/** write |

### 6.2 reconciler

| Requirement | Detail |
|-------------|--------|
| Reconciliation scope | Positions (equity, fixed income, derivatives), cash (all currencies), corporate actions |
| Data sources | Internal positions (Eagle PACE), custodian records (BNY Mellon, State Street), DTCC settlement data |
| Break taxonomy | Timing differences, pricing discrepancies, missing/incorrect corporate actions, tax withholding errors, currency conversion errors, settlement date mismatches |
| Prioritization | Ranked by: dollar value of break, age of break, settlement deadline proximity |
| Routing | Pricing breaks → fund accounting queue; corporate action breaks → CA team; custodian discrepancies → ops manager |
| Hard constraint | CANNOT modify internal position records, custodian records, or Eagle PACE data. Read-only analysis only. Write access limited to operations/reconciliation/** |

### 6.3 nav-calculator

| Requirement | Detail |
|-------------|--------|
| Pricing hierarchy | Exchange close prices (primary) > evaluated pricing — ICE/BVAL (secondary) > model-based (tertiary, flagged) |
| Stale price detection | >24 hours: liquid securities (equity, IG credit, G10 rates); >7 days: illiquid (HY, EM, private credit) |
| Fair value flagging | Identifies Level 2 securities (model inputs observable) and Level 3 (unobservable inputs) per ASC 820/IFRS 13 |
| Corporate action adjustment | Applies announced dividends, splits, rights per fund accounting records |
| Fee accrual | Management fee, performance fee, fund expense accruals per fund structure |
| Output scope | preliminary NAV only — writes to operations/nav/preliminary/** |
| Publication gate | System cannot publish NAV. Dual sign-off required: fund accountant approval + operations manager approval. System logs approval chain to Chronicle |
| NAV deadline | Preliminary package delivered to review queue by 4:30 PM ET; published NAV by 6:00 PM ET |

---

## 7. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Settlement instruction generation | Within 30 minutes of trade execution (T+1 compliance) |
| Reconciliation completion | Within 2 hours of custodian file receipt |
| Preliminary NAV delivery | By 4:30 PM ET daily |
| Published NAV deadline | By 6:00 PM ET daily |
| SSI match rate | > 98% on routine institutional counterparties |
| System availability (market hours) | 99.9% (7:00 AM – 7:00 PM ET) |
| Audit trail completeness | 100% of agent decisions logged to Chronicle |
| NAV publication gate | 0 exceptions — dual approval is non-negotiable |

---

## 8. Integration Points

| System | Direction | Data | Protocol |
|--------|-----------|------|---------|
| TradeSentinel | Read | Executed trade data | Internal API (read-only) |
| Eagle PACE | Read | Internal positions, fund structure, fee schedules | Eagle REST API (read-only role) |
| BNY Mellon | Read/Write | Custodian positions, cash, settlement status; settlement instructions | SWIFT network; custody API |
| State Street | Read/Write | Custodian positions, cash; settlement instructions | SWIFT network; custody API |
| DTCC | Write | US equity settlement instructions | DTCC API |
| LCH / CME | Write | CCP clearing submissions for OTC derivatives | CCP clearing API |
| Bloomberg / ICE / BVAL | Read | Pricing data for NAV calculation | Bloomberg API, ICE BondPoint, BVAL feed |
| Chronicle (Sentinel-Ops) | Write | All agent decisions, NAV approval chain | SOE audit hook (automatic) |

---

*Document owner: Maria Torres, COO. Review cycle: Quarterly or on regulatory change.*

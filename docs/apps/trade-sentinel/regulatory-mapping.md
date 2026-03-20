# TradeSentinel — Regulatory Mapping

**Application:** TradeSentinel
**Document:** regulatory-mapping.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** CCO, Compliance Technology, Legal, Regulatory Affairs

---

## Overview

TradeSentinel operates at the highest regulatory complexity of any AssetCo AI application. It sits at the intersection of five distinct regulatory regimes — MiFID II, Reg NMS, MAR, Reg FD, and the EU AI Act — each of which imposes specific, technically enforceable requirements on the system's behaviour. This document maps each regulatory obligation to the specific SOE control, agent, and audit mechanism that satisfies it.

**Governing principle:** Every regulatory obligation must be satisfied by a deterministic SOE control, a documented audit event, or an explicit human oversight gate. No obligation is satisfied by relying on the AI model's own judgment alone.

---

## 1. MiFID II Article 27 — Best Execution Obligation

**Requirement:** Investment firms must take all sufficient steps to obtain the best possible result for clients when executing orders. Factors include price, costs, speed, likelihood of execution, order size, nature, and any other relevant consideration. Firms must have a best execution policy and demonstrate compliance on request.

| Obligation | Agent | SOE / Technical Control | Audit Evidence |
|---|---|---|---|
| Venue selection based on best execution factors | order-router | SOR scoring matrix evaluates 6 factors per order; SOE blocks submission without completed scoring | `order-execution` event with `venueSelectionRationale` field populated |
| Document venue selection rationale per order | order-router | SOE pre-condition: `trading/orders/staged/{order-id}/rationale.json` must exist before FlexTrade submit tool call is permitted | `best-execution-compliance` audit event with full rationale JSON attached |
| Best execution policy — periodic review | tca-analyzer | Quarterly RTS 28 reports surface venue quality degradation; compliance officer review gate before publication | `rts28-report-generated` events; report promotion requires human approval |
| Demonstrate best execution on demand | order-router + tca-analyzer | Every order has an immutable audit trail from rationale → submission → fill → TCA | Chronicle audit trail queryable by order ID; 7-year retention |
| Client notification of material changes to execution policy | tca-analyzer | Systematic venue quality deterioration triggers draft notification to compliance for client communication | `execution-policy-review-triggered` events |

**RTS 28 Quarterly Reporting** (MiFID II Level 2, Article 65 Delegated Regulation):

`tca-analyzer` generates the full RTS 28 disclosure for each quarter:
- Top 5 execution venues per instrument class (equities, bonds, ETFs, listed derivatives, OTC derivatives)
- Order volume and number of orders per venue
- Passive vs. aggressive order percentage
- Quality of execution narrative per asset class
- Summary of any changes to the execution policy during the quarter

Reports are staged to `compliance/reports/tca/YYYY-QQ/rts28/` and require compliance officer approval before external publication.

---

## 2. MiFID II Article 25 — Suitability and Appropriateness

**Requirement:** Investment firms must assess the suitability of investment services and instruments for clients before executing orders. Mandate constraints must be validated pre-trade.

| Obligation | Agent | SOE / Technical Control | Audit Evidence |
|---|---|---|---|
| Pre-trade mandate compliance check | order-router | SOE pre-condition: mandate check must pass before FlexTrade submit is permitted; SOE reads mandate constraints from `trading/mandates/**` | `mandate-check-pass` or `mandate-check-fail` event per order |
| Restricted instrument blocking | order-router | Restricted securities list read from `trading/restricted-securities/**`; SOE blocks submission for restricted instruments deterministically | `restricted-instrument-block` event with instrument ID |
| Concentration limit enforcement | order-router | Post-fill concentration check against mandate; instrument and sector limits enforced | `concentration-limit-check` event |
| SFDR PAI pre-trade threshold | order-router | ESG score from `research-nexus/published/esg-scores/published/**`; SFDR Art.9 fund mandates have PAI deny thresholds | `sfdr-pai-check` event; block event if threshold breached |

---

## 3. Reg NMS Rule 611 — Order Protection Rule

**Requirement:** Trading centres must not execute trades at prices inferior to protected quotations displayed by other trading centres (trade-through prohibition). Firms must route to the national best bid and offer (NBBO) or obtain a valid exception.

| Obligation | Agent | SOE / Technical Control | Audit Evidence |
|---|---|---|---|
| NBBO validation before order submission | order-router | `nbbo-validator validate` tool call is a mandatory pre-condition in the SOE toolAction sequence; FlexTrade submit denied without NBBO validation token | `nbbo-validation` event with quoted NBBO at time of validation |
| Rule 610 access fee compliance | order-router | Venue fee schedule cache checked; orders not routed to venues charging >$0.003/share in access fees without exception | `venue-fee-check` event |
| Rule 612 sub-penny compliance | order-router | Order format validated; limit prices must use minimum tick increment | `order-format-validation` event |
| Trade-through documentation for exceptions | order-router | Intermarket sweep orders (ISO) and valid exception categories must be flagged and logged | `trade-through-exception` event with exception code |

---

## 4. MAR Article 12 — Market Manipulation

**Requirement:** Prohibition on engaging in transactions, placing orders, or any other behaviour that gives false signals as to the supply, demand, or price of a financial instrument, or that secures the price at an abnormal or artificial level.

| Obligation | Agent | SOE / Technical Control | Audit Evidence |
|---|---|---|---|
| Spoofing / layering detection | execution-monitor | Real-time pattern: large order + cancellation >80% within 30s before opposite-side fill; alert threshold configurable | `market-abuse-alert` event, type: SPOOFING, with order cluster details |
| Wash trading detection | execution-monitor | Pattern: coordinated buy/sell in same instrument, same account cluster, <60s, same price band | `market-abuse-alert` event, type: WASH_TRADING |
| Order leakage / front-running detection | execution-monitor | Pattern: adverse correlated price movement >2bp before fill, 3+ consecutive orders | `market-abuse-alert` event, type: ORDER_LEAKAGE |
| Ramping / momentum ignition detection | execution-monitor | Pattern: order size escalation and stop-loss cascade signatures in illiquid instruments | `market-abuse-alert` event, type: RAMPING or MOMENTUM_IGNITION |
| Surveillance coverage documentation | execution-monitor | Every open order is in scope of execution-monitor surveillance; no orders are excluded from monitoring | Chronicle audit trail: all orders have monitoring coverage timestamps |

---

## 5. MAR Article 16 — Suspicious Transaction Reporting (STR)

**Requirement:** Persons professionally arranging or executing transactions must establish and maintain effective arrangements, systems, and procedures to detect and report suspicious transactions. Reports must be filed promptly with the competent authority.

| Obligation | Agent | SOE / Technical Control | Audit Evidence |
|---|---|---|---|
| STR detection | execution-monitor | Pattern detection engine evaluates all MAR Art.12 indicators; STR_CANDIDATE classification triggers draft creation | `market-abuse-alert` event with STR_CANDIDATE flag |
| STR draft creation | execution-monitor | Automated draft STR record created in `compliance-shield/str-drafts/**` within 15 minutes of pattern detection | `str-draft-created` event with draft ID, pattern ID, order details |
| Compliance officer review | ComplianceShield | Human review gate in ComplianceShield STR workflow; SOE enforces that STR cannot be filed without human approval | `str-human-review-completed` event in ComplianceShield audit trail |
| Filing to competent authority | ComplianceShield | `regulatory-filer` in ComplianceShield handles actual STR submission to FCA (UK), ESMA/NCA (EU) | `str-filed` event with filing reference |
| 4-hour MAR Art.16 window | execution-monitor + ComplianceShield | 15-minute detection SLA + ComplianceShield SLA of <3.5 hours for review and filing; Sentinel-Ops escalates at SLA breach | `str-sla-breach` escalation event if window threatened |

---

## 6. Regulation FD — Chinese Wall Enforcement

**Requirement:** Material non-public information (MNPI) must not be selectively disclosed to, or used by, trading personnel. Firms must maintain effective information barriers between research and trading functions.

| Obligation | Agent | SOE / Technical Control | Audit Evidence |
|---|---|---|---|
| Pre-publication research access blocked | All 3 agents | SOE `readDeny` rules: `research-nexus/pre-publication/**`, `research-nexus/draft/**`, `research-nexus/analyst-workspace/**` are deterministic deny rules in all 3 agent SOE definitions | `chinese-wall-violation-attempt` event on any access attempt |
| Technical enforcement vs. convention | All 3 agents | Deny rules evaluated in <1ms by the Sentinel-Ops deterministic pre-filter; no reliance on desk-level conventions or policies | Chronicle event log provides technical evidence of barrier enforcement for regulatory audit |
| Violation escalation | All 3 agents | 500 risk units charged per violation attempt; single violation freezes agent; Beacon cross-agent alert issued | `chinese-wall-violation-attempt` event + Beacon `anomaly-detected` event + Arbiter freeze |
| Published research access (permitted) | order-router only | `research-nexus/published/**` is on the readAllow list for order-router only; execution-monitor and tca-analyzer are denied all ResearchNexus paths | No event generated for permitted reads; only denies are logged |

**Demonstrating the Chinese Wall to Regulators**

When the FCA, SEC, or ESMA requests evidence of the chinese wall:
1. Chronicle audit trail shows zero successful reads of `research-nexus/pre-publication/**` by any TradeSentinel agent
2. Any violation attempts are documented with timestamp, agent identity, attempted path, and block confirmation
3. SOE definition files are provided as formal policy documentation showing the deny rules
4. Sentinel-Ops system architecture documentation demonstrates that deny rules are enforced at the pre-filter layer, not dependent on AI model behavior

---

## 7. EU AI Act Article 14 — Human Oversight

**Requirement:** High-risk AI systems must be designed and developed in such a way as to allow natural persons to effectively oversee and intervene in the functioning of the AI system during its use period.

| Obligation | Agent | SOE / Technical Control | Audit Evidence |
|---|---|---|---|
| Human oversight for high-stakes orders | order-router | SOE gate: orders >€500K require `human-approved: true` flag from Bloomberg AIM approval workflow | `human-approval-gate` event with approver ID, timestamp, order ID |
| Ability to override/intervene | All 3 agents | Head of Trading can activate market-hours kill-switch within 30 seconds; all in-flight staging stops; SOE gates all remaining tool calls | `kill-switch-activated` event in Chronicle; all subsequent agent tool calls blocked |
| Human review of STR filings | execution-monitor | SOE enforces: STR drafts created by execution-monitor require compliance officer review in ComplianceShield before filing | `str-human-review-completed` event |
| Human review of RTS 28 reports | tca-analyzer | SOE gate: RTS 28 reports require compliance officer approval before promotion from staging to publication directory | `rts28-human-review-completed` event |
| Risk budget ceiling — human escalation | All 3 agents | At 80% of daily risk budget, Arbiter notifies Head of Trading and Compliance; at ceiling, agent frozen pending human review | `risk-budget-escalation` and `risk-budget-freeze` Arbiter events |
| EU AI Act conformity documentation | Platform | SOE definition files, Chronicle audit events, and this regulatory mapping constitute technical documentation per EU AI Act Art.11 | All documents versioned and stored in compliance document management system |

---

## 8. MiFID II Article 17 — Algorithmic Trading Controls

**Requirement:** Investment firms engaging in algorithmic trading must have effective systems and risk controls to ensure their trading systems are resilient and have sufficient capacity. Must have kill-switch capability.

| Obligation | Agent | SOE / Technical Control |
|---|---|---|
| Pre-trade controls | order-router | NBBO validation, mandate check, risk budget check are all pre-trade controls enforced by SOE |
| Kill-switch capability | order-router | SOE admin can freeze order-router via risk budget ceiling; Head of Trading can trigger via Bloomberg AIM emergency stop |
| Annual self-assessment | tca-analyzer | TCA execution quality data feeds the FCA PS 19/1 annual algorithmic trading self-assessment |
| System stress testing | Platform | RiskCompass stress tests provide pre-trade exposure context; circuit breaker configurations documented in ops runbook |

---

## 9. Regulatory Obligation Summary

| Regulation | Article | Obligation | Agent(s) | Control Type | Satisfied |
|---|---|---|---|---|---|
| MiFID II | Art.27 | Best execution venue selection | order-router | SOE pre-condition | Yes |
| MiFID II | Art.27 | Venue rationale documentation | order-router | SOE required write | Yes |
| MiFID II | Art.27 (RTS 28) | Quarterly best execution report | tca-analyzer | Batch report + human gate | Yes |
| MiFID II | Art.25 | Pre-trade mandate compliance | order-router | SOE pre-condition | Yes |
| Reg NMS | Rule 611 | NBBO validation | order-router | SOE pre-condition | Yes |
| Reg NMS | Rule 610 | Access fee compliance | order-router | Venue fee check | Yes |
| MAR | Art.12 | Market manipulation detection | execution-monitor | Real-time pattern engine | Yes |
| MAR | Art.16 | Suspicious transaction reporting | execution-monitor | Auto-draft + human review | Yes |
| Reg FD | 17 CFR 243 | Chinese wall enforcement | All 3 agents | SOE deterministic deny | Yes |
| EU AI Act | Art.14 | Human oversight gates | All 3 agents | SOE approval gates | Yes |
| EU AI Act | Art.12 | Automatic event logging | All 3 agents | Chronicle audit trail | Yes |
| MiFID II | Art.17 | Algorithmic trading controls | order-router | Pre-trade controls + kill-switch | Yes |

---

*This document is part of the AssetCo AI Platform documentation suite. Regulatory interpretations in this document are for internal compliance mapping purposes and do not constitute legal advice. All regulatory requirements must be verified by AssetCo Legal and Compliance against current regulatory publications. MiFID II and MAR requirements apply to EU/UK operations; Reg NMS and Reg FD requirements apply to US operations. Obligations are additive for cross-jurisdictional orders.*

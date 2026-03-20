# ResearchNexus — Regulatory Mapping

**Application:** ResearchNexus
**Document:** regulatory-mapping.md
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** CCO David Okonkwo
**Audience:** Compliance, Legal, Regulatory Affairs, External Auditors
**Jurisdictions:** United States, European Union

---

## Overview

ResearchNexus carries a distinct regulatory profile from the other AssetCo AI Platform applications. It is classified SIGNIFICANT (not HIGH RISK) under the EU AI Act because it augments research analysis rather than making direct investment decisions. However, its position in the information chain — research outputs feed AlphaEngine's portfolio construction — means that regulatory failures in ResearchNexus propagate into HIGH RISK applications downstream.

The two primary regulatory concerns are: (1) information barrier integrity (Reg FD, MAR insider dealing provisions) and (2) sustainability disclosure accuracy (SFDR, EU Taxonomy). Both are addressed by Sentinel-Ops SOE enforcement, the publication gate, and esg-scorer's structured PAI computation.

---

## 1. SEC Regulation FD — Fair Disclosure

**Regulation:** SEC Regulation FD (17 CFR §243), effective October 2000
**Issuer:** SEC
**Jurisdiction:** United States
**Scope:** Prohibits selective disclosure of material nonpublic information (MNPI) to market professionals or investors before broader public disclosure

**Applicability to ResearchNexus:**

Reg FD applies to ResearchNexus in two directions:

1. **Inbound:** ResearchNexus agents must not receive MNPI as research inputs. If market-analyst ingests a broker research report that contains MNPI shared selectively by a corporate issuer, using that information in research outputs creates Reg FD liability for AssetCo.

2. **Outbound (Publication Gate):** If ResearchNexus generates a research view that constitutes material nonpublic information about AssetCo's own investment intentions, sharing that view selectively (e.g., with the trading desk before formal publication) is a Reg FD violation under the "selective disclosure by an institutional investor" principle.

| Reg FD Obligation | SOE Control | Implementation |
|---|---|---|
| No selective disclosure of material research to trading desk before formal publication | Publication gate enforced by SOE write paths | All research outputs go to `research/pre-publication/**` (RESTRICTED); TradeSentinel and AlphaEngine SOE definitions deny read access to all pre-publication paths |
| MNPI screening before publication | Human review step in publication workflow | Research Manager reviews for MNPI indicators before IC presentation; CCO sign-off required before publication |
| Simultaneous public disclosure when material information published | Publication workflow triggers broad disclosure event | Chronicle audit trail records publication timestamp; ComplianceShield generates disclosure event for regulatory record |

---

## 2. SFDR Article 4 — Principal Adverse Impact Statement

**Regulation:** EU Sustainable Finance Disclosure Regulation (SFDR), Regulation (EU) 2019/2088, Article 4
**Issuer:** European Commission / ESMA
**Jurisdiction:** European Union
**Scope:** Financial market participants with >500 employees must publish a Principal Adverse Impact (PAI) statement at the entity level, disclosing how principal adverse impacts of investment decisions on sustainability factors are considered

**Applicability to ResearchNexus:**

esg-scorer is the primary system of record for PAI indicator computation. Its outputs populate AssetCo's annual PAI statement.

| PAI Obligation | SOE Control | Implementation |
|---|---|---|
| Mandatory PAI indicators (Table 1, 14 for investee companies) | esg-scorer reads MSCI ESG, Sustainalytics, CDP; computes all 14 mandatory indicators per holding | SOE grants esg-scorer exclusive read access to ESG provider paths; other agents denied |
| Data quality and coverage disclosure | esg-scorer flags estimated vs. reported data; computes fund-level data coverage ratio | Data quality metadata included in every PAI record; coverage ratio included in SFDR disclosure output |
| Annual entity-level PAI statement | esg-scorer writes to `compliance/sfdr/entity-pai/**` | ComplianceShield reads from this path to generate and submit the PAI statement |

---

## 3. SFDR Articles 6, 8, and 9 — Fund-Level Sustainability Disclosures

**Regulation:** SFDR Articles 6 (no sustainability claim), 8 (environmental/social characteristics), 9 (sustainable investment objective)
**Issuer:** European Commission
**Jurisdiction:** European Union
**Scope:** Product-level pre-contractual and periodic disclosures for EU-distributed funds

| Fund Classification | Disclosure Obligation | esg-scorer Role |
|---|---|---|
| Article 6 | Disclose whether and how sustainability risks are integrated | esg-scorer provides sustainability risk score per fund; no minimum threshold |
| Article 8 | Disclose how environmental/social characteristics are met; PAI indicators for promoted characteristics | esg-scorer computes PAI indicators for promoted E/S characteristics; EU Taxonomy alignment percentage where Article 8 funds claim taxonomy alignment |
| Article 9 | Disclose how sustainable investment objective is achieved; taxonomy alignment % for investments | esg-scorer computes sustainable investment percentage, taxonomy alignment percentage, and DNSH (Do No Significant Harm) assessment per holding |

**SOE control:** esg-scorer writes fund-level SFDR disclosures to `compliance/sfdr/funds/**`. These paths are read by ComplianceShield for regulatory submission. The SOE write grant to `compliance/sfdr/**` is exclusive to esg-scorer to ensure a single authoritative source for SFDR data.

---

## 4. EU Taxonomy Regulation — Environmental Objectives

**Regulation:** EU Taxonomy Regulation (EU) 2020/852, Article 3 (criteria for environmentally sustainable economic activities)
**Issuer:** European Commission
**Jurisdiction:** European Union
**Scope:** Establishes six environmental objectives and technical screening criteria for Taxonomy-aligned economic activities; mandatory for SFDR Article 8/9 funds claiming taxonomy alignment

**Six Environmental Objectives (Article 9 of the Taxonomy Regulation):**

| Objective | esg-scorer Computation |
|---|---|
| 1. Climate change mitigation | Maps revenue to NACE codes with climate mitigation taxonomy eligibility; applies technical screening criteria (e.g., renewable energy threshold, building energy performance) |
| 2. Climate change adaptation | Screens capex and revenue for adaptation-aligned activities; applies physical climate risk assessment where criteria require it |
| 3. Sustainable use and protection of water and marine resources | Revenue screen for water sector activities; applies water stress methodology where applicable |
| 4. Transition to a circular economy | Revenue and capex screen for circular economy activities (waste reduction, product lifetime extension, secondary materials) |
| 5. Pollution prevention and control | NACE-based screen; applies hazardous substance criteria per sector-specific technical screening criteria |
| 6. Protection and restoration of biodiversity and ecosystems | Biodiversity sensitive area screen; applies TNFD-aligned biodiversity metrics where data available |

**DNSH (Do No Significant Harm):** For each claim of alignment with one objective, esg-scorer verifies that the activity does not significantly harm any of the other five objectives. DNSH assessment outputs are included in esg-scorer's taxonomy alignment records.

**SOE control:** EU Taxonomy alignment data flows from esg-scorer to `compliance/sfdr/**`. No other agent writes to this path.

---

## 5. MAR Articles 7 and 8 — Insider Dealing and Market Manipulation

**Regulation:** EU Market Abuse Regulation (MAR), Regulation (EU) 596/2014, Articles 7 (inside information definition) and 8 (prohibition on insider dealing)
**Issuer:** European Commission / ESMA
**Jurisdiction:** European Union
**Scope:** Prohibits insider dealing (trading on inside information) and requires issuers and their advisers to manage inside information

**Applicability to ResearchNexus:**

MAR Article 7 defines inside information as information of a precise nature, not publicly available, relating to a financial instrument, that if made public would likely have a significant effect on the price. MAR Article 8 prohibits any person in possession of inside information from using it when trading.

**Front-running as an insider dealing risk:**
If a ResearchNexus agent could read AssetCo's current positions or pending orders, its research outputs could inadvertently encode that information. If a downstream system (AlphaEngine) acted on those outputs before the positions were disclosed, this could constitute insider dealing under MAR Article 8 — trading on information (the firm's own pending order flow) not available to the market.

| MAR Obligation | SOE Control | Implementation |
|---|---|---|
| Prevent MNPI from reaching research agents (MAR Art.7 — inside information management) | Chinese wall readDeny blocks all trading/order/position/execution paths | Deterministic deny in ResearchNexus base policy; cannot be overridden by any agent policy |
| Prevent research outputs from selectively reaching trading desk before publication (MAR Art.10 — tipping) | Publication gate; TradeSentinel and AlphaEngine SOE deny pre-publication read access | Pre-publication research inaccessible to trading-side applications at SOE layer |
| Chinese wall violation attempt → immediate escalation | BLOCK_AND_ESCALATE on any readDeny hit against trading paths | Chronicle generates CRITICAL-severity audit event; routed to ComplianceShield for CCO review |

---

## 6. EU AI Act Article 12 — Record-Keeping (Traceability)

**Regulation:** EU Artificial Intelligence Act (EU) 2024/1689, Article 12 (record-keeping)
**Issuer:** European Commission
**Jurisdiction:** European Union (applies to SIGNIFICANT and HIGH RISK systems)
**Scope:** AI systems classified as SIGNIFICANT must maintain logs enabling traceability of AI-generated outputs

**ResearchNexus EU AI Act obligations:**

| Article 12 Requirement | Chronicle Implementation |
|---|---|
| Logging of operation period | Every research generation event logged with start/end timestamp, agent identity, model version |
| Data inputs used to generate output | Input sources (SEC filing reference, transcript ID, ESG provider data vintage) logged per research item |
| Reference data used | ESG provider data snapshot reference logged per esg-scorer computation |
| Traceability from output to input | Chronicle event chain: input_received → agent_processing → output_written → review_event → publication_event → downstream_access |
| Retention of logs | Research records: 5 years; SFDR disclosures: 7 years; fair value assessments: 10 years |

The Chronicle audit trail satisfies EU AI Act Article 12 traceability requirements. Every research output can be traced from its downstream consumption (AlphaEngine portfolio construction) back through the publication event, the human review, and the original research generation — with input sources and model versions recorded at each step.

---

## 7. ASC 820 / IFRS 13 — Fair Value Measurement

**Regulations:** FASB ASC 820 (Fair Value Measurement); IFRS 13 (Fair Value Measurement)
**Issuer:** FASB (US GAAP); IASB (IFRS)
**Scope:** Establishes framework for measuring fair value; requires disclosure of valuation techniques, significant inputs, and Level 1/2/3 hierarchy classification for all fair value measurements

**Level hierarchy:**
- **Level 1:** Quoted prices in active markets for identical assets — no modelling required
- **Level 2:** Observable inputs other than Level 1 (comparable prices, yield curves, credit spreads) — fair-value-modeler assists
- **Level 3:** Significant unobservable inputs — fair-value-modeler required; highest documentation burden

| ASC 820 / IFRS 13 Requirement | fair-value-modeler Implementation |
|---|---|
| Valuation technique disclosure (market, income, cost approach) | fair-value-modeler records the approach applied per asset; rationale for technique selection documented |
| Significant unobservable inputs for Level 3 (with range and weighted average) | Level 3 output includes `unobservable_inputs[]` array: input name, value, range low/high, weighted average where applicable |
| Sensitivity of fair value to changes in unobservable inputs | fair-value-modeler generates sensitivity table: +/- 10% on key inputs with resulting fair value range |
| Roll-forward of Level 3 activity | Quarterly roll-forward: opening balance, purchases, sales, settlements, transfers in/out, unrealised gains/losses in P&L and OCI, closing balance |
| Human validation before NAV use | SOE blocks automated write to NAV/accounting systems; all valuation outputs go to `research/pre-publication/valuations/**` pending human sign-off from Model Risk |

---

## 8. Regulatory Obligation Summary

| Regulation | Primary SOE Control | Agent Responsible |
|---|---|---|
| Reg FD (selective disclosure) | Publication gate; TradeSentinel/AlphaEngine pre-publication read deny | All agents (via publication gate) |
| SFDR Art.4 (PAI statement) | esg-scorer exclusive access to ESG providers; writes to compliance/sfdr/** | esg-scorer |
| SFDR Art.6/8/9 (fund disclosures) | esg-scorer fund-level PAI and taxonomy computation | esg-scorer |
| EU Taxonomy Art.3 (environmental objectives) | esg-scorer taxonomy alignment scoring + DNSH assessment | esg-scorer |
| MAR Art.7/8 (insider dealing) | Chinese wall readDeny (trading/orders/executions/positions) | All agents (base policy) |
| MAR Art.10 (tipping) | Publication gate; pre-publication paths denied to downstream apps | All agents (via publication gate) |
| EU AI Act Art.12 (traceability) | Chronicle audit trail per research generation event | All agents (Chronicle logging) |
| ASC 820 / IFRS 13 (fair value hierarchy) | fair-value-modeler Level 3 documentation; NAV write deny | fair-value-modeler |

---

*This document is part of the AssetCo AI Platform documentation suite. Regulatory requirements should be validated by qualified Legal and Compliance counsel before implementation. This document is maintained by the Compliance Technology team.*

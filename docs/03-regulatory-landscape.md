# AssetCo AI Platform — Regulatory Landscape

**Document:** 03-Regulatory-Landscape
**Organization:** AssetCo (fictional $85B global asset manager)
**Scope:** AI governance obligations across US, EU, UK, and APAC jurisdictions
**Maintainer:** Compliance & Legal, AI Governance Office
**Last Updated:** 2026-03-20

---

## Overview

AssetCo operates seven AI applications across four regulatory jurisdictions. Each application carries distinct regulatory obligations depending on its function, the data it processes, and the decisions it influences. This document maps each AI application to its primary regulatory requirements, surfaces cross-cutting obligations and conflicts, and documents how the Sentinel-Ops Safe Operating Envelope (SOE) enforces compliance at the point of AI execution.

### AI Application Regulatory Profile

| Application | Function | EU AI Act Class | Primary Jurisdictions | Key Risk |
|-------------|----------|-----------------|----------------------|----------|
| **AlphaEngine** | Portfolio optimization | HIGH RISK | US, EU, UK, APAC | Fiduciary liability, SFDR greenwashing |
| **TradeSentinel** | Trade execution | HIGH RISK | US, EU, UK | Market manipulation, best execution failure |
| **RiskCompass** | Risk analytics | HIGH RISK | US, EU, APAC | Model risk, systemic risk amplification |
| **ComplianceShield** | Regulatory reporting | SIGNIFICANT | US, EU, UK | Inaccurate filings, DORA ICT failure |
| **AdvisorLens** | Client advisory | HIGH RISK | US, EU, UK | Fiduciary breach, GDPR Art.22 automated decisions |
| **ResearchNexus** | Research + ESG scoring | SIGNIFICANT | US, EU | Reg FD breach, SFDR PAI inaccuracy |
| **OpsFabric** | Operations | LIMITED | US, EU, UK | Settlement fails (T+1/T+2/CSDR) |

---

## US Regulatory Framework

### SEC Investment Advisers Act of 1940

The Advisers Act establishes fiduciary duty for registered investment advisers and applies directly to AlphaEngine and AdvisorLens as AI systems that influence investment advice.

| Provision | Requirement | Applicable AI Apps | SOE Control |
|-----------|-------------|-------------------|-------------|
| Fiduciary Duty | Act in client's best interest; duty of loyalty and care | AlphaEngine, AdvisorLens | Human-in-the-loop gate for client-impacting recommendations |
| Form ADV, Part 2B | Disclose use of AI/algorithms in investment process | All apps | ComplianceShield generates ADV disclosures; SOE logs model version at each decision |
| Rule 204-2 (Books and Records) | Retain records of investment advice for 5 years; includes AI-generated recommendations | AlphaEngine, AdvisorLens, RiskCompass | Chronicle audit trail retained in S3 with 5-year lifecycle policy |
| Custody Rule (Rule 206(4)-2) | Safeguards for client assets; independent verification | OpsFabric | SOE blocks automated custody transfers above $50K without human approval |
| Rule 206(4)-7 (Compliance Program) | Written compliance policies covering AI systems | All apps | SOE policy definitions (*.soe.json) constitute formal compliance controls |

### SEC Regulation NMS (National Market System)

Reg NMS governs trade execution quality and applies directly to TradeSentinel.

| Provision | Requirement | Applicable AI Apps | SOE Control |
|-----------|-------------|-------------------|-------------|
| Rule 611 (Order Protection Rule) | Must execute at NBBO or better; no trade-throughs | TradeSentinel | SOE enforces pre-trade price validation before execution commands |
| Rule 610 (Access Rule) | Access fees capped at $0.003/share | TradeSentinel | Fee schedule validation in SOE deterministic pre-filter |
| Rule 612 (Sub-Penny Rule) | Minimum pricing increments | TradeSentinel | Order format validation at SOE gate |
| Best Execution | Duty to seek best reasonably available terms | TradeSentinel, AlphaEngine | SOE requires venue selection rationale in audit log |

### SEC Regulation FD (Fair Disclosure)

Reg FD prohibits selective disclosure of material non-public information and constrains ResearchNexus and AlphaEngine.

| Provision | Requirement | Applicable AI Apps |
|-----------|-------------|-------------------|
| Simultaneous public disclosure | Material information disclosed to one investor must be disclosed to all simultaneously | ResearchNexus |
| Research publication controls | AI-generated research cannot be selectively routed based on client tier | ResearchNexus |
| Information barrier enforcement | AI must not access sell-side MNPI feeds without controls | AlphaEngine, TradeSentinel |

SOE enforces Reg FD via data access deny rules blocking ResearchNexus from writing to external channels before public release, and blocking AlphaEngine's read access to pre-publication research.

### FINRA Rules

| Rule | Title | Requirement | Applicable AI Apps |
|------|-------|-------------|-------------------|
| Rule 2111 | Suitability | Recommendations must be suitable given customer profile | AdvisorLens |
| Rule 4511 | Books and Records | 6-year retention for records of customer accounts and transactions | All apps (records) |
| Rule 3110 | Supervision | Supervisory system for AI-generated communications and recommendations | AdvisorLens, ComplianceShield |
| Rule 2210 | Communications | Fair, balanced, not misleading; includes AI-generated content | AdvisorLens, ResearchNexus |
| Rule 4370 | Business Continuity | BCP covers AI system failure scenarios | All apps |

### Dodd-Frank Act

| Provision | Requirement | Applicable AI Apps |
|-----------|-------------|-------------------|
| Title I (FSOC/Systemic Risk) | Systemic risk reporting; AI amplification risk | RiskCompass |
| Title II (Orderly Liquidation) | Liquidity modeling under stress | RiskCompass |
| Form PF | Quarterly/annual filing for PE/hedge fund advisers managing >$150M | AlphaEngine, ComplianceShield |
| Title VII (OTC Derivatives) | Clearing and reporting of swaps | OpsFabric, ComplianceShield |
| Volcker Rule | Proprietary trading restrictions; AI must not execute prohibited strategies | TradeSentinel |

### ERISA (Employee Retirement Income Security Act)

ERISA applies to AlphaEngine and AdvisorLens where AssetCo manages pension plan assets.

| Provision | Requirement | Applicable AI Apps |
|-----------|-------------|-------------------|
| Section 404 (Prudent Expert) | Investment decisions must meet prudent expert standard | AlphaEngine, AdvisorLens |
| Section 406 (Prohibited Transactions) | AI cannot execute transactions between plan and party-in-interest | TradeSentinel |
| Section 408 (Exemptions) | Certain AI-assisted decisions require specific exemptions | AlphaEngine |
| DOL AI Guidance | Fiduciaries must understand and monitor AI tools used in plan management | AlphaEngine, AdvisorLens |

### Sarbanes-Oxley Act (SOX)

| Section | Requirement | Applicable AI Apps |
|---------|-------------|-------------------|
| Section 302 | CEO/CFO certify accuracy of financial statements; AI-generated inputs must be auditable | ComplianceShield, RiskCompass |
| Section 404 | Annual assessment of internal controls over financial reporting; AI models are in-scope | ComplianceShield, RiskCompass |
| Section 802 | Criminal penalties for record destruction; immutable audit trail required | All apps |

### OCC SR 11-7 — Model Risk Management

SR 11-7 (issued by the Fed/OCC) is the primary US model risk management framework and applies to all AI models used in material business decisions.

| Requirement | Detail | Applicable AI Apps |
|-------------|--------|-------------------|
| Model Inventory | All models must be inventoried with risk tier | All apps |
| Model Validation | Independent validation before deployment and on material change | AlphaEngine, RiskCompass, TradeSentinel |
| Ongoing Monitoring | Performance monitoring, outcome analysis, backtesting | AlphaEngine, TradeSentinel, RiskCompass |
| Model Documentation | Conceptual soundness, data, assumptions, limitations | All apps |
| Challenger Models | High-risk models require challenger model or benchmark | AlphaEngine, RiskCompass |

SOE enforces SR 11-7 compliance by blocking deployment of model versions not registered in the model inventory (enforced via ComplianceShield's SOE definition).

---

## EU Regulatory Framework

### EU AI Act (Regulation 2024/1689)

The EU AI Act is the primary AI-specific regulation and imposes the most extensive obligations on AssetCo's HIGH RISK applications.

**HIGH RISK Classification:** Financial services AI that influences credit decisions, investment decisions, or insurance pricing is classified HIGH RISK under Annex III, Category 5(b) and 8.

| Article | Requirement | Applicable AI Apps | Implementation |
|---------|-------------|-------------------|----------------|
| Art.9 (Risk Management) | Continuous risk management system throughout lifecycle | AlphaEngine, TradeSentinel, RiskCompass, AdvisorLens | Arbiter async risk scoring; SOE risk budget enforcement |
| Art.10 (Data Governance) | Training data must be relevant, representative, free of errors | All HIGH RISK apps | Data provenance logged; SOE blocks access to unvalidated data sources |
| Art.11 (Technical Documentation) | Technical documentation before market placement | All HIGH RISK apps | ComplianceShield generates and versions technical documentation |
| Art.12 (Record-Keeping) | Automatic logging of events for lifetime of system | All HIGH RISK apps | Chronicle append-only audit trail; retention = system lifetime + 10 years |
| Art.13 (Transparency) | Provide sufficient information for users to interpret output | AlphaEngine, AdvisorLens, RiskCompass | Decision rationale logged; explanation endpoint required |
| Art.14 (Human Oversight) | Human oversight measures; ability to intervene | AlphaEngine, AdvisorLens, TradeSentinel | SOE enforces human-in-the-loop for HIGH RISK decisions above risk thresholds |
| Art.15 (Accuracy/Robustness) | Performance metrics; resilience against errors and adversarial manipulation | All HIGH RISK apps | Continuous monitoring; SOE blocks degraded model versions |
| Art.17 (Quality Management) | Quality management system; policies, procedures, oversight | All HIGH RISK apps | Mapped to existing ISO 27001/SOC2 QMS |
| Art.52 (Transparency for Users) | Disclose when user is interacting with AI; no deceptive design | AdvisorLens | Mandatory AI disclosure in client-facing UI; SOE enforces disclosure before advisory output |
| Art.72 (Serious Incident Reporting) | Report serious incidents to national authority within 15 days | All HIGH RISK apps | SOE Beacon triggers incident workflow; Chronicle generates incident report |

**SIGNIFICANT RISK Applications (ComplianceShield, ResearchNexus):** Lower obligations — no mandatory conformity assessment, but transparency and record-keeping requirements apply under Art.52 and Art.12 where applicable.

### MiFID II / MiFIR (Directive 2014/65/EU and Regulation 600/2014)

| Provision | Article | Requirement | Applicable AI Apps |
|-----------|---------|-------------|-------------------|
| Best Execution | Art.27 MiFID II | Execute orders on terms most favorable to client | TradeSentinel |
| Suitability | Art.25(2) MiFID II | Assess suitability of investment before advice | AdvisorLens, AlphaEngine |
| Appropriateness | Art.25(3) MiFID II | Assess appropriateness for complex instruments | AdvisorLens |
| Product Governance | Art.16(3) MiFID II | AI products must have defined target market | AlphaEngine, AdvisorLens |
| Transaction Reporting | Art.26 MiFIR | Report all transactions to NCA within T+1 | TradeSentinel, ComplianceShield |
| Algorithmic Trading | Art.17 MiFID II | Algorithmic trading systems require pre-trade controls, kill switch | TradeSentinel |
| Market Data | Art.64-66 MiFIR | Consolidated tape access, trade transparency | TradeSentinel, ResearchNexus |
| Conflicts of Interest | Art.23 MiFID II | Identify, manage, disclose conflicts | AdvisorLens, ResearchNexus |

### AIFMD (Alternative Investment Fund Managers Directive 2011/61/EU)

Applies to AssetCo's alternative fund strategies managed by AlphaEngine and RiskCompass.

| Requirement | Detail | Applicable AI Apps |
|-------------|--------|-------------------|
| Risk Management | Functionally and hierarchically separate risk management | RiskCompass |
| Leverage Limits | Gross/commitment method leverage reporting to NCAs | RiskCompass, AlphaEngine |
| Liquidity Management | Stress testing of liquidity profiles quarterly | RiskCompass |
| Annex IV Reporting | Detailed portfolio data to regulator | ComplianceShield |

### SFDR (Sustainable Finance Disclosure Regulation 2019/2088)

| Article | Requirement | Applicable AI Apps |
|---------|-------------|-------------------|
| Art.4 (PAI Disclosures) | Report 18 mandatory Principal Adverse Impact indicators | ResearchNexus, ComplianceShield |
| Art.6/8/9 Classification | Disclose ESG integration approach per fund class | AlphaEngine, ComplianceShield |
| Art.9 (Dark Green) | Sustainable investment objective; no significant harm | AlphaEngine (Art.9 funds) |
| RTS (Level 2) | Detailed templates for PAI, taxonomy alignment | ComplianceShield, ResearchNexus |

SOE blocks AlphaEngine from executing trades in instruments with SFDR PAI scores above fund-specific thresholds, enforced via ResearchNexus ESG data integration.

### EU Taxonomy Regulation (2020/852)

| Requirement | Detail | Applicable AI Apps |
|-------------|--------|-------------------|
| 6 Environmental Objectives | Taxonomy alignment scoring per objective | ResearchNexus |
| DNSH (Do No Significant Harm) | Verify all 6 objectives not significantly harmed | ResearchNexus, AlphaEngine |
| Minimum Social Safeguards | OECD Guidelines, UN Guiding Principles compliance | ResearchNexus |
| KPI Reporting | Revenue/CapEx/OpEx alignment for corporates | ResearchNexus, ComplianceShield |

### EMIR (European Market Infrastructure Regulation 648/2012)

| Requirement | Detail | Applicable AI Apps |
|-------------|--------|-------------------|
| Central Clearing | OTC derivatives above clearing threshold must be centrally cleared | OpsFabric, TradeSentinel |
| Trade Repository Reporting | All OTC derivatives reported to ESMA-registered TRs | ComplianceShield, OpsFabric |
| Margin Requirements | VM and IM exchange for non-cleared derivatives | OpsFabric, RiskCompass |
| Risk Mitigation | Timely confirmation, portfolio reconciliation, compression | OpsFabric |

### GDPR (General Data Protection Regulation 2016/679)

| Article | Requirement | Applicable AI Apps |
|---------|-------------|-------------------|
| Art.5 (Principles) | Lawfulness, fairness, transparency, purpose limitation, data minimisation | All apps processing personal data |
| Art.22 (Automated Decision-Making) | Right not to be subject to solely automated decisions with significant effects; right to human review | AdvisorLens |
| Art.25 (Privacy by Design) | Data protection by design and by default | AdvisorLens, AlphaEngine |
| Art.35 (DPIA) | Data Protection Impact Assessment required for HIGH RISK processing | AdvisorLens, AlphaEngine |
| Art.44-49 (Transfers) | Personal data transfers to third countries restricted | All apps (model training data) |
| Art.83 (Fines) | Up to 4% global annual turnover for serious infringements | All apps |

SOE enforces GDPR Art.22 by requiring human review of AdvisorLens recommendations that materially affect client portfolios (>2% allocation change or >€10K impact).

### DORA (Digital Operational Resilience Act 2022/2554)

DORA applies to financial entities and their critical ICT third-party providers from January 2025.

| Pillar | Requirement | Applicable AI Apps |
|--------|-------------|-------------------|
| ICT Risk Management | Governance framework; risk tolerance; ICT asset inventory | All apps |
| Incident Classification | Classify and report major ICT-related incidents | All apps |
| TLPT (Threat-Led Penetration Testing) | Threat-led testing for significant institutions every 3 years | All apps (platform-level) |
| Third-Party Risk | Due diligence, contractual requirements for critical ICT providers | All apps (cloud/AI providers) |
| Information Sharing | Voluntary sharing of cyber threat intelligence | Platform-level |

ComplianceShield tracks DORA ICT incidents; SOE Beacon's anomaly detection feeds the DORA incident classification workflow.

### CSDR (Central Securities Depositories Regulation 909/2014)

Applies to OpsFabric's settlement processing.

| Requirement | Detail | Applicable AI Apps |
|-------------|--------|-------------------|
| Settlement Discipline | Mandatory buy-ins and cash penalties for fails | OpsFabric |
| T+2 Standard Settlement | EU equities settle T+2; AI must optimize allocation timing | OpsFabric |
| Settlement Fail Reporting | Daily fail reporting to CSDs | OpsFabric, ComplianceShield |

---

## UK Regulatory Framework (Post-Brexit)

Following Brexit, the UK has diverged from EU regulations while maintaining broadly equivalent standards.

### FCA SYSC (Systems and Controls)

| Source Rule | Requirement | Applicable AI Apps |
|-------------|-------------|-------------------|
| SYSC 6.1 | Compliance function; compliance monitoring programme | All apps |
| SYSC 7.1 | Risk management policies and procedures; model risk | RiskCompass, AlphaEngine |
| SYSC 10.1 | Conflicts of interest policy | AdvisorLens, ResearchNexus |
| MAR 5 (Algorithmic Trading) | Pre-trade controls, kill switches, stress testing for algos | TradeSentinel |
| PS 19/1 (Algo Trading) | Annual self-assessment of algorithmic trading controls | TradeSentinel |

### UK GDPR and Data Protection Act 2018

The UK retained GDPR equivalence post-Brexit. Identical article structure to EU GDPR applies. Key divergences:

| Area | EU GDPR | UK GDPR | Impact |
|------|---------|---------|--------|
| Adequacy | EU Commission decisions | UK adequacy decisions (separate) | Data flows between EU and UK require bilateral adequacy or SCCs |
| Art.22 | Automated decision-making rights identical | Same, enforced by ICO | AdvisorLens dual compliance required |
| Enforcement | CNIL/DPA network | ICO | Separate breach notifications required |

### FCA Consumer Duty (PS22/9, effective July 2023)

| Outcome | Requirement | Applicable AI Apps |
|---------|-------------|-------------------|
| Products and Services | Fair value; designed for target market | AdvisorLens, AlphaEngine |
| Price and Value | AI must not deliver poor value outcomes | AdvisorLens |
| Consumer Understanding | Clear, not misleading communications | AdvisorLens, ResearchNexus |
| Consumer Support | Support that meets client needs | AdvisorLens |

The Consumer Duty applies to all retail client-facing AI interactions. SOE enforces a Consumer Duty gate on AdvisorLens output: recommendations are validated against suitability profile before delivery.

### UK AI Governance

The UK has not enacted an AI Act equivalent. The FCA's discussion papers (DP23/3, 2023) and the AI and Digital Finance position paper establish that **"same risk, same regulatory outcome"** applies — existing SYSC, Consumer Duty, and conduct rules govern AI behavior. The FCA expects firms to:

- Document AI model governance in line with SR 11-7 principles
- Maintain explainability proportionate to decision impact
- Test for bias and discrimination in AI outputs
- Appoint a senior manager accountable for AI under SMCR

---

## APAC Regulatory Framework

### MAS Technology Risk Management (TRM) Guidelines (January 2021)

Issued by the Monetary Authority of Singapore, the TRM Guidelines apply to all financial institutions operating in Singapore, including AlphaEngine, TradeSentinel, and RiskCompass used for Singapore-domiciled funds.

| Domain | Requirement | Applicable AI Apps |
|--------|-------------|-------------------|
| AI/ML Governance | Board-level accountability; AI inventory | All apps |
| Data Management | Data quality, lineage, access controls | All apps |
| Model Risk | Independent validation; ongoing performance monitoring | AlphaEngine, RiskCompass |
| Third-Party Management | Due diligence and oversight of AI service providers | All apps (cloud providers) |
| Cyber Resilience | Threat intelligence; incident response | All apps |

### MAS FEAT Principles (November 2018)

The Fairness, Ethics, Accountability, and Transparency framework applies to all AI/data analytics decisions in financial services.

| Principle | Requirement | Applicable AI Apps | SOE Enforcement |
|-----------|-------------|-------------------|----------------|
| Fairness | AI must not discriminate on protected characteristics | AdvisorLens, AlphaEngine | Bias monitoring in Beacon; alerts on demographic skew |
| Ethics | AI must operate within ethical boundaries; flag conflicts | AdvisorLens | Counsel policy advisor; SOE escalation for edge cases |
| Accountability | Clear accountability for AI decisions; human responsible | All apps | Decision attribution in Chronicle audit trail |
| Transparency | Explainable decisions; appropriate disclosure | All apps | Explanation logs per Art.13 (reused for FEAT) |

### Singapore Personal Data Protection Act (PDPA) 2012 (amended 2021)

| Provision | Requirement | Applicable AI Apps |
|-----------|-------------|-------------------|
| Consent Obligation | Collect personal data only with consent | AdvisorLens |
| Data Portability | Transfer personal data on request | AdvisorLens |
| Mandatory Breach Notification | Notify PDPC and affected individuals within 3 days | All apps |
| Data Innovation Provisions (2021) | Allows secondary use of data without consent for legitimate business improvement | ResearchNexus (ESG analytics) |

### MAS Notice on Outsourcing (MAS 634/MAS 655)

Applies when AssetCo uses third-party AI providers (cloud AI, LLM APIs) for Singapore-regulated activities.

| Requirement | Detail | Applicable AI Apps |
|-------------|--------|-------------------|
| Material Outsourcing Assessment | Determine if AI provider is material outsourcing | All apps using cloud AI |
| Due Diligence | Pre-engagement and ongoing assessment | All apps |
| Contractual Obligations | Audit rights, subcontracting restrictions, exit provisions | All apps |
| Concentration Risk | Monitor dependency on single AI provider | Platform-level |
| Notification | Notify MAS before entering material outsourcing arrangements | AlphaEngine, TradeSentinel |

---

## Cross-Cutting Themes

### 1. Fiduciary Duty vs. AI Autonomy

Multiple regimes impose fiduciary or fiduciary-equivalent obligations, but differ in how much autonomy AI may exercise.

| Regime | Standard | Human Oversight Required |
|--------|----------|--------------------------|
| SEC Advisers Act | Fiduciary (best interest) | Judgment calls require human sign-off |
| MiFID II Art.25 | Suitability | Suitability assessment may be AI-assisted but adviser is responsible |
| ERISA Sect.404 | Prudent expert | Investment committee must ratify AI-generated allocations |
| FCA Consumer Duty | Client outcome | AI recommendations reviewed for fair value |
| MAS FEAT | Accountability | Named human accountable for all AI decisions |

**SOE Resolution:** AlphaEngine and AdvisorLens operate under a tiered human-in-the-loop policy. Decisions below jurisdiction-specific risk thresholds execute autonomously with full audit logging. Decisions above thresholds require explicit human approval before execution. Thresholds are encoded in each application's SOE definition and cannot be modified by the AI itself.

### 2. Explainability

| Regime | Provision | Requirement |
|--------|-----------|-------------|
| EU AI Act | Art.13 | Sufficient transparency for users to interpret output |
| GDPR | Art.22(3) | Right to obtain human review and explanation of automated decisions |
| MiFID II | Art.25 | Document basis of suitability assessment |
| SR 11-7 | Section IV | Model documentation of assumptions and limitations |
| MAS FEAT | Transparency | Explanations proportionate to impact |

**SOE Resolution:** Every decision by AlphaEngine, AdvisorLens, and TradeSentinel includes a structured explanation record in Chronicle. The explanation captures: inputs considered, rules matched, risk score at time of decision, model version, and human oversight action (if any). This single log satisfies Art.13, Art.22, Art.25, and FEAT transparency requirements simultaneously.

### 3. Information Barriers (Chinese Walls)

| Regime | Provision | Restriction |
|--------|-----------|------------|
| Reg FD | 17 CFR 243 | Material non-public information cannot be selectively disclosed |
| EU MAR | Art.10-11 | Unlawful disclosure of inside information |
| MiFID II | Art.23 | Conflicts of interest; information barriers between business units |
| FCA MAR | MAR 1 | Market abuse; front-running restrictions |

**SOE Resolution:** SOE data access rules enforce information barriers at the AI agent level. ResearchNexus cannot write to channels accessible by TradeSentinel. AlphaEngine's read access to ResearchNexus output is delayed by T+1 for MNPI-flagged research. These controls are enforced deterministically in the SOE pre-filter, not by the AI model itself.

### 4. Record-Keeping Retention Conflicts

Different regimes impose different retention periods, creating a need to satisfy the longest requirement.

| Regime | Provision | Retention Period | Applicable Apps |
|--------|-----------|-----------------|----------------|
| SEC Rule 204-2 | Books and Records | 5 years (most recent 2 years easily accessible) | AlphaEngine, AdvisorLens |
| FINRA Rule 4511 | Books and Records | 6 years | All records |
| MiFIR | Art.25 (transaction reporting) | 5 years | TradeSentinel |
| EU AI Act | Art.12 | Lifetime of system + post-decommission period | All HIGH RISK apps |
| GDPR | Art.5(1)(e) | No longer than necessary (conflicts with above) | All apps processing personal data |
| MAS TRM | Audit logs | 5 years | All apps (Singapore) |

**SOE Resolution:** Chronicle retains all decision records for 10 years minimum (satisfying FINRA's 6-year requirement with buffer). GDPR conflicts are resolved via pseudonymization: personal data fields are anonymized after 2 years, but the decision record itself (non-personal) is retained for the full period. EU AI Act's "lifetime of system" requirement is met by never deleting records for active models.

### 5. Model Risk — Overlapping Governance Requirements

| Regime | Provision | Key Requirement |
|--------|-----------|----------------|
| SR 11-7 | Full guidance | Independent validation, ongoing monitoring, challenger models |
| EU AI Act | Art.9, Art.15 | Risk management system, accuracy/robustness requirements |
| MAS FEAT | Accountability | Documented accountability for model outcomes |
| FCA SYSC 7 | Risk management | Model risk policies |
| DORA | ICT Risk | AI systems as ICT assets requiring risk management |

**SOE Resolution:** AssetCo maintains a single Model Governance Framework (MGF) that satisfies all five regimes. The MGF maps each requirement to a single control. SOE enforces MGF compliance by blocking execution of model versions not in the approved model registry (maintained by ComplianceShield).

### 6. Data Sovereignty

Cross-border data flows for AI model training and inference are restricted by multiple data protection regimes.

| Regime | Cross-Border Mechanism | Restriction |
|--------|----------------------|-------------|
| GDPR | SCCs, BCRs, Adequacy Decisions | Personal data to non-adequate third countries requires safeguards |
| UK GDPR | UK SCCs (IDTA), Adequacy | Separate from EU — bilateral flows require separate basis |
| Singapore PDPA | Binding corporate rules, contractual protection | Transfers to countries without comparable protection require safeguards |
| China PIPL | Government approval for critical data | Not currently in scope, noted for future |

**SOE Resolution:** SOE data access rules enforce data residency: EU personal data processed in EU region, UK data in UK region, Singapore data in APAC region. Cross-region data movement by AI agents is blocked at the SOE gate unless a human-approved transfer basis is logged in the session context.

---

## Regulatory Conflict Resolution

The following table documents specific regulatory conflicts and their SOE resolution.

| Conflict | Regulation A | Regulation B | Conflict Description | SOE Resolution |
|----------|-------------|-------------|---------------------|---------------|
| Algorithm transparency vs. IP protection | EU AI Act Art.13 (full transparency) | SEC/FTC (trade secret protection) | Full algorithmic disclosure conflicts with IP protection | SOE logs complete decision rationale to Chronicle (internal, regulatorily accessible); external disclosure is controlled by SOE write-deny rules on public channels |
| Automated execution vs. opt-out right | MiFID II Art.27 (automated best execution required) | GDPR Art.22 (right to opt out of automated decisions) | Client cannot opt out of automated execution but has GDPR rights | SOE enforces human-in-the-loop for client-facing advisory (AdvisorLens); execution (TradeSentinel) is treated as MiFID II-exempt automated execution, not an Art.22 "decision significantly affecting" the individual |
| Data minimisation vs. audit retention | GDPR Art.5(1)(e) (no longer than necessary) | SEC Rule 204-2, FINRA 4511, EU AI Act Art.12 (5-10 years) | GDPR says delete; financial regs say retain | Personal data pseudonymized at 2 years; non-personal decision records retained for 10 years; pseudonymization key held in HSM with access logged |
| UK/EU divergence post-Brexit | EU AI Act (binding HIGH RISK requirements) | UK FCA (principles-based, no AI Act equivalent) | Different obligations for same AI system | AlphaEngine operates under EU AI Act standards globally (highest common denominator); documented in Form ADV and UK regulatory correspondence as voluntary adoption |
| PAI reporting vs. data availability | SFDR Art.4 (mandatory PAI for all investees) | SME/private company data scarcity | AI cannot report PAI for companies with no data | ResearchNexus flags "data not available" per SFDR RTS template; best-efforts estimation disclosed; ComplianceShield includes methodology caveat |
| DORA third-party vs. cloud AI provider | DORA Art.28-44 (critical ICT provider obligations) | Cloud AI provider (LLM/model API) as potential critical provider | LLM API providers may qualify as critical ICT providers | SOE routes AI inference through assetco-controlled proxy; no client data sent to third-party AI APIs without DORA-compliant contractual framework; logged per DORA Art.28 |

---

## Compliance Calendar

Quarterly and annual regulatory obligations mapped to responsible AI applications.

### Annual Obligations

| Obligation | Regulation | Deadline | Responsible App | Frequency |
|------------|-----------|----------|----------------|-----------|
| Form ADV Update | SEC Advisers Act | Within 90 days of FY end | ComplianceShield | Annual |
| Form PF (large filer) | Dodd-Frank | 60 days after quarter end | ComplianceShield, AlphaEngine | Quarterly |
| SOX 404 Assessment | SOX | Annual (with 10-K) | ComplianceShield, RiskCompass | Annual |
| SFDR PAI Report | SFDR Art.4 | 30 June annually | ComplianceShield, ResearchNexus | Annual |
| EU AI Act Conformity Assessment | EU AI Act Art.43 | Before deployment; annual review for HIGH RISK | ComplianceShield | Annual |
| MAS TRM Annual Review | MAS TRM | Annual | All apps | Annual |
| DORA ICT Risk Self-Assessment | DORA Art.6 | Annual | ComplianceShield | Annual |
| FCA SYSC Algorithmic Trading Self-Assessment | FCA PS 19/1 | Annual | TradeSentinel | Annual |
| Model Validation (HIGH RISK) | SR 11-7, EU AI Act Art.9 | Annual or on material change | RiskCompass, AlphaEngine, TradeSentinel | Annual |
| FEAT Assessment | MAS FEAT | Annual | AdvisorLens | Annual |

### Quarterly Obligations

| Obligation | Regulation | Deadline | Responsible App |
|------------|-----------|----------|----------------|
| Form PF (large filer) | Dodd-Frank | 60 days after Q end | ComplianceShield |
| AIFMD Annex IV | AIFMD | Q1/Q3: 30 days; Q2/Q4: 45 days | ComplianceShield |
| SFDR PAI Data Collection | SFDR RTS | Rolling quarterly | ResearchNexus |
| Settlement Fail Reporting | CSDR | Daily (aggregated quarterly review) | OpsFabric |
| RiskCompass Liquidity Stress Test | AIFMD | Quarterly | RiskCompass |

### Ongoing / Real-Time Obligations

| Obligation | Regulation | Trigger | Responsible App |
|------------|-----------|---------|----------------|
| MiFIR Transaction Reporting | MiFIR Art.26 | Each transaction, T+1 | TradeSentinel, ComplianceShield |
| EMIR Trade Repository Reporting | EMIR Art.9 | Each OTC derivative, T+1 | OpsFabric, ComplianceShield |
| GDPR Breach Notification | GDPR Art.33 | Within 72 hours of discovery | ComplianceShield, all apps |
| PDPA Breach Notification (SG) | PDPA 2021 | Within 3 calendar days | ComplianceShield |
| DORA Major Incident Report | DORA Art.19 | Initial: within 4 hours; final: within 1 month | ComplianceShield, Beacon |
| EU AI Act Serious Incident Report | EU AI Act Art.72 | Within 15 days | ComplianceShield |
| MAR Suspicious Transaction Report | EU MAR Art.16 | Immediately upon detection | TradeSentinel, Chronicle |

---

## Appendix: Regulation Reference Index

| Abbreviation | Full Name | Jurisdiction | Authority |
|-------------|-----------|-------------|-----------|
| Advisers Act | Investment Advisers Act of 1940 | US | SEC |
| Reg NMS | Regulation National Market System | US | SEC |
| Reg FD | Regulation Fair Disclosure | US | SEC |
| Dodd-Frank | Dodd-Frank Wall Street Reform Act 2010 | US | FSOC/SEC/CFTC |
| ERISA | Employee Retirement Income Security Act 1974 | US | DOL |
| SOX | Sarbanes-Oxley Act 2002 | US | SEC/PCAOB |
| SR 11-7 | Supervisory Guidance on Model Risk Management | US | OCC/Fed |
| EU AI Act | Regulation (EU) 2024/1689 | EU | European AI Office |
| MiFID II | Directive 2014/65/EU | EU | ESMA |
| MiFIR | Regulation (EU) 600/2014 | EU | ESMA |
| AIFMD | Directive 2011/61/EU | EU | ESMA |
| SFDR | Regulation (EU) 2019/2088 | EU | ESMA/EBA/EIOPA |
| EU Taxonomy | Regulation (EU) 2020/852 | EU | European Commission |
| EMIR | Regulation (EU) 648/2012 | EU | ESMA |
| GDPR | Regulation (EU) 2016/679 | EU | National DPAs |
| DORA | Regulation (EU) 2022/2554 | EU | ESAs |
| CSDR | Regulation (EU) 909/2014 | EU | ESMA |
| MAR | Market Abuse Regulation (EU) 596/2014 | EU | ESMA |
| FCA SYSC | Supervision, Systems and Controls | UK | FCA |
| UK GDPR | UK General Data Protection Regulation | UK | ICO |
| Consumer Duty | FCA Policy Statement PS22/9 | UK | FCA |
| MAS TRM | Technology Risk Management Guidelines | Singapore | MAS |
| MAS FEAT | Fairness, Ethics, Accountability, Transparency | Singapore | MAS |
| PDPA | Personal Data Protection Act 2012 | Singapore | PDPC |

---

*This document is part of the AssetCo AI Platform documentation suite. It is a regulatory mapping reference, not legal advice. AssetCo's Legal and Compliance teams must review all regulatory interpretations. Regulatory requirements change frequently — this document should be reviewed quarterly against current regulatory publications.*

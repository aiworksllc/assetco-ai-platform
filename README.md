# AssetCo AI Platform

> Comprehensive product specification for AI governance in institutional asset management,
> powered by [Sentinel-Ops](https://github.com/aiworksllc/sentinel-ops) Safe Operating Envelope (SOE).

---

## What This Is

AssetCo Investment Management is a fictional $85B global asset manager — built to demonstrate what
rigorous, production-grade AI governance looks like at enterprise scale. This repository contains
the full product specification for AssetCo's AI Platform: 7 applications, 25 agents, spanning the
entire investment lifecycle from research and portfolio construction through trade execution, risk
monitoring, regulatory compliance, client advisory, and operations.

Every agent has:

- A **product specification** — purpose, agents, business value, and success metrics
- An **agent architecture** — component design, data flows, and integration patterns
- An **annotated SOE definition** — machine-enforceable governance JSON with rationale comments
- A **regulatory mapping** — article-level obligation traceability per jurisdiction
- A **risk and audit model** — risk budget design, Chronicle audit strategy, and escalation logic

The documentation IS the deliverable. There is no application code. The purpose is to show — in
precise, specification-quality detail — how Sentinel-Ops SOE enables safe AI deployment across a
complex, multi-jurisdictional financial services environment where the cost of a governance failure
is measured in regulatory sanctions, fiduciary liability, and client harm.

**Why this matters:** Any team deploying AI agents in regulated financial services faces the same
structural problems AssetCo does: fiduciary obligations, information barriers, multi-jurisdictional
rule conflicts, model risk requirements, and audit trail mandates. This repository provides a
reusable reference architecture for all of them.

---

## AssetCo at a Glance

| Attribute | Detail |
|-----------|--------|
| **Founded** | 1987, New York |
| **AUM** | $85 billion |
| **Business Lines** | Equities ($28B), Fixed Income ($22B), Alternatives ($15B), Multi-Asset Solutions ($12B), Private Markets ($8B) |
| **Offices** | New York (HQ, ~1,100 staff), London (~500), Frankfurt (~200), Singapore (~200) |
| **Regulatory Jurisdictions** | US (SEC, FINRA, CFTC, ERISA), EU (ESMA, BaFin, MiFID II, EU AI Act), UK (FCA), APAC (MAS) |
| **Client Types** | US public pension funds, corporate pension plans, endowments, sovereign wealth funds, insurance general accounts, HNW/family offices |
| **AI Applications** | 7 |
| **AI Agents** | 25 |
| **AI Governance Platform** | Sentinel-Ops SOE |
| **AI Budget** | $14M over 18 months (CTO: James Chen, ex-Two Sigma) |
| **Regulatory Frameworks Covered** | 20+ (see Regulatory Coverage section) |

---

## The 7 Applications

| Application | Domain | Agents | EU AI Act Classification | Primary Regulations |
|-------------|--------|--------|--------------------------|---------------------|
| **AlphaEngine** | Portfolio Optimization | 4 | Annex III — High Risk | SEC Advisers Act, MiFID II Art.25, SFDR, ERISA |
| **TradeSentinel** | Trade Execution | 3 | Annex III — High Risk | MiFID II Art.27, Reg NMS, MAR |
| **RiskCompass** | Risk Analytics | 4 | Annex III — High Risk | Basel III/IV, Dodd-Frank, AIFMD |
| **ComplianceShield** | Regulatory Reporting & Surveillance | 4 | Significant Risk | SOX, FINRA Rule 3110, EMIR, MiFIR, DORA |
| **AdvisorLens** | Client Advisory | 3 | Annex III — High Risk + Art.52 | Fiduciary, MiFID II Art.25, GDPR Art.22 |
| **ResearchNexus** | Research & ESG Scoring | 4 | Significant Risk | SFDR, EU Taxonomy, Reg FD |
| **OpsFabric** | Operations & Settlement | 3 | Limited Risk | CSDR T+1/T+2, EMIR clearing |
| **Total** | | **25** | | |

### Application Dependency Diagram

All data flows are subject to SOE-enforced information barriers. The Research–Trading chinese wall
is the most consequential: ResearchNexus outputs are quarantined in a staging directory and can
only be read by AlphaEngine and AdvisorLens after a human analyst promotes them to the published
path. This barrier is enforced deterministically at the SOE layer — not by convention.

```
                       ┌─────────────────────────────────────┐
                       │          ResearchNexus              │
                       │   (Published research only — gated) │
                       └──────────────────┬──────────────────┘
                                          │ Published reports only
                                          │ (Chinese wall enforced by SOE)
                        ┌─────────────────▼──────────────────┐
                        │           AlphaEngine              │
                        │     Portfolio Optimization          │
                        └─────────────────┬──────────────────┘
                                          │ Trade lists
                        ┌─────────────────▼──────────────────┐
                        │          TradeSentinel             │
                        │         Trade Execution            │
                        └──────┬──────────────────┬──────────┘
                               │ Executed trades  │ All trading data
                  ┌────────────▼────────┐         │
                  │      OpsFabric      │         │
                  │     Operations      │         │
                  └────────────┬────────┘         │
                               │ Settlement records│
                  ┌────────────▼──────────────────▼──────────┐
                  │           ComplianceShield               │
                  │        Regulatory Reporting              │
                  └────────────────────┬─────────────────────┘
                                       │ Risk metrics / limit breaches
                  ┌────────────────────▼─────────────────────┐
                  │             RiskCompass                  │◄──── All apps (read-only)
                  │           Risk Analytics                 │
                  └──────────────────────────────────────────┘

                  ┌──────────────────────────────────────────┐
                  │             AdvisorLens                  │◄──── ResearchNexus (published only)
                  │           Client Advisory                │◄──── Client portfolio data (read-only)
                  └──────────────────────────────────────────┘
```

**SOE-enforced information barriers:**
- ResearchNexus CANNOT read trading positions or pending orders from TradeSentinel or AlphaEngine (Reg FD, MAR)
- TradeSentinel CANNOT read pre-publication research (chinese wall — MAR, Reg FD)
- AlphaEngine CANNOT read ResearchNexus staging paths before publication (chinese wall)
- RiskCompass has the broadest read access across all apps but has strictly ZERO write access

---

## Key Governance Features Demonstrated

Each feature below is enforced by a specific SOE constraint — not by policy document, not by
developer discipline, and not by the AI model itself. The enforcement is structural and deterministic.

**Fiduciary Enforcement — AlphaEngine**
The `portfolio-optimizer` and `allocation-advisor` agents operate under `authorityLevel: propose-only`.
SOE toolAction deny patterns block any allocation instruction that exceeds per-issuer, per-sector,
or per-asset-class concentration limits defined in the mandate's Investment Policy Statement. The AI
cannot override its own fiduciary constraints. Every allocation decision is logged with rationale,
factor inputs, and the active constraint set to Chronicle's immutable audit trail.

**Chinese Wall — TradeSentinel and ResearchNexus**
SOE `readDeny` glob patterns structurally prevent TradeSentinel agents from reading any ResearchNexus
path outside `/published/**`. An attempt to read a pre-publication research path generates a block
event, logs a Regulation FD escalation to Chronicle, and triggers a Beacon anomaly alert. This is
enforced in the Sentinel-Ops deterministic pre-filter — evaluated in under 1ms with zero AI
involvement and zero possibility of reasoning-based bypass.

**Best Execution Mandate — TradeSentinel**
The `order-router` agent's SOE definition requires venue selection rationale to be written to the
audit log before an order submission command is permitted. An order without a logged rationale is
blocked. This satisfies MiFID II Article 27's documentation obligation and produces a per-order
evidence record suitable for FCA or ESMA examination.

**EU AI Act Art.52 Disclosure — AdvisorLens**
Every client-facing output from `proposal-generator` and `client-reporter` must contain a required
AI disclosure string before the SOE gate permits it to be delivered. Outputs without the disclosure
are blocked and escalated. This converts the Art.52 transparency obligation from a policy
requirement into a structural enforcement point that cannot be misconfigured by individual agents.

**GDPR Art.22 Human Approval Gate — AdvisorLens**
Automated AdvisorLens recommendations that trigger material portfolio changes (greater than 2%
allocation shift or greater than €10K client impact) are held at the SOE gate until an explicit
human advisor approval signal is logged. The AI cannot self-approve or bypass this gate.

**Read-Only Analytics — RiskCompass**
RiskCompass requires the broadest data access on the platform — it reads position data from
AlphaEngine, TradeSentinel, and OpsFabric for consolidated exposure computation. Its SOE definition
grants this wide read access and simultaneously enforces zero write access to any upstream system.
The `limit-enforcer` agent can generate escalation alerts but cannot independently execute trades
or impose position limits without human confirmation.

**Surveillance Mandate — ComplianceShield**
The `trade-surveiller` agent holds an intentional, audited exception to least-privilege: it has
read access to ALL trading data across all applications to satisfy the compliance surveillance
mandate. This exception is documented in the SOE definition with explicit regulatory justification.
The same SOE definition restricts `regulatory-filer` write access to approved report staging
directories only — the surveillance agent that sees everything cannot write anywhere except its
designated output paths.

**Publication Gate — ResearchNexus**
Research outputs are written to a staging directory (`/staging/**`) that is on the readDeny list
for all trading applications. A human analyst must review and explicitly promote research to the
`/published/**` path before it becomes readable by AlphaEngine or AdvisorLens. The SOE gate
enforces this at the file access level — trading agents are structurally blocked from staging
paths regardless of what the research agents produce.

**NAV Dual-Approval — OpsFabric**
The `nav-calculator` agent can compute and stage Net Asset Value figures but cannot publish them
to client-accessible systems. The SOE gate on the write path to the NAV publication directory
requires a dual-approval signal — two separate human sign-offs — before the write is permitted.
This satisfies the fund accounting control requirement for independent verification of NAV
calculations.

**4-Tier Data Classification**
AssetCo enforces a four-tier data classification scheme (PUBLIC, INTERNAL, CONFIDENTIAL,
RESTRICTED) across all 25 agents. RESTRICTED data — which includes MNPI, M&A deal information,
and regulatory examination materials — is accessible only to named agents with explicit SOE
authorization. The Private Markets deal room is isolated from all public markets agents via hard
`readDeny` patterns on RESTRICTED paths.

---

## Documentation Map

```
docs/
├── 00-company-narrative.md          Company history (1987–2025), leadership team, org structure,
│                                    business lines, client base, technology landscape, governance
│                                    obligations, and Sentinel-Ops selection rationale
│
├── 01-operating-model.md            Investment value chain and AI application mapping; how agents
│                                    are governed, deployed, and monitored at AssetCo
│
├── 02-ai-enablement-strategy.md     Strategic vision (CTO James Chen), AI opportunity map,
│                                    agent taxonomy, authority level definitions, and the four
│                                    outcomes the $14M AI budget is organized to deliver
│
├── 03-regulatory-landscape.md       Multi-jurisdictional regulatory analysis: US (SEC, FINRA,
│                                    ERISA, SOX, SR 11-7), EU (AI Act, MiFID II, AIFMD, SFDR,
│                                    GDPR, DORA, EMIR, CSDR), UK (FCA, Consumer Duty), APAC
│                                    (MAS TRM, FEAT, PDPA); cross-cutting theme analysis and
│                                    regulatory conflict resolution table
│
├── 04-app-portfolio-overview.md     Full application and agent inventory; inter-application
│                                    dependency diagram; per-app: purpose, agents, EU AI Act
│                                    classification, regulatory frameworks, SOE constraints, and
│                                    cross-app dependencies; platform-wide SOE principles
│
├── 05-implementation-roadmap.md     Phased 4-quarter deployment plan (Q1–Q4 2026); dependency
│                                    rationale; audit-phase protocol (shadow → warn → soft →
│                                    full) per application; Go/No-Go gates with quantitative
│                                    thresholds; risk register; program governance structure
│
└── apps/
    ├── alpha-engine/
    │   ├── product-spec.md          Purpose, business value, agents, success metrics, and
    │   │                            investment lifecycle integration
    │   ├── agent-architecture.md    Component design, data flows, AlphaEngine → TradeSentinel
    │   │                            interface, concentration limit enforcement architecture
    │   ├── soe-definitions.md       Annotated SOE JSON for all 4 agents: portfolio-optimizer,
    │   │                            rebalancer, allocation-advisor, factor-analyst; includes
    │   │                            chinese wall readDeny patterns, IPS concentration toolAction
    │   │                            deny rules, and fiduciary audit logging requirements
    │   ├── regulatory-mapping.md    Article-level mapping: SEC Advisers Act §206, MiFID II
    │   │                            Art.25, SFDR Art.8/9, ERISA §404, SR 11-7
    │   └── risk-audit-models.md     Risk budget design, Arbiter scoring parameters, Chronicle
    │                                audit strategy, and SR 11-7 model validation evidence
    │
    ├── trade-sentinel/
    │   ├── product-spec.md          Best execution platform purpose, TCA value proposition,
    │   │                            agents, and MiFID II compliance positioning
    │   ├── agent-architecture.md    Order routing architecture, FlexTrade EMS integration,
    │   │                            real-time execution monitoring design
    │   ├── soe-definitions.md       Annotated SOE JSON for all 3 agents: order-router,
    │   │                            execution-monitor, tca-analyzer; includes best execution
    │   │                            pre-log requirement, chinese wall readDeny, and
    │   │                            tca-analyzer read-only enforcement
    │   ├── regulatory-mapping.md    MiFID II Art.27 best execution, Reg NMS Rule 611,
    │   │                            MAR Art.16, MiFID II Art.17 algorithmic trading controls
    │   └── risk-audit-models.md     Execution risk budget, MAR detection Chronicle strategy,
    │                                best execution evidence model for FCA/ESMA examination
    │
    ├── risk-compass/
    │   ├── product-spec.md          Real-time risk analytics purpose, VaR and stress testing
    │   │                            capability, limit enforcement architecture
    │   ├── agent-architecture.md    Cross-fund exposure aggregation design, Aladdin integration,
    │   │                            limit breach escalation workflow
    │   ├── soe-definitions.md       Annotated SOE JSON for all 4 agents: var-calculator,
    │   │                            stress-tester, exposure-monitor, limit-enforcer; documents
    │   │                            the broadest read / zero write SOE pattern and alert-only
    │   │                            enforcement constraint
    │   ├── regulatory-mapping.md    Basel III/IV IMA, AIFMD Art.15, Dodd-Frank Title VII,
    │   │                            SR 11-7 VaR model governance
    │   └── risk-audit-models.md     Risk budget calibration, VaR model validation evidence
    │                                log design, SR 11-7 ongoing monitoring strategy
    │
    ├── compliance-shield/
    │   ├── product-spec.md          Surveillance and regulatory reporting purpose, multi-
    │   │                            jurisdiction filing coverage, MAR detection capability
    │   ├── agent-architecture.md    Surveillance data pipeline, EMIR/MiFIR filing architecture,
    │   │                            DORA incident classification integration
    │   ├── soe-definitions.md       Annotated SOE JSON for all 4 agents: trade-surveiller,
    │   │                            position-reporter, breach-detector, regulatory-filer;
    │   │                            documents the audited surveillance exception to least-
    │   │                            privilege and the filing path write restriction
    │   ├── regulatory-mapping.md    SOX §302/§404/§802, FINRA Rule 3110, EMIR Art.9,
    │   │                            MiFIR Art.26, DORA Art.17/19, SFDR PAI reporting
    │   └── risk-audit-models.md     Surveillance coverage metrics, append-only finding model,
    │                                OSCAL compliance report generation strategy
    │
    ├── advisor-lens/
    │   ├── product-spec.md          Client advisory purpose, suitability automation, Art.52
    │   │                            compliance positioning, HNW and institutional segments
    │   ├── agent-architecture.md    Suitability engine design, proposal generation pipeline,
    │   │                            GDPR Art.22 human approval gate architecture
    │   ├── soe-definitions.md       Annotated SOE JSON for all 3 agents: suitability-checker,
    │   │                            proposal-generator, client-reporter; Art.52 disclosure
    │   │                            enforcement pattern, GDPR Art.22 material change gate,
    │   │                            and read-only client data constraint
    │   ├── regulatory-mapping.md    SEC Reg BI, MiFID II Art.25, GDPR Art.22, EU AI Act
    │   │                            Art.52, FCA Consumer Duty, MAS FEAT, ERISA §404
    │   └── risk-audit-models.md     Advisory risk budget, suitability failure detection,
    │                                Art.52 disclosure audit trail model
    │
    ├── research-nexus/
    │   ├── product-spec.md          Research augmentation purpose, ESG scoring capability,
    │   │                            analyst productivity value proposition, SFDR PAI production
    │   ├── agent-architecture.md    Research pipeline design, ESG data source integration,
    │   │                            publication gate architecture, SFDR PAI calculation flow
    │   ├── soe-definitions.md       Annotated SOE JSON for all 4 agents: market-analyst,
    │   │                            esg-scorer, sentiment-analyzer, fair-value-modeler;
    │   │                            hard readDeny on all trading data, publication gate
    │   │                            write-to-staging pattern, and esg-scorer special data
    │   │                            source access
    │   ├── regulatory-mapping.md    SFDR Art.4/8/9, EU Taxonomy Art.3, Reg FD, ESMA ESG
    │   │                            guidelines, EU MAR Art.10 information barrier requirements
    │   └── risk-audit-models.md     Research integrity risk budget, publication gate audit
    │                                trail, SFDR PAI accuracy monitoring strategy
    │
    └── ops-fabric/
        ├── product-spec.md          Post-trade operations purpose, T+1 settlement capability,
        │                            NAV calculation automation, reconciliation value proposition
        ├── agent-architecture.md    Settlement instruction pipeline, custodian/prime broker
        │                            reconciliation design, NAV dual-approval gate architecture
        ├── soe-definitions.md       Annotated SOE JSON for all 3 agents: settlement-processor,
        │                            reconciler, nav-calculator; NAV dual-approval write gate,
        │                            settlement rate-limit pattern, and reconciler read-only
        │                            constraint across custodian and prime broker systems
        ├── regulatory-mapping.md    CSDR Art.6/7 settlement discipline, EMIR Art.4 clearing,
        │                            SEC T+1 mandate, ASC 820 fair value documentation
        └── risk-audit-models.md     Settlement deadline risk model, NAV calculation audit
                                     evidence, CSDR fail reporting Chronicle strategy
```

---

## Regulatory Coverage

This repository provides article-level regulatory mapping for each application against the
following frameworks:

| Framework | Jurisdiction | Authority | Coverage |
|-----------|-------------|-----------|----------|
| **Investment Advisers Act of 1940** | US | SEC | Fiduciary duty (§206), books and records (Rule 204-2), compliance program (Rule 206(4)-7) |
| **Regulation NMS** | US | SEC | Order protection (Rule 611), best execution duty |
| **Regulation FD** | US | SEC | Information barrier enforcement, selective disclosure prohibition |
| **Dodd-Frank Act** | US | FSOC/SEC/CFTC | Title VII OTC derivatives, Form PF, systemic risk |
| **ERISA** | US | DOL | Prudent expert standard (§404), prohibited transactions (§406) |
| **FINRA Rules** | US | FINRA | Suitability (Rule 2111), supervision (Rule 3110), communications (Rule 2210) |
| **Sarbanes-Oxley Act** | US | SEC/PCAOB | §302 CEO/CFO certification, §404 internal controls, §802 record retention |
| **SR 11-7 Model Risk** | US | OCC/Federal Reserve | Model inventory, independent validation, ongoing monitoring |
| **EU AI Act (2024/1689)** | EU | European AI Office | Art.9 risk management, Art.12 logging, Art.13 transparency, Art.14 human oversight, Art.52 disclosure, Art.72 incident reporting |
| **MiFID II (2014/65/EU)** | EU | ESMA | Art.25 suitability, Art.27 best execution, Art.17 algorithmic trading |
| **MiFIR (600/2014)** | EU | ESMA | Art.26 transaction reporting |
| **AIFMD (2011/61/EU)** | EU | ESMA | Art.15 risk management, leverage limits, Annex IV reporting |
| **SFDR (2019/2088)** | EU | ESMA/EBA/EIOPA | Art.4 PAI disclosures, Art.8/9 fund classification |
| **EU Taxonomy (2020/852)** | EU | European Commission | 6 environmental objectives, DNSH assessment |
| **EMIR (648/2012)** | EU | ESMA | Art.9 trade reporting, central clearing, margin requirements |
| **GDPR (2016/679)** | EU | National DPAs | Art.22 automated decisions, Art.25 privacy by design, Art.35 DPIA |
| **DORA (2022/2554)** | EU | ESAs | ICT risk management, incident classification, third-party risk |
| **CSDR (909/2014)** | EU | ESMA | T+2 settlement discipline, cash penalties, fail reporting |
| **MAR (596/2014)** | EU | ESMA | Art.10 unlawful disclosure, Art.16 suspicious transaction reporting |
| **FCA SYSC** | UK | FCA | Systems and controls, algorithmic trading (MAR 5), model risk (SYSC 7) |
| **FCA Consumer Duty (PS22/9)** | UK | FCA | Fair value, consumer understanding, consumer support |
| **UK GDPR / DPA 2018** | UK | ICO | Equivalent to EU GDPR; bilateral adequacy for cross-border flows |
| **MAS TRM Guidelines** | Singapore | MAS | AI/ML governance, model risk, cyber resilience |
| **MAS FEAT Principles** | Singapore | MAS | Fairness, ethics, accountability, transparency |
| **PDPA (2012, amended 2021)** | Singapore | PDPC | Consent, breach notification (3-day), data portability |

---

## Implementation Roadmap Summary

AssetCo deploys across four phases in 2026. The sequencing is determined by application dependency
chains, information barrier activation requirements, and EU AI Act conformity assessment timelines.
Every application graduates through four enforcement phases before production: shadow (monitor-only),
warn (log violations), soft enforce (block with override), and full enforce (block unconditionally).

```
Application         | Q1 2026            | Q2 2026            | Q3 2026            | Q4 2026
--------------------|--------------------|--------------------|--------------------|-----------------
Sentinel-Ops Infra  | [===== DEPLOY ====]|                    |                    |
RiskCompass         | [==SHADOW==][WARN] | [SOFT][====FULL====]|                    |
OpsFabric           | [==SHADOW==][WARN] | [SOFT][====FULL====]|                    |
AlphaEngine         |                    | [SHADOW][WARN][SOFT]| [======FULL=======]|
TradeSentinel       |                    |      [SHADOW][WARN] | [SOFT][====FULL====]|
ComplianceShield    |                    |                    | [SHADOW][WARN][SOFT]| [======FULL=======]
AdvisorLens         |                    |                    | [SHADOW][WARN][SOFT]| [======FULL=======]
ResearchNexus       |                    |                    |      [SHADOW][WARN] | [SOFT][====FULL====]
Info Barrier (full) |                    |                    |                    | [====ACTIVE========]
```

RiskCompass deploys first: read-only analytics, no investment decisions, most tractable EU AI Act
conformity pathway, bounded blast radius. ResearchNexus deploys last: the Research–Trading chinese
wall cannot be meaningfully tested until TradeSentinel and AlphaEngine are live and generating
real trading data. A configuration error in the wall — a pre-publication research path becoming
readable to a trading agent — is a Regulation FD violation. It must be tested against production
traffic, not synthetic data.

Full details, Go/No-Go gates, staffing plans, and risk register in
[docs/05-implementation-roadmap.md](docs/05-implementation-roadmap.md).

---

## How to Use This Repository

**For developers building AI agents in financial services:**
Start with [docs/04-app-portfolio-overview.md](docs/04-app-portfolio-overview.md) for the complete
application and agent inventory, then open the `soe-definitions.md` file for the application most
similar to your use case. The annotated SOE JSON is the implementation specification — it maps
directly to Sentinel-Ops SOE definition schema and can be used as a template for your own agents.

**For compliance officers and regulatory counsel:**
Start with [docs/03-regulatory-landscape.md](docs/03-regulatory-landscape.md) for the full
multi-jurisdictional analysis, including the regulatory conflict resolution table. Then consult
the `regulatory-mapping.md` file for each application to see article-level traceability between
regulatory obligations and SOE controls. The compliance calendar in doc 03 maps quarterly and
real-time filing obligations to responsible applications.

**For executives and board members:**
Start with [docs/00-company-narrative.md](docs/00-company-narrative.md) for the full business
context and the seven governance obligations that drove Sentinel-Ops selection. Then read
[docs/02-ai-enablement-strategy.md](docs/02-ai-enablement-strategy.md) for the strategic thesis
and the four outcomes the AI program is organized to deliver.

**For auditors and examiners (SEC, FCA, MAS, BaFin):**
Start with the `regulatory-mapping.md` and `risk-audit-models.md` files for the application under
review. Each regulatory mapping file provides article-level SOE control traceability. The
`risk-audit-models.md` files describe the Chronicle audit trail design and evidence retention
strategy for that application's specific regulatory obligations.

**For model risk teams (SR 11-7, EU AI Act Art.9):**
The `risk-audit-models.md` files contain the model validation evidence strategy and Arbiter risk
budget design for each application. [docs/03-regulatory-landscape.md](docs/03-regulatory-landscape.md)
Section 5 covers the Model Risk cross-cutting theme and the unified Model Governance Framework
that maps SR 11-7, EU AI Act Art.9, MAS FEAT, FCA SYSC 7, and DORA to a single control set.

---

## Related Repositories

- [**Sentinel-Ops**](https://github.com/aiworksllc/sentinel-ops) — The SOE enforcement engine
  that governs all 25 agents in this platform. Source code, architecture, and deployment
  documentation for the Safe Operating Envelope: deterministic pre-filter, Sentinel AI reasoning,
  Arbiter risk scoring, Chronicle audit trail, Beacon anomaly detection, and Counsel policy design.

- [**InsureCo AI Platform**](https://github.com/aiworksllc/insureco-ai-platform) — A simpler
  showcase: a fictional EU-only insurance carrier, 1 application, 4 agents, focused on EU AI Act
  Annex III compliance for claims processing automation. A good starting point if the full
  AssetCo multi-jurisdictional complexity is more than your use case requires.

---

## About

Built by [YadriWorks Inc.](https://yadriworks.ai) to demonstrate Sentinel-Ops governance
capabilities across complex, multi-jurisdictional financial services environments.

AssetCo Investment Management is a fictional company. All AUM figures, client relationships,
regulatory registrations, personnel, and financial metrics are illustrative. This repository
is designed to show how Sentinel-Ops SOE governance applies in a realistic institutional
asset management context — not to represent any real firm or regulatory interpretation.

For questions about Sentinel-Ops or this reference architecture: support@yadriworks.ai

---

## License

Apache-2.0

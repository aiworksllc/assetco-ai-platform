# AdvisorLens — Product Specification

**Application:** AdvisorLens
**Domain:** Client Advisory
**Document:** product-spec.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** Head of Client Services, CCO, DPO, CTO, Legal
**EU AI Act Classification:** HIGH RISK — Annex III, Category 5(b) (AI systems used in financial services for creditworthiness assessment and financial advice with material impact on clients)

---

## 1. Business Context

AssetCo manages $85B in assets across five business lines. The Client Advisory division serves two distinct segments: **$18B in High Net Worth (HNW) relationships** — families and individuals with investable assets above $5M — and **$5B in retail managed accounts** with minimum investment thresholds of $250K. These 2,300+ client relationships are managed by 45 client advisors distributed across AssetCo's New York, London, and Singapore offices.

Personalized investment advice is not a commodity service for AssetCo. It is the primary competitive differentiator that justifies the firm's fee structure versus lower-cost passive alternatives. HNW clients pay 60–100 basis points in annual management fees precisely because they expect advice calibrated to their individual financial situation, tax circumstances, liquidity requirements, and investment horizon — not generic model portfolio allocations. Losing a $50M HNW client relationship due to poorly tailored advice or a perceived compliance failure represents a direct revenue loss of $300–500K per year and material reputational damage in the HNW community.

At the same time, AdvisorLens sits at the highest point of regulatory sensitivity across the entire AssetCo AI Platform. It interacts with clients, generates recommendations that carry fiduciary weight, and processes detailed personal financial data subject to both SEC regulations and, for EU-domiciled clients, GDPR and MiFID II. An error in AdvisorLens — a recommendation unsuited to a client's risk profile, a missing disclosure, an automated decision delivered without human review — carries direct regulatory, civil, and reputational liability.

---

## 2. Problem Statement

| Problem | Business Impact | Regulatory Impact |
|---|---|---|
| 45 advisors managing 2,300+ relationships cannot produce fully personalized recommendations at scale without shortcuts | Standardized advice undermining fee justification; client attrition risk | SEC Advisers Act fiduciary — generic advice may not satisfy best-interest standard |
| Suitability documentation is manual and inconsistent | Regulatory examination exposure; inability to demonstrate per-recommendation suitability on demand | MiFID II Art.25 — documented suitability assessment required for every recommendation |
| No systematic pre-recommendation check against client KYC, risk tolerance, and restrictions | Unsuitable recommendations reaching clients before advisor review | SEC Reg BI — best-interest obligation; MiFID II Art.25 suitability requirement |
| Proposal generation is time-intensive (4–8 hours per HNW proposal) | Advisors spending 60% of capacity on document production vs. client relationships | No direct regulatory issue but operational efficiency drives quality risk |
| Periodic client reports are template-driven with minimal personalization | Reports perceived as generic; client satisfaction declining in NPS surveys | GDPR Art.13/14 — processing disclosures must be client-specific |
| No technical enforcement of EU AI Act Art.52 disclosure requirement | AI-generated content reaching clients without required AI disclosure | EU AI Act Art.52 — mandatory disclosure when AI interacts with or produces content for humans |

---

## 3. Solution Overview

AdvisorLens is a 3-agent AI advisory platform operating within the Sentinel-Ops Safe Operating Envelope. It augments advisor capacity for suitability assessment, proposal generation, and client reporting — with technical guarantees that no AI-generated content reaches a client without a human advisor's review and required regulatory disclosures.

**The 3-agent architecture enforces strict separation and the human-in-the-loop at the system level:**

- `suitability-checker` validates proposed investments against the client's profile and outputs a structured suitability determination; it cannot communicate with clients under any circumstances
- `proposal-generator` creates draft investment proposals with mandatory disclosures; all proposals route to the human advisor approval queue and cannot be delivered to clients directly
- `client-reporter` generates periodic client-facing reports with mandatory Art.52 AI disclosure on every output; it reads client data but cannot modify any client record

The SOE enforces these boundaries deterministically. The proposal-generator's `writeDeny` rule on `advisory/proposals/delivered/**` means that no proposal — regardless of model output — can be marked delivered without a human advisor moving it from the draft queue. This is not a process control. It is a technical constraint enforced at every tool call by the Sentinel-Ops gate.

---

## 4. User Stories

### Head of Client Services

> As Head of Client Services, I want every investment recommendation produced by AdvisorLens to be validated against the client's current risk tolerance score, investment horizon, and documented restrictions before it reaches an advisor's review queue — so that advisors are never in the position of catching a suitability issue manually under time pressure.

> As Head of Client Services, I want the Art.52 AI disclosure present on every client-facing output as a technical guarantee enforced by the SOE content guardrail, not as a checklist item dependent on advisor memory — because a single undisclosed AI recommendation to a European client represents a direct regulatory violation.

> As Head of Client Services, I want proposal turnaround time reduced from 4–8 hours of advisor production time to under 30 minutes of advisor review time, so that advisors can serve 40% more HNW relationships without adding headcount.

> As Head of Client Services, I want GDPR Art.22 opt-out status enforced automatically — if a client has opted out of automated decision-making, their proposals require documented human deliberation beyond a rubber-stamp review, and the system must flag this distinction.

### Relationship Manager (Senior Advisor, HNW Desk)

> As a relationship manager, I want AdvisorLens to pull together the client's current portfolio, their stated risk tolerance, their upcoming liquidity needs, and the latest model portfolio signals into a draft proposal that I can review, annotate, and approve — rather than assembling all this information manually before I can even begin drafting.

> As a relationship manager, I want the suitability-checker to flag any proposed holding that conflicts with a client's documented restriction list (e.g., ESG exclusions, sector restrictions, ERISA fiduciary constraints for pension clients) so that I catch these conflicts at the draft stage, not after the proposal has been prepared.

> As a relationship manager, I want the quarterly client report to already contain the performance attribution, cost and charges disclosure, and sustainability disclosure so I can review it for accuracy and send it to the client on the same day — rather than spending three days gathering data from different systems.

---

## 5. Functional Requirements

### 5.1 Suitability Assessment

| ID | Requirement |
|---|---|
| FR-01 | For every proposed investment action, evaluate suitability against: client risk tolerance score (1–7 MiFID II scale), investment horizon, liquidity requirements, tax situation, and documented exclusion/restriction list |
| FR-02 | Access client KYC data from the CRM in read-only mode; never write to or modify client records |
| FR-03 | Apply MiFID II Art.25 suitability criteria: knowledge and experience, financial situation, ability to bear losses, investment objectives |
| FR-04 | Apply SEC best-interest standard checks: cost reasonableness, conflicts of interest disclosures, alternative product comparison |
| FR-05 | For pension clients subject to ERISA, apply ERISA fiduciary standard: exclusive benefit rule, prudent expert standard, prohibited transaction check |
| FR-06 | Output structured suitability determination: `suitable` / `unsuitable` / `requires-review` with annotated rationale for each dimension |
| FR-07 | `unsuitable` determination immediately blocks the proposal from progressing; advisor must override with documented justification |
| FR-08 | `requires-review` adds a mandatory compliance officer review step before the proposal can be presented to the client |
| FR-09 | All suitability determinations written to `advisory/suitability-results/` with full audit record; retention 7 years per MiFID II |

### 5.2 Proposal Generation

| ID | Requirement |
|---|---|
| FR-10 | Accept suitability-checker output as a required input; refuse to generate proposal if no current suitability determination exists |
| FR-11 | Incorporate published research signals, current asset allocation model outputs, and market conditions data into personalized proposal |
| FR-12 | Generate PDF-ready proposal document containing: executive summary, recommended allocation, rationale per holding, risk warnings appropriate to product complexity, MiFID II cost and charges disclosure, sustainability disclosure (SFDR where applicable), and mandatory EU AI Act Art.52 disclosure |
| FR-13 | Art.52 disclosure text (SOE-enforced): "This proposal was generated with AI assistance. Your advisor has reviewed and approved this recommendation before it was presented to you." |
| FR-14 | All proposals written to `advisory/proposals/draft/` only — NEVER to `advisory/proposals/delivered/` |
| FR-15 | Proposal delivery to client requires human advisor action moving the proposal from draft to delivered queue; this transition is outside AdvisorLens system scope |
| FR-16 | For clients with GDPR Art.22 opt-out status, flag proposal with `GDPR-ART22-OPT-OUT` tag requiring documented deliberative review (not summary approval) |
| FR-17 | Proposals requiring compliance officer review (from FR-08) cannot be approved by the relationship manager alone |

### 5.3 Client Reporting

| ID | Requirement |
|---|---|
| FR-18 | Generate periodic client reports (quarterly, annually, or on-demand) including: portfolio summary, performance attribution, benchmark comparison |
| FR-19 | Include mandatory MiFID II cost and charges disclosure (RTS 28 format for institutional; MiFID II Art.24(4) for retail) in every periodic report |
| FR-20 | Include SFDR sustainability disclosure for any funds with an Article 8 or Article 9 classification held by the client |
| FR-21 | Include mandatory EU AI Act Art.52 AI disclosure on every report: "This report was generated with AI assistance and reviewed by your advisor." |
| FR-22 | Read-only access to client portfolio data; client-reporter cannot modify any client record, portfolio position, or fee schedule |
| FR-23 | Strict client data isolation: client-reporter can only read data for the specific client identified in the task; cross-client data access is denied at the SOE level |
| FR-24 | All reports written to `advisory/reports/`; reports are not delivered directly to clients — delivery is an advisor-initiated action outside AdvisorLens scope |

---

## 6. Non-Functional Requirements

| Category | Requirement |
|---|---|
| **Suitability check latency** | Suitability determination available within 3 minutes of proposal initiation |
| **Proposal generation time** | Draft proposal available within 15 minutes of suitability clearance |
| **Report generation time** | Quarterly client report available within 20 minutes of advisor request |
| **Art.52 disclosure enforcement** | SOE content guardrail blocks any client-facing output that does not contain the mandatory AI disclosure; this check is deterministic with zero exception path |
| **GDPR Art.22 enforcement** | Automated decision opt-out status checked against client record at proposal initiation; opt-out flag cannot be overridden by any AdvisorLens agent action |
| **Audit trail** | 100% of suitability determinations, proposal generations, and report outputs logged to Chronicle; MiFID II 7-year retention enforced |
| **Data isolation** | Client data reads scoped to the specific client; cross-client queries blocked at SOE data access layer |
| **Availability** | 99.9% during business hours (08:00–20:00 local time across NY, London, Singapore) |
| **Model validation** | Suitability-checker model must pass independent validation per SR 11-7 before deployment; revalidation annually and on material model change |

---

## 7. Integration Points

| System | Direction | Protocol | Data |
|---|---|---|---|
| CRM (Salesforce Financial Services Cloud) | Read | Salesforce API (read-only) | Client KYC, risk tolerance score, restrictions, GDPR consent status |
| ResearchNexus | Read (published only) | Internal API (published research only) | Published research signals, analyst ratings, sector views |
| AlphaEngine | Read | Internal API | Current model portfolio allocations, factor signals |
| Bloomberg (market data) | Read | Bloomberg API | Current prices, market conditions |
| Portfolio Management System | Read | Internal API (read-only) | Client current holdings, performance data, cost basis |
| Fee schedule system | Read | Internal API | Current fee structures for cost and charges disclosure |
| Advisor workflow system | Outbound | Internal event | Proposal draft notifications to advisor review queue |
| ComplianceShield | Outbound | Event bus | Compliance review flags, GDPR Art.22 escalations |
| Chronicle (Sentinel-Ops) | Write | SOE audit hook | All agent decisions, suitability determinations, proposal events |
| Pre-publication ResearchNexus | **BLOCKED** | SOE deny rule | All pre-publication paths blocked — no MNPI access |

---

*This document is part of the AssetCo AI Platform documentation suite. All financial figures are illustrative. Regulatory requirements should be validated by Legal, Compliance, and the Data Protection Officer before implementation.*

# AdvisorLens — Agent Architecture

**Application:** AdvisorLens
**Document:** agent-architecture.md
**Version:** 1.0
**Date:** 2026-03-20
**Audience:** Platform Engineering, AI Safety, Compliance Technology

---

## 1. Architecture Overview

AdvisorLens deploys three agents with hard-separated responsibilities. The dependency flow is strictly linear and non-reversible: `suitability-checker` runs first and its output is a required input for `proposal-generator`. Neither upstream agent can be bypassed. `client-reporter` operates independently of the proposal pipeline and handles all periodic reporting obligations.

```
Client KYC (CRM) ──────────────────────────────────────────────────────┐
Product catalog / risk ratings ────────────────────────────────────────┤
Proposed investment actions ────────────────────────────────────────────┤
                                                                        │
                                                              suitability-checker
                                                                        │
                                                         suitable / unsuitable / requires-review
                                                                        │
Published research (ResearchNexus) ────────────────────────────────────┐│
Market data (Bloomberg) ───────────────────────────────────────────────┤│
Model portfolios (AlphaEngine) ─────────────────────────────────────────┤│
                                                                        ││
                                                              proposal-generator
                                                                        │
                                                    advisory/proposals/draft/** (ONLY)
                                                                        │
                                                    ┌─── Human Advisor Review ───┐
                                                    │   (required before delivery)│
                                                    └────────────────────────────┘

Client portfolios / performance ────────────────────────────────────────┐
Published research ─────────────────────────────────────────────────────┤
Fee schedules ──────────────────────────────────────────────────────────┤
                                                                        │
                                                              client-reporter
                                                                        │
                                                    advisory/reports/** (Art.52 disclosure enforced)
```

No agent has write access to client records in the CRM. No agent can deliver content directly to a client. The human advisor is the only entity that can move a proposal from draft to delivered, or send a report to a client — both actions are outside AdvisorLens system scope.

---

## 2. Agent: suitability-checker

### Role and Responsibility

suitability-checker is the compliance gate for the entire advisory workflow. It validates every proposed investment action against the client's current profile before any proposal work begins. It has no client communication capability whatsoever — its only output is a structured suitability determination written to the suitability-results store.

### Data Reads

| Source | Data Accessed | Restriction |
|---|---|---|
| CRM (Salesforce FSC) | Risk tolerance score (1–7), investment horizon, liquidity requirements, tax situation, ERISA flag, exclusion/restriction list | Read-only; no PII beyond what suitability computation requires |
| Product catalog | Risk rating, asset class, liquidity profile, complexity classification, regulatory category | Read-only |
| Regulatory restrictions registry | Prohibited securities lists, sanction overlays, ERISA prohibited transaction list | Read-only |

**Explicitly denied:**
- Client SSN, tax identification numbers, bank account details, or payment information — not required for suitability and not accessible
- Client trading history (to prevent the system from rationalizing past unsuitable recommendations)
- Pre-publication research from ResearchNexus — suitability check must be independent of research signals that may themselves be MNPI

### Outputs

Every suitability determination is a structured record written to `advisory/suitability-results/`:

```json
{
  "determinationId": "suit-2026-03-20-000123",
  "clientId": "HNW-00847",
  "proposedAction": "increase-allocation-high-yield-bonds",
  "timestamp": "2026-03-20T09:14:22Z",
  "determination": "requires-review",
  "dimensions": {
    "riskTolerance": { "score": 3, "productRisk": 5, "result": "mismatch", "note": "Client risk score 3; product risk rating 5 — exceeds client band" },
    "investmentHorizon": { "clientHorizon": "3yr", "productHorizon": "5yr+", "result": "mismatch" },
    "liquidityRequirements": { "result": "pass" },
    "taxSituation": { "result": "pass" },
    "restrictionList": { "result": "pass" },
    "eriasCheck": { "applicable": false }
  },
  "regulatoryBasis": ["MiFID II Art.25", "SEC Reg BI"],
  "nextStep": "compliance-review-required",
  "expiryTimestamp": "2026-03-27T09:14:22Z"
}
```

A suitability determination has a 7-day validity. After expiry, a fresh check is required before any proposal using that determination can proceed.

### Blocking Behavior

- `unsuitable` determination: proposal-generator will refuse to accept this determination as input; the proposed action is blocked until the advisor documents a formal override with compliance sign-off
- `requires-review`: proposal enters a compliance review branch with mandatory CCO review before advisor presentation
- `suitable`: proposal-generator may proceed normally

---

## 3. Agent: proposal-generator

### Role and Responsibility

proposal-generator creates personalized investment proposals combining the suitability-checker's clearance with published research signals, model portfolio allocations, and current market data. It produces PDF-ready draft documents with all required regulatory disclosures embedded. It has no ability to communicate with clients and no write access to the delivered proposals path — the human advisor approval gate is technically enforced at the file system level.

### Data Reads

| Source | Data Accessed | Restriction |
|---|---|---|
| `advisory/suitability-results/` | Current valid suitability determination for the client | Required input; will not generate without valid determination |
| ResearchNexus (published only) | Published research notes, analyst ratings, sector views, fund fact sheets | Published paths only; pre-publication paths blocked by SOE deny rule |
| AlphaEngine | Current model portfolio allocations, rebalancing signals | Read-only |
| Bloomberg market data | Current prices, yield curves, credit spreads | Read-only |
| Fund data repository | Fee schedules, SFDR classification, cost disclosure data (MiFID II RTS 28 format) | Read-only |

**Explicitly denied:**
- Raw client PII (SSN, bank details, tax IDs) — not required for proposal content
- Client trading history and order data
- Pre-publication ResearchNexus paths — blocked deterministically; MNPI must not influence proposals before publication
- `advisory/proposals/delivered/**` — proposal-generator has a writeDeny on this entire path; it can only write to `draft/`

### Mandatory Disclosure Enforcement

Every proposal document generated by proposal-generator must pass a SOE content guardrail check before the write to `advisory/proposals/draft/` is permitted. The guardrail validates:

1. **EU AI Act Art.52 disclosure** — exact text required: "This proposal was generated with AI assistance. Your advisor has reviewed and approved this recommendation before it was presented to you." Absence of this text causes the write to be blocked with a CRITICAL severity audit event.
2. **Risk warnings** — presence of product-appropriate risk disclosure validated against the product's complexity classification
3. **Cost and charges disclosure** — MiFID II Art.24(4) or RTS 28 format required based on client category
4. **GDPR Art.22 flag** — if the client has an active Art.22 opt-out, the document must carry a `GDPR-ART22-OPT-OUT` processing flag that triggers the documented deliberative review workflow

### Human Approval Gate

The proposal lifecycle after draft creation is:

```
proposal-generator writes to: advisory/proposals/draft/{clientId}/{proposalId}.pdf
                                          │
                         Advisor review queue notification (event)
                                          │
                         Human advisor reviews, annotates, approves
                                          │
                         Advisor action moves file to: advisory/proposals/delivered/
                                          │
                         (This file-move action is performed by advisor tooling,
                          not by any AdvisorLens agent)
```

The SOE writeDeny on `advisory/proposals/delivered/**` is enforced at every tool call. Any attempt by proposal-generator to write directly to the delivered path — whether from model hallucination, prompt injection, or software error — is blocked by the Sentinel-Ops gate and logged as a separation-of-duties violation.

---

## 4. Agent: client-reporter

### Role and Responsibility

client-reporter handles all periodic reporting obligations: quarterly performance reports, annual reviews, on-demand portfolio summaries, and mandatory regulatory disclosures. It operates independently of the proposal pipeline. Every output includes the mandatory Art.52 AI disclosure and is written to `advisory/reports/` for advisor review before client delivery.

### Data Reads

| Source | Data Accessed | Restriction |
|---|---|---|
| Portfolio Management System | Client holdings, cost basis, current valuations, historical performance | Read-only; scoped to the specific client in the current task — cross-client queries blocked |
| Performance attribution system | Attribution data, benchmark comparisons, factor decomposition | Read-only |
| Fee system | Applied management fees, transaction charges, performance fees | Read-only |
| Fund data repository | SFDR Article 8/9 disclosures, principal adverse impact indicators | Read-only |
| ResearchNexus (published) | Published market commentary for report narrative context | Read-only; published paths only |

**Explicitly denied:**
- Data belonging to any client other than the client identified in the current task — strict client isolation enforced at the SOE data access layer
- Trading execution details (order-level routing data; the agent works with settled positions and attributed performance, not order flow)
- Pre-publication research

### Mandatory Art.52 Disclosure

The SOE content guardrail runs on every output written to `advisory/reports/`. The mandatory disclosure text is: "This report was generated with AI assistance and reviewed by your advisor." Any report write that omits this disclosure is blocked and generates a CRITICAL severity audit event. There is no exception path.

### Report Types

| Report | Frequency | Primary Regulation | Key Required Content |
|---|---|---|---|
| Quarterly performance report | Quarterly | MiFID II Art.24(4), SFDR | Performance attribution, cost and charges, sustainability disclosures, AI disclosure |
| Annual review | Annually | SEC Advisers Act Rule 204-3 | Full suitability reassessment context, fee disclosure, conflicts disclosure, AI disclosure |
| SFDR sustainability report | Annually (Art.8/9 funds) | SFDR Art.8/9, PAI indicators | Principal adverse impact statement, sustainability factor disclosures, AI disclosure |
| Portfolio summary (on-demand) | On request | Internal; regulatory if sent to client | Current holdings, YTD performance, benchmark comparison, AI disclosure |
| Cost and charges statement | Annually | MiFID II Art.24(4) | All explicit and implicit costs; comparative illustration; AI disclosure |

---

## 5. Cross-Agent SOE Enforcement Summary

| Constraint | Enforced By | Mechanism |
|---|---|---|
| No agent modifies client records | SOE writeDeny on CRM paths | Deterministic pre-filter — blocks before tool call executes |
| No proposal delivered without human review | SOE writeDeny on `advisory/proposals/delivered/**` | Deterministic pre-filter — proposal-generator cannot write to delivered path |
| Art.52 disclosure on all client-facing outputs | SOE content guardrail | Post-generation validation before write is permitted |
| GDPR Art.22 opt-out enforced | Suitability-checker reads consent status; proposal-generator validates flag | Two-layer check: input read + output flag |
| Pre-publication research blocked | SOE readDeny on pre-publication paths | Deterministic pre-filter on all three agents |
| Client data isolation | SOE readDeny scoped per-client task | Task-scoped data access; cross-client queries blocked |
| All decisions audited | Chronicle hook (PostToolUse) | Automatic; immutable append-only event log |

---

*This document is part of the AssetCo AI Platform documentation suite. Review cycle: on material change to agent design or regulatory requirements.*

# OpsFabric — Agent Architecture

**Document:** apps/ops-fabric/agent-architecture.md
**Application:** OpsFabric — Post-Trade Operations Automation
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** Maria Torres, Chief Operating Officer
**Classification:** Internal — Restricted

---

## 1. Architecture Overview

OpsFabric uses three agents organized around the three phases of post-trade processing: instruction generation, reconciliation, and valuation. The agents are independent — no agent can instruct another, and no agent shares write access to the same data domain.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  INPUTS                          AGENTS                   OUTPUTS        │
│                                                                           │
│  TradeSentinel ──────────► settlement-processor ──► Custodian APIs       │
│  (executed trades)                                ──► CCP submissions     │
│                                                   ──► settlement/**       │
│                                                                           │
│  Eagle PACE ─────────────► reconciler ────────────► reconciliation/**    │
│  BNY Mellon records ─────►   (read-only)          ──► Break reports       │
│  State Street records ───►                                                │
│                                                                           │
│  Eagle PACE ─────────────► nav-calculator ────────► nav/preliminary/**   │
│  Bloomberg/ICE/BVAL ─────►                            (no publication)   │
│  Fund structure ──────────►                                               │
│                                                                           │
│                                    Human Review                           │
│                            (fund accountant + ops manager)               │
│                                         │                                 │
│                                         ▼                                 │
│                                nav/published/**                           │
└─────────────────────────────────────────────────────────────────────────┘
```

SOE enforcement (Sentinel-Ops) validates every tool call against each agent's defined envelope before execution. The NAV publication gate and the reconciler's read-only constraint are enforced at the SOE level — these are not application-level conventions but hard boundaries the agent cannot cross.

---

## 2. Agent: settlement-processor

### 2.1 Purpose

settlement-processor automates the generation and submission of settlement instructions for all executed trades, targeting the T+1 instruction cutoff (9:00 PM ET on trade date). It receives executed trade data from TradeSentinel and handles the full instruction lifecycle: SSI matching, custodian routing, CCP submission for cleared derivatives, and fail monitoring through to CSDR buy-in escalation.

### 2.2 Instruction Generation Pipeline

```
TradeSentinel trade event
         │
         ▼
  SSI lookup (counterparty + instrument → delivery/receive instructions)
         │
    ┌────┴─────────────────────┐
    │ SSI matched              │ SSI not found
    ▼                          ▼
  Validate: SWIFT format    Flag to operations team
  settlement date           (SSI exception queue)
  custodian routing
         │
    ┌────┴────────────────────────────────┐
    │ OTC derivative (clearing eligible)  │ All others
    ▼                                     ▼
  CCP routing:                      Submit to custodian:
  - Rates/credit → LCH              - US equity → DTCC
  - Futures/options → CME           - EU equity → BNY/State Street SWIFT
         │                                │
         └──────────────┬─────────────────┘
                        ▼
              Write: operations/settlement/instructions/**
              Write: operations/settlement/status/**
```

### 2.3 CSDR Fail Monitoring

settlement-processor maintains a live fail registry — every unsettled instruction is tracked by age. Escalation triggers are deterministic:

| Fail Age | Action |
|----------|--------|
| T+1 (1 day) | Log to fail registry, monitor |
| T+2 | Early warning alert to operations team |
| T+3 | Urgent escalation; operations manager notified |
| T+4 (equities) / T+7 (bonds) | Buy-in workflow initiated; CSDR Art.7 threshold reached |

CSDR cash penalty calculation runs daily: penalty = fail value × 1bp (liquid shares) or 0.5bp (illiquid shares, bonds). Accrued penalties reported to operations manager weekly.

### 2.4 SOE Boundaries

- **Write access:** `operations/settlement/instructions/**`, `operations/settlement/status/**`
- **Cannot write:** position records, NAV data, fund accounting systems, trading systems
- **Tool actions:** custodian API calls (settlement instruction endpoints only), CCP submission, DTCC submission
- **Cannot execute:** trade orders, position modifications, cancel/amend trade records

---

## 3. Agent: reconciler

### 3.1 Purpose

reconciler performs daily three-way reconciliation of positions, cash, and corporate actions: internal records (Eagle PACE) against BNY Mellon custodian records against State Street custodian records. It classifies every break by root cause and routes it to the appropriate resolution queue. It does not resolve breaks — resolution is a human function that may require custodian contact, accounting adjustments, or corporate action amendments.

### 3.2 Reconciliation Taxonomy

| Break Category | Root Cause | Resolution Queue |
|----------------|------------|-----------------|
| Timing difference | Settlement lag — position shows in one system before the other | Operations standard queue (auto-resolves next day if settlement completes) |
| Pricing discrepancy | Bond price difference between internal and custodian (accrued interest, dirty/clean) | Fund accounting team |
| Missing corporate action | Custodian has applied dividend/split; internal records not yet updated | Corporate actions team |
| Incorrect tax withholding | Withholding rate applied differs from fund treaty rate | Tax operations team |
| Currency conversion error | FX rate used for conversion differs by more than 0.01% | Operations manager |
| Settlement date mismatch | Custodian settles on different date than expected | Operations + custodian inquiry |

### 3.3 Priority Ranking

Breaks are surfaced in priority order based on:
1. Dollar value of break (descending)
2. Break age (oldest first within same dollar tier)
3. Settlement deadline proximity (breaks with active settlement instructions ranked higher)

Breaks exceeding $500,000 or aged over 5 business days are escalated immediately to the senior operations manager, regardless of root cause classification.

### 3.4 Hard Constraint: Read-Only Source Records

reconciler has no write access to any source system. This constraint is enforced at the SOE level and is non-negotiable. The reconciler:

- CANNOT modify Eagle PACE position records
- CANNOT modify BNY Mellon or State Street custodian records
- CANNOT submit custody instructions or correction messages
- CANNOT amend settlement records

All reconciler write access is limited to the `operations/reconciliation/` namespace — specifically break classification records and reconciliation reports. Source record correction, if required, is performed by human operations staff through the custodian's secure portal.

### 3.5 SOE Boundaries

- **Write access:** `operations/reconciliation/breaks/**`, `operations/reconciliation/reports/**`
- **Cannot write:** Eagle PACE positions, custodian records, settlement instructions, NAV data
- **Read access:** internal positions (Eagle PACE), custodian data files (BNY Mellon, State Street), DTCC settlement data, corporate action announcements

---

## 4. Agent: nav-calculator

### 4.1 Purpose

nav-calculator validates pricing inputs, applies fund accounting adjustments, and computes preliminary NAV for all 47 active funds. It delivers a complete preliminary NAV package — including pricing exceptions and fair value flags — to the human review queue by 4:30 PM ET daily. It cannot publish NAV. Publication requires dual human approval: fund accountant and operations manager.

### 4.2 Pricing Validation Hierarchy

nav-calculator follows the fair value hierarchy mandated by ASC 820 (US GAAP funds) and IFRS 13 (UCITS/AIFMD funds):

```
Level 1 — Exchange close prices
  Source: Bloomberg exchange composite, ICE close
  Acceptance: price age ≤ 24 hours for liquid securities
  Coverage: exchange-listed equities, exchange-listed options, on-the-run government bonds

Level 2 — Observable market inputs
  Source: ICE BondPoint evaluated pricing, BVAL
  Acceptance: model inputs observable from active markets
  Coverage: investment-grade corporate bonds, agency MBS, liquid credit
  Flag: all Level 2 securities listed in NAV exception report

Level 3 — Unobservable inputs
  Source: internal models, broker quotes, third-party valuation agents
  Acceptance: requires investment committee approval for first use of any new model
  Coverage: private credit, illiquid structured products, side-pocket instruments
  Flag: CRITICAL flag in NAV exception report; fund accountant must explicitly accept
```

Stale price thresholds:
- Liquid securities: price older than 24 hours → stale price exception
- Illiquid securities: price older than 7 calendar days → stale price exception

### 4.3 NAV Dual-Approval Gate

The dual-approval gate is the defining governance control of nav-calculator. It is enforced at two levels:

1. **SOE level:** nav-calculator has write access to `operations/nav/preliminary/**` only. The path `operations/nav/published/**` is in its writeDeny list. The agent physically cannot write to the published NAV location.

2. **Workflow level:** the review queue requires two distinct human approvals (fund accountant and operations manager) with separate authentication. Approval is logged to Chronicle with timestamp and approver identity.

No NAV has ever been published without dual approval in OpsFabric's operating history. Any attempt by the system to route around this control is treated as a CRITICAL severity SOE violation.

### 4.4 SOE Boundaries

- **Write access:** `operations/nav/preliminary/**` only
- **Cannot write:** `operations/nav/published/**` (human publishes after dual approval), position records, pricing database
- **Read access:** Eagle PACE positions, Bloomberg/ICE/BVAL pricing feeds, fund structure data, fee schedules, corporate action records
- **Cannot read:** client PII, trading execution details, order management data

---

## 5. Inter-Agent Coordination

OpsFabric agents are independent. They do not call each other, share session state, or delegate tasks between themselves. Coordination happens through shared data paths and human workflow:

| Dependency | Mechanism |
|------------|-----------|
| reconciler reads settled positions from Eagle PACE | Eagle PACE is updated by operations staff after settlement confirms; reconciler reads on its scheduled daily run |
| nav-calculator reads same positions as reconciler | Shared read-only access to Eagle PACE; no coordination required |
| settlement-processor fail data informs operations priority | Fail registry (operations/settlement/status/**) is readable by operations managers; reconciler does not read it directly |

There is no agent-to-agent messaging, no shared mutable state, and no cascading authorization. Each agent's SOE is evaluated independently by Sentinel-Ops.

---

*Document owner: Maria Torres, COO. Review cycle: Quarterly or on material system change.*

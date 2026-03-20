# ResearchNexus — SOE Definitions

**Application:** ResearchNexus
**Document:** soe-definitions.md
**Version:** 1.0
**Date:** 2026-03-20
**Owner:** CCO David Okonkwo, Head of Research Dr. Priya Sharma
**Audience:** Compliance Technology, Model Risk, Sentinel-Ops Platform Team
**Enforcement:** Sentinel-Ops SOE gate (deterministic pre-filter + Sentinel AI for ambiguous cases)

---

## 1. Chinese Wall Shared Policy (All ResearchNexus Agents)

The following `readDeny` rules are inherited by every ResearchNexus agent via SOE policy inheritance. They cannot be overridden at the individual agent level — they are declared in the ResearchNexus base policy and composed into every agent's effective SOE at load time.

These rules implement the research–trading information barrier. Any read attempt matching these patterns is blocked by the deterministic pre-filter (<1ms) with no AI evaluation — the deny is unconditional.

```json
{
  "policy": "research-nexus-base",
  "description": "Chinese wall base policy — inherited by all ResearchNexus agents. Immutable.",
  "chineseWall": {
    "readDeny": [
      "trading/**",
      // All trading activity data — executed trades, trade blotter, FIX messages
      // Prevents research agents from inferring firm trading activity or direction

      "orders/**",
      // All pending and historical orders — limit orders, algorithmic order parameters,
      // order sizing, order timing. Prevents front-running via order flow knowledge.

      "executions/**",
      // All execution data — venue fills, partial fills, execution timestamps,
      // execution prices. Even post-trade execution data is denied.

      "positions/**",
      // All current portfolio positions — long/short positions, notional exposures,
      // delta-adjusted exposures. Prevents research AI from knowing current book.

      "portfolios/model/**"
      // Target model portfolios — proposed allocations before execution.
      // Prevents research AI from knowing intended future positions.
    ]
  },
  "violationSeverity": "CRITICAL",
  "violationAction": "BLOCK_AND_ESCALATE"
  // Any attempt to read a denied trading path is blocked immediately
  // and generates a CRITICAL-severity audit event routed to ComplianceShield
  // for CCO review. No exceptions, no override path.
}
```

---

## 2. market-analyst SOE Definition

```json
{
  "agent": "market-analyst",
  "application": "research-nexus",
  "inherits": ["research-nexus-base"],

  "identity": {
    "role": "ResearchAnalyst",
    "allowedPersonas": ["market-analyst"],
    "authorityLevel": "research-read-write-prepublication",
    "environmentScope": ["research"]
  },

  "dataAccess": {
    "readAllow": [
      "data/sec-edgar/**",
      // SEC EDGAR filings: 8-K, 10-K, 10-Q, DEF 14A proxy, S-1
      // Sourced from EDGAR full-text search and filing feed

      "data/earnings-transcripts/**",
      // Earnings call transcripts from licensed transcript data provider
      // (FactSet Transcripts, Refinitiv StreetEvents, or equivalent)

      "data/news-feeds/**",
      // Reuters Elektron, Bloomberg News, AP wire, Dow Jones Newswires
      // Pre-normalised and ingested into research data store

      "data/broker-research/**",
      // Licensed sell-side research reports from broker research aggregator
      // (e.g., Refinitiv Research, S&P Global Market Intelligence)

      "research/published/**"
      // Published research library — market-analyst can read prior published
      // work for context and consistency checking
    ],

    "readDeny": [
      // Inherits all chinese wall readDeny from research-nexus-base
      // Additional denies specific to market-analyst:

      "data/esg-providers/**",
      // ESG provider data reserved for esg-scorer only — reduces unnecessary
      // data surface and ensures consistent PAI computation methodology

      "data/esg-pai/**"
    ],

    "writeAllow": [
      "research/pre-publication/analysis/**"
      // All market-analyst outputs go to pre-publication analysis directory.
      // RESTRICTED classification. Inaccessible to AlphaEngine, TradeSentinel,
      // RiskCompass, AdvisorLens, OpsFabric until published.
    ],

    "writeDeny": [
      "research/published/**",
      // Cannot self-publish. Publication requires human workflow completion.

      "compliance/**",
      // No direct compliance writes — that is ComplianceShield's domain

      "portfolios/**",
      // Cannot influence portfolio construction directly

      "trading/**"
      // Belt-and-suspenders: write deny on all trading paths
    ]
  },

  "toolActions": {
    "bash": {
      "allow": [
        "python nlp_processor.py *",
        "python transcript_parser.py *",
        "python filing_analyzer.py *",
        "curl https://efts.sec.gov/LATEST/search-index*",
        "curl https://data.sec.gov/submissions/*"
        // SEC EDGAR API access permitted
      ],
      "deny": [
        "curl *trading*",
        "curl *positions*",
        "curl *orders*",
        "rm -rf *",
        "curl *bloomberg-oms*",
        "curl *flextrade*"
      ]
    },
    "edit": {
      "allowPaths": [
        "research/pre-publication/analysis/**"
      ],
      "denyPaths": [
        "research/published/**",
        "compliance/**",
        "trading/**",
        "portfolios/**"
      ]
    },
    "mcp_write": {
      "allowPaths": [
        "research/pre-publication/analysis/**"
      ]
    }
  },

  "riskBudget": {
    "dailyLimit": 600,
    // High-volume NLP processing: 500+ earnings transcripts/quarter,
    // 10,000+ SEC filings/year. Budget reflects legitimate high throughput.
    "perCallCost": {
      "read": 1,
      "write": 2,
      "bash_execute": 3
    },
    "burstAllowance": 100,
    // Earnings season burst: multiple calls reporting same day (e.g., FAANG + banks)
    "resetPeriod": "24h"
  }
}
```

---

## 3. esg-scorer SOE Definition

```json
{
  "agent": "esg-scorer",
  "application": "research-nexus",
  "inherits": ["research-nexus-base"],

  "identity": {
    "role": "ESGAnalyst",
    "allowedPersonas": ["esg-scorer"],
    "authorityLevel": "esg-research-sfdr-writer",
    "environmentScope": ["research", "compliance"]
    // Dual environment scope: research (ESG scoring) + compliance (SFDR disclosures)
  },

  "dataAccess": {
    "readAllow": [
      "data/esg-providers/msci/**",
      // MSCI ESG Research: company ESG scores (AAA–CCC), ESG momentum,
      // controversy scores, business involvement screens
      // Access restricted to esg-scorer only

      "data/esg-providers/sustainalytics/**",
      // Sustainalytics: ESG risk ratings (negligible/low/medium/high/severe),
      // unmanaged risk scores, global standards violations

      "data/esg-providers/cdp/**",
      // CDP: climate, water, forests disclosure scores
      // GHG Scope 1/2/3 data from corporate CDP submissions

      "data/sfdr-pai/**",
      // SFDR Principal Adverse Impact reference data:
      // PAI indicator definitions (Annex I Table 1 mandatory + Table 2 optional),
      // EU Taxonomy NACE code mappings, technical screening criteria

      "portfolios/holdings/**",
      // Fund-level holdings for PAI computation and EU Taxonomy alignment scoring.
      // READ-ONLY access to holdings (what is owned, not what is targeted).
      // Note: portfolios/model/** is denied via inherited chinese wall base policy.

      "research/published/**"
    ],

    "readDeny": [
      // Inherits all chinese wall readDeny from research-nexus-base
    ],

    "writeAllow": [
      "research/pre-publication/esg/**",
      // ESG scores per security, PAI indicator values, EU Taxonomy alignment scores.
      // RESTRICTED until published.

      "compliance/sfdr/**"
      // SFDR disclosure reports (Art.4 entity PAI statement, Art.6/8/9 fund disclosures).
      // Writes directly to compliance path — SFDR disclosures follow compliance
      // filing workflow, not research publication gate.
    ],

    "writeDeny": [
      "research/published/**",
      "portfolios/**",
      "trading/**"
    ]
  },

  "toolActions": {
    "bash": {
      "allow": [
        "python esg_scorer.py *",
        "python pai_calculator.py *",
        "python taxonomy_mapper.py *",
        "curl https://api.msci.com/esg/*",
        "curl https://api.sustainalytics.com/*",
        "curl https://api.cdp.net/*"
        // ESG provider API calls permitted for esg-scorer only
      ],
      "deny": [
        "curl *trading*",
        "curl *positions*",
        "curl *orders*",
        "rm -rf *"
      ]
    },
    "edit": {
      "allowPaths": [
        "research/pre-publication/esg/**",
        "compliance/sfdr/**"
      ],
      "denyPaths": [
        "research/published/**",
        "portfolios/**",
        "trading/**"
      ]
    }
  },

  "riskBudget": {
    "dailyLimit": 300,
    // Lower volume than market-analyst: ESG scoring is computationally
    // intensive but not real-time; daily batch processing cadence.
    "perCallCost": {
      "read": 1,
      "write": 2,
      "bash_execute": 3,
      "external_api_call": 4
      // ESG provider API calls carry higher cost — external API calls
      // are the highest-risk tool action (latency, cost, rate limits)
    },
    "resetPeriod": "24h"
  }
}
```

---

## 4. sentiment-analyzer SOE Definition

```json
{
  "agent": "sentiment-analyzer",
  "application": "research-nexus",
  "inherits": ["research-nexus-base"],

  "identity": {
    "role": "SentimentAnalyst",
    "allowedPersonas": ["sentiment-analyzer"],
    "authorityLevel": "research-read-write-prepublication",
    "environmentScope": ["research"]
  },

  "dataAccess": {
    "readAllow": [
      "data/news-feeds/**",
      // Reuters, Bloomberg News, AP, Dow Jones — continuous news stream

      "data/social-media/**",
      // Twitter/X Streaming API (institutional + retail commentary)
      // Reddit posts (r/investing, r/wallstreetbets) — retail sentiment proxy

      "data/analyst-consensus/**",
      // I/B/E/S or FactSet consensus: EPS estimates, price targets,
      // buy/hold/sell rating distributions and revision history

      "data/market-data/prices/**",
      // Market prices and volume ONLY — for sentiment context (is the
      // market reacting to news?) and divergence detection
      // NOTE: prices and volume only. Not positions. Not order flow.

      "data/market-data/volume/**",

      "research/published/**"
    ],

    "readDeny": [
      // Inherits all chinese wall readDeny from research-nexus-base

      "data/market-data/orderflow/**",
      // Explicit deny: order flow data (even aggregated) could reveal
      // institutional positioning intentions. Belt-and-suspenders beyond
      // the inherited positions/** and orders/** deny.

      "data/esg-providers/**"
      // Not needed for sentiment analysis
    ],

    "writeAllow": [
      "research/pre-publication/sentiment/**"
      // Sentiment signals are alpha signals. RESTRICTED until published.
      // AlphaEngine cannot read these until publication workflow completes.
    ],

    "writeDeny": [
      "research/published/**",
      "compliance/**",
      "portfolios/**",
      "trading/**"
    ]
  },

  "toolActions": {
    "bash": {
      "allow": [
        "python sentiment_analyzer.py *",
        "python consensus_tracker.py *",
        "python social_signal_processor.py *",
        "curl https://stream.twitter.com/1.1/*",
        "curl https://oauth.reddit.com/r/*"
      ],
      "deny": [
        "curl *trading*",
        "curl *positions*",
        "curl *orders*",
        "curl *bloomberg-oms*",
        "rm -rf *"
      ]
    },
    "edit": {
      "allowPaths": [
        "research/pre-publication/sentiment/**"
      ],
      "denyPaths": [
        "research/published/**",
        "compliance/**",
        "trading/**",
        "portfolios/**"
      ]
    }
  },

  "riskBudget": {
    "dailyLimit": 400,
    // Continuous sentiment processing throughout trading day.
    // Higher than esg-scorer (real-time stream), lower than market-analyst
    // (no SEC filing volume).
    "perCallCost": {
      "read": 1,
      "write": 2,
      "bash_execute": 3
    },
    "burstAllowance": 80,
    // News burst: major macro event (Fed announcement, geopolitical shock)
    // triggers high-volume simultaneous news and social media processing
    "resetPeriod": "24h"
  }
}
```

---

## 5. fair-value-modeler SOE Definition

```json
{
  "agent": "fair-value-modeler",
  "application": "research-nexus",
  "inherits": ["research-nexus-base"],

  "identity": {
    "role": "ValuationAnalyst",
    "allowedPersonas": ["fair-value-modeler"],
    "authorityLevel": "research-read-write-prepublication",
    "environmentScope": ["research"]
  },

  "dataAccess": {
    "readAllow": [
      "data/comparables/**",
      // Private credit transaction comps, leveraged loan pricing (LSTA),
      // CMBS spread indices, CLO tranche spreads, distressed debt comps

      "data/pricing-sources/**",
      // Broker dealer marks (monthly), independent pricing service marks
      // (ICE Data Services, Refinitiv), Bloomberg evaluated pricing (BVAL)

      "data/market-data/credit-spreads/**",
      // Credit spread indices: IG/HY OAS, sector-level spread series,
      // single-name CDS spreads for credit analysis

      "data/market-data/rates/**",
      // Risk-free rates, swap curves, OIS — DCF discount rate inputs

      "research/valuations/historical/**",
      // Prior quarter fair value estimates for roll-forward computation
      // and valuation consistency checking

      "portfolios/holdings/**",
      // Level 2/3 asset holdings list (read-only)

      "research/published/**"
    ],

    "readDeny": [
      // Inherits all chinese wall readDeny from research-nexus-base

      "data/esg-providers/**",
      // Not needed for fair value modelling

      "data/social-media/**"
      // Not needed for fair value modelling
    ],

    "writeAllow": [
      "research/pre-publication/valuations/**"
      // Fair value estimates with documented Level 3 inputs.
      // RESTRICTED. Human validation required before NAV use.
    ],

    "writeDeny": [
      "research/published/**",
      "portfolios/**",
      "portfolios/nav/**",
      // EXPLICIT NAV DENY: cannot write to NAV or portfolio accounting systems.
      // Fair value estimates must be validated by Model Risk before NAV use.

      "accounting/**",
      "trading/**",
      "compliance/**"
    ]
  },

  "toolActions": {
    "bash": {
      "allow": [
        "python dcf_model.py *",
        "python comparables_analysis.py *",
        "python fair_value_calculator.py *",
        "python level3_rollforward.py *"
        // Valuation computation scripts only
      ],
      "deny": [
        "curl *trading*",
        "curl *positions*",
        "curl *orders*",
        "curl *nav-system*",
        "curl *portfolio-accounting*",
        "rm -rf *",
        "UPDATE *",
        "INSERT INTO *nav*"
        // Explicit deny on any database write that could affect NAV
      ]
    },
    "edit": {
      "allowPaths": [
        "research/pre-publication/valuations/**"
      ],
      "denyPaths": [
        "research/published/**",
        "portfolios/**",
        "accounting/**",
        "trading/**"
      ]
    }
  },

  "riskBudget": {
    "dailyLimit": 200,
    // Lowest volume in ResearchNexus. Fair value modelling is computationally
    // intensive but the Level 2/3 universe is a bounded set (~200–500 positions)
    // vs. the open-ended SEC filing and news volumes.
    "perCallCost": {
      "read": 1,
      "write": 2,
      "bash_execute": 5
      // Higher bash cost: DCF and comparables models are resource-intensive;
      // cost weighting discourages runaway model execution loops
    },
    "resetPeriod": "24h"
  }
}
```

---

## 6. Policy Inheritance Summary

```
research-nexus-base (immutable chinese wall)
    │
    ├── market-analyst    (inherits base + analysis-specific access)
    ├── esg-scorer        (inherits base + ESG provider access + compliance/sfdr write)
    ├── sentiment-analyzer (inherits base + social/news/consensus access)
    └── fair-value-modeler (inherits base + comparables/pricing access; NAV write denied)
```

The base policy's `readDeny` rules for trading data cannot be overridden by child agent policies. The Sentinel-Ops SOE inheritance engine (`soe-inherit.js`) enforces a tighten-only merge: child policies can restrict further but cannot relax a deny declared in a parent policy.

---

*This document is part of the AssetCo AI Platform documentation suite. SOE definitions are validated against the Sentinel-Ops SOE schema before deployment.*

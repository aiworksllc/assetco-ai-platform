import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRiskModel, listModels,
  MarketAnalystRiskModel, EsgScorerRiskModel,
  SentimentAnalyzerRiskModel, FairValueModelerRiskModel,
  isChineseWallViolation, isPrePublicationLeakage,
} from '../../platform/models/research-nexus/risk-models.js';

// ── Factory Tests ────────────────────────────────────────────────────────

describe('ResearchNexus Risk Model Factory', () => {
  it('lists all 4 agent models', () => {
    const models = listModels();
    assert.deepStrictEqual(models.sort(), [
      'esg-scorer', 'fair-value-modeler', 'market-analyst', 'sentiment-analyzer',
    ]);
  });

  it('creates each model by agent ID', () => {
    for (const id of listModels()) {
      const m = createRiskModel(id);
      assert.ok(m, `model for ${id}`);
    }
  });

  it('throws for unknown agent', () => {
    assert.throws(() => createRiskModel('unknown-agent'), /Unknown ResearchNexus agent/);
  });
});

// ── Score Structure ──────────────────────────────────────────────────────

describe('Score Structure', () => {
  it('returns required fields', () => {
    const m = createRiskModel('market-analyst');
    const result = m.score('read data/news-feeds/reuters/latest.json', {});
    assert.ok(typeof result.riskScore === 'number');
    assert.ok(['green', 'yellow', 'red', 'critical'].includes(result.riskTier));
    assert.ok(Array.isArray(result.factors));
    assert.ok(Array.isArray(result.regulatoryFlags));
    assert.ok(typeof result.explanation === 'string');
    assert.equal(result.model, 'MarketAnalystRiskModel');
    assert.equal(result.modelVersion, '1.0.0');
    assert.ok(result.scoredAt);
  });

  it('clamps score to 0-100', () => {
    const m = createRiskModel('market-analyst');
    const result = m.score('read data/news-feeds/reuters/latest.json', {});
    assert.ok(result.riskScore >= 0 && result.riskScore <= 100);
  });
});

// ── Chinese Wall Detection (shared) ──────────────────────────────────────

describe('Chinese Wall Detection', () => {
  const violations = [
    'read trading/blotter/2026-03-20.json',
    'read orders/pending/ORD-001.json',
    'read executions/fills/2026-03-20.json',
    'read positions/equity-book/long-positions.json',
    'read portfolios/model/GROWTH-EQUITY/target.json',
    'glob positions/**',
    'write trading/new-order.json',
    'curl https://bloomberg-oms/positions/equity',
    'curl https://flextrade/orders/pending',
  ];

  for (const v of violations) {
    it(`detects: ${v}`, () => {
      assert.ok(isChineseWallViolation(v), `should detect: ${v}`);
    });
  }

  const safe = [
    'read data/news-feeds/reuters/latest.json',
    'read research/published/analysis/AAPL.json',
    'write research/pre-publication/analysis/AAPL.json',
    'python nlp_processor.py transcript.txt',
  ];

  for (const s of safe) {
    it(`does NOT flag: ${s}`, () => {
      assert.ok(!isChineseWallViolation(s), `should NOT detect: ${s}`);
    });
  }
});

// ── Pre-Publication Leakage Detection ────────────────────────────────────

describe('Pre-Publication Leakage Detection', () => {
  it('detects write to published/', () => {
    assert.ok(isPrePublicationLeakage('write research/published/analysis/AAPL.json'));
  });

  it('detects edit of published/', () => {
    assert.ok(isPrePublicationLeakage('edit research/published/analysis/AAPL.json'));
  });

  it('does NOT flag pre-publication write', () => {
    assert.ok(!isPrePublicationLeakage('write research/pre-publication/analysis/AAPL.json'));
  });
});

// ── Market Analyst Risk Model ────────────────────────────────────────────

describe('MarketAnalystRiskModel', () => {
  const m = createRiskModel('market-analyst');

  it('baseline score for normal read', () => {
    const r = m.score('read data/news-feeds/reuters/latest.json', {});
    assert.equal(r.riskTier, 'green');
    assert.ok(r.riskScore <= 10);
  });

  it('NLP processing adds minimal risk', () => {
    const r = m.score('python nlp_processor.py transcript.txt', {});
    assert.equal(r.riskTier, 'green');
    assert.ok(r.factors.some(f => f.name === 'nlp-processing'));
  });

  it('SEC EDGAR API access is green', () => {
    const r = m.score('curl https://efts.sec.gov/LATEST/search-index?q=AAPL', {});
    assert.equal(r.riskTier, 'green');
    assert.ok(r.factors.some(f => f.name === 'sec-edgar-api'));
  });

  it('analysis write is green', () => {
    const r = m.score('write research/pre-publication/analysis/AAPL/2026-Q1.json', {});
    assert.equal(r.riskTier, 'green');
    assert.ok(r.factors.some(f => f.name === 'analysis-write'));
  });

  it('Chinese wall violation → CRITICAL', () => {
    const r = m.score('read positions/equity-book/long-positions.json', {});
    assert.equal(r.riskTier, 'critical');
    assert.ok(r.riskScore >= 95);
    assert.ok(r.regulatoryFlags.includes('MAR_ART10'));
    assert.ok(r.regulatoryFlags.includes('REG_FD'));
    assert.ok(r.regulatoryFlags.includes('SEC_204A'));
  });

  it('Chinese wall short-circuits — only one factor', () => {
    const r = m.score('read trading/blotter/2026-03-20.json', {});
    assert.equal(r.factors.length, 1);
    assert.equal(r.factors[0].name, 'chinese-wall-violation');
  });

  it('pre-publication leakage → RED', () => {
    const r = m.score('write research/published/analysis/AAPL.json', {});
    assert.equal(r.riskTier, 'red');
    assert.ok(r.riskScore >= 80);
    assert.ok(r.regulatoryFlags.includes('REG_FD'));
  });

  it('ESG data unauthorized access → yellow', () => {
    const r = m.score('read data/esg-providers/msci/scores.json', {});
    assert.equal(r.riskTier, 'yellow');
  });

  it('high call volume adds risk', () => {
    const r = m.score('read data/news-feeds/reuters/latest.json', {}, { sessionCallCount: 250 });
    assert.ok(r.factors.some(f => f.name === 'high-call-volume'));
  });

  it('earnings season adds burst factor', () => {
    const r = m.score('python transcript_parser.py batch.txt', {}, { earningsSeason: true });
    assert.ok(r.factors.some(f => f.name === 'earnings-season-burst'));
  });

  it('broker research read is green', () => {
    const r = m.score('read data/broker-research/gs/AAPL-initiate.pdf', {});
    assert.equal(r.riskTier, 'green');
    assert.ok(r.factors.some(f => f.name === 'broker-research-read'));
  });
});

// ── ESG Scorer Risk Model ────────────────────────────────────────────────

describe('EsgScorerRiskModel', () => {
  const m = createRiskModel('esg-scorer');

  it('ESG computation is green', () => {
    const r = m.score('python pai_calculator.py FUND-001', {});
    assert.equal(r.riskTier, 'green');
  });

  it('ESG provider API is green', () => {
    const r = m.score('curl https://api.msci.com/esg/scores/AAPL', {});
    assert.equal(r.riskTier, 'green');
    assert.ok(r.factors.some(f => f.name === 'esg-provider-api'));
  });

  it('SFDR disclosure write is green', () => {
    const r = m.score('write compliance/sfdr/FUND-001-art8.json', {});
    assert.equal(r.riskTier, 'green');
    assert.ok(r.factors.some(f => f.name === 'sfdr-disclosure-write'));
  });

  it('Chinese wall → CRITICAL', () => {
    const r = m.score('read positions/equity-book/longs.json', {});
    assert.equal(r.riskTier, 'critical');
  });

  it('low data coverage (60%) → yellow', () => {
    const r = m.score('python pai_calculator.py FUND-002', {}, { dataCoverage: 60 });
    assert.ok(r.riskScore > 30);
    assert.ok(r.factors.some(f => f.name === 'low-data-coverage'));
  });

  it('critical data gap (<50%) → red', () => {
    const r = m.score('python pai_calculator.py FUND-003', {}, { dataCoverage: 40 });
    assert.ok(r.riskScore > 60);
    assert.ok(r.factors.some(f => f.name === 'critical-data-gap'));
    assert.ok(r.regulatoryFlags.includes('SFDR_DATA_QUALITY'));
  });

  it('stale data adds risk', () => {
    const r = m.score('python esg_scorer.py AAPL', {}, { staleData: true });
    assert.ok(r.factors.some(f => f.name === 'stale-esg-data'));
  });

  it('provider outage adds risk', () => {
    const r = m.score('curl https://api.sustainalytics.com/scores', {}, { providerOutage: true });
    assert.ok(r.factors.some(f => f.name === 'esg-provider-outage'));
  });

  it('data version mismatch adds risk', () => {
    const r = m.score('python pai_calculator.py FUND-001', {}, { dataVersionMismatch: true });
    assert.ok(r.factors.some(f => f.name === 'data-version-mismatch'));
  });

  it('portfolio write attempt → CRITICAL', () => {
    const r = m.score('write portfolios/holdings/FUND-001.json', {});
    assert.equal(r.riskTier, 'critical');
    assert.ok(r.factors.some(f => f.name === 'portfolio-write-attempt'));
  });

  it('SFDR regulatory flags on SFDR operations', () => {
    const r = m.score('write compliance/sfdr/entity-pai-2026.json', {});
    assert.ok(r.regulatoryFlags.includes('SFDR_ART4'));
  });
});

// ── Sentiment Analyzer Risk Model ────────────────────────────────────────

describe('SentimentAnalyzerRiskModel', () => {
  const m = createRiskModel('sentiment-analyzer');

  it('normal sentiment processing is green', () => {
    const r = m.score('python sentiment_analyzer.py reuters-feed.json', {});
    assert.equal(r.riskTier, 'green');
  });

  it('social media API is green', () => {
    const r = m.score('curl https://stream.twitter.com/1.1/statuses/filter', {});
    assert.equal(r.riskTier, 'green');
  });

  it('sentiment signal write is green', () => {
    const r = m.score('write research/pre-publication/sentiment/AAPL-signal.json', {});
    assert.equal(r.riskTier, 'green');
  });

  it('Chinese wall → CRITICAL', () => {
    const r = m.score('read orders/pending/all.json', {});
    assert.equal(r.riskTier, 'critical');
  });

  it('sentiment reversal anomaly → yellow-red', () => {
    const r = m.score('python sentiment_analyzer.py batch.json', {}, { sentimentReversalPct: 85 });
    assert.ok(r.riskScore > 30);
    assert.ok(r.factors.some(f => f.name === 'sentiment-reversal-anomaly'));
    assert.ok(r.regulatoryFlags.includes('MAR_ART12'));
  });

  it('extreme value cluster → yellow-red', () => {
    const r = m.score('python sentiment_analyzer.py batch.json', {}, { extremeValueCluster: true });
    assert.ok(r.riskScore > 30);
    assert.ok(r.factors.some(f => f.name === 'extreme-value-cluster'));
  });

  it('anomalous social volume → yellow', () => {
    const r = m.score('python social_signal_processor.py feed.json', {}, { anomalousSocialVolume: true });
    assert.ok(r.factors.some(f => f.name === 'anomalous-social-volume'));
  });

  it('prompt injection → yellow-red', () => {
    const r = m.score('python sentiment_analyzer.py injected.json', {}, { promptInjectionDetected: true });
    assert.ok(r.riskScore > 30);
    assert.ok(r.regulatoryFlags.includes('EU_AI_ACT_ART15'));
  });

  it('news burst adds minimal risk', () => {
    const r = m.score('python sentiment_analyzer.py fed-announcement.json', {}, { newsBurst: true });
    assert.ok(r.factors.some(f => f.name === 'news-burst'));
    assert.equal(r.riskTier, 'green');
  });

  it('orderflow access attempt → red', () => {
    const r = m.score('read data/market-data/orderflow/aggregated.json', {});
    assert.ok(r.riskScore > 60);
    assert.ok(r.factors.some(f => f.name === 'orderflow-access-attempt'));
  });

  it('pre-publication leakage → red', () => {
    const r = m.score('write research/published/sentiment/AAPL.json', {});
    assert.equal(r.riskTier, 'red');
  });
});

// ── Fair Value Modeler Risk Model ────────────────────────────────────────

describe('FairValueModelerRiskModel', () => {
  const m = createRiskModel('fair-value-modeler');

  it('DCF computation is green', () => {
    const r = m.score('python dcf_model.py loan-XYZ', {});
    assert.equal(r.riskTier, 'green');
    assert.ok(r.factors.some(f => f.name === 'valuation-computation'));
  });

  it('valuation write is green', () => {
    const r = m.score('write research/pre-publication/valuations/loan-XYZ.json', {});
    assert.equal(r.riskTier, 'green');
  });

  it('Chinese wall → CRITICAL', () => {
    const r = m.score('read trading/blotter/2026-03-20.json', {});
    assert.equal(r.riskTier, 'critical');
  });

  it('Level 2 deviation >5% → red', () => {
    const r = m.score('python fair_value_calculator.py bond-ABC', {}, { level2DeviationPct: 7, fvHierarchyLevel: 2 });
    assert.ok(r.riskScore > 30);
    assert.ok(r.factors.some(f => f.name === 'level2-deviation'));
    assert.ok(r.regulatoryFlags.includes('ASC_820_DEVIATION'));
  });

  it('Level 3 deviation >10% → red', () => {
    const r = m.score('python level3_rollforward.py loan-XYZ', {}, { level3DeviationPct: 15, fvHierarchyLevel: 3 });
    assert.ok(r.riskScore > 30);
    assert.ok(r.factors.some(f => f.name === 'level3-deviation'));
    assert.ok(r.factors.some(f => f.name === 'level3-asset'));
    assert.ok(r.regulatoryFlags.includes('ASC_820_LEVEL3'));
  });

  it('material NAV impact >0.5% → critical', () => {
    const r = m.score('python fair_value_calculator.py batch', {}, {
      level3DeviationPct: 20, fvHierarchyLevel: 3, navImpactPct: 0.8,
    });
    assert.ok(r.riskScore > 85);
    assert.ok(r.factors.some(f => f.name === 'material-nav-impact'));
    assert.ok(r.regulatoryFlags.includes('ICA_RULE_22C1'));
  });

  it('NAV/accounting write → CRITICAL', () => {
    const r = m.score('write portfolios/nav/FUND-001/2026-03-20.json', {});
    assert.equal(r.riskTier, 'critical');
    assert.ok(r.factors.some(f => f.name === 'nav-accounting-write'));
  });

  it('portfolio write attempt → CRITICAL', () => {
    const r = m.score('write portfolios/holdings/FUND-001.json', {});
    assert.equal(r.riskTier, 'critical');
  });

  it('NAV system curl → CRITICAL', () => {
    const r = m.score('curl https://internal.nav-system/publish/FUND-001', {});
    assert.equal(r.riskTier, 'critical');
    assert.ok(r.factors.some(f => f.name === 'nav-system-access'));
  });

  it('SQL NAV insert → CRITICAL', () => {
    const r = m.score('INSERT INTO nav_published VALUES (FUND-001, 100.5)', {});
    assert.equal(r.riskTier, 'critical');
    assert.ok(r.factors.some(f => f.name === 'nav-database-write'));
  });

  it('pre-publication leakage → red', () => {
    const r = m.score('write research/published/valuations/loan-XYZ.json', {});
    assert.equal(r.riskTier, 'red');
  });

  it('Level 3 asset flag without deviation is green', () => {
    const r = m.score('python level3_rollforward.py loan-XYZ', {}, { fvHierarchyLevel: 3 });
    assert.equal(r.riskTier, 'green');
    assert.ok(r.regulatoryFlags.includes('ASC_820_LEVEL3'));
  });
});

// ── Cumulative Scenarios ─────────────────────────────────────────────────

describe('Cumulative Scenarios', () => {
  it('all 4 agents score Chinese wall as CRITICAL', () => {
    for (const id of listModels()) {
      const m = createRiskModel(id);
      const r = m.score('read positions/equity-book/longs.json', {});
      assert.equal(r.riskTier, 'critical', `${id} should be critical`);
    }
  });

  it('all 4 agents score pre-pub leakage as RED', () => {
    for (const id of listModels()) {
      const m = createRiskModel(id);
      const r = m.score('write research/published/some-file.json', {});
      assert.equal(r.riskTier, 'red', `${id} should be red`);
    }
  });

  it('ESG scorer with multiple data quality issues stacks risk', () => {
    const m = createRiskModel('esg-scorer');
    const r = m.score('python pai_calculator.py FUND-001', {}, {
      dataCoverage: 45, staleData: true, providerOutage: true, dataVersionMismatch: true,
    });
    assert.ok(r.riskScore > 85, 'stacked data quality issues should be critical');
  });

  it('fair-value-modeler with deviation + NAV impact escalates', () => {
    const m = createRiskModel('fair-value-modeler');
    const r = m.score('python fair_value_calculator.py batch', {}, {
      level3DeviationPct: 25, fvHierarchyLevel: 3, navImpactPct: 1.2,
    });
    assert.equal(r.riskTier, 'critical');
    assert.ok(r.regulatoryFlags.includes('ASC_820_LEVEL3'));
    assert.ok(r.regulatoryFlags.includes('ICA_RULE_22C1'));
  });

  it('sentiment analyzer with multiple anomalies stacks', () => {
    const m = createRiskModel('sentiment-analyzer');
    const r = m.score('python sentiment_analyzer.py batch.json', {}, {
      sentimentReversalPct: 90, extremeValueCluster: true, promptInjectionDetected: true,
    });
    assert.ok(r.riskScore > 85, 'stacked anomalies should be critical');
  });
});

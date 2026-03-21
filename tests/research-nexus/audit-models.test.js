import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createAuditModel, listModels, RETENTION, FRAMEWORKS,
  MarketAnalystAuditModel, EsgScorerAuditModel,
  SentimentAnalyzerAuditModel, FairValueModelerAuditModel,
} from '../../platform/models/research-nexus/audit-models.js';

// ── Factory Tests ────────────────────────────────────────────────────────

describe('ResearchNexus Audit Model Factory', () => {
  it('lists all 4 agent models', () => {
    assert.deepStrictEqual(listModels().sort(), [
      'esg-scorer', 'fair-value-modeler', 'market-analyst', 'sentiment-analyzer',
    ]);
  });

  it('creates each model by agent ID', () => {
    for (const id of listModels()) {
      const m = createAuditModel(id);
      assert.ok(m);
    }
  });

  it('throws for unknown agent', () => {
    assert.throws(() => createAuditModel('unknown'), /Unknown ResearchNexus agent/);
  });
});

// ── Record Structure ─────────────────────────────────────────────────────

describe('Audit Record Structure', () => {
  it('returns required fields', () => {
    const m = createAuditModel('market-analyst');
    const r = m.classify({ toolName: 'read data/news-feeds/reuters/latest.json', decision: 'allow', riskScore: 5 });
    assert.ok(r.recordId.startsWith('aud-'));
    assert.ok(r.timestamp);
    assert.equal(r.agentId, 'market-analyst');
    assert.equal(r.model, 'MarketAnalystAuditModel');
    assert.ok(r.event);
    assert.ok(r.auditCategory);
    assert.ok(r.eventType);
    assert.ok(r.severity);
    assert.ok(r.impactArea);
    assert.ok(Array.isArray(r.compliance));
    assert.ok(r.retention);
    assert.ok(typeof r.retention.years === 'number');
    assert.ok(typeof r.retention.reason === 'string');
  });

  it('filters context to allowedContextKeys only', () => {
    const m = createAuditModel('market-analyst');
    const r = m.classify(
      { toolName: 'read data/news-feeds/reuters/latest.json' },
      { chineseWallViolation: false, secretInternalData: 'should-not-appear' },
    );
    assert.ok(!('secretInternalData' in r.context));
  });
});

// ── Retention Schedule ───────────────────────────────────────────────────

describe('Retention Schedule', () => {
  const expected = {
    'research-generation': 5,
    'esg-scoring': 7,
    'sentiment-signal': 5,
    'fair-value-estimate': 10,
    'publication-gate-transition': 5,
    'chinese-wall-violation-attempt': 10,
    'pre-publication-leakage-attempt': 10,
    'esg-data-quality-alert': 7,
    'fair-value-deviation-alert': 10,
    'sentiment-anomaly': 5,
    'agent-suspension': 10,
    'model-version-change': 5,
  };

  for (const [cat, years] of Object.entries(expected)) {
    it(`${cat} → ${years} years`, () => {
      assert.equal(RETENTION[cat].years, years);
      assert.ok(RETENTION[cat].reason.length > 0);
    });
  }
});

// ── Market Analyst Audit Model ───────────────────────────────────────────

describe('MarketAnalystAuditModel', () => {
  const m = createAuditModel('market-analyst');

  it('research generation on analysis write', () => {
    const r = m.classify({ toolName: 'write research/pre-publication/analysis/AAPL/2026-Q1.json', decision: 'allow', riskScore: 8 });
    assert.equal(r.auditCategory, 'research-generation');
    assert.equal(r.eventType, 'analysis-written');
    assert.equal(r.severity, 'low');
  });

  it('SEC EDGAR query', () => {
    const r = m.classify({ toolName: 'curl https://efts.sec.gov/LATEST/search-index?q=AAPL', decision: 'allow', riskScore: 6 });
    assert.equal(r.auditCategory, 'research-generation');
    assert.equal(r.eventType, 'sec-edgar-query');
  });

  it('Chinese wall violation → CRITICAL', () => {
    const r = m.classify(
      { toolName: 'read positions/equity-book/longs.json', decision: 'deny', riskScore: 98 },
      { chineseWallViolation: true, attemptedPath: 'positions/equity-book/longs.json' },
    );
    assert.equal(r.auditCategory, 'chinese-wall-violation-attempt');
    assert.equal(r.severity, 'critical');
    assert.equal(r.retention.years, 10);
    assert.ok(r.compliance.some(c => c.framework === 'MAR'));
  });

  it('pre-publication leakage → HIGH', () => {
    const r = m.classify(
      { toolName: 'write research/published/analysis/AAPL.json', decision: 'deny', riskScore: 83 },
      { prePublicationLeakageAttempt: true },
    );
    assert.equal(r.auditCategory, 'pre-publication-leakage-attempt');
    assert.equal(r.severity, 'high');
    assert.ok(r.compliance.some(c => c.framework === 'Reg FD'));
  });

  it('publication gate transition', () => {
    const r = m.classify(
      { toolName: 'status-change', decision: 'allow', riskScore: 5 },
      { fromState: 'pre-publication', toState: 'under-review', researchItemId: 'RN-2026-0342' },
    );
    assert.equal(r.auditCategory, 'publication-gate-transition');
    assert.equal(r.eventType, 'transition-pre-publication-to-under-review');
    assert.equal(r.severity, 'low');
  });

  it('publication gate → published is HIGH severity', () => {
    const r = m.classify(
      { toolName: 'status-change', decision: 'allow', riskScore: 15 },
      { fromState: 'cco-approved', toState: 'published' },
    );
    assert.equal(r.severity, 'high');
  });

  it('general operation fallback', () => {
    const r = m.classify({ toolName: 'read data/news-feeds/reuters/latest.json', decision: 'allow', riskScore: 3 });
    assert.equal(r.auditCategory, 'research-generation');
    assert.equal(r.eventType, 'general-research-operation');
  });
});

// ── ESG Scorer Audit Model ───────────────────────────────────────────────

describe('EsgScorerAuditModel', () => {
  const m = createAuditModel('esg-scorer');

  it('ESG score computation', () => {
    const r = m.classify({ toolName: 'python pai_calculator.py FUND-001', decision: 'allow', riskScore: 6 });
    assert.equal(r.auditCategory, 'esg-scoring');
    assert.equal(r.eventType, 'esg-score-computed');
  });

  it('SFDR disclosure write', () => {
    const r = m.classify({ toolName: 'write compliance/sfdr/FUND-001-art8.json', decision: 'allow', riskScore: 13 });
    assert.equal(r.auditCategory, 'esg-scoring');
    assert.equal(r.eventType, 'sfdr-disclosure-written');
    assert.equal(r.severity, 'medium');
    assert.ok(r.compliance.some(c => c.framework === 'SFDR'));
  });

  it('low data coverage (60%) → MEDIUM', () => {
    const r = m.classify(
      { toolName: 'python pai_calculator.py FUND-002', decision: 'allow', riskScore: 28 },
      { dataCoverage: 60 },
    );
    assert.equal(r.auditCategory, 'esg-data-quality-alert');
    assert.equal(r.severity, 'medium');
  });

  it('critical data gap (<50%) → CRITICAL', () => {
    const r = m.classify(
      { toolName: 'python pai_calculator.py FUND-003', decision: 'allow', riskScore: 58 },
      { dataCoverage: 40 },
    );
    assert.equal(r.auditCategory, 'esg-data-quality-alert');
    assert.equal(r.severity, 'critical');
    assert.equal(r.eventType, 'critical-data-gap');
  });

  it('stale data alert', () => {
    const r = m.classify(
      { toolName: 'python esg_scorer.py AAPL', decision: 'allow', riskScore: 18 },
      { staleData: true },
    );
    assert.equal(r.auditCategory, 'esg-data-quality-alert');
    assert.equal(r.eventType, 'stale-data-detected');
  });

  it('provider outage alert', () => {
    const r = m.classify(
      { toolName: 'curl https://api.msci.com/esg/scores', decision: 'allow', riskScore: 23 },
      { providerOutage: true },
    );
    assert.equal(r.auditCategory, 'esg-data-quality-alert');
    assert.equal(r.eventType, 'provider-outage');
  });

  it('Chinese wall → CRITICAL', () => {
    const r = m.classify(
      { toolName: 'read trading/blotter/2026.json', decision: 'deny', riskScore: 98 },
      { chineseWallViolation: true },
    );
    assert.equal(r.auditCategory, 'chinese-wall-violation-attempt');
    assert.equal(r.severity, 'critical');
  });
});

// ── Sentiment Analyzer Audit Model ───────────────────────────────────────

describe('SentimentAnalyzerAuditModel', () => {
  const m = createAuditModel('sentiment-analyzer');

  it('sentiment signal generation', () => {
    const r = m.classify({ toolName: 'write research/pre-publication/sentiment/AAPL-signal.json', decision: 'allow', riskScore: 8 });
    assert.equal(r.auditCategory, 'sentiment-signal');
    assert.equal(r.eventType, 'sentiment-signal-generated');
  });

  it('sentiment reversal anomaly → HIGH', () => {
    const r = m.classify(
      { toolName: 'python sentiment_analyzer.py batch.json', decision: 'allow', riskScore: 43 },
      { sentimentReversalPct: 85 },
    );
    assert.equal(r.auditCategory, 'sentiment-anomaly');
    assert.equal(r.severity, 'high');
  });

  it('extreme value cluster → HIGH', () => {
    const r = m.classify(
      { toolName: 'python sentiment_analyzer.py batch.json', decision: 'allow', riskScore: 38 },
      { extremeValueCluster: true },
    );
    assert.equal(r.auditCategory, 'sentiment-anomaly');
    assert.equal(r.severity, 'high');
  });

  it('prompt injection → CRITICAL', () => {
    const r = m.classify(
      { toolName: 'python sentiment_analyzer.py injected.json', decision: 'allow', riskScore: 53 },
      { promptInjectionDetected: true },
    );
    assert.equal(r.auditCategory, 'sentiment-anomaly');
    assert.equal(r.eventType, 'prompt-injection-detected');
    assert.equal(r.severity, 'critical');
    assert.ok(r.compliance.some(c => c.framework === 'EU AI Act'));
  });

  it('anomalous social volume → HIGH', () => {
    const r = m.classify(
      { toolName: 'python social_signal_processor.py feed.json', decision: 'allow', riskScore: 33 },
      { anomalousSocialVolume: true },
    );
    assert.equal(r.auditCategory, 'sentiment-anomaly');
    assert.equal(r.severity, 'high');
  });

  it('Chinese wall → CRITICAL', () => {
    const r = m.classify(
      { toolName: 'read orders/pending/all.json', decision: 'deny', riskScore: 98 },
      { chineseWallViolation: true },
    );
    assert.equal(r.severity, 'critical');
  });

  it('pre-publication leakage → HIGH', () => {
    const r = m.classify(
      { toolName: 'write research/published/sentiment/AAPL.json', decision: 'deny', riskScore: 83 },
      { prePublicationLeakageAttempt: true },
    );
    assert.equal(r.auditCategory, 'pre-publication-leakage-attempt');
    assert.equal(r.severity, 'high');
  });
});

// ── Fair Value Modeler Audit Model ───────────────────────────────────────

describe('FairValueModelerAuditModel', () => {
  const m = createAuditModel('fair-value-modeler');

  it('fair value computation', () => {
    const r = m.classify({ toolName: 'python dcf_model.py loan-XYZ', decision: 'allow', riskScore: 8 });
    assert.equal(r.auditCategory, 'fair-value-estimate');
    assert.equal(r.retention.years, 10);
  });

  it('Level 3 computation → MEDIUM severity', () => {
    const r = m.classify(
      { toolName: 'python level3_rollforward.py loan-XYZ', decision: 'allow', riskScore: 13 },
      { fvHierarchyLevel: 3 },
    );
    assert.equal(r.auditCategory, 'fair-value-estimate');
    assert.equal(r.eventType, 'level3-fair-value-computed');
    assert.equal(r.severity, 'medium');
    assert.ok(r.compliance.some(c => c.framework === 'ASC 820'));
  });

  it('Level 2 deviation >5% → HIGH', () => {
    const r = m.classify(
      { toolName: 'python fair_value_calculator.py bond-ABC', decision: 'allow', riskScore: 28 },
      { deviationPct: 7, fvHierarchyLevel: 2 },
    );
    assert.equal(r.auditCategory, 'fair-value-deviation-alert');
    assert.equal(r.eventType, 'level2-deviation-alert');
    assert.equal(r.severity, 'high');
  });

  it('Level 3 deviation >10% → HIGH', () => {
    const r = m.classify(
      { toolName: 'python level3_rollforward.py loan-XYZ', decision: 'allow', riskScore: 38 },
      { deviationPct: 15, fvHierarchyLevel: 3 },
    );
    assert.equal(r.auditCategory, 'fair-value-deviation-alert');
    assert.equal(r.eventType, 'level3-deviation-alert');
    assert.equal(r.severity, 'high');
  });

  it('material NAV impact → CRITICAL', () => {
    const r = m.classify(
      { toolName: 'python fair_value_calculator.py batch', decision: 'allow', riskScore: 88 },
      { deviationPct: 20, fvHierarchyLevel: 3, navImpactPct: 0.8 },
    );
    assert.equal(r.severity, 'critical');
    assert.ok(r.compliance.some(c => c.framework === 'Investment Company Act'));
  });

  it('NAV write attempt → CRITICAL agent-suspension', () => {
    const r = m.classify(
      { toolName: 'write portfolios/nav/FUND-001/2026-03-20.json', decision: 'deny', riskScore: 98 },
      {},
    );
    assert.equal(r.auditCategory, 'agent-suspension');
    assert.equal(r.severity, 'critical');
    assert.equal(r.retention.years, 10);
  });

  it('Chinese wall → CRITICAL', () => {
    const r = m.classify(
      { toolName: 'read positions/credit-book/holdings.json', decision: 'deny', riskScore: 98 },
      { chineseWallViolation: true },
    );
    assert.equal(r.severity, 'critical');
  });

  it('pre-publication leakage → HIGH', () => {
    const r = m.classify(
      { toolName: 'write research/published/valuations/loan-XYZ.json', decision: 'deny', riskScore: 83 },
      { prePublicationLeakageAttempt: true },
    );
    assert.equal(r.auditCategory, 'pre-publication-leakage-attempt');
  });

  it('Level 3 within threshold → normal fair-value-estimate', () => {
    const r = m.classify(
      { toolName: 'python level3_rollforward.py loan-XYZ', decision: 'allow', riskScore: 8 },
      { deviationPct: 5, fvHierarchyLevel: 3 },
    );
    assert.equal(r.auditCategory, 'fair-value-estimate');
  });
});

// ── Severity Consistency ─────────────────────────────────────────────────

describe('Severity Consistency', () => {
  it('Chinese wall is CRITICAL for all agents', () => {
    for (const id of listModels()) {
      const m = createAuditModel(id);
      const r = m.classify(
        { toolName: 'read positions/equity-book/longs.json', decision: 'deny', riskScore: 98 },
        { chineseWallViolation: true },
      );
      assert.equal(r.severity, 'critical', `${id}: Chinese wall should be critical`);
    }
  });

  it('pre-publication leakage is HIGH for all agents', () => {
    for (const id of listModels()) {
      const m = createAuditModel(id);
      const r = m.classify(
        { toolName: 'write research/published/file.json', decision: 'deny', riskScore: 83 },
        { prePublicationLeakageAttempt: true },
      );
      assert.equal(r.severity, 'high', `${id}: leakage should be high`);
    }
  });

  it('all CRITICAL events get 10-year retention', () => {
    for (const id of listModels()) {
      const m = createAuditModel(id);
      const r = m.classify(
        { toolName: 'read trading/blotter/latest.json', decision: 'deny', riskScore: 98 },
        { chineseWallViolation: true },
      );
      assert.ok(r.retention.years >= 10, `${id}: CRITICAL should have ≥10yr retention`);
    }
  });
});

/**
 * AssetCo Sample Business Data — Portfolios, Trades, Positions, Clients, Research
 *
 * Mock data for all 7 apps and 25 agents. Use with demo scenarios or as seed
 * data for local testing. All data is fictional.
 *
 * Run: node platform/data/seed.js
 */

// ── Clients ──────────────────────────────────────────────────────────

export const clients = [
  {
    id: 'CLI-001', name: 'CalPERS Pension Fund', type: 'institutional',
    aum: 450_000_000_000, jurisdiction: 'US', regulator: 'SEC',
    mandate: { riskTolerance: 'moderate', esgRequired: true, benchmarks: ['S&P 500', 'Bloomberg Agg'] },
    restricted: { pii: { contact: 'board@calpers.example.gov' }, classification: 'CONFIDENTIAL' },
  },
  {
    id: 'CLI-002', name: 'Nordic Sovereign Wealth Fund', type: 'institutional',
    aum: 1_200_000_000_000, jurisdiction: 'EU', regulator: 'FCA',
    mandate: { riskTolerance: 'conservative', esgRequired: true, benchmarks: ['MSCI World', 'FTSE 100'] },
    restricted: { pii: { contact: 'invest@nordicswf.example.eu' }, classification: 'RESTRICTED' },
  },
  {
    id: 'CLI-003', name: 'Harrison Family Office', type: 'hnw',
    aum: 85_000_000, jurisdiction: 'US', regulator: 'SEC',
    mandate: { riskTolerance: 'aggressive', esgRequired: false, benchmarks: ['Russell 2000'] },
    restricted: { pii: { ssn: '***-**-4521', contact: 'j.harrison@example.com' }, classification: 'RESTRICTED' },
  },
  {
    id: 'CLI-004', name: 'Munich RE Sub-Advisory', type: 'retail',
    aum: 2_300_000_000, jurisdiction: 'EU', regulator: 'ESMA',
    mandate: { riskTolerance: 'moderate', esgRequired: true, benchmarks: ['Euro Stoxx 50'] },
    restricted: { pii: { contact: 'subadvisory@munichre.example.de' }, classification: 'CONFIDENTIAL' },
  },
];

// ── Portfolios (AlphaEngine) ─────────────────────────────────────────

export const portfolios = [
  {
    id: 'PF-US-EQ-001', name: 'US Large Cap Core', client: 'CLI-001',
    benchmark: 'S&P 500', aum: 8_500_000_000, currency: 'USD',
    strategy: 'active', mandateLimit: { maxSingleName: 0.05, maxSector: 0.25, maxCash: 0.10 },
    holdings: [
      { symbol: 'AAPL', weight: 0.072, shares: 312_000, avgCost: 165.40 },
      { symbol: 'MSFT', weight: 0.068, shares: 178_000, avgCost: 340.10 },
      { symbol: 'NVDA', weight: 0.055, shares: 64_000, avgCost: 680.25 },
      { symbol: 'JPM', weight: 0.038, shares: 195_000, avgCost: 172.80 },
      { symbol: 'JNJ', weight: 0.032, shares: 180_000, avgCost: 155.60 },
    ],
  },
  {
    id: 'PF-EU-FI-001', name: 'Euro Investment Grade', client: 'CLI-002',
    benchmark: 'Bloomberg Euro Agg', aum: 4_200_000_000, currency: 'EUR',
    strategy: 'active', mandateLimit: { maxSingleIssuer: 0.03, minRating: 'BBB-', maxDuration: 8.0 },
    holdings: [
      { isin: 'DE0001102481', issuer: 'Germany', weight: 0.12, coupon: 0.50, maturity: '2031-02-15' },
      { isin: 'FR0014006OJ7', issuer: 'France', weight: 0.09, coupon: 0.75, maturity: '2032-05-25' },
      { isin: 'XS2010028699', issuer: 'Volkswagen', weight: 0.025, coupon: 1.625, maturity: '2029-01-16' },
    ],
  },
  {
    id: 'PF-ALT-001', name: 'Global Alternatives', client: 'CLI-003',
    benchmark: 'HFRX Global Hedge', aum: 650_000_000, currency: 'USD',
    strategy: 'multi-strategy', mandateLimit: { maxLeverage: 2.0, maxDrawdown: 0.15 },
    holdings: [
      { fund: 'Bridgewater All Weather', weight: 0.15, strategy: 'risk-parity' },
      { fund: 'Citadel Wellington', weight: 0.12, strategy: 'multi-strategy' },
      { fund: 'AssetCo Private Credit I', weight: 0.08, strategy: 'direct-lending' },
    ],
  },
];

// ── Orders & Trades (TradeSentinel) ──────────────────────────────────

export const orders = [
  {
    id: 'ORD-20260321-001', portfolio: 'PF-US-EQ-001', side: 'buy',
    symbol: 'GOOGL', qty: 45_000, type: 'limit', limitPrice: 178.50,
    venue: 'NYSE', algo: 'VWAP', urgency: 'medium',
    bestExecution: { venueRationale: 'Lowest spread, highest fill rate for GOOGL', nbboCheck: true },
  },
  {
    id: 'ORD-20260321-002', portfolio: 'PF-US-EQ-001', side: 'sell',
    symbol: 'JNJ', qty: 80_000, type: 'market', venue: 'NASDAQ',
    algo: 'TWAP', urgency: 'low',
    bestExecution: { venueRationale: 'Best TWAP fill history', nbboCheck: true },
  },
  {
    id: 'ORD-20260321-003', portfolio: 'PF-EU-FI-001', side: 'buy',
    isin: 'XS2434891219', qty: 5_000_000, type: 'rfq', venue: 'Tradeweb',
    counterparties: ['Goldman Sachs', 'Deutsche Bank', 'BNP Paribas'],
    bestExecution: { venueRationale: 'RFQ competitive pricing, 3 dealer quotes', nbboCheck: false },
  },
];

export const trades = [
  {
    id: 'TRD-20260321-001', orderId: 'ORD-20260321-001', status: 'filled',
    fillPrice: 178.32, fillQty: 45_000, fillTime: '2026-03-21T14:32:15Z',
    venue: 'NYSE', slippage: -0.0010, commission: 2_250.00,
  },
  {
    id: 'TRD-20260321-002', orderId: 'ORD-20260321-002', status: 'partial',
    fillPrice: 155.80, fillQty: 52_000, fillTime: '2026-03-21T14:45:22Z',
    venue: 'NASDAQ', slippage: 0.0013, commission: 1_560.00,
  },
];

// ── Positions & Exposure (RiskCompass) ────────────────────────────────

export const positions = [
  { portfolio: 'PF-US-EQ-001', symbol: 'AAPL', qty: 312_000, marketValue: 56_784_000, unrealizedPnl: 5_241_600 },
  { portfolio: 'PF-US-EQ-001', symbol: 'MSFT', qty: 178_000, marketValue: 68_614_000, unrealizedPnl: 8_032_200 },
  { portfolio: 'PF-US-EQ-001', symbol: 'NVDA', qty: 64_000, marketValue: 57_600_000, unrealizedPnl: 14_064_000 },
  { portfolio: 'PF-EU-FI-001', isin: 'DE0001102481', notional: 504_000_000, marketValue: 489_888_000, duration: 4.2 },
  { portfolio: 'PF-EU-FI-001', isin: 'FR0014006OJ7', notional: 378_000_000, marketValue: 370_440_000, duration: 5.8 },
];

export const riskMetrics = {
  'PF-US-EQ-001': { var95: 127_500_000, var99: 212_500_000, beta: 1.08, trackingError: 0.023, sharpe: 1.42 },
  'PF-EU-FI-001': { var95: 42_000_000, var99: 71_400_000, duration: 5.1, convexity: 0.38, spreadDuration: 4.6 },
  'PF-ALT-001': { var95: 32_500_000, var99: 55_250_000, leverage: 1.4, maxDrawdown: 0.087, sharpe: 0.92 },
};

// ── Compliance Data (ComplianceShield) ───────────────────────────────

export const complianceAlerts = [
  {
    id: 'ALERT-001', type: 'position-limit', severity: 'warning',
    agent: 'position-reporter', portfolio: 'PF-US-EQ-001',
    message: 'AAPL weight (7.2%) approaching single-name limit (5%)',
    regulation: 'Investment Company Act § 5(b)(1)', status: 'open',
  },
  {
    id: 'ALERT-002', type: 'trade-surveillance', severity: 'critical',
    agent: 'trade-surveiller', portfolio: 'PF-US-EQ-001',
    message: 'Potential layering pattern: 5 cancel-replace orders on NVDA in 3min window',
    regulation: 'MAR Art. 12(1)(a)(ii)', status: 'investigating',
  },
  {
    id: 'ALERT-003', type: 'regulatory-filing', severity: 'info',
    agent: 'regulatory-filer',
    message: 'SEC Form 13F filing due 2026-05-15 — 55 days remaining',
    regulation: 'Securities Exchange Act § 13(f)', status: 'scheduled',
  },
];

export const regulatoryFilings = [
  { type: 'Form 13F', jurisdiction: 'US', frequency: 'quarterly', nextDue: '2026-05-15', status: 'pending' },
  { type: 'MiFIR RTS 25', jurisdiction: 'EU', frequency: 'daily', nextDue: '2026-03-22', status: 'on-track' },
  { type: 'EMIR Refit', jurisdiction: 'EU', frequency: 'T+1', nextDue: '2026-03-22', status: 'on-track' },
  { type: 'Form PF', jurisdiction: 'US', frequency: 'quarterly', nextDue: '2026-04-30', status: 'pending' },
];

// ── Advisory Data (AdvisorLens) ──────────────────────────────────────

export const advisoryProposals = [
  {
    id: 'PROP-001', client: 'CLI-003', advisor: 'suitability-checker',
    recommendation: 'Increase alternatives allocation from 15% to 20%',
    suitability: { riskScore: 78, horizonYears: 15, liquidityNeed: 'low' },
    aiDisclosure: 'This recommendation was generated by AI (Art. 52 EU AI Act). A human advisor has reviewed and approved it.',
    gdprArt22: { automatedDecision: false, humanReview: true, reviewedBy: 'Sarah Chen, CFA' },
  },
  {
    id: 'PROP-002', client: 'CLI-004', advisor: 'proposal-generator',
    recommendation: 'Transition from active to passive Euro IG, saving 12bps',
    suitability: { riskScore: 55, horizonYears: 7, liquidityNeed: 'moderate' },
    aiDisclosure: 'This analysis was produced by AI. Final investment decisions are made by qualified human advisors.',
    gdprArt22: { automatedDecision: false, humanReview: true, reviewedBy: 'Marcus Weber, CFA' },
  },
];

// ── Research Data (ResearchNexus) ────────────────────────────────────

export const researchReports = [
  {
    id: 'RSH-001', status: 'published', publishDate: '2026-03-18',
    title: 'US Technology Sector — Q1 2026 Outlook',
    analyst: 'market-analyst', tickers: ['AAPL', 'MSFT', 'GOOGL', 'NVDA'],
    classification: 'INTERNAL', chineseWall: 'published — trading desk may access',
  },
  {
    id: 'RSH-002', status: 'draft', publishDate: null,
    title: 'NVDA Fair Value Update — Post-Earnings Revision',
    analyst: 'fair-value-modeler', tickers: ['NVDA'],
    classification: 'RESTRICTED', chineseWall: 'UNPUBLISHED — trading desk MUST NOT access (Reg FD)',
  },
];

export const esgScores = [
  { symbol: 'AAPL', environmental: 72, social: 68, governance: 85, overall: 75, sfdrArticle: 8 },
  { symbol: 'MSFT', environmental: 78, social: 74, governance: 88, overall: 80, sfdrArticle: 8 },
  { symbol: 'NVDA', environmental: 65, social: 62, governance: 79, overall: 69, sfdrArticle: 6 },
  { symbol: 'JPM', environmental: 55, social: 70, governance: 82, overall: 69, sfdrArticle: 6 },
];

// ── Operations Data (OpsFabric) ──────────────────────────────────────

export const settlements = [
  {
    id: 'STL-001', tradeId: 'TRD-20260321-001', status: 'pending',
    settlementDate: '2026-03-24', regime: 'T+1', csdr: true,
    counterparty: 'Goldman Sachs', amount: 8_024_400, currency: 'USD',
  },
  {
    id: 'STL-002', tradeId: 'TRD-20260321-002', status: 'pending',
    settlementDate: '2026-03-24', regime: 'T+1', csdr: true,
    counterparty: 'Morgan Stanley', amount: 8_101_600, currency: 'USD',
  },
];

export const navCalculations = [
  {
    portfolio: 'PF-US-EQ-001', date: '2026-03-21', nav: 8_512_345_678.42,
    shares: 85_123_456, navPerShare: 100.00, status: 'calculated',
    dualApproval: { calcBy: 'nav-calculator', approvedBy: null, published: false },
  },
  {
    portfolio: 'PF-EU-FI-001', date: '2026-03-21', nav: 4_198_765_432.10,
    shares: 41_987_654, navPerShare: 100.00, status: 'calculated',
    dualApproval: { calcBy: 'nav-calculator', approvedBy: null, published: false },
  },
];

// ── DataStore (like InsureCo pattern) ────────────────────────────────

export class DataStore {
  constructor() {
    this.clients = clients;
    this.portfolios = portfolios;
    this.orders = orders;
    this.trades = trades;
    this.positions = positions;
    this.riskMetrics = riskMetrics;
    this.complianceAlerts = complianceAlerts;
    this.regulatoryFilings = regulatoryFilings;
    this.advisoryProposals = advisoryProposals;
    this.researchReports = researchReports;
    this.esgScores = esgScores;
    this.settlements = settlements;
    this.navCalculations = navCalculations;
  }

  getClient(id) { return this.clients.find(c => c.id === id); }
  getPortfolio(id) { return this.portfolios.find(p => p.id === id); }
  getOrder(id) { return this.orders.find(o => o.id === id); }
  getPositions(portfolioId) { return this.positions.filter(p => p.portfolio === portfolioId); }
  getRisk(portfolioId) { return this.riskMetrics[portfolioId]; }
  getResearch(id) { return this.researchReports.find(r => r.id === id); }
}

// ── CLI: print summary ───────────────────────────────────────────────

if (process.argv[1]?.endsWith('seed.js')) {
  console.log('\nAssetCo Sample Data Summary\n');
  console.log(`  Clients:              ${clients.length}`);
  console.log(`  Portfolios:           ${portfolios.length} ($${(portfolios.reduce((s, p) => s + p.aum, 0) / 1e9).toFixed(1)}B AUM)`);
  console.log(`  Orders:               ${orders.length}`);
  console.log(`  Trades:               ${trades.length}`);
  console.log(`  Positions:            ${positions.length}`);
  console.log(`  Compliance Alerts:    ${complianceAlerts.length}`);
  console.log(`  Regulatory Filings:   ${regulatoryFilings.length}`);
  console.log(`  Advisory Proposals:   ${advisoryProposals.length}`);
  console.log(`  Research Reports:     ${researchReports.length} (${researchReports.filter(r => r.status === 'draft').length} unpublished — Chinese wall)`);
  console.log(`  ESG Scores:           ${esgScores.length}`);
  console.log(`  Settlements:          ${settlements.length}`);
  console.log(`  NAV Calculations:     ${navCalculations.length}`);
  console.log();
}

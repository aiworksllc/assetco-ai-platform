/**
 * LLM Configuration — AssetCo AI Platform
 *
 * AssetCo agents use Groq as their LLM provider for low-latency inference.
 * Sentinel-Ops (the governance layer) uses AWS Bedrock natively.
 *
 * This configuration is consumed by agent runtimes to route LLM calls
 * to the correct provider with appropriate model selection per use case.
 */

const LLM_PROVIDERS = {
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    models: {
      // Primary model for agent reasoning and analysis
      primary: 'llama-3.3-70b-versatile',
      // Fast model for structured output, classification, routing
      fast: 'llama-3.1-8b-instant',
      // Tool-use optimized model
      toolUse: 'llama-3.3-70b-versatile',
    },
    rateLimits: {
      requestsPerMinute: 30,
      tokensPerMinute: 15000,
    },
  },
  bedrock: {
    name: 'AWS Bedrock',
    region: 'us-east-1',
    envKey: 'AWS_REGION',
    models: {
      primary: 'anthropic.claude-sonnet-4-6-20250514',
      fast: 'anthropic.claude-haiku-4-5-20251001',
    },
  },
};

// ── Application → Provider Mapping ───────────────────────────────────────

const APP_LLM_CONFIG = {
  // AssetCo application agents use Groq
  'alpha-engine':      { provider: 'groq', model: 'primary', description: 'Portfolio optimization reasoning' },
  'trade-sentinel':    { provider: 'groq', model: 'primary', description: 'Trade execution monitoring' },
  'risk-compass':      { provider: 'groq', model: 'primary', description: 'Risk analytics and computation' },
  'compliance-shield': { provider: 'groq', model: 'primary', description: 'Regulatory compliance monitoring' },
  'advisor-lens':      { provider: 'groq', model: 'primary', description: 'Client advisory with Art.52 disclosure' },
  'research-nexus':    { provider: 'groq', model: 'primary', description: 'Research analysis and ESG scoring' },
  'ops-fabric':        { provider: 'groq', model: 'fast',    description: 'Settlement and reconciliation (latency-sensitive)' },

  // Sentinel-Ops governance agents use Bedrock natively
  'sentinel-ops':      { provider: 'bedrock', model: 'primary', description: 'SOE governance — gate evaluation' },
};

// ── Agent-Specific LLM Config ────────────────────────────────────────────

const AGENT_LLM_CONFIG = {
  // RiskCompass agents
  'var-calculator':    { app: 'risk-compass', model: 'primary', maxTokens: 4096, temperature: 0.1 },
  'stress-tester':     { app: 'risk-compass', model: 'primary', maxTokens: 4096, temperature: 0.1 },
  'exposure-monitor':  { app: 'risk-compass', model: 'primary', maxTokens: 8192, temperature: 0.1 },
  'limit-enforcer':    { app: 'risk-compass', model: 'fast',    maxTokens: 2048, temperature: 0.0 },

  // TradeSentinel agents
  'order-router':      { app: 'trade-sentinel', model: 'fast',    maxTokens: 2048, temperature: 0.0 },
  'execution-monitor': { app: 'trade-sentinel', model: 'primary', maxTokens: 4096, temperature: 0.1 },
  'tca-analyzer':      { app: 'trade-sentinel', model: 'primary', maxTokens: 8192, temperature: 0.2 },

  // AlphaEngine agents
  'portfolio-optimizer':  { app: 'alpha-engine', model: 'primary', maxTokens: 8192, temperature: 0.2 },
  'rebalancer':           { app: 'alpha-engine', model: 'fast',    maxTokens: 4096, temperature: 0.0 },
  'allocation-advisor':   { app: 'alpha-engine', model: 'primary', maxTokens: 4096, temperature: 0.3 },
  'factor-analyst':       { app: 'alpha-engine', model: 'primary', maxTokens: 8192, temperature: 0.2 },

  // ComplianceShield agents
  'trade-surveiller':     { app: 'compliance-shield', model: 'primary', maxTokens: 4096, temperature: 0.1 },
  'position-reporter':    { app: 'compliance-shield', model: 'fast',    maxTokens: 2048, temperature: 0.0 },
  'breach-detector':      { app: 'compliance-shield', model: 'primary', maxTokens: 4096, temperature: 0.1 },
  'regulatory-filer':     { app: 'compliance-shield', model: 'fast',    maxTokens: 2048, temperature: 0.0 },

  // AdvisorLens agents
  'suitability-checker':  { app: 'advisor-lens', model: 'primary', maxTokens: 4096, temperature: 0.1 },
  'proposal-generator':   { app: 'advisor-lens', model: 'primary', maxTokens: 8192, temperature: 0.3 },
  'client-reporter':      { app: 'advisor-lens', model: 'fast',    maxTokens: 4096, temperature: 0.1 },

  // ResearchNexus agents
  'market-analyst':       { app: 'research-nexus', model: 'primary', maxTokens: 8192, temperature: 0.3 },
  'esg-scorer':           { app: 'research-nexus', model: 'primary', maxTokens: 4096, temperature: 0.1 },
  'sentiment-analyzer':   { app: 'research-nexus', model: 'primary', maxTokens: 4096, temperature: 0.2 },
  'fair-value-modeler':   { app: 'research-nexus', model: 'primary', maxTokens: 8192, temperature: 0.1 },

  // OpsFabric agents
  'settlement-processor': { app: 'ops-fabric', model: 'fast', maxTokens: 2048, temperature: 0.0 },
  'reconciler':           { app: 'ops-fabric', model: 'fast', maxTokens: 2048, temperature: 0.0 },
  'nav-calculator':       { app: 'ops-fabric', model: 'fast', maxTokens: 2048, temperature: 0.0 },
};

// ── Resolver ─────────────────────────────────────────────────────────────

function resolveAgentLLM(agentId) {
  const agentConfig = AGENT_LLM_CONFIG[agentId];
  if (!agentConfig) {
    throw new Error(`Unknown agent: ${agentId}. Known agents: ${Object.keys(AGENT_LLM_CONFIG).join(', ')}`);
  }
  const appConfig = APP_LLM_CONFIG[agentConfig.app];
  const provider = LLM_PROVIDERS[appConfig.provider];
  const modelId = provider.models[agentConfig.model];

  return {
    agentId,
    application: agentConfig.app,
    provider: appConfig.provider,
    providerName: provider.name,
    modelId,
    maxTokens: agentConfig.maxTokens,
    temperature: agentConfig.temperature,
    baseUrl: provider.baseUrl || null,
    envKey: provider.envKey,
  };
}

function listAgents() {
  return Object.keys(AGENT_LLM_CONFIG);
}

export {
  LLM_PROVIDERS,
  APP_LLM_CONFIG,
  AGENT_LLM_CONFIG,
  resolveAgentLLM,
  listAgents,
};

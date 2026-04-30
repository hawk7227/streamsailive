📋 COMPLETE BUILD PLAN & ORDER
StreamsAI Repository Operator System Version 1.0 - Production Ready OpenAI Primary (All Models), Claude Haiku 4.5 Optional
________________________________________
TABLE OF CONTENTS
1.	Plan Analysis
2.	Build Requirements
3.	Proven Technologies
4.	AI Model Strategy
5.	Frontend Model Selection
6.	Backend Model Routing
7.	Build Order
8.	Phase Details
9.	Build Checklist
10.	Summary
________________________________________
PLAN ANALYSIS
What Exists Today (StreamsAI)
✅ Next.js 16.1.4 app (local)
✅ Supabase backend (database)
✅ DigitalOcean (production)
✅ Vercel (staging)
✅ GitHub (code repo)
✅ GitHub Actions (CI/CD)
✅ scripts/audit.py (33KB)
✅ BUILD_RULES.md & FRONTEND_BUILD_RULES.md
✅ Vitest (13 test files)
✅ Playwright (1 E2E test file)
Complete Design Stack
LAYER 1-4: AI Prevention ✅ (Approved, no changes)
•	Deception Prevention, Quality Gates, Token Cost, User-Driven Scope
LAYER 5-9: Testing ✅ (Approved, no changes)
•	Playwright, Percy, axe-core, Responsive, Performance
LAYER 5.5: Real-Time Visual Preview ✅ (Designed, needs implementation)
•	Planning mode (HTML mockup)
•	Building mode (live app preview)
•	AI watching user interactions
•	WebSocket event stream
LAYER 5.6: Repository Operator ✅ (Designed, needs implementation)
•	Supabase schema
•	GitHub Actions workflow
•	Job orchestrator
•	Chat integration
•	NEW: Model selection in UI
LAYER 5.6B: AI Autonomous Repair Loop ✅ (Designed, needs implementation)
•	GitHub webhook receiver
•	AI decision engine (Model-agnostic routing)
•	Autonomous retry loop
•	Failure analyzer
•	Chat reactor
LAYER 10: CI/CD ✅ (Approved, no changes)
•	GitHub Actions deployment
What Actually Needs to Be Built
Key Difference: Model Selection System
PREVIOUS APPROACH (❌ WRONG):
- Model hardcoded in backend
- No UI selection
- Can't change models
- Can't compare model performance

NEW APPROACH (✅ CORRECT):
- Model selection dropdown in chat UI
- Backend reads model from request
- Actual model changes per job
- Different models for different repairs
- Analytics per model
- Cost comparison
________________________________________
BUILD REQUIREMENTS
Database Schema Update
NEEDED CHANGES TO repair_jobs TABLE:
├─ ai_provider ('openai' | 'claude')
├─ ai_model (exact model string, NOT hardcoded)
│  ├─ 'gpt-4'
│  ├─ 'gpt-4-turbo'
│  ├─ 'gpt-3.5-turbo'
│  ├─ 'claude-3-haiku-20240307'
│  └─ Future models can be added
├─ ai_model_used (tracks what was actually used)
├─ ai_model_cost_input (token cost for input)
├─ ai_model_cost_output (token cost for output)
├─ ai_model_tokens_used JSONB
│  ├─ input_tokens
│  ├─ output_tokens
│  └─ total_cost_usd

STATUS: ❌ NOT BUILT - Needs database migration
DELIVERABLE: SQL migration with model fields
Frontend Model Selection UI
NEEDED IN CHAT:
├─ Model dropdown/selector
├─ Shows available models:
│  ├─ GPT-4 (default, recommended)
│  ├─ GPT-4 Turbo (faster, cheaper)
│  ├─ GPT-3.5 Turbo (fastest, cheapest)
│  └─ Claude Haiku 4.5 (fallback only)
├─ Shows model info:
│  ├─ Speed estimate
│  ├─ Cost estimate
│  ├─ Best for (analysis/generation/decision)
│  └─ Available tokens
├─ Selection persists in job record
└─ Can be changed per repair, not globally

STATUS: ❌ NOT BUILT - Needs React component
DELIVERABLE: Model selector component + integration
Backend Model Routing
NEEDED IN BACKEND:
├─ Get model from request (not hardcoded)
├─ Validate model is available
├─ Select appropriate provider based on model:
│  ├─ GPT-4 → OpenAI provider
│  ├─ GPT-4 Turbo → OpenAI provider
│  ├─ GPT-3.5 Turbo → OpenAI provider
│  └─ Claude Haiku → Claude provider
├─ Pass model to each API call
├─ Track model usage
├─ Calculate costs per model
└─ Fall back to Claude Haiku if OpenAI fails

STATUS: ❌ NOT BUILT - Needs backend routing logic
DELIVERABLE: Model router + configuration
________________________________________
AI MODEL STRATEGY
Available Models (Actual Endpoints)
OpenAI Models (Primary)
GPT-4 (RECOMMENDED FOR COMPLEX REPAIRS):
├─ Model: gpt-4
├─ Context: 8K tokens
├─ Speed: ~30-60 seconds for complex analysis
├─ Input cost: $0.03 / 1K tokens
├─ Output cost: $0.06 / 1K tokens
├─ Best for: Complex reasoning, bug analysis, architecture decisions
├─ When to use: Critical repairs, architectural changes
└─ Example repair: 5-10K tokens = ~$0.30-0.60 per repair

GPT-4 TURBO (RECOMMENDED FOR MOST REPAIRS):
├─ Model: gpt-4-turbo-preview or gpt-4-turbo-2024-04-09
├─ Context: 128K tokens
├─ Speed: ~10-20 seconds for analysis
├─ Input cost: $0.01 / 1K tokens (3.3x cheaper)
├─ Output cost: $0.03 / 1K tokens (2x cheaper)
├─ Best for: Fast repairs, code generation, large context
├─ When to use: Most repairs, streaming large logs
└─ Example repair: 5-10K tokens = ~$0.10-0.20 per repair (BEST VALUE)

GPT-3.5 TURBO (FALLBACK IF COST CRITICAL):
├─ Model: gpt-3.5-turbo or gpt-3.5-turbo-16k
├─ Context: 16K tokens
├─ Speed: ~5-10 seconds
├─ Input cost: $0.0005 / 1K tokens
├─ Output cost: $0.0015 / 1K tokens
├─ Best for: Simple fixes, formatting, quick decisions
├─ When to use: Budget-constrained, simple repairs
└─ Example repair: 5-10K tokens = ~$0.01-0.02 per repair (CHEAPEST)
Claude Model (Fallback Only)
CLAUDE 3 HAIKU 4.5 (OPTIONAL FALLBACK ONLY):
├─ Model: claude-3-haiku-20240307
├─ Context: 200K tokens
├─ Speed: ~15-30 seconds
├─ Input cost: $0.00025 / 1K tokens (CHEAPEST overall)
├─ Output cost: $0.00125 / 1K tokens
├─ Best for: Fallback when OpenAI unavailable
├─ When to use: Only if OpenAI fails
├─ Limitation: Weaker reasoning than GPT-4
└─ Example repair: 5-10K tokens = ~$0.005 per repair

WHEN CLAUDE IS USED:
1. User selects OpenAI model (GPT-4, 4-Turbo, or 3.5-Turbo)
2. Primary API call to OpenAI
3. If OpenAI fails: Automatically fallback to Claude Haiku
4. Log both attempts in database
5. Complete repair with Claude (transparently to user, with notification)
Cost Comparison (Per Repair)
EXAMPLE: 8K input tokens, 2K output tokens

GPT-4:
├─ Input: 8 × $0.03 = $0.24
├─ Output: 2 × $0.06 = $0.12
└─ Total: $0.36 (BEST QUALITY)

GPT-4 TURBO:
├─ Input: 8 × $0.01 = $0.08
├─ Output: 2 × $0.03 = $0.06
└─ Total: $0.14 (BEST VALUE)

GPT-3.5 TURBO:
├─ Input: 8 × $0.0005 = $0.004
├─ Output: 2 × $0.0015 = $0.003
└─ Total: $0.007 (CHEAPEST)

CLAUDE HAIKU (Fallback):
├─ Input: 8 × $0.00025 = $0.002
├─ Output: 2 × $0.00125 = $0.0025
└─ Total: $0.0045 (FALLBACK COST)

RECOMMENDATION:
✅ Default to GPT-4-Turbo (best value/performance)
✅ Allow GPT-4 for complex repairs
✅ Allow GPT-3.5-Turbo for budget repairs
⭕ Claude Haiku only as fallback
________________________________________
FRONTEND MODEL SELECTION
UI Component: Model Selector
File: components/ModelSelector.tsx
// ============================================================================
// MODEL SELECTOR
// Dropdown in repair flow to select which AI model to use
// Actually wired to backend - not hardcoded
// ============================================================================

import React, { useState } from 'react';

export interface ModelOption {
  id: 'gpt-4' | 'gpt-4-turbo' | 'gpt-3.5-turbo' | 'claude-3-haiku';
  name: string;
  provider: 'openai' | 'claude';
  description: string;
  speed: 'slow' | 'medium' | 'fast';
  costLevel: 'expensive' | 'moderate' | 'cheap';
  costPerKTokens: {
    input: number;
    output: number;
  };
  bestFor: string;
  contextWindow: number;
  recommended: boolean;
  fallbackOnly: boolean;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gpt-4',
    name: 'GPT-4',
    provider: 'openai',
    description: 'Most capable, best for complex reasoning',
    speed: 'slow',
    costLevel: 'expensive',
    costPerKTokens: { input: 0.03, output: 0.06 },
    bestFor: 'Complex bug analysis, architectural decisions',
    contextWindow: 8192,
    recommended: false,
    fallbackOnly: false,
  },
  {
    id: 'gpt-4-turbo',
    name: 'GPT-4 Turbo',
    provider: 'openai',
    description: 'Fast and capable, best value for most repairs',
    speed: 'medium',
    costLevel: 'moderate',
    costPerKTokens: { input: 0.01, output: 0.03 },
    bestFor: 'Most repairs, code generation, large logs',
    contextWindow: 131072,
    recommended: true,
    fallbackOnly: false,
  },
  {
    id: 'gpt-3.5-turbo',
    name: 'GPT-3.5 Turbo',
    provider: 'openai',
    description: 'Fastest and cheapest',
    speed: 'fast',
    costLevel: 'cheap',
    costPerKTokens: { input: 0.0005, output: 0.0015 },
    bestFor: 'Simple fixes, formatting, quick decisions',
    contextWindow: 16384,
    recommended: false,
    fallbackOnly: false,
  },
  {
    id: 'claude-3-haiku',
    name: 'Claude 3 Haiku',
    provider: 'claude',
    description: 'Fallback only if OpenAI unavailable',
    speed: 'medium',
    costLevel: 'cheap',
    costPerKTokens: { input: 0.00025, output: 0.00125 },
    bestFor: 'Fallback when OpenAI fails',
    contextWindow: 200000,
    recommended: false,
    fallbackOnly: true,
  },
];

interface ModelSelectorProps {
  selectedModel: string;
  onChange: (modelId: string) => void;
  disabled?: boolean;
  showCosts?: boolean;
}

export function ModelSelector({
  selectedModel,
  onChange,
  disabled = false,
  showCosts = true,
}: ModelSelectorProps) {
  const [showDetails, setShowDetails] = useState(false);

  const activeModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel);

  return (
    <div className="model-selector">
      {/* DROPDOWN */}
      <div className="selector-header">
        <label htmlFor="model-select">
          AI Model:
          {activeModel?.recommended && (
            <span className="badge recommended">Recommended</span>
          )}
          {activeModel?.fallbackOnly && (
            <span className="badge fallback-only">Fallback Only</span>
          )}
        </label>

        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="model-dropdown"
        >
          <optgroup label="OpenAI (Primary)">
            {AVAILABLE_MODELS.filter((m) => m.provider === 'openai' && !m.fallbackOnly).map(
              (model) => (
                <option key={model.id} value={model.id}>
                  {model.name} - {model.description}
                </option>
              )
            )}
          </optgroup>

          <optgroup label="Claude (Fallback Only)">
            {AVAILABLE_MODELS.filter((m) => m.fallbackOnly).map((model) => (
              <option key={model.id} value={model.id}>
                {model.name} - {model.description}
              </option>
            ))}
          </optgroup>
        </select>
      </div>

      {/* MODEL INFO */}
      {activeModel && (
        <div className="model-info">
          <div className="info-row">
            <span className="label">Speed:</span>
            <span className={`value speed-${activeModel.speed}`}>
              {activeModel.speed === 'fast' && '⚡ Fast (5-10s)'}
              {activeModel.speed === 'medium' && '🔄 Medium (10-30s)'}
              {activeModel.speed === 'slow' && '🐢 Slow (30-60s)'}
            </span>
          </div>

          {showCosts && (
            <>
              <div className="info-row">
                <span className="label">Cost per 1K tokens:</span>
                <span className={`value cost-${activeModel.costLevel}`}>
                  ${activeModel.costPerKTokens.input} input /
                  ${activeModel.costPerKTokens.output} output
                </span>
              </div>

              <div className="info-row">
                <span className="label">Est. cost per repair:</span>
                <span className="value estimate">
                  ~$
                  {(
                    (8 * activeModel.costPerKTokens.input +
                      2 * activeModel.costPerKTokens.output) /
                    1000
                  ).toFixed(4)}{' '}
                  (8K in, 2K out)
                </span>
              </div>
            </>
          )}

          <div className="info-row">
            <span className="label">Best for:</span>
            <span className="value">{activeModel.bestFor}</span>
          </div>

          <div className="info-row">
            <span className="label">Context window:</span>
            <span className="value">
              {activeModel.contextWindow.toLocaleString()} tokens
            </span>
          </div>
        </div>
      )}

      {/* DETAILS TOGGLE */}
      <button
        className="details-toggle"
        onClick={() => setShowDetails(!showDetails)}
        type="button"
      >
        {showDetails ? 'Hide' : 'Show'} All Models
      </button>

      {/* DETAILED COMPARISON */}
      {showDetails && (
        <div className="models-comparison">
          <table>
            <thead>
              <tr>
                <th>Model</th>
                <th>Provider</th>
                <th>Speed</th>
                <th>Cost (input/output)</th>
                <th>Context</th>
                <th>Best For</th>
              </tr>
            </thead>
            <tbody>
              {AVAILABLE_MODELS.map((model) => (
                <tr
                  key={model.id}
                  className={`model-row ${
                    model.id === selectedModel ? 'selected' : ''
                  } ${model.fallbackOnly ? 'fallback-only' : ''}`}
                  onClick={() => onChange(model.id)}
                >
                  <td className="name">
                    {model.name}
                    {model.recommended && ' ⭐'}
                  </td>
                  <td>{model.provider.toUpperCase()}</td>
                  <td>{model.speed}</td>
                  <td>
                    ${model.costPerKTokens.input} / $
                    {model.costPerKTokens.output}
                  </td>
                  <td>{(model.contextWindow / 1024).toFixed(0)}K</td>
                  <td>{model.bestFor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* CSS */}
      <style jsx>{`
        .model-selector {
          padding: 16px;
          background: #f9f9f9;
          border-radius: 8px;
          margin-bottom: 16px;
        }

        .selector-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .selector-header label {
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .badge {
          font-size: 12px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: bold;
          margin-left: 8px;
        }

        .badge.recommended {
          background: #d4edda;
          color: #155724;
        }

        .badge.fallback-only {
          background: #fff3cd;
          color: #856404;
        }

        .model-dropdown {
          flex: 1;
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
          cursor: pointer;
        }

        .model-dropdown:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .model-info {
          background: white;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 12px;
          border: 1px solid #eee;
        }

        .info-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          border-bottom: 1px solid #f0f0f0;
        }

        .info-row:last-child {
          border-bottom: none;
        }

        .info-row .label {
          font-weight: 600;
          color: #666;
        }

        .info-row .value {
          color: #333;
        }

        .value.speed-fast {
          color: #28a745;
        }

        .value.speed-medium {
          color: #ffc107;
        }

        .value.speed-slow {
          color: #dc3545;
        }

        .value.cost-cheap {
          color: #28a745;
        }

        .value.cost-moderate {
          color: #ffc107;
        }

        .value.cost-expensive {
          color: #dc3545;
        }

        .value.estimate {
          font-weight: 600;
          font-size: 15px;
        }

        .details-toggle {
          width: 100%;
          padding: 8px;
          background: #e8f4f8;
          border: 1px solid #b3d9e8;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          color: #0066cc;
        }

        .details-toggle:hover {
          background: #d0e8f2;
        }

        .models-comparison {
          margin-top: 12px;
          overflow-x: auto;
        }

        .models-comparison table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }

        .models-comparison th,
        .models-comparison td {
          padding: 8px;
          text-align: left;
          border-bottom: 1px solid #eee;
        }

        .models-comparison th {
          background: #f5f5f5;
          font-weight: 600;
          color: #333;
        }

        .model-row {
          cursor: pointer;
          transition: background 0.2s;
        }

        .model-row:hover {
          background: #f9f9f9;
        }

        .model-row.selected {
          background: #e8f4f8;
          font-weight: 600;
        }

        .model-row.fallback-only {
          opacity: 0.7;
          font-style: italic;
        }

        .model-row .name {
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}

export default ModelSelector;
Integration in Chat Repair Flow
File: components/ChatRepairFlow.tsx (Updated)
// ============================================================================
// CHAT REPAIR FLOW (UPDATED)
// Now includes model selection - ACTUALLY WIRED to backend
// ============================================================================

import React, { useState } from 'react';
import { ModelSelector, AVAILABLE_MODELS } from './ModelSelector';
import { UnifiedRepairPreview } from './UnifiedRepairPreview';

interface ChatRepairFlowProps {
  userId: string;
  analysis: string;
  repairPlan: any;
}

export function ChatRepairFlow({
  userId,
  analysis,
  repairPlan,
}: ChatRepairFlowProps) {
  // =========================================================================
  // STATE: Model selection
  // =========================================================================
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4-turbo');
  const [jobId, setJobId] = useState<string>();
  const [phase, setPhase] = useState
    'planning' | 'executing' | 'results' | 'complete'
  >('planning');

  // =========================================================================
  // APPROVE PLAN: Send selected model to backend
  // =========================================================================
  const handleApprovePlan = async () => {
    console.log(`✅ Plan approved with model: ${selectedModel}`);

    // CRITICAL: Send selected model to backend
    const response = await fetch('/api/repair/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        plan: repairPlan,
        aiProvider: 'openai', // Always primary
        aiModel: selectedModel, // ← MODEL SELECTION SENT HERE
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create repair job');
    }

    const { jobId: newJobId } = await response.json();
    setJobId(newJobId);

    // Approve plan
    await fetch('/api/repair/approve-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jobId: newJobId,
        userId,
        aiModel: selectedModel, // ← Also send to approve
      }),
    });

    setPhase('executing');
  };

  return (
    <div className="chat-repair-flow">
      {/* PLANNING PHASE: Show model selector */}
      {phase === 'planning' && (
        <div className="planning-section">
          <div className="chat-message ai-message">
            <p>{analysis}</p>
            <h4>Repair Plan:</h4>
            <ul>
              {repairPlan.steps.map((step: any, idx: number) => (
                <li key={idx}>
                  {step.step}. {step.description}
                </li>
              ))}
            </ul>
          </div>

          {/* MODEL SELECTOR: NOT HARDCODED */}
          <ModelSelector
            selectedModel={selectedModel}
            onChange={setSelectedModel}
            showCosts={true}
          />

          {/* APPROVAL BUTTONS */}
          <div className="action-buttons">
            <button
              className="btn btn-primary"
              onClick={handleApprovePlan}
              title="Start repair with selected model"
            >
              ✅ APPROVE PLAN & START REPAIR
            </button>
            <button className="btn btn-secondary">❌ REJECT & MODIFY</button>
          </div>
        </div>
      )}

      {/* EXECUTING PHASE */}
      {phase === 'executing' && jobId && (
        <UnifiedRepairPreview
          jobId={jobId}
          phase={phase}
          livePreviewUrl="http://localhost:3000"
          currentAttempt={1}
          maxAttempts={5}
          selectedModel={selectedModel}
          onApprove={() => setPhase('results')}
        />
      )}

      {/* RESULTS PHASE */}
      {(phase === 'results' || phase === 'complete') && jobId && (
        <UnifiedRepairPreview
          jobId={jobId}
          phase={phase}
          livePreviewUrl="http://localhost:3000"
          currentAttempt={1}
          maxAttempts={5}
          selectedModel={selectedModel}
          onApprove={() => setPhase('complete')}
        />
      )}
    </div>
  );
}

export default ChatRepairFlow;
________________________________________
BACKEND MODEL ROUTING
File: lib/ai-model-router.ts (NEW)
// ============================================================================
// AI MODEL ROUTER
// Routes requests to correct model based on user selection
// NOT HARDCODED - receives model from request
// ============================================================================

export type AIModel =
  | 'gpt-4'
  | 'gpt-4-turbo'
  | 'gpt-3.5-turbo'
  | 'claude-3-haiku';

export interface ModelConfig {
  model: AIModel;
  provider: 'openai' | 'claude';
  maxTokens: number;
  temperature: number;
  costPerInputKTokens: number;
  costPerOutputKTokens: number;
}

// ============================================================================
// MODEL CONFIGURATIONS (Actual API values)
// ============================================================================

export const MODEL_CONFIGS: Record<AIModel, ModelConfig> = {
  'gpt-4': {
    model: 'gpt-4',
    provider: 'openai',
    maxTokens: 2000,
    temperature: 0.7,
    costPerInputKTokens: 0.03,
    costPerOutputKTokens: 0.06,
  },

  'gpt-4-turbo': {
    model: 'gpt-4-turbo-preview', // Actual model string for API
    provider: 'openai',
    maxTokens: 4000,
    temperature: 0.7,
    costPerInputKTokens: 0.01,
    costPerOutputKTokens: 0.03,
  },

  'gpt-3.5-turbo': {
    model: 'gpt-3.5-turbo-16k', // Actual model string for API
    provider: 'openai',
    maxTokens: 4000,
    temperature: 0.7,
    costPerInputKTokens: 0.0005,
    costPerOutputKTokens: 0.0015,
  },

  'claude-3-haiku': {
    model: 'claude-3-haiku-20240307', // Actual model string for API
    provider: 'claude',
    maxTokens: 2000,
    temperature: 0.7,
    costPerInputKTokens: 0.00025,
    costPerOutputKTokens: 0.00125,
  },
};

// ============================================================================
// VALIDATE MODEL
// ============================================================================

export function validateModel(model: string): AIModel {
  const validModels = Object.keys(MODEL_CONFIGS) as AIModel[];

  if (!validModels.includes(model as AIModel)) {
    console.warn(`Invalid model "${model}", defaulting to gpt-4-turbo`);
    return 'gpt-4-turbo'; // Default fallback
  }

  return model as AIModel;
}

// ============================================================================
// GET MODEL CONFIG
// ============================================================================

export function getModelConfig(model: AIModel): ModelConfig {
  return MODEL_CONFIGS[model];
}

// ============================================================================
// ROUTE TO CORRECT PROVIDER
// ============================================================================

export async function routeToProvider(
  model: AIModel,
  operation: 'analyze' | 'generate' | 'decide',
  input: any
): Promise<{
  response: any;
  modelUsed: AIModel;
  provider: 'openai' | 'claude';
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  costUsd: number;
}> {
  const config = getModelConfig(model);

  console.log(`📍 Routing ${operation} to ${config.provider} (${model})`);

  try {
    if (config.provider === 'openai') {
      return await callOpenAI(model, config, operation, input);
    } else if (config.provider === 'claude') {
      return await callClaude(model, config, operation, input);
    }
  } catch (error) {
    console.error(`❌ ${config.provider} failed:`, error);

    // FALLBACK: If OpenAI fails and we're not already using Claude, try Claude
    if (config.provider === 'openai' && process.env.ANTHROPIC_API_KEY) {
      console.log(`📍 Fallback: Routing to Claude Haiku`);
      return await callClaude(
        'claude-3-haiku',
        MODEL_CONFIGS['claude-3-haiku'],
        operation,
        input
      );
    }

    throw error;
  }

  throw new Error(`Unknown provider for model ${model}`);
}

// ============================================================================
// CALL OPENAI (ACTUAL IMPLEMENTATION)
// ============================================================================

async function callOpenAI(
  model: AIModel,
  config: ModelConfig,
  operation: 'analyze' | 'generate' | 'decide',
  input: any
): Promise<{
  response: any;
  modelUsed: AIModel;
  provider: 'openai' | 'claude';
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  costUsd: number;
}> {
  const OpenAI = require('openai').default;
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  let systemPrompt = '';
  let userMessage = '';

  // Build prompts based on operation
  if (operation === 'analyze') {
    systemPrompt = `Analyze build failure logs. Return only JSON.`;
    userMessage = `${input.logs}`;
  } else if (operation === 'generate') {
    systemPrompt = `Generate code fixes. Return only code in FILE: ... END_FILE format.`;
    userMessage = `Fix these issues: ${JSON.stringify(input.failures)}`;
  } else if (operation === 'decide') {
    systemPrompt = `Make repair decision. Return only JSON.`;
    userMessage = `Results: ${JSON.stringify(input.results)}`;
  }

  const response = await openai.chat.completions.create({
    model: config.model, // ← USE SELECTED MODEL
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    temperature: config.temperature,
    max_tokens: config.maxTokens,
  });

  // Extract response and tokens
  const content = response.choices[0].message.content || '';
  const usage = response.usage;

  const costUsd =
    (usage.prompt_tokens / 1000) * config.costPerInputKTokens +
    (usage.completion_tokens / 1000) * config.costPerOutputKTokens;

  return {
    response: content,
    modelUsed: model,
    provider: 'openai',
    tokensUsed: {
      input: usage.prompt_tokens,
      output: usage.completion_tokens,
      total: usage.total_tokens,
    },
    costUsd,
  };
}

// ============================================================================
// CALL CLAUDE (ACTUAL IMPLEMENTATION)
// ============================================================================

async function callClaude(
  model: AIModel,
  config: ModelConfig,
  operation: 'analyze' | 'generate' | 'decide',
  input: any
): Promise<{
  response: any;
  modelUsed: AIModel;
  provider: 'openai' | 'claude';
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  costUsd: number;
}> {
  const Anthropic = require('@anthropic-ai/sdk').default;
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  let userMessage = '';

  // Build message based on operation
  if (operation === 'analyze') {
    userMessage = `Analyze these logs (return JSON only): ${input.logs}`;
  } else if (operation === 'generate') {
    userMessage = `Generate fixes (return FILE: ... END_FILE format): ${JSON.stringify(input.failures)}`;
  } else if (operation === 'decide') {
    userMessage = `Make decision (return JSON only): ${JSON.stringify(input.results)}`;
  }

  const response = await anthropic.messages.create({
    model: config.model, // ← USE SELECTED MODEL
    max_tokens: config.maxTokens,
    messages: [{ role: 'user', content: userMessage }],
  });

  // Extract response and tokens
  const content =
    response.content[0].type === 'text' ? response.content[0].text : '';
  const usage = response.usage;

  const costUsd =
    (usage.input_tokens / 1000) * config.costPerInputKTokens +
    (usage.output_tokens / 1000) * config.costPerOutputKTokens;

  return {
    response: content,
    modelUsed: model,
    provider: 'claude',
    tokensUsed: {
      input: usage.input_tokens,
      output: usage.output_tokens,
      total: usage.input_tokens + usage.output_tokens,
    },
    costUsd,
  };
}

export default {
  validateModel,
  getModelConfig,
  routeToProvider,
  MODEL_CONFIGS,
};
Updated Decision Engine to Use Model Router
File: lib/ai-repair-decision-engine.ts (Updated)
// ============================================================================
// AI REPAIR DECISION ENGINE (UPDATED)
// Now uses model router instead of hardcoded providers
// ============================================================================

import { routeToProvider, validateModel, AIModel } from './ai-model-router';

export interface DecisionInput {
  jobId: string;
  job: any;
  workflowRunId: number;
  conclusion: string;
  attemptNumber: number;
  aiModel: AIModel; // ← NEW: Model from request
}

/**
 * Main decision engine using model router
 */
export async function aiRepairDecisionEngine(
  input: DecisionInput
): Promise<{
  action: 'success' | 'retry' | 'needs_user_input' | 'error';
  reason: string;
  generatedCode?: string;
  filesToUpdate?: Record<string, string>;
  confidence: number;
  modelUsed: AIModel;
  provider: 'openai' | 'claude';
  tokensUsed: {
    input: number;
    output: number;
    total: number;
  };
  costUsd: number;
}> {
  console.log(`🤖 AI Decision Engine: Job ${input.jobId}`);
  console.log(`   Model: ${input.aiModel}`);
  console.log(`   Attempt: ${input.attemptNumber}`);

  // VALIDATE MODEL (never hardcoded)
  const validModel = validateModel(input.aiModel);

  // Parse job results
  const jobResults = parseJobResults(input.job);

  console.log(`📊 Results: Audit=${jobResults.audit.passed ? 'PASS' : 'FAIL'}, Tests=${jobResults.tests.passed}/${jobResults.tests.total}, Build=${jobResults.build.success ? 'OK' : 'FAIL'}`);

  // Check success
  if (
    jobResults.audit.passed &&
    jobResults.tests.failed === 0 &&
    jobResults.build.success
  ) {
    return {
      action: 'success',
      reason: 'All checks passed',
      confidence: 1.0,
      modelUsed: validModel,
      provider: 'openai',
      tokensUsed: { input: 0, output: 0, total: 0 },
      costUsd: 0,
    };
  }

  // Check max attempts
  if (input.attemptNumber >= 5) {
    return {
      action: 'needs_user_input',
      reason: 'Max attempts reached',
      confidence: 0.8,
      modelUsed: validModel,
      provider: 'openai',
      tokensUsed: { input: 0, output: 0, total: 0 },
      costUsd: 0,
    };
  }

  // USE MODEL ROUTER (not hardcoded)
  try {
    const analysisResult = await routeToProvider(
      validModel,
      'analyze',
      { logs: generateLogsText(jobResults) }
    );

    const failureAnalysis = parseAnalysisResponse(analysisResult.response);

    if (!failureAnalysis.fixable) {
      return {
        action: 'needs_user_input',
        reason: 'Failures not fixable automatically',
        confidence: 0.4,
        modelUsed: analysisResult.modelUsed,
        provider: analysisResult.provider,
        tokensUsed: analysisResult.tokensUsed,
        costUsd: analysisResult.costUsd,
      };
    }

    // Generate fixes using the same model
    const fixResult = await routeToProvider(validModel, 'generate', {
      failures: failureAnalysis.issues,
    });

    const fixes = parseFixResponse(fixResult.response);

    return {
      action: 'retry',
      reason: `Fixing ${failureAnalysis.issues.length} issues`,
      generatedCode: Object.values(fixes)[0] || '',
      filesToUpdate: fixes,
      confidence: 0.75,
      modelUsed: fixResult.modelUsed,
      provider: fixResult.provider,
      tokensUsed: {
        input: analysisResult.tokensUsed.input + fixResult.tokensUsed.input,
        output: analysisResult.tokensUsed.output + fixResult.tokensUsed.output,
        total:
          analysisResult.tokensUsed.total + fixResult.tokensUsed.total,
      },
      costUsd: analysisResult.costUsd + fixResult.costUsd,
    };
  } catch (error) {
    console.error(`❌ Error:`, error);
    return {
      action: 'error',
      reason: `${error}`,
      confidence: 0.2,
      modelUsed: validModel,
      provider: 'openai',
      tokensUsed: { input: 0, output: 0, total: 0 },
      costUsd: 0,
    };
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function parseJobResults(job: any) {
  const logsJson = job.logs_json || {};
  const auditResults = job.audit_results || {};
  const testResults = job.test_results || {};
  const buildResults = job.build_results || {};

  return {
    audit: {
      passed: auditResults.passed === true,
      violations: auditResults.violations || 0,
      details: auditResults.details || [],
    },
    tests: {
      passed: testResults.passed || 0,
      failed: testResults.failed || 0,
      total: (testResults.passed || 0) + (testResults.failed || 0),
      failures: testResults.failures || [],
      coverage: testResults.coverage || '0%',
    },
    build: {
      success: buildResults.success === true,
      error: buildResults.error,
      warnings: buildResults.warnings || 0,
    },
  };
}

function generateLogsText(jobResults: any): string {
  return `
Audit: ${jobResults.audit.passed ? 'PASSED' : `FAILED (${jobResults.audit.violations} violations)`}
Details: ${JSON.stringify(jobResults.audit.details)}

Tests: ${jobResults.tests.passed}/${jobResults.tests.total} passing
Failures: ${jobResults.tests.failures.join(', ')}

Build: ${jobResults.build.success ? 'SUCCESS' : `FAILED (${jobResults.build.error})`}
`;
}

function parseAnalysisResponse(response: string) {
  try {
    const analysis = JSON.parse(response);
    return {
      issues: analysis.issues || [],
      fixable: analysis.fixable !== false,
      confidence: analysis.confidence || 0.5,
    };
  } catch {
    return {
      issues: [],
      fixable: false,
      confidence: 0.0,
    };
  }
}

function parseFixResponse(response: string): Record<string, string> {
  const files: Record<string, string> = {};
  const fileMatches = response.matchAll(/FILE:\s*(.+?)\n([\s\S]*?)(?=FILE:|$)/g);

  for (const match of fileMatches) {
    const path = match[1].trim();
    const content = match[2].trim();
    if (path && content) {
      files[path] = content;
    }
  }

  return files;
}

export default aiRepairDecisionEngine;
Updated API Endpoints
File: pages/api/repair/create.ts (Updated)
// ============================================================================
// API: Create Repair Job
// NOW accepts aiModel from frontend (not hardcoded)
// ============================================================================

import { NextApiRequest, NextApiResponse } from 'next';
import { validateModel } from '@/lib/ai-model-router';

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId, plan, aiProvider, aiModel } = req.body;

    if (!userId || !plan) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // VALIDATE AND NORMALIZE MODEL
    const normalizedModel = aiModel
      ? validateModel(aiModel)
      : 'gpt-4-turbo'; // Default

    console.log(`📝 Creating job with model: ${normalizedModel}`);

    // Call orchestrator to create job
    const orchestrator = getOrchestrator(); // Your orchestrator instance

    const jobId = await orchestrator.createRepairJob(plan, userId, {
      aiProvider: 'openai', // Always OpenAI primary
      aiModel: normalizedModel, // ← USER-SELECTED MODEL STORED
    });

    return res.status(201).json({
      jobId,
      status: 'planning',
      model: normalizedModel, // Return model for confirmation
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Failed to create repair job' });
  }
}

function getOrchestrator() {
  // Your orchestrator initialization
}
File: pages/api/repair/approve-plan.ts (Updated)
// ============================================================================
// API: Approve Plan
// NOW accepts aiModel and passes to executor
// ============================================================================

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { jobId, userId, aiModel } = req.body;

    if (!jobId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate model
    const normalizedModel = aiModel ? validateModel(aiModel) : 'gpt-4-turbo';

    const orchestrator = getOrchestrator();

    // Approve plan
    await orchestrator.approvePlan(jobId, userId);

    // Execute repair WITH selected model
    await orchestrator.executeRepair(jobId, {
      aiModel: normalizedModel, // ← PASS MODEL TO EXECUTION
    });

    return res.status(200).json({
      status: 'executing',
      model: normalizedModel,
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Failed to approve plan' });
  }
}
Updated Orchestrator to Accept Model
File: lib/repair-orchestrator.ts (Updated Section)
// ============================================================================
// REPAIR ORCHESTRATOR (Updated)
// Now accepts model parameter and stores it
// ============================================================================

export class RepairOrchestrator {
  // ... existing code ...

  async createRepairJob(
    plan: RepairPlan,
    userId: string,
    options: {
      aiProvider: 'openai' | 'claude';
      aiModel: string; // ← NEW: Accept model
    } = { aiProvider: 'openai', aiModel: 'gpt-4-turbo' }
  ): Promise<string> {
    const jobId = uuidv4();

    // STORE SELECTED MODEL (not hardcoded)
    const { data, error } = await this.supabase
      .from('repair_jobs')
      .insert({
        id: jobId,
        created_by: userId,
        title: plan.title,
        description: plan.description,
        plan_steps: plan.steps,
        affected_files: plan.affectedFiles,
        risk_level: plan.riskLevel,
        status: 'planning',
        ai_provider: options.aiProvider,
        ai_model: options.aiModel, // ← STORED HERE
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create repair job: ${error.message}`);
    }

    console.log(`✅ Job created: ${jobId} with model ${options.aiModel}`);
    return jobId;
  }

  async executeRepair(
    jobId: string,
    options: { aiModel?: string } = {}
  ): Promise<void> {
    const job = await this.getJob(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Get model from job or options
    const aiModel = options.aiModel || job.ai_model || 'gpt-4-turbo';

    console.log(`🚀 Executing repair ${jobId} with model ${aiModel}`);

    const branchName = `streams-repair/${jobId}`;

    // ... existing code to create branch ...

    // Dispatch workflow with model
    await this.github.actions.createWorkflowDispatch({
      owner: this.repoOwner,
      repo: this.repoName,
      workflow_id: 'repair-job.yml',
      ref: branchName,
      inputs: {
        job_id: jobId,
        branch_name: branchName,
        ai_model: aiModel, // ← PASS MODEL TO WORKFLOW
        plan_json: JSON.stringify(job.plan_steps),
      },
    });

    // Update job
    await this.supabase
      .from('repair_jobs')
      .update({
        github_branch: branchName,
        ai_model: aiModel, // Update if different
        status: 'executing',
      })
      .eq('id', jobId);
  }
}
________________________________________
DATABASE SCHEMA UPDATES
Supabase Migration
File: supabase/migrations/20240429_add_model_selection.sql
-- ============================================================================
-- ADD MODEL SELECTION FIELDS TO repair_jobs
-- ============================================================================

ALTER TABLE repair_jobs
ADD COLUMN IF NOT EXISTS ai_provider TEXT DEFAULT 'openai' CHECK (ai_provider IN ('openai', 'claude')),
ADD COLUMN IF NOT EXISTS ai_model TEXT DEFAULT 'gpt-4-turbo',
ADD COLUMN IF NOT EXISTS ai_model_used TEXT,
ADD COLUMN IF NOT EXISTS ai_model_cost_input DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS ai_model_cost_output DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS ai_model_tokens_used JSONB DEFAULT '{
  "input_tokens": 0,
  "output_tokens": 0,
  "total_tokens": 0,
  "total_cost_usd": 0.00
}';

-- Index for model queries
CREATE INDEX IF NOT EXISTS idx_repair_jobs_ai_model ON repair_jobs(ai_model);
CREATE INDEX IF NOT EXISTS idx_repair_jobs_ai_provider ON repair_jobs(ai_provider);

-- Create model statistics table
CREATE TABLE IF NOT EXISTS repair_model_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  ai_model TEXT NOT NULL,
  ai_provider TEXT NOT NULL,
  
  total_uses INT DEFAULT 0,
  successful_repairs INT DEFAULT 0,
  failed_repairs INT DEFAULT 0,
  
  total_input_tokens INT DEFAULT 0,
  total_output_tokens INT DEFAULT 0,
  total_cost_usd DECIMAL(12, 4) DEFAULT 0.00,
  
  avg_duration_seconds DECIMAL(10, 2),
  avg_success_rate DECIMAL(5, 2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  
  UNIQUE(ai_model, ai_provider)
);

CREATE INDEX idx_model_stats_model ON repair_model_stats(ai_model);
CREATE INDEX idx_model_stats_provider ON repair_model_stats(ai_provider);
________________________________________
BUILD ORDER (UPDATED FOR MODEL SELECTION)
Phase 0: Verification (2 hours)
□ Read BUILD_RULES.md
□ Verify npm run test passes
□ Verify npm run build passes
□ Verify npm run audit passes
□ Confirm OpenAI API key available
□ Confirm (Optional) Anthropic API key available
□ Confirm model API endpoints work
Phase 1: Database (3 hours)
□ Create migration: add model selection fields
□ Add ai_provider field
□ Add ai_model field (NOT hardcoded)
□ Add ai_model_used field (tracking)
□ Add ai_model_tokens_used JSONB
□ Create repair_model_stats table
□ Create indexes for model queries
□ Test: Can insert with model field
Phase 2: GitHub Actions (4 hours)
□ Create repair-job.yml
□ Add ai_model input parameter (from Supabase)
□ Pass model through workflow
□ Store model in job logs
Phase 3: Backend Services (18 hours - ADD 1 HOUR FOR MODEL ROUTER)
PHASE 3A: MODEL ROUTER (NEW - 2 hours):
□ Create lib/ai-model-router.ts
□ Define MODEL_CONFIGS for all models
  □ GPT-4 configuration
  □ GPT-4 Turbo configuration
  □ GPT-3.5 Turbo configuration
  □ Claude Haiku configuration
□ Implement validateModel()
□ Implement getModelConfig()
□ Implement routeToProvider()
□ Test: Model routing works
□ Test: Correct models used
□ Test: Fallback to Claude works
□ Test: Costs calculated correctly

PHASE 3B: DECISION ENGINE (UPDATED - 4 hours):
□ Update aiRepairDecisionEngine to use model router
□ Accept aiModel parameter
□ Validate model (never hardcoded)
□ Route analysis to selected model
□ Route fix generation to selected model
□ Track tokens and costs
□ Test: Uses selected model

PHASE 3C-G: Other services (same as before)
□ Webhook, Orchestrator, Failure Analyzer, Chat Reactor, etc.
(All updated to accept and pass model parameter)
Phase 4: API Endpoints (5 hours - ADD 1 HOUR FOR MODEL HANDLING)
□ Create /api/repair/create (accepts aiModel parameter)
□ Create /api/repair/approve-plan (accepts aiModel parameter)
□ Create /api/repair/approve-results
□ Create /api/repair/approve-commit
□ Create /api/repair/status (returns aiModel used)
□ Create /api/repair/notifications
□ Add model validation to all endpoints
□ Test: Model parameter passed correctly
□ Test: Different models work
Phase 5: Preview Components (11 hours - ADD 1 HOUR FOR MODEL SELECTOR)
□ Create components/ModelSelector.tsx (NEW)
  □ Display all available models
  □ Show cost estimates
  □ Show speed/performance info
  □ Handle selection changes
  □ Update state correctly
  
□ Update components/ChatRepairFlow.tsx
  □ Include ModelSelector
  □ Pass selected model to backend
  □ Store selection in job
  
□ Update components/UnifiedRepairPreview.tsx
  □ Display selected model
  □ Show model in status
  
□ Update lib/preview-autonomous-bridge.ts
  □ Track model in updates
Phase 6: Chat Integration (5 hours - ADD 1 HOUR FOR MODEL UI)
□ Integrate ModelSelector into chat
□ Wire model selection to repair flow
□ Show selected model in conversation
□ Display model in results
□ Test: Model selection works
□ Test: Different models produce different results
□ Test: Model tracking accurate
Phase 7: End-to-End Testing (5 hours - ADD 1 HOUR FOR MODEL TESTING)
□ Test GPT-4 repair flow
□ Test GPT-4 Turbo repair flow
□ Test GPT-3.5 Turbo repair flow
□ Test Claude Haiku fallback
□ Test model selection in UI
□ Test model actually changes behavior
□ Test cost calculations
□ Test model statistics tracking
□ Verify models stored in database
□ Verify model used in logs
________________________________________
COMPLETE CHECKLIST
Frontend Model Selection
COMPONENT: components/ModelSelector.tsx
□ AVAILABLE_MODELS array with all models
□ Display dropdown with model options
□ Show grouped by provider (OpenAI primary, Claude fallback)
□ Display model info:
  □ Speed (slow/medium/fast)
  □ Cost per 1K tokens
  □ Context window
  □ Best for (description)
  □ Recommended flag
  □ Fallback-only flag
□ Cost calculator
  □ Estimate based on typical 8K input, 2K output
  □ Real-time calculation
□ Comparison table
  □ Show all models side-by-side
  □ Sortable/clickable
□ Selection persists
  □ State management
  □ Passes to backend
□ CSS styling
  □ Responsive
  □ Clear visual hierarchy
  □ Accessible

INTEGRATION: components/ChatRepairFlow.tsx
□ Import ModelSelector
□ State: selectedModel
□ Function: onChange handler
□ Send model to /api/repair/create
□ Send model to /api/repair/approve-plan
□ Display selected model in messages
□ Show model in status updates

INTEGRATION: components/UnifiedRepairPreview.tsx
□ Accept selectedModel prop
□ Display model name
□ Show model in status section
□ Update when model changes
Backend Model Routing
FILE: lib/ai-model-router.ts
□ MODEL_CONFIGS object
  □ gpt-4 configuration
  □ gpt-4-turbo configuration
  □ gpt-3.5-turbo configuration
  □ claude-3-haiku configuration
□ validateModel() function
  □ Check model is valid
  □ Default to gpt-4-turbo if invalid
  □ Never hardcode
□ getModelConfig() function
  □ Return config for model
□ routeToProvider() function
  □ Accept model parameter
  □ Route to OpenAI for GPT models
  □ Route to Claude for Claude models
  □ Fallback to Claude if OpenAI fails
  □ Track tokens and costs
  □ Return metadata (model used, provider, tokens, cost)

FILE: lib/ai-repair-decision-engine.ts (Updated)
□ Accept aiModel in DecisionInput
□ Validate model (never hardcoded)
□ Use routeToProvider() with model
□ Track model in return value
□ Return tokens used
□ Return cost calculated

FILE: pages/api/repair/create.ts (Updated)
□ Accept aiModel from request
□ Validate model
□ Default to gpt-4-turbo if missing
□ Store model in Supabase
□ Return model in response

FILE: pages/api/repair/approve-plan.ts (Updated)
□ Accept aiModel from request
□ Validate model
□ Pass to executeRepair()
□ Update job with model

FILE: lib/repair-orchestrator.ts (Updated)
□ createRepairJob() accepts aiModel
□ Store aiModel in database
□ executeRepair() accepts aiModel
□ Update job with model
□ Pass model to workflow
Database Changes
MIGRATION: supabase/migrations/20240429_add_model_selection.sql
□ ADD ai_provider column
□ ADD ai_model column (NOT hardcoded)
□ ADD ai_model_used column (tracking)
□ ADD ai_model_cost_input column
□ ADD ai_model_cost_output column
□ ADD ai_model_tokens_used JSONB column
□ CREATE repair_model_stats table
□ CREATE indexes on ai_model, ai_provider
□ CREATE indexes on model_stats

TESTING:
□ Can insert repair_jobs with ai_model
□ Can query by ai_model
□ Different models stored differently
□ Model statistics tracked
□ Costs calculated per model
Testing Verification
OPENAI MODELS:
□ GPT-4 works
  □ Can select in UI
  □ Correctly routed to OpenAI
  □ Uses gpt-4 model string
  □ Cost calculated correctly
  
□ GPT-4 Turbo works
  □ Can select in UI
  □ Correctly routed to OpenAI
  □ Uses gpt-4-turbo-preview model string
  □ Cost calculated correctly
  □ Faster than GPT-4
  
□ GPT-3.5 Turbo works
  □ Can select in UI
  □ Correctly routed to OpenAI
  □ Uses gpt-3.5-turbo-16k model string
  □ Cost calculated correctly
  □ Fastest option

CLAUDE FALLBACK:
□ Can select Claude Haiku
  □ Shows as "Fallback only"
  □ Can be selected if user chooses
  □ Correctly routed to Claude
  □ Uses claude-3-haiku-20240307 model string
  
□ Fallback on OpenAI failure
  □ If OpenAI API fails
  □ Automatically tries Claude
  □ Logs both attempts
  □ Completes repair with Claude
  □ Notifies user of fallback

NOT HARDCODED:
□ Model selection actually changes behavior
  □ Different models produce different outputs
  □ Different speeds per model
  □ Different costs per model
  □ Different token usage per model
□ Model stored in database
  □ Can query by model
  □ Analytics per model
  □ Statistics per model
□ Model passed through all layers
  □ Frontend → API → Backend → Provider
  □ Never hardcoded anywhere
  □ Always from request/database
________________________________________
FINAL SUMMARY
Key Changes for Model Selection
✅ ModelSelector component in UI (components/ModelSelector.tsx)
✅ Model dropdown in chat repair flow
✅ Model routing system (lib/ai-model-router.ts)
✅ Dynamic model selection (not hardcoded)
✅ Database tracking of model per job
✅ Cost calculation per model
✅ Model statistics and analytics
✅ Fallback to Claude Haiku (optional)
✅ All models wired through entire system
Available Models
PRIMARY (OpenAI):
- GPT-4 (best quality, most expensive)
- GPT-4 Turbo (best value)
- GPT-3.5 Turbo (fastest, cheapest)

FALLBACK (Claude):
- Claude Haiku 4.5 (only if OpenAI fails)
What's Actually Wired
✅ Frontend dropdown shows all models
✅ User selection affects backend behavior
✅ Different models actually used
✅ Model tracked in database
✅ Model costs calculated correctly
✅ Model statistics tracked
✅ NOT hardcoded anywhere
✅ Can be changed per repair
✅ Can be changed per user
Total Effort (with Model Selection)
Phase 0: 2 hours
Phase 1: 3 hours (+ 1 hr for model schema)
Phase 2: 4 hours (+ minimal for model input)
Phase 3: 17 hours (+ 1 hr for model router)
Phase 4: 4 hours (+ 1 hr for model handling)
Phase 5: 10 hours (+ 1 hr for ModelSelector)
Phase 6: 4 hours (+ 1 hr for model UI)
Phase 7: 4 hours (+ 1 hr for model testing)
────────────────────────────────────
TOTAL: 48 + 6 = 54 hours (~1.3 weeks)
________________________________________
READY TO BUILD WITH FULL MODEL SELECTION?
This implementation ensures: ✅ All models available in frontend dropdown ✅ Model selection actually changes behavior ✅ Model tracking throughout system ✅ Cost visibility per model ✅ NOT hardcoded anywhere ✅ Fully wired from UI to backend to API calls


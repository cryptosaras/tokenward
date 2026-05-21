// Shared contracts for tokenwarden. Every module codes against these types.
// Verified 2026-05-21 against code.claude.com/docs/en/hooks and /statusline.

// ---------------------------------------------------------------------------
// Configuration (.tokenwarden.json)
// ---------------------------------------------------------------------------

/** How tokenwarden behaves when a rule fires. */
export type Mode = "observe" | "enforce";

/**
 * A single budget cap in USD. `null` means "no cap".
 * v0.1 enforces dollar caps only — the reliable live signal is `cost.total_cost_usd`
 * from the statusline, not a cumulative token count. (Token-count caps are deferred.)
 */
export interface Budget {
  usd: number | null;
}

export interface Budgets {
  session: Budget;
  daily: Budget;
  project: Budget;
  /** Per-model caps keyed by model id substring (e.g. "opus", "claude-opus-4-7"). */
  perModel: Record<string, Budget>;
}

export interface CompactionConfig {
  /** Inject a /compact nudge once context usage reaches this percent. */
  coachAtPercent: number;
  /** Veto auto-compaction that fires below this context percent (wasteful). */
  vetoAutoBelowPercent: number;
}

export interface EscalationConfig {
  enabled: boolean;
  /** Model-id substrings considered "expensive" (default: ["opus"]). */
  expensiveModels: string[];
  /** A call whose estimated cost is below this is "trivial" and passes silently. */
  trivialThresholdUsd: number;
}

export interface BloatConfig {
  /** Cap Read line counts to this (rewrites Read.limit via modifiedInput). */
  readMaxLines: number | null;
  /** Refuse Grep/Glob with no path/glob scoping. */
  refuseUnscopedSearch: boolean;
  /** Cap Bash timeout (ms) to avoid runaway background commands. */
  bashMaxTimeoutMs: number | null;
}

export interface Config {
  mode: Mode;
  budgets: Budgets;
  compaction: CompactionConfig;
  escalation: EscalationConfig;
  bloat: BloatConfig;
  /** Per-model price overrides (negotiated rates), keyed by model id. */
  pricingOverrides: Record<string, Partial<ModelPricing>>;
}

// ---------------------------------------------------------------------------
// Pricing
// ---------------------------------------------------------------------------

/** Per-MTok USD rates. Derived rates use multiplier rules over `baseInput`. */
export interface ModelPricing {
  /** Substring matched against the model id. */
  match: string;
  baseInput: number;
  output: number;
  cacheRead: number;
  /** 5-minute cache write; defaults to baseInput * 1.25 when omitted. */
  cacheWrite5m?: number;
  /** 1-hour cache write; defaults to baseInput * 2 when omitted. */
  cacheWrite1h?: number;
}

export interface PricingTable {
  /** Human date the snapshot was verified, e.g. "2026-05-21". */
  updated: string;
  source: string;
  models: ModelPricing[];
  /** Web search billing in USD per 1k requests. */
  webSearchPer1k: number;
}

// ---------------------------------------------------------------------------
// Token usage (from JSONL transcripts and statusline)
// ---------------------------------------------------------------------------

/** Normalized usage for one API call (deduped by requestId). */
export interface CallUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
  webSearchRequests: number;
  /** Model id from the assistant line (message.model), used to price the call. */
  model?: string;
  /** Inference geo, e.g. "us" (1.1x multiplier). */
  inferenceGeo?: string;
  serviceTier?: string;
}

/** A live snapshot captured from the statusline JSON (the reliable cost signal). */
export interface StatuslineSnapshot {
  sessionId: string;
  modelId: string;
  modelDisplayName: string;
  cwd: string;
  /** Client-side estimate; the most reliable live cost signal we get. */
  totalCostUsd: number;
  contextUsedPercent: number | null;
  contextWindowSize: number;
  exceeds200k: boolean;
  capturedAt: number; // epoch ms
}

// ---------------------------------------------------------------------------
// Ledger (JSON-backed; O(small) reads in hooks)
// ---------------------------------------------------------------------------

export interface SessionRecord {
  sessionId: string;
  modelId: string;
  cwd: string;
  /** Latest known cumulative cost for the session (from statusline). */
  costUsd: number;
  contextUsedPercent: number | null;
  startedAt: number;
  updatedAt: number;
  /** Local date (YYYY-MM-DD) the session started, for daily aggregation. */
  startDate: string;
}

/** A recorded enforcement decision — powers observe-mode logging and `report`. */
export interface LedgerEvent {
  at: number;
  sessionId: string;
  kind:
    | "budget-block"
    | "escalation"
    | "bloat-cap"
    | "compaction-coach"
    | "compaction-veto"
    | "session-finalize" // SessionEnd/Stop bookkeeping; never a block
    | "would-block"; // observe mode: what enforce mode would have done
  detail: string;
  estUsd?: number;
}

export interface LedgerState {
  version: number;
  sessions: Record<string, SessionRecord>;
  /** Capped ring buffer of recent events. */
  events: LedgerEvent[];
}

/**
 * Aggregates computed on read. Hooks call these for O(1)-ish enforcement.
 * `project` is keyed by cwd path; `daily` by local YYYY-MM-DD.
 */
export interface LedgerAggregates {
  sessionUsd: number;
  dailyUsd: number;
  projectUsd: number;
}

export interface Ledger {
  read(): LedgerState;
  /** Upsert the live session snapshot (called by the statusline capture). */
  recordStatusline(snap: StatuslineSnapshot): void;
  /** Persist the active model for a session (SessionStart). */
  recordSessionModel(sessionId: string, modelId: string, cwd: string): void;
  /** Append an enforcement/observe event (capped ring buffer). */
  recordEvent(ev: LedgerEvent): void;
  /** Compute spend aggregates relevant to the given session/project. */
  aggregates(sessionId: string, cwd: string): LedgerAggregates;
}

// ---------------------------------------------------------------------------
// Hook I/O (verified schemas)
// ---------------------------------------------------------------------------

export type HookEventName =
  | "SessionStart"
  | "UserPromptSubmit"
  | "PreToolUse"
  | "PostToolUse"
  | "PreCompact"
  | "Stop"
  | "SessionEnd";

/** Fields common to all hook stdin payloads. */
export interface HookInputBase {
  session_id: string;
  transcript_path: string;
  cwd: string;
  hook_event_name: HookEventName;
  permission_mode?: string;
}

export interface SessionStartInput extends HookInputBase {
  hook_event_name: "SessionStart";
  source: "startup" | "resume" | "clear" | "compact";
  model?: string;
}

export interface UserPromptSubmitInput extends HookInputBase {
  hook_event_name: "UserPromptSubmit";
  prompt: string;
}

export interface PreToolUseInput extends HookInputBase {
  hook_event_name: "PreToolUse";
  tool_name: string;
  tool_input: Record<string, unknown>;
  tool_use_id: string;
  agent_id?: string;
  agent_type?: string;
}

export interface PreCompactInput extends HookInputBase {
  hook_event_name: "PreCompact";
  matcher_value?: "manual" | "auto";
  /** Some versions deliver the matcher under `trigger`; handle both. */
  trigger?: "manual" | "auto";
}

export interface SessionEndInput extends HookInputBase {
  hook_event_name: "SessionEnd";
  reason: string;
}

export interface StopInput extends HookInputBase {
  hook_event_name: "Stop";
}

/**
 * Output a hook prints to stdout (exit 0). Only the fields a given event
 * supports should be set; unknown fields are ignored by Claude Code.
 */
export interface HookOutput {
  continue?: boolean;
  stopReason?: string;
  suppressOutput?: boolean;
  systemMessage?: string;
  /** UserPromptSubmit / PostToolUse / PreCompact / Stop block decision. */
  decision?: "block";
  reason?: string;
  hookSpecificOutput?: {
    hookEventName: HookEventName;
    permissionDecision?: "allow" | "deny" | "ask" | "defer";
    permissionDecisionReason?: string;
    modifiedInput?: Record<string, unknown>;
    additionalContext?: string;
  };
}

/** Shape Claude Code pipes to the configured statusLine command (stdin). */
export interface StatuslineInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  model?: { id?: string; display_name?: string };
  workspace?: { current_dir?: string; project_dir?: string };
  cost?: { total_cost_usd?: number };
  context_window?: {
    total_input_tokens?: number;
    total_output_tokens?: number;
    context_window_size?: number;
    used_percentage?: number | null;
    remaining_percentage?: number | null;
    current_usage?: {
      input_tokens?: number;
      output_tokens?: number;
      cache_creation_input_tokens?: number;
      cache_read_input_tokens?: number;
    } | null;
  };
  exceeds_200k_tokens?: boolean;
}

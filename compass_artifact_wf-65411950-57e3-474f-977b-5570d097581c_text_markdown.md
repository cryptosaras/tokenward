<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Viral AI Dev-Tool Repos in 2026 — 20 Buildable Project Ideas</title>
<style>
  :root {
    --bg: #fafafa;
    --bg-soft: #f4f4f5;
    --card: #ffffff;
    --border: #e4e4e7;
    --border-strong: #d4d4d8;
    --text: #18181b;
    --text-soft: #52525b;
    --text-mute: #71717a;
    --accent: #2563eb;
    --accent-soft: #dbeafe;
    --tier-s: #fee2e2;
    --tier-s-fg: #991b1b;
    --tier-a: #fef3c7;
    --tier-a-fg: #92400e;
    --tier-b: #dcfce7;
    --tier-b-fg: #166534;
    --easy: #dcfce7;
    --easy-fg: #166534;
    --medium: #fef3c7;
    --medium-fg: #92400e;
    --hard: #fee2e2;
    --hard-fg: #991b1b;
    --code-bg: #f4f4f5;
    --code-border: #e4e4e7;
  }
  * { box-sizing: border-box; }
  html { scroll-behavior: smooth; }
  body {
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.65;
    font-size: 16px;
  }
  .wrap {
    max-width: 1100px;
    margin: 0 auto;
    padding: 56px 24px 96px;
  }
  header.hero {
    border-bottom: 1px solid var(--border);
    padding-bottom: 32px;
    margin-bottom: 40px;
  }
  h1 {
    font-size: 2.4rem;
    font-weight: 700;
    margin: 0 0 12px;
    letter-spacing: -0.02em;
    line-height: 1.15;
  }
  .subtitle {
    font-size: 1.1rem;
    color: var(--text-soft);
    margin: 0;
  }
  .meta {
    margin-top: 16px;
    color: var(--text-mute);
    font-size: 0.9rem;
  }
  h2 {
    font-size: 1.6rem;
    font-weight: 700;
    margin: 56px 0 16px;
    letter-spacing: -0.01em;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--border);
  }
  h3 {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 32px 0 12px;
  }
  h4 {
    font-size: 1.05rem;
    font-weight: 600;
    margin: 18px 0 8px;
  }
  p { margin: 0 0 14px; }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  code, .mono {
    font-family: "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
    font-size: 0.88em;
    background: var(--code-bg);
    border: 1px solid var(--code-border);
    padding: 1px 6px;
    border-radius: 4px;
  }
  ul, ol { padding-left: 22px; }
  li { margin-bottom: 6px; }
  .tldr {
    background: var(--card);
    border: 1px solid var(--border);
    border-left: 4px solid var(--accent);
    padding: 20px 24px;
    border-radius: 8px;
    margin: 0 0 8px;
  }
  .tldr ul { margin: 0; padding-left: 20px; }
  .tldr li { margin-bottom: 10px; }
  .pill {
    display: inline-block;
    padding: 2px 9px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    vertical-align: middle;
  }
  .pill.tier-s { background: var(--tier-s); color: var(--tier-s-fg); }
  .pill.tier-a { background: var(--tier-a); color: var(--tier-a-fg); }
  .pill.tier-b { background: var(--tier-b); color: var(--tier-b-fg); }
  .pill.easy   { background: var(--easy); color: var(--easy-fg); }
  .pill.medium { background: var(--medium); color: var(--medium-fg); }
  .pill.hard   { background: var(--hard); color: var(--hard-fg); }

  /* Landscape table */
  .landscape {
    width: 100%;
    border-collapse: collapse;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    font-size: 0.93rem;
    margin: 16px 0 8px;
  }
  .landscape th, .landscape td {
    text-align: left;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
  }
  .landscape th {
    background: var(--bg-soft);
    font-weight: 600;
    font-size: 0.85rem;
    color: var(--text-soft);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .landscape tr:last-child td { border-bottom: none; }
  .landscape .repo { font-family: "SF Mono", Menlo, monospace; font-size: 0.85rem; }

  /* Idea card */
  .idea {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 22px 24px;
    margin-bottom: 18px;
    transition: border-color 0.15s ease;
  }
  .idea:hover { border-color: var(--border-strong); }
  .idea-header {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 10px;
  }
  .idea-num {
    font-weight: 700;
    color: var(--text-mute);
    font-size: 1rem;
    flex-shrink: 0;
  }
  .idea-name {
    font-weight: 700;
    font-size: 1.15rem;
    margin: 0;
    flex: 1 1 auto;
    min-width: 200px;
  }
  .idea-name code {
    background: transparent;
    border: none;
    padding: 0;
    font-size: 0.95em;
    color: var(--accent);
  }
  .idea-tags { display: flex; gap: 6px; flex-shrink: 0; }
  .idea-hook {
    font-style: italic;
    color: var(--text-soft);
    margin: 4px 0 14px;
    font-size: 0.97rem;
  }
  .idea-grid {
    display: grid;
    grid-template-columns: 130px 1fr;
    gap: 6px 16px;
    font-size: 0.93rem;
  }
  .idea-grid dt {
    font-weight: 600;
    color: var(--text-soft);
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding-top: 2px;
  }
  .idea-grid dd { margin: 0; color: var(--text); }

  /* Promo sequence */
  .week {
    background: var(--card);
    border: 1px solid var(--border);
    border-left: 3px solid var(--accent);
    padding: 16px 20px;
    border-radius: 6px;
    margin-bottom: 14px;
  }
  .week h4 { margin-top: 0; color: var(--accent); }

  .caveat {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 16px 20px;
    margin-top: 8px;
  }
  .caveat strong { color: #92400e; }
  .small { font-size: 0.88rem; color: var(--text-mute); }
  hr.soft {
    border: none;
    border-top: 1px solid var(--border);
    margin: 32px 0;
  }
  .toc {
    background: var(--bg-soft);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 16px 22px;
    margin-bottom: 32px;
    font-size: 0.93rem;
  }
  .toc ul { columns: 2; column-gap: 32px; margin: 8px 0 0; padding-left: 18px; }
  .toc li { margin-bottom: 4px; break-inside: avoid; }
  @media (max-width: 720px) {
    .wrap { padding: 32px 16px 64px; }
    h1 { font-size: 1.8rem; }
    .toc ul { columns: 1; }
    .idea-grid { grid-template-columns: 1fr; }
    .idea-grid dt { padding-top: 8px; }
    .landscape { font-size: 0.85rem; }
    .landscape th, .landscape td { padding: 8px 10px; }
  }
</style>
</head>
<body>
<div class="wrap">

<header class="hero">
  <h1>Viral AI Dev-Tool Repos in 2026 — 20 Buildable Project Ideas</h1>
  <p class="subtitle">A research-backed playbook for shipping Serena-style open-source tools that target Claude Code, MCP servers, and AI agent users — with a launch plan designed to reach 5k+ stars from zero audience.</p>
  <p class="meta">Compiled May 2026 · Light theme · Single-file HTML</p>
</header>

<nav class="toc" aria-label="Table of contents">
  <strong>Contents</strong>
  <ul>
    <li><a href="#tldr">TL;DR</a></li>
    <li><a href="#findings">Key findings</a></li>
    <li><a href="#landscape">The viral landscape</a></li>
    <li><a href="#patterns">Patterns behind virality</a></li>
    <li><a href="#gaps">Current gaps</a></li>
    <li><a href="#ecosystem">MCP &amp; Claude Code state</a></li>
    <li><a href="#ideas">20 project ideas</a></li>
    <li><a href="#promo">Promotion plan</a></li>
    <li><a href="#caveats">Caveats</a></li>
  </ul>
</nav>

<!-- TL;DR -->
<h2 id="tldr">TL;DR</h2>
<div class="tldr">
  <ul>
    <li>The viral AI-dev-tool surface in 2026 has shifted from "another agent framework" to <strong>small, single-purpose, agent-friendly tools that bolt onto Claude Code / MCP / Codex</strong>. Reference templates: <code>oraios/serena</code> (~24.4k stars, v1.5.1 May 2026), <code>upstash/context7</code> (~55.7k), <code>obra/superpowers</code> (launched Oct 2025, ~6k stars/week growth through Q1 2026 reaching ~195k by May), <code>mattpocock/skills</code> (~77k by mid-May), and <code>ryoppippi/ccusage</code> (~14k).</li>
    <li>The biggest unsolved pain points right now are token-cost runaway in agent loops, MCP tool-sprawl and supply-chain risk, weak local-first agent memory, Claude Code skill/hook quality, and orchestration UX around the new <code>--worktree</code> flag.</li>
    <li>To hit 5k+ stars with no audience: ship a <strong>CLI or MCP server (not a framework)</strong>, sub-30-second install, one benchmark number in the README, time the launch to an Anthropic/MCP platform event, and seed via <strong>Twitter creator threads + r/ClaudeAI + awesome-list PRs</strong>. Show HN underperforms Twitter in this niche — the Tier-A repos almost all launched via X.</li>
  </ul>
</div>

<!-- KEY FINDINGS -->
<h2 id="findings">Key Findings</h2>

<h3 id="landscape">The viral landscape (verified, mid-2026)</h3>
<table class="landscape">
  <thead>
    <tr>
      <th>Repo</th>
      <th>Stars</th>
      <th>Launch / Notable</th>
      <th>Why it went viral</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="repo">oraios/serena</td>
      <td>~24,395</td>
      <td>Mar 2025 · v1.5.1 May 2026</td>
      <td>LSP-backed semantic code retrieval/editing MCP — the canonical "small Serena-style tool" reference.</td>
    </tr>
    <tr>
      <td class="repo">upstash/context7</td>
      <td>~55,700</td>
      <td>Mar 2025 · ThoughtWorks Trial Nov 2025</td>
      <td>Injects up-to-date library docs into prompts. Patched the "ContextCrush" tool-poisoning CVE Feb 2026.</td>
    </tr>
    <tr>
      <td class="repo">obra/superpowers</td>
      <td>~195k (May)</td>
      <td>Oct 2025, same day as Anthropic plugin system</td>
      <td>Enforces TDD/brainstorm→plan→execute discipline. ~6k stars/week through Q1 2026.</td>
    </tr>
    <tr>
      <td class="repo">anthropics/skills</td>
      <td>~137k</td>
      <td>Jan 2026</td>
      <td>Official SKILL.md spec reference + document-creation skills.</td>
    </tr>
    <tr>
      <td class="repo">mattpocock/skills</td>
      <td>~77k (mid-May)</td>
      <td>Feb 3, 2026 · #1 Trending Shell ~6 days</td>
      <td>Reference skill set (tdd, grill-me, to-prd, caveman). Pocock YouTube + X amplification.</td>
    </tr>
    <tr>
      <td class="repo">github/spec-kit</td>
      <td>~90k+</td>
      <td>Late 2025 · GitHub-official</td>
      <td>Spec-Driven Development toolkit; 30+ agent integrations.</td>
    </tr>
    <tr>
      <td class="repo">eyaltoledano/claude-task-master</td>
      <td>~27k</td>
      <td>Early 2025</td>
      <td>PRD → atomic-task generator. Hit #1 GitHub Trending of the day on launch.</td>
    </tr>
    <tr>
      <td class="repo">anthropics/claude-cookbooks</td>
      <td>~43k</td>
      <td>Anthropic official</td>
      <td>Central reference for tool_use + context engineering + skills.</td>
    </tr>
    <tr>
      <td class="repo">ryoppippi/ccusage</td>
      <td>~14k</td>
      <td>May 29, 2025</td>
      <td>Local CLI for Claude Code JSONL usage — the de facto baseline tool.</td>
    </tr>
    <tr>
      <td class="repo">BeehiveInnovations/zen-mcp-server (→pal-mcp-server)</td>
      <td>~11.5k</td>
      <td>Mid-2025 · HN front page</td>
      <td>Lets Claude Code spawn Gemini/o3/GPT-5 sub-agents for cross-model consensus.</td>
    </tr>
    <tr>
      <td class="repo">ruvnet/ruflo (ex-claude-flow)</td>
      <td>~53k</td>
      <td>Mid-2025</td>
      <td>Multi-agent swarm orchestration for Claude Code. Larger scope than Serena.</td>
    </tr>
    <tr>
      <td class="repo">Fission-AI/OpenSpec</td>
      <td>low-thousands</td>
      <td>Late 2025</td>
      <td>Lightweight spec-driven dev plugin; alternative to AWS Kiro / Spec-Kit.</td>
    </tr>
    <tr>
      <td class="repo">invariantlabs-ai/mcp-scan</td>
      <td>~610</td>
      <td>2025; ongoing</td>
      <td>First-mover MCP security scanner (tool poisoning, rug pulls).</td>
    </tr>
    <tr>
      <td class="repo">cisco-ai-defense/mcp-scanner</td>
      <td>recent v4.x</td>
      <td>2026</td>
      <td>YARA + LLM-judge MCP supply-chain scanner.</td>
    </tr>
  </tbody>
</table>
<p class="small">Star counts dated to early–mid May 2026 and verified by the subagent against repo pages, ChatForest reviews, and 2026 listicles. Numbers move ~10–20% per week in this sector. The "Karpathy CLAUDE.md" repo (<code>forrestchang/andrej-karpathy-skills</code>) is reported in one source as having ~109k stars; our verification could only corroborate roughly ~3.5k — treat the larger figure with skepticism.</p>

<h3 id="patterns">Patterns behind virality (what actually works in 2026)</h3>
<ol>
  <li><strong>Skill / plugin / MCP format &gt; framework.</strong> A single SKILL.md or one-binary MCP server installs in under 30 seconds; frameworks don't.</li>
  <li><strong>Ride platform events.</strong> Superpowers launched the same day as Anthropic's plugin system; Spec-Kit landed in the spec-driven wave; Context7 rode the MCP curve. Time-to-event matters more than time-of-day.</li>
  <li><strong>Twitter creator threads beat Show HN</strong> in this niche. <code>mattpocock</code>, <code>jvincent</code>, <code>eyaltoledano</code>, <code>ryoppippi</code> drove huge spikes; almost none of the Tier-A repos launched via Show HN.</li>
  <li><strong>Recognition, not novelty.</strong> Karpathy's CLAUDE.md went viral because every developer already felt the pain. The "deliberate, surgical, simplicity-first" four-principles framing was articulation, not invention.</li>
  <li><strong>Agent-as-user framing.</strong> Serena's README explicitly evaluates itself with AI agents as the end user; that framing reads well to vibecoders and to LLMs that recommend tools.</li>
  <li><strong>README pattern is the same everywhere:</strong> hero GIF, one-line install (<code>npx</code>/<code>uvx</code>), a concrete benchmark number in the first paragraph (e.g., "65% fewer tokens," "84% trigger rate"), MIT license, an "Agent use" section so LLMs know how to call it.</li>
</ol>

<h3 id="gaps">Current gaps and unmet needs</h3>
<ul>
  <li><strong>Token cost runaway.</strong> Specific 2026 case studies: one developer's $4,200 over 3 days; one 35-engineer team's April 2026 bill of $87,000. ccusage and claude-token-lens variants <em>show</em> the cost; nothing <em>acts</em> on it deterministically via hooks.</li>
  <li><strong>MCP tool-sprawl.</strong> ~14,000 MCP servers exist by May 2026; most users carry 100+ tool schemas in context. Claude Code's April 2026 Tool Search + lazy loading helps, but gateway/aggregator UX is wide open. Bifrost's MCP Gateway benchmark (April 2026, getmaxim.ai) recorded 92.8% input-token reduction and 92.2% cost reduction at 508 tools across 16 servers with 100% pass rate retained.</li>
  <li><strong>MCP security.</strong> OX Security's April 15, 2026 disclosure (<em>"The Mother of All AI Supply Chains"</em>) by researchers Moshe Siman Tov Bustan, Mustafa Naamnih, Nir Zadok, and Roni Bar identified a systemic STDIO RCE design flaw affecting 7,000+ publicly accessible servers and up to 200,000 total vulnerable instances across 150M+ downloads. Anthropic declined to patch the protocol. mcp-scan (Invariant Labs) and Cisco's MCP Scanner exist but are enterprise-shaped, not vibe-shaped.</li>
  <li><strong>Agent memory.</strong> Mem0's April 2026 paper "Token-Efficient Memory Algorithm" (Yadav et al.) scored 92.5 on LoCoMo and 94.4 on LongMemEval at under 7,000 tokens per retrieval, with +29.6 points on temporal queries and +23.1 on multi-hop reasoning vs the prior algorithm. Zep/Graphiti, Letta, and Cognee compete — but no single dominant <em>local-first, MCP-native</em> memory tool yet.</li>
  <li><strong>Lightweight spec-driven dev.</strong> Spec-Kit is heavyweight (Python); OpenSpec is small; nothing yet dominates skill <em>generation</em> + automated <em>quality scoring</em>.</li>
  <li><strong>Agent observability for solo devs.</strong> Langfuse, Laminar, MLflow, Phoenix all target teams. A local TUI for one developer is missing.</li>
  <li><strong>Worktree orchestration.</strong> Claude Code v2.1.50 (Feb 20, 2026) shipped native worktree CLI. Boris Cherny's announcement got 1M+ views on X. Sources differ on the typical concurrency: Upsun's Dev Center reports incident.io "runs four or five parallel Claude agents routinely," while the broader Claude Directory 2026 guide cites "4–8 concurrent worktrees per developer reliably" as the mid-2026 industry ceiling. Either way, the dashboard/kanban UX layer is wide open.</li>
  <li><strong>Skill quality / discovery.</strong> alirezarezvani/claude-skills lists 232+ skills; VoltAgent/awesome-agent-skills lists 1000+. Almost no automated quality scoring or auto-tested skill grading exists.</li>
</ul>

<h3 id="ecosystem">State of MCP / Claude Code (mid-2026)</h3>
<ul>
  <li><strong>MCP governance:</strong> Donated to the Linux Foundation's Agentic AI Foundation (AAIF) in December 2025; OAuth 2.1 with PKCE added April 2026; SSE deprecated, <strong>Streamable HTTP</strong> is the standard.</li>
  <li><strong>Claude Code extension layers (timeline):</strong> MCP (Nov 2024) → Subagents (Jul 2025) → Hooks (Sep 2025) → Plugins (Oct 2025) → Skills (Oct 2025) → Agent Teams (Feb 2026, experimental). 27 hook events across 5 categories; CLAUDE.md = facts; Skills = in-context procedures; Subagents = isolated workers; Agent Teams = separate processes.</li>
  <li><strong>Token economics:</strong> Per Anthropic's official API pricing page, Claude Opus 4.6 standard input is $5.00/MTok and Cache Hits cost $0.50/MTok — a 90% discount. The 5-minute cache write costs 1.25× base, the 1-hour write 2× base. Opus 4.7 uses up to 35% more tokens than 4.6 for code-heavy inputs; o3 dropped ~80% in price (April 2026) to $2/$8 per MTok.</li>
  <li><strong>Tool Search + lazy loading</strong> (April 2026 update) reduces tool-injection context up to 95%; per-result MCP output limit raised to 500,000 chars; concurrent MCP server connections enabled.</li>
</ul>

<!-- IDEAS -->
<h2 id="ideas">The 20 Project Ideas (ranked by viral potential)</h2>
<p>Each idea is sized for an AI-assisted solo builder (a "vibecoder") to ship in days to a few weeks. Every idea is either a CLI, an MCP server, a Claude Code skill/plugin, or a small library — i.e. agent-friendly by construction.</p>

<!-- TIER S -->
<h3>Tier S — Highest viral potential</h3>

<!-- 1 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">01.</span>
    <h4 class="idea-name"><code>tokenwarden</code> — Token-Budget Hook &amp; Auto-Compactor for Claude Code</h4>
    <div class="idea-tags"><span class="pill tier-s">Tier S</span><span class="pill medium">Medium</span></div>
  </div>
  <p class="idea-hook">"Cut your Claude Code bill 60–80% with one <code>npx tokenwarden install</code>."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Engineering teams report $20k–$87k/month Claude bills with agent-loop runaway (one documented case: 35-engineer team, April 2026, $87k). ccusage shows the cost; nothing acts on it.</dd>
    <dt>Audience</dt><dd>Claude Code users on the API or Max plan; teams running Claude Code agents.</dd>
    <dt>Why viral now</dt><dd>Cost is the #1 r/ClaudeAI complaint. The "saved $X this week" tweet is endlessly shareable.</dd>
    <dt>Stack</dt><dd>TypeScript CLI + Claude Code <code>PreToolUse</code>/<code>PostToolUse</code> hooks + local SQLite. Auto-injects <code>/compact</code> prompts, blocks expensive models for trivial calls, prunes stale tool output.</dd>
    <dt>Agent use</dt><dd>Hooks fire automatically; also exposes <code>tokenwarden inspect</code> + <code>tokenwarden compact</code> as MCP tools for agent self-audit.</dd>
  </dl>
</div>

<!-- 2 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">02.</span>
    <h4 class="idea-name"><code>mcp-firewall</code> — Local Tool-Poisoning &amp; Supply-Chain Scanner</h4>
    <div class="idea-tags"><span class="pill tier-s">Tier S</span><span class="pill medium">Medium</span></div>
  </div>
  <p class="idea-hook">"200,000 MCP servers, one RCE flaw, zero local guardrails. Fix it before your agent does."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>OX Security's April 15, 2026 disclosure (Bustan, Naamnih, Zadok, Bar) covered 7,000+ exposed servers across 150M+ downloads. Anthropic declined to patch the STDIO behavior. mcp-scan and Cisco MCP Scanner exist but are enterprise UX.</dd>
    <dt>Audience</dt><dd>Solo Claude Code / Cursor / Windsurf users running 10+ MCP servers.</dd>
    <dt>Why viral now</dt><dd>Security headlines = guaranteed Reddit/HN attention. The OX disclosure + ContextCrush (Context7, Feb 2026) are perfect launch tailwinds.</dd>
    <dt>Stack</dt><dd>Rust or Go CLI reading <code>~/.cursor/mcp.json</code>, <code>~/.claude.json</code>, etc. YARA-like rules for poisoning patterns + version diffing (rug-pull detection) + STDIO allowlist hook for Claude Code.</dd>
    <dt>Agent use</dt><dd>Daemon mode exposes <code>mcp-firewall://recent-risks</code> as an MCP resource; agents can self-check before installing new servers.</dd>
  </dl>
</div>

<!-- 3 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">03.</span>
    <h4 class="idea-name"><code>skill-forge</code> — Auto-Generate &amp; Quality-Score Claude Code Skills</h4>
    <div class="idea-tags"><span class="pill tier-s">Tier S</span><span class="pill medium">Medium</span></div>
  </div>
  <p class="idea-hook">"Turn any codebase into a battle-tested skill in 60 seconds."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>mattpocock/skills proved the format; <code>anthropics/skills</code> defined the spec; nobody has skill <em>generation</em> + automated quality grading. Scott Spence's 200-prompt experiment showed skills alone trigger ~20% of the time vs 84% when paired with hooks — measuring this matters.</dd>
    <dt>Audience</dt><dd>Claude Code users with repetitive prompts; teams building shared skill libraries.</dd>
    <dt>Why viral now</dt><dd>Skills are the hottest format of 2026 (mattpocock/skills hit ~77k in three months). Tools that compound the trend ride the wave.</dd>
    <dt>Stack</dt><dd>TypeScript CLI; introspects git history + CLAUDE.md + folder layout → drafts SKILL.md; runs them in a sandboxed Claude Code subprocess against fixtures and scores trigger-rate + token delta.</dd>
    <dt>Agent use</dt><dd><code>skill-forge generate ./my-repo</code> → committed <code>.claude/skills/*</code>. Also itself exposed as an MCP server so an agent can ask "generate me a skill for X" mid-session.</dd>
  </dl>
</div>

<!-- TIER A -->
<h3>Tier A — Strong viral potential</h3>

<!-- 4 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">04.</span>
    <h4 class="idea-name"><code>agent-mem</code> — Local-First, MCP-Native Memory With LoCoMo Benchmarks</h4>
    <div class="idea-tags"><span class="pill tier-a">Tier A</span><span class="pill hard">Hard</span></div>
  </div>
  <p class="idea-hook">"Mem0-quality memory. Zero cloud. One binary."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Mem0 (the April 2026 algorithm by Yadav et al. scored 92.5 on LoCoMo and 94.4 on LongMemEval at &lt;7k tokens/retrieval) is SaaS-shaped; Zep is enterprise; Letta is heavy. No clean local-first agent-memory MCP.</dd>
    <dt>Audience</dt><dd>Claude Code / Codex / Cursor users wanting privacy + speed.</dd>
    <dt>Why viral now</dt><dd>Memory benchmarks are a recurring r/LocalLLaMA topic; Mem0's paper sets a measurable target.</dd>
    <dt>Stack</dt><dd>Rust + sled/SQLite + ONNX bge-small embeddings; single static binary &lt;15MB; exposes <code>remember</code>/<code>recall</code>/<code>forget</code>/<code>graph</code> via MCP.</dd>
    <dt>Agent use</dt><dd>Standard MCP tool calls + an installable SKILL.md that teaches Claude when to write vs. recall.</dd>
  </dl>
</div>

<!-- 5 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">05.</span>
    <h4 class="idea-name"><code>ctx-lens</code> — Per-Session Context Heatmap (Ink TUI)</h4>
    <div class="idea-tags"><span class="pill tier-a">Tier A</span><span class="pill easy">Easy</span></div>
  </div>
  <p class="idea-hook">"See which tool, agent, MCP server, or skill is burning your context — live."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Claude Code's <code>/context</code> shows totals; nobody shows the time-series flame graph or per-tool attribution.</dd>
    <dt>Audience</dt><dd>Power Claude Code users on Max / API.</dd>
    <dt>Why viral now</dt><dd>The "live AI dashboard" demo GIF is highly shareable; ccusage proved the appetite for usage tooling.</dd>
    <dt>Stack</dt><dd>Ink/React TUI + a Stop/PreToolUse hook tailing JSONL. <code>npx ctx-lens</code>. Optional native macOS SwiftUI companion.</dd>
    <dt>Agent use</dt><dd>Read-mostly by humans; exposes <code>ctx-lens://current-session</code> MCP resource so planner agents can query their own footprint.</dd>
  </dl>
</div>

<!-- 6 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">06.</span>
    <h4 class="idea-name"><code>mcp-lazy</code> — Universal Lazy-Loading Gateway for MCP Tools</h4>
    <div class="idea-tags"><span class="pill tier-a">Tier A</span><span class="pill medium">Medium</span></div>
  </div>
  <p class="idea-hook">"Connect 100 MCP servers, pay for 4 tool schemas."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Even with Anthropic's April 2026 Tool Search, most users still inject 100+ tool schemas per session. RaiAnsar/mcp-gateway proved the pattern is underbuilt. Bifrost's published benchmark recorded 92.8% input-token reduction and 92.2% cost reduction at 508 tools across 16 servers with no accuracy loss.</dd>
    <dt>Audience</dt><dd>Anyone with 10+ MCP servers configured.</dd>
    <dt>Why viral now</dt><dd>Tool-sprawl + token-saving is a confirmed-hot category in mid-2026.</dd>
    <dt>Stack</dt><dd>Go single binary; JSON-RPC proxy; exposes one virtual MCP server with 4 meta-tools (<code>discover</code>, <code>invoke</code>, <code>describe</code>, <code>list_by_tag</code>) backed by semantic search.</dd>
    <dt>Agent use</dt><dd>Agent calls <code>discover("send slack message")</code> → gets the exact tool schema, then invokes it.</dd>
  </dl>
</div>

<!-- 7 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">07.</span>
    <h4 class="idea-name"><code>agentscope</code> — Local OpenTelemetry-Native Trace Viewer</h4>
    <div class="idea-tags"><span class="pill tier-a">Tier A</span><span class="pill medium">Medium</span></div>
  </div>
  <p class="idea-hook">"Laminar for your laptop. Zero account, zero cloud."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Langfuse, Laminar, MLflow, Phoenix are team-shaped (per-seat, cloud-first). Solo Claude Code / Codex users have no good local trace viewer for OTel GenAI traces.</dd>
    <dt>Audience</dt><dd>Codex CLI, Claude Code, OpenCode users debugging agent loops.</dd>
    <dt>Why viral now</dt><dd>Agent observability is a top-7 topic across the 2026 listicles; OTel GenAI semantic conventions are stable; OpenLLMetry/OpenInference are mature.</dd>
    <dt>Stack</dt><dd>Rust + DuckDB + Tauri/terminal UI; OTel ingest via OTLP HTTP.</dd>
    <dt>Agent use</dt><dd>Exposes <code>agentscope_query("show last 10 failed tool calls")</code> via MCP so agents can debug themselves.</dd>
  </dl>
</div>

<!-- 8 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">08.</span>
    <h4 class="idea-name"><code>specsmith</code> — Lightweight Spec-Driven Dev Plugin</h4>
    <div class="idea-tags"><span class="pill tier-a">Tier A</span><span class="pill easy">Easy</span></div>
  </div>
  <p class="idea-hook">"GitHub Spec-Kit without the Python install. Six slash commands. One markdown folder."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Spec-Kit (~90k stars) is heavy + Python; OpenSpec is light but limited; spec-driven dev is the cleanest anti-vibe-coding pattern in 2026.</dd>
    <dt>Audience</dt><dd>Claude Code / Codex / Cursor / Windsurf users tired of vibe-coding losses on serious projects.</dd>
    <dt>Why viral now</dt><dd>Spec-driven is a verified-hot category; the gap for a "10-second install, no Python" version is wide open.</dd>
    <dt>Stack</dt><dd>One-shell installer; <code>.claude/skills/specsmith/SKILL.md</code> exposing <code>/spec</code>, <code>/plan</code>, <code>/tasks</code>, <code>/verify</code>, <code>/archive</code>. Works with any agent supporting the open Skills standard.</dd>
    <dt>Agent use</dt><dd>Pure slash-command + skill discovery; agents pick up the workflow automatically.</dd>
  </dl>
</div>

<!-- 9 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">09.</span>
    <h4 class="idea-name"><code>swarmpad</code> — Kanban TUI for Parallel Claude Code Worktrees</h4>
    <div class="idea-tags"><span class="pill tier-a">Tier A</span><span class="pill medium">Medium</span></div>
  </div>
  <p class="idea-hook">"Run 8 Claude agents in 8 worktrees on one repo. Watch them race."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Claude Code's <code>--worktree</code> flag (v2.1.50, Feb 20, 2026) made parallel agents trivial; the orchestrator UX is wide open. Upsun's Dev Center reports incident.io "runs four or five parallel Claude agents routinely" — and the Claude Directory cites 4–8 worktrees per dev as the 2026 ceiling.</dd>
    <dt>Audience</dt><dd>Vibecoders pushing throughput; CTOs running engineering leaderboards.</dd>
    <dt>Why viral now</dt><dd>Boris Cherny's worktree announcement got 1M+ views on X. The demo GIF of 8 columns advancing in parallel is exactly the shareable artifact.</dd>
    <dt>Stack</dt><dd>Bun + Ink + a tiny worktree manager; columns = todo/wip/review/merge; auto-merges clean diffs.</dd>
    <dt>Agent use</dt><dd>Each card spawns a Claude Code subprocess in its own worktree; the orchestrator exposes MCP tools <code>assign_card</code>, <code>request_review</code>.</dd>
  </dl>
</div>

<!-- 10 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">10.</span>
    <h4 class="idea-name"><code>skillshop</code> — Curated, Quality-Scored Skill Registry With Live Tests</h4>
    <div class="idea-tags"><span class="pill tier-a">Tier A</span><span class="pill medium">Medium</span></div>
  </div>
  <p class="idea-hook">"The npm of Claude Code skills, but every package has a test."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>1000+ awesome-skills lists are noisy and untested; mattpocock/skills proved curation works; no neutral registry yet exists.</dd>
    <dt>Audience</dt><dd>Skill consumers and skill authors.</dd>
    <dt>Why viral now</dt><dd>Every ecosystem produces a registry (npm, MCP.Directory, awesome-*). Plugin marketplace mechanics drive virality.</dd>
    <dt>Stack</dt><dd>Astro/Next + Cloudflare Workers; CI runs each submitted skill against an evaluator harness; "trigger rate" + "token delta" scores public per skill.</dd>
    <dt>Agent use</dt><dd>MCP tool <code>skillshop://search?q=tdd</code> returns top-3 scored skills with one-line install.</dd>
  </dl>
</div>

<!-- TIER B -->
<h3>Tier B — High potential, narrower audience</h3>

<!-- 11 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">11.</span>
    <h4 class="idea-name"><code>claude-replay</code> — Deterministic Replay of Claude Code Sessions</h4>
    <div class="idea-tags"><span class="pill tier-b">Tier B</span><span class="pill medium">Medium</span></div>
  </div>
  <p class="idea-hook">"git rerere for your agent. Replay any session, swap models, diff outputs."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Debugging an agent failure today means re-running and praying for determinism.</dd>
    <dt>Stack</dt><dd>Hooks-only; captures all tool I/O + model responses to a sidecar JSONL; <code>claude-replay run --model claude-sonnet-4-6</code> to A/B.</dd>
    <dt>Agent use</dt><dd>MCP tool <code>replay_step(session_id, step_n)</code> for retrospective subagents.</dd>
  </dl>
</div>

<!-- 12 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">12.</span>
    <h4 class="idea-name"><code>promptkit</code> — In-Repo Prompt Caching Validator</h4>
    <div class="idea-tags"><span class="pill tier-b">Tier B</span><span class="pill easy">Easy</span></div>
  </div>
  <p class="idea-hook">"Stop leaving 90% savings on the table."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Most agent code forgets <code>cache_control</code>. Per Anthropic's official pricing, Claude Opus 4.6 standard input is $5.00/MTok and Cache Hits cost $0.50/MTok — exactly a 90% discount. The 5-minute cache write costs 1.25× base, the 1-hour write 2× base.</dd>
    <dt>Stack</dt><dd>Lint rule + runtime decorator for Python/TS; warns when a system-prompt-shaped string isn't cached.</dd>
    <dt>Agent use</dt><dd>Library + <code>promptkit_lint</code> MCP tool for a code-review subagent.</dd>
  </dl>
</div>

<!-- 13 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">13.</span>
    <h4 class="idea-name"><code>mcp-doctor</code> — Health, Latency &amp; Tool-Drift Monitor for Local MCP Servers</h4>
    <div class="idea-tags"><span class="pill tier-b">Tier B</span><span class="pill easy">Easy</span></div>
  </div>
  <p class="idea-hook">"Why is Claude slow today? Find out in 5 seconds."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>When an MCP server hangs, Claude Code hangs; no built-in diagnostics.</dd>
    <dt>Stack</dt><dd>Go CLI that pings each configured server, measures <code>tools/list</code> latency, diffs tool descriptions vs last run (rug-pull detection).</dd>
    <dt>Agent use</dt><dd><code>mcp-doctor health</code> emits structured JSON the agent can parse.</dd>
  </dl>
</div>

<!-- 14 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">14.</span>
    <h4 class="idea-name"><code>agent-eval</code> — One-Command Eval Harness for Coding Agents</h4>
    <div class="idea-tags"><span class="pill tier-b">Tier B</span><span class="pill medium">Medium</span></div>
  </div>
  <p class="idea-hook">"Did Opus 4.7 actually beat 4.6 on your codebase? Find out tonight."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Anthropic ships new models every 2–4 weeks (Opus 4.6 → 4.7). Developers can't easily benchmark on their own repos.</dd>
    <dt>Stack</dt><dd>TS CLI + JSONL fixtures; spawns subagents per model; scores via LLM-judge + ast-grep assertions.</dd>
    <dt>Agent use</dt><dd>Agents invoke <code>agent-eval run --suite refactor</code> as a pre-commit subagent.</dd>
  </dl>
</div>

<!-- 15 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">15.</span>
    <h4 class="idea-name"><code>context-curator</code> — Smart <code>.claudeignore</code> Generator</h4>
    <div class="idea-tags"><span class="pill tier-b">Tier B</span><span class="pill easy">Easy</span></div>
  </div>
  <p class="idea-hook">"Your <code>node_modules</code> is eating your context. Fix it."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd><code>.claudeignore</code> / file-tree pruning is hand-rolled; massive token waste.</dd>
    <dt>Stack</dt><dd>CLI introspects the repo and emits an opinionated <code>.claudeignore</code> + suggested subagent boundaries.</dd>
    <dt>Agent use</dt><dd><code>context_curator_recommend()</code> MCP tool returns one-line edits agents can apply.</dd>
  </dl>
</div>

<!-- 16 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">16.</span>
    <h4 class="idea-name"><code>statusforge</code> — Beautiful Statusline Library for Claude Code</h4>
    <div class="idea-tags"><span class="pill tier-b">Tier B</span><span class="pill easy">Easy</span></div>
  </div>
  <p class="idea-hook">"Powerline for your AI. Tokens, $, burn rate, ETA — themed."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Claude Code 2.x supports statusline scripts; existing ones are basic.</dd>
    <dt>Stack</dt><dd>TS library + 12 themes; reads <code>/usage</code> data and prompt-cache hit rates.</dd>
    <dt>Agent use</dt><dd>Indirect — humans see; agents read <code>statusforge://current</code> resource.</dd>
  </dl>
</div>

<!-- 17 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">17.</span>
    <h4 class="idea-name"><code>hookshop</code> — Curated Marketplace + Tester for Claude Code Hooks</h4>
    <div class="idea-tags"><span class="pill tier-b">Tier B</span><span class="pill easy">Easy</span></div>
  </div>
  <p class="idea-hook">"27 hook events, 100 hooks, one install command."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>disler/claude-code-hooks-mastery is the reference; discovery is hard; no quality tests.</dd>
    <dt>Stack</dt><dd>Static site + <code>npx hookshop add &lt;name&gt;</code>; each hook ships with <code>test.sh</code> and a CI badge.</dd>
    <dt>Agent use</dt><dd><code>hookshop install &lt;name&gt;</code>; registry queryable via MCP.</dd>
  </dl>
</div>

<!-- 18 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">18.</span>
    <h4 class="idea-name"><code>promptpack</code> — Versioned, Cache-Friendly Prompt Bundles</h4>
    <div class="idea-tags"><span class="pill tier-b">Tier B</span><span class="pill medium">Medium</span></div>
  </div>
  <p class="idea-hook">"Treat prompts like Docker images: tag, ship, cache."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Multi-env prompt drift; cache_control segmentation is error-prone; per Anthropic's pricing page, getting caching right is the difference between $5.00/MTok and $0.50/MTok on Opus 4.6.</dd>
    <dt>Stack</dt><dd><code>promptpack.yml</code> → content-addressable bundle; SDK wrappers for Anthropic + OpenAI + Vercel AI SDK.</dd>
    <dt>Agent use</dt><dd>Library; cache hits go up automatically.</dd>
  </dl>
</div>

<!-- 19 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">19.</span>
    <h4 class="idea-name"><code>mcp-typegen</code> — Strongly Typed MCP Server Generator</h4>
    <div class="idea-tags"><span class="pill tier-b">Tier B</span><span class="pill medium">Medium</span></div>
  </div>
  <p class="idea-hook">"OpenAPI → MCP in 30 seconds."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Most MCP servers are hand-written; Apify/Pipedream cover SaaS APIs but local services lack a generator.</dd>
    <dt>Stack</dt><dd>CLI ingests OpenAPI 3.x or Zod schema → emits FastMCP (Python) or <code>@modelcontextprotocol/sdk</code> (TS) server.</dd>
    <dt>Agent use</dt><dd>Run by humans; the generated servers are agent-native by construction.</dd>
  </dl>
</div>

<!-- 20 -->
<div class="idea">
  <div class="idea-header">
    <span class="idea-num">20.</span>
    <h4 class="idea-name"><code>sandboxd</code> — Throwaway VM for Agent Shell Commands (E2B-lite, Local)</h4>
    <div class="idea-tags"><span class="pill tier-b">Tier B</span><span class="pill hard">Hard</span></div>
  </div>
  <p class="idea-hook">"E2B without the cloud bill."</p>
  <dl class="idea-grid">
    <dt>Pain</dt><dd>Letting Claude Code run <code>bash</code> against your host is scary; E2B costs add up.</dd>
    <dt>Stack</dt><dd>Lima (macOS) / systemd-nspawn (Linux) wrapper; exposes <code>run_in_sandbox(cmd)</code> via MCP with per-call filesystem snapshots.</dd>
    <dt>Agent use</dt><dd>Drop-in replacement for <code>Bash</code> via Claude Code hook policy.</dd>
  </dl>
</div>

<!-- PROMOTION -->
<h2 id="promo">Promotion Plan — Reaching 5k+ Stars With No Audience</h2>

<h3>Universal pre-launch checklist</h3>
<ol>
  <li><strong>Repo polish first.</strong> Hero GIF (Asciinema/Terminalizer), single-line install (<code>npx</code>/<code>uvx</code>), one concrete benchmark number in the opening paragraph, MIT license, <code>examples/</code> folder, an explicit "Agent use" subsection so LLMs themselves recommend you.</li>
  <li><strong>Awesome-list PRs filed pre-launch:</strong> <code>hesreallyhim/awesome-claude-code</code>, <code>rohitg00/awesome-claude-code-toolkit</code>, <code>punkpeye/awesome-mcp-servers</code>, <code>TensorBlock/awesome-mcp-servers</code>, <code>tolkonepiu/best-of-mcp-servers</code>, <code>VoltAgent/awesome-agent-skills</code>. Many merge in 24–48h.</li>
  <li><strong>MCP registry submissions on day one:</strong> MCP.Directory, mcpmarket.com, PulseMCP, Continue.dev's directory, LobeHub.</li>
  <li><strong>Plugin-marketplace packaging</strong> (for skills/hooks/plugins): inclusion = instant install.</li>
  <li><strong>Naming convention:</strong> short, single-word, evocative (Serena, Superpowers, Context7, ccusage). Avoid "AI-Powered" anything.</li>
</ol>

<h3>Channel-specific tactics</h3>
<ul>
  <li><strong>Twitter/X:</strong> 4–6 tweet thread. Tweet 1 = video GIF; 2 = code/install; 3 = benchmark number; 4 = install line; 5 = "built with Claude Code in X days" honesty; 6 = repo link. Pin the most-replied-to tweet. Tag relevant creators only when authentic.</li>
  <li><strong>r/ClaudeAI &amp; r/ChatGPTCoding:</strong> Pain-point first, tool second. The community rejects marketing copy and embraces "I built this because I was sick of X."</li>
  <li><strong>r/LocalLLaMA:</strong> Best for memory/inference/local-first ideas (#4, #20). Quote benchmarks.</li>
  <li><strong>Show HN:</strong> Per arXiv 2511.04453 (Kraishan, Texas Tech, Nov 2025), a sample of 138 repository launches in 2024–25 gained an average of 121 stars within 24 hours, 189 within 48 hours, and 289 within a week of HN exposure, with the "Show HN" tag showing no statistical advantage after controlling for timing. Myriade's BigQuery analysis of 157k+ Show HN posts found that, contrary to conventional advice, weekends actually outperformed weekdays for "breakout" success (≥30 votes) — fewer competing posts means standout is easier. Use HN as a velocity boost, not a primary channel.</li>
  <li><strong>Discord:</strong> Anthropic Discord <code>#community-showcase</code>, MCP Discord, LangChain Discord. Drop a 90-second screen capture.</li>
  <li><strong>Newsletters / blogs:</strong> Latent Space, ByteByteGo, The New Stack, Developer's Digest, KDnuggets, Firecrawl blog, Stacklok docs (good MCP-server roundups).</li>
  <li><strong>GitHub Topics:</strong> tag with <code>claude-code</code>, <code>mcp</code>, <code>model-context-protocol</code>, <code>claude-code-plugin</code>, <code>serena</code>, <code>vibe-coding</code>. These are browse-able by humans and agents.</li>
  <li><strong>README SEO:</strong> Include the literal phrases users actually search ("Claude Code token usage," "MCP tool poisoning," "spec-driven development").</li>
</ul>

<h3>Week-by-week launch sequence</h3>

<div class="week">
  <h4>Week –2 to –1 — Build &amp; seed</h4>
  <ul>
    <li>Soft-publish; finalize README with the benchmark number.</li>
    <li>Get 3–5 friends to actually try it; collect a one-line quote each.</li>
    <li>File PRs to the awesome lists <em>before</em> the public launch.</li>
    <li>Reserve handles: domain (if useful), <code>@</code> on X/Bluesky, npm name, PyPI name.</li>
  </ul>
</div>

<div class="week">
  <h4>Week 0 — Launch day</h4>
  <ul>
    <li><strong>Tuesday or Wednesday ~10 AM US Eastern</strong> for Twitter + HN (Myriade's BigQuery analysis suggests weekend is also viable for HN breakouts — pick based on whether your goal is total reach or front-page algorithmic placement).</li>
    <li><strong>Twitter first.</strong> The Tier-A repos almost all launched here, not Show HN.</li>
    <li><strong>Show HN ~2h later.</strong> Title format: <code>Show HN: &lt;Name&gt; – &lt;one-line value prop&gt;</code>. Per arXiv 2511.04453, posting hour strongly affects launch success; off-peak early Pacific often gets the algorithmic boost.</li>
    <li><strong>r/ClaudeAI + r/ChatGPTCoding + r/LocalLLaMA + r/MCP</strong> — separate posts, tailored copy, GIF embedded. Don't cross-post identical titles (auto-removed).</li>
    <li><strong>Discord drops + MCP-registry submissions.</strong></li>
  </ul>
</div>

<div class="week">
  <h4>Week 1 — Sustain</h4>
  <ul>
    <li>Reply to every GitHub issue and tweet within 6 hours.</li>
    <li>Ship one substantive update by Friday — "actively maintained" compounds star velocity.</li>
    <li>Pitch one writeup to Latent Space / ByteByteGo / The New Stack / Developer's Digest, or guest-blog for Firecrawl/Stacklok roundups.</li>
    <li>File a Product Hunt launch for the following Tuesday.</li>
  </ul>
</div>

<div class="week">
  <h4>Week 2 — Compound</h4>
  <ul>
    <li>Ship v0.2 with a "you asked, we shipped" CHANGELOG.</li>
    <li>Publish a comparison post positioning vs the nearest competitor (e.g., "agent-mem vs Mem0 vs Zep").</li>
    <li>Reach out to YouTube channels that cover Claude Code (Mertz, AI Jason, NetworkChuck-style) with a 90-second demo.</li>
  </ul>
</div>

<div class="week">
  <h4>Week 3–4 — Re-attention</h4>
  <ul>
    <li>Repurpose the launch as a "lessons learned" thread for round-two attention.</li>
    <li>Pitch a talk to AI Engineer / MCP Summit / agent conferences — even a rejection email gets noticed.</li>
    <li>Submit a Hacker News <em>blog post</em> about the building process. Often outperforms the original Show HN.</li>
  </ul>
</div>

<h3>Benchmarks that should change your plan</h3>
<ul>
  <li><strong>If you don't hit 200 stars in 48h:</strong> the README or demo is the problem. Rewrite, re-GIF, repost in 2 weeks with a different angle.</li>
  <li><strong>If you cross 1k stars in week 1:</strong> ship a v0.2 fast — momentum compounds.</li>
  <li><strong>If you stall at 2–3k:</strong> write a deep-dive blog ("why X is hard"), pitch to Latent Space, re-launch on Product Hunt with a polished video.</li>
  <li><strong>If you cross 5k:</strong> you have product-market fit; start planning a v1.0 release with a paid hosted tier or commercial license escape hatch.</li>
</ul>

<!-- CAVEATS -->
<h2 id="caveats">Caveats</h2>
<div class="caveat">
  <p><strong>Star counts move fast.</strong> Superpowers grew ~6k stars/week through Q1 2026; figures like 107k vs 195k are both correct at different timestamps. Cross-check the day you launch.</p>
</div>
<div class="caveat">
  <p><strong>One specific claim is unverified.</strong> The widely cited ~109k stars on <code>forrestchang/andrej-karpathy-skills</code> could not be corroborated by the subagent's verification pass; the verifiable figure appears closer to ~3.5k. The repo <em>did</em> go viral on Reddit, but at a much smaller scale than the original claim. Treat any "single-markdown-file" star claim with skepticism — they're frequently confused across forks.</p>
</div>
<div class="caveat">
  <p><strong>MCP security is unstable.</strong> The OX Security disclosure (April 15, 2026) and ContextCrush (Feb 2026) mean any tool that touches MCP must take supply-chain seriously. Anthropic declined to patch STDIO behavior, putting the burden on downstream implementers — including you.</p>
</div>
<div class="caveat">
  <p><strong>Claude Code's surface evolves monthly.</strong> Skills, Subagents, Agent Teams, Hooks landed across Oct 2025 → Feb 2026. Today's "missing capability" may be tomorrow's built-in. Ideas #5 (<code>ctx-lens</code>) and #16 (<code>statusforge</code>) compete with features Anthropic could absorb at any time.</p>
</div>
<div class="caveat">
  <p><strong>Two ideas compete with funded companies.</strong> #4 <code>agent-mem</code> goes head-to-head with Mem0/Zep/Letta; #20 <code>sandboxd</code> with E2B. Local-first + OSS is your differentiator — don't try to out-feature them.</p>
</div>
<div class="caveat">
  <p><strong>Show HN underperforms Twitter in this niche.</strong> Per arXiv 2511.04453, the "Show HN" tag has no statistical advantage after controlling for timing; the Tier-A repos in 2026 launched via X creator threads.</p>
</div>
<div class="caveat">
  <p><strong>Several quantitative claims come from secondary sources</strong> (industry blog summaries, vendor benchmarks, listicles dated April–May 2026). Verify on the day you act — especially Bifrost's "92.8% / 92.2%" gateway benchmark (vendor-published, getmaxim.ai April 2026) and the worktree-concurrency norms (Upsun / Claude Directory).</p>
</div>

<hr class="soft">
<p class="small">Generated May 21, 2026. Light theme. Built as a single self-contained HTML file — no external CSS/JS dependencies. Save as <code>.html</code> and open in any browser.</p>

</div>
</body>
</html>
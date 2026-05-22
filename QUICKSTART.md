# tokenwarden — Quickstart

**ccusage tells you what you spent. tokenwarden stops you from overspending.**

## Install

```bash
npx tokenwarden install   # wires hooks into Claude Code settings.json
```

<details>
<summary>From source (no npm)</summary>

```bash
git clone https://github.com/cryptosaras/tokenward.git
cd tokenward && npm install && npm run build
npm link
tokenwarden install
```
</details>

## Use

| Command | What it does |
|---|---|
| `tokenwarden install` | Wire into Claude Code |
| `tokenwarden status` | Spend vs caps (+ usage windows if on a plan) |
| `tokenwarden report` | Past spend, by day & model |
| `tokenwarden doctor` | Health check |
| `tokenwarden init` | Create a `.tokenwarden.json` |
| `tokenwarden uninstall` | Remove everything it added |

## Turn on enforcement

Starts in **observe mode** — logs what it *would* block, blocks nothing. When ready:

```bash
tokenwarden init                  # writes .tokenwarden.json
# edit it:  "mode": "enforce"
```

## On a paid plan ($100 Max, etc.)?

Dollars aren't your limit — usage windows are. Track your rolling 5-hour + weekly windows:

```json
{ "subscription": { "plan": "max5x" } }
```

Plans: `"pro"` · `"max5x"` · `"max20x"`. Then `tokenwarden status` shows window usage.

---

Full docs: [README.md](README.md) · all `$` figures are estimates · every hook fails open.

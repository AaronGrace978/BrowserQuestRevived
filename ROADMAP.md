# BrowserQuest Revival — Enhancement Roadmap

Living plan for what comes after the current playable revival.  
Repo: [AaronGrace978/BrowserQuestRevived](https://github.com/AaronGrace978/BrowserQuestRevived)

**Dedicated to [Mozilla](https://www.mozilla.org/) and [Little Workshop](http://www.littleworkshop.fr/)** — Guillaume Lecollinet & Franck Lecollinet.

---

## Status today (shipped)

- Modern Node server + one-command local play
- AI NPCs (OpenAI / Anthropic / Ollama Cloud / local Ollama) with unique scripts
- Admin settings UI (`/admin`) with provider + model dropdowns, localhost-or-token access
- **Ollama Cloud hardened** — strips `:cloud` for `ollama.com`, higher reply budget for thinking models, curated cloud catalog, custom model id tucked under Advanced (blocks API-key autofill into the model field)
- **Spawn / combat stability** — armor/weapon ranks no longer depend on a missing global `_` (was NaN HP → instant death + blank screen); native `Map` preserved so `fetch()` / AI calls don’t crash the server
- Custom soundtrack with quiet crossfades, combat cues, Enemy Defeated sting
- Credits / dedication art for Mozilla + original creators
- Client UI polish: crisp pixels, fixed mobile death screen, credits fit, chat NPC mode, AI HUD indicator, same-origin connect, faster classic NPC fallback when AI is slow

---

## Phase A — Public multiplayer (next)

Goal: strangers and collaborators can open a URL and play together.

| Item | Notes |
|------|--------|
| Same-origin WebSocket host | **Done** — client prefers page hostname/port (no localhost trap for remote players) |
| Hosted deploy | VPS / Fly / Railway / Render — document one recommended path |
| HTTPS + WSS | Required if the site is served over HTTPS |
| `ADMIN_TOKEN` for production | Protect `/admin` when the server is on the public internet |
| Capacity tuning | Adjust `nb_worlds` / `nb_players_per_world` for the host size |
| Status / health | Keep `/status`; optional uptime check for collaborators |

---

## Phase B — Persistence & accounts

Goal: progress survives refresh and feels like a real MMO save.

| Item | Notes |
|------|--------|
| Character persistence | Name, armor, weapon, checkpoint survive reconnect |
| Optional accounts | Lightweight login (or guest + claim-later) |
| Achievements sync | Server-side unlock store |
| Anti-cheat basics | Validate gear/progress on the server |

---

## Phase C — World & content

Goal: more reasons to explore beyond the classic map.

| Item | Notes |
|------|--------|
| New zones / map expansions | Keep classic art language |
| New mobs / items / chests | Data-driven where possible |
| Quests / NPC goals | Pair with AI dialogue for flavor |
| Boss encounters polish | Dedicated music already supports boss/skeleton cues |
| Seasonal or collab events | Easy content packs for the 6+ collaborators |

---

## Phase D — AI & social polish

Goal: smarter NPCs and clearer multiplayer social feel.

| Item | Notes |
|------|--------|
| Ollama Cloud reliability | **Done** — model name normalization, thinking-token budget, fail-fast config errors, admin UX so dropdown wins over autofill |
| Faster NPC fallback | **Done** — client falls back to classic scripts ~3.5s if AI is silent |
| Per-NPC memory across sessions | Tied to persistence |
| Safer AI prompts / rate limits | Partially in place — expand (per-IP limits, abuse caps) |
| In-game “AI on/off” indicator | **Done** — HUD pill via public `/api/ai-status` (no keys in the client) |
| Chat UX | **Done** — NPC vs world chat placeholder + tint when targeting an NPC |
| Voice / streaming (later) | Out of scope until text AI is solid |

---

## Phase E — Platform & contributor experience

Goal: easy for collaborators to ship without breaking the revival.

| Item | Notes |
|------|--------|
| Contributor guide | How to run, `/admin`, music, map tools, Ollama Cloud tips |
| CI smoke test | Boot server + `/status` + static `/admin` + spawn HP sanity |
| Default branch clarity | `main` and `master` kept in sync for now |
| Issue / project boards | Track roadmap items as GitHub issues |
| Code of conduct / contributing | Friendly defaults for a public revival |

---

## Explicitly not rushing

- Full TypeScript/React rewrite of the classic client
- Replacing Little Workshop art/style
- Shipping API keys to browsers
- Pushing to `mozilla/BrowserQuest` (this lives on **BrowserQuestRevived**)

---

## How we pick “what’s next”

1. **Phase A** if the goal is “more people can join tonight”  
2. **Phase B** if the goal is “don’t lose my character”  
3. **Phase C** if the goal is “new adventures”  
4. Otherwise polish **Phase D/E** in parallel with collaborators  

When an item starts, open a GitHub issue, link it here, and check it off when merged.

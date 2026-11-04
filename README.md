# Ashgrave: The Midnight Inquest

A multiplayer gothic murder mystery played in team chat. Every suspect, the victim's ghost, the forensics lab and the game master are AI agents (characters played by Meta's Muse Spark) living in [Switch](https://github.com/sandbox-quantum/switch) rooms on Mattermost. Players question them, test evidence, catch lies, and name the killer.

Built for the **Flip the Switch** hackathon (WeMakeDevs × Switch, Nov 4–7 2026).

## Why it needs Switch

Each agent only sees the rooms it belongs to. The killer can't read your private clues, suspects can't read each other's secrets, and no agent ever holds the solution: agents ask the game engine for the facts they are allowed at that moment.

| Room | Members | Purpose |
|---|---|---|
| `#conservatory` | all players, every agent | The shared investigation |
| `🔒 detective-<name>` | one player, game-master | Private clues |
| `#interrogation-<suspect>` | a player, one suspect | One-on-one questioning |

## The cast

| Agent | Plays | Model |
|---|---|---|
| `game-master` | Acts, searches, private clues, accusation and scoring | game engine (no LLM) |
| `thomas-reed`, `clara-ashgrave`, `dr-vale`, `mrs-holloway` | The four suspects | Muse Spark 1.3 |
| `ghost-of-verity` | The victim, whose memory returns when shown evidence | Muse Spark 1.3 |
| `forensics-lab` | Lab reports on evidence you found | game engine (no LLM) |
| `evidence-clerk` | Case file and contradictions | Muse Spark 1.3 |

## Run it

**Try it in the terminal first** (no Switch needed):

```bash
npm install
cp .env.example .env        # add MODEL_API_KEY (Meta Model API) for real character replies
npm run sim -- --demo       # scripted solve
npm run sim                 # play it yourself
```

**On Switch + Mattermost:**

1. Install and start Docker, then [Switch Console](https://docs.switchagents.ai/switch-rooms/getting-started/install-switch-console.md). Choose **Run a server on this computer**.
2. Sign in to the bundled Mattermost (Console → Home → Messaging apps → Mattermost → Sign-in details).
3. In the Gateway, create an **API key of type registration**. Put it in `.env` as `SWITCH_REGISTRATION_KEY`, and set `SWITCH_BRIDGE_URL`.
4. `npm run probe` checks the bridge URL.
5. `npm run register` registers all eight agents and saves their keys to `.switch-agents.json`.
6. Create a room (`#conservatory`) in Console, invite all eight agents, and your private room with just `game-master`.
7. `npm run rooms` lists room ids and writes `rooms.json`. Fill in the ids.
8. `npm start`, then in Mattermost: `@game-master join`, `@game-master start`.

## How to play

- `@game-master search <place>`: conservatory, study, kitchen, greenhouse, back-door, clara-room
- `@forensics-lab <evidence>`: test something you found (6 tests a game)
- `@ghost-of-verity`: show her evidence and she remembers
- `@thomas-reed`, `@clara-ashgrave`, `@dr-vale`, `@mrs-holloway`: question them. Confront a suspect with the right proof and their lie cracks.
- `@game-master accuse <suspect> how: <evidence> why: <evidence>`

## Development

```bash
npm test          # engine rules, case consistency, leak checks
npm run typecheck
```

```
src/case/        the mystery as data (black-orchid.ts holds spoilers)
src/engine/      game rules and state, no network
src/runtime/     the cast: prompts and message handling
src/switch/      Switch agent protocol client (WebSocket + HTTP)
src/main.ts      runs every agent against a Switch server
scripts/         probe, register, rooms, terminal simulator
```

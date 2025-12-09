# Subgraph Sentinel

Bun + grammy Telegram bot that watches The Graph subgraphs for fee regressions, KPI drops, indexer rotations, and fetch failures. State is stored on disk in SQLite via KeyV (no system SQLite install needed with Bun).

## Setup
1. Install deps: `bun install`
2. Create `.env` in repo root:
```
TELEGRAM_BOT_TOKEN=xxxx
GRAPH_GATEWAY_API_KEY=yyyy          # needed for gateway + attestation lookups
NEXT_PUBLIC_GNOSIS_LM_SUBGRAPH_URL= # Legacy Mech subgraph URL (full HTTP)
NEXT_PUBLIC_MODE_REGISTRY_SUBGRAPH_URL= # Mode registry URL (full HTTP)
```
3. Run the bot: `bun start`

## What it monitors
- Legacy fees subgraph (total, legacy, marketplace) for decreases and indexer flips.
- ATA subgraphs: Gnosis MM, Base MM, Legacy Mech (env URL).
- Registry subgraphs: Gnosis, Base, Mode (env), Optimism, Celo, Ethereum, Polygon, Arbitrum.
- Alerts fire on fetch errors, value drops, or indexer rotations (when attestations present).

## Bot commands
- `/start` subscribe this chat
- `/mute` stop alerts
- `/status` latest fee and KPI totals
- `/history` last 10 alert lines
- `/analyze` recent indexer inconsistencies (distinct indexers, value range)
- `/report` last detailed alert batch
- `/alerts` subscription status and signals tracked
- `/help` command list

## Notes
- Polls every 5 minutes. Summaries send every 5 minutes (configurable via `ALERT_SEND_INTERVAL_MS`). Early exits when URLs or keys are missing to stay quiet.
- State persisted in `data/state.sqlite` via KeyV + SQLite; no external DB install required.
- GraphQL queries live in `src/queries/*.graphql` and are loaded as raw strings.
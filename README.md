# Subgraph Sentinel

Bun + Grammy Telegram bot that watches The Graph subgraphs for sync lag and indexing errors. Uses universal `_meta` query combined with RPC block height comparison. State is stored on disk in SQLite via KeyV.

## Setup

1. Install deps: `bun install`
2. Create `.env` in repo root:
```
TELEGRAM_BOT_TOKEN=xxxx
GRAPH_GATEWAY_API_KEY=yyyy          # needed for gateway subgraphs
NEXT_PUBLIC_GNOSIS_LM_SUBGRAPH_URL= # Legacy Mech subgraph URL (full HTTP)
NEXT_PUBLIC_MODE_REGISTRY_SUBGRAPH_URL= # Mode registry URL (full HTTP)
```
3. Run the bot: `bun start`

## What it monitors

- **Sync lag**: Compares subgraph block number against chain head via RPC
- **Indexing errors**: Checks `_meta.hasIndexingErrors` flag
- **Fetch failures**: Detects when subgraph endpoints are unreachable

Alerts fire only on state transitions (e.g., ok → lagging) to prevent spam.

## Bot commands

- `/start` subscribe this chat
- `/mute` stop alerts
- `/status` top 10 endpoints with sync status
- `/history` last 10 alert lines
- `/check` run sync checks on all endpoints
- `/report` last detailed alert batch
- `/alerts` subscription status
- `/endpoints` list all monitored endpoints with lag info
- `/endpoint_add <chain> <url> <name>` add a new endpoint
- `/endpoint_remove <name>` remove an endpoint
- `/explain` what the bot monitors and how alerts work
- `/help` command list

## Configuration

| Variable | Description | Default |
| -------- | ----------- | ------- |
| `SYNC_LAG_THRESHOLD` | Blocks behind before alerting | 100 |
| `SYNC_CHECK_INTERVAL_MS` | Poll interval | 300000 (5 min) |
| `ALERT_SEND_INTERVAL_MS` | Alert batching interval | 300000 (5 min) |
| `POLL_CONCURRENCY` | Parallel requests | 20 |
| `*_RPC_URL` | Per-chain RPC URLs | Public defaults |

## Notes

- State persisted in `data/state.sqlite` (KeyV + SQLite)
- Endpoints stored in `data/endpoints.json`; defaults migrated from config on first run
- Uses standard `_meta` query that all Graph subgraphs support

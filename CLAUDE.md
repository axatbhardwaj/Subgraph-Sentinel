# Subgraph Sentinel

Telegram bot monitoring The Graph subgraphs for sync status via `_meta` query and RPC block height comparison.

## Files

| File           | What                                 | When to read                                     |
| -------------- | ------------------------------------ | ------------------------------------------------ |
| `README.md`    | Project overview, setup, bot commands| Getting started, understanding bot features      |
| `package.json` | Dependencies and scripts             | Adding dependencies, checking available scripts  |
| `.env.example` | Environment variable template        | Setting up new instance, adding config variables |
| `.gitignore`   | Git exclusions                       | Modifying tracked files                          |
| `LICENSE`      | MIT license                          | Checking license terms                           |

## Subdirectories

| Directory  | What                                     | When to read                                        |
| ---------- | ---------------------------------------- | --------------------------------------------------- |
| `src/`     | Core bot logic: polling, sync, commands  | Modifying bot behavior, adding features             |
| `helpers/` | Standalone diagnostic scripts            | Debugging subgraphs, testing sync status            |
| `data/`    | Runtime data (sqlite, logs, endpoints)   | Never edit directly; generated at runtime           |

## Build

```bash
bun install
```

## Run

```bash
bun start
```

## Test

```bash
bun run helpers/check_pollings.js        # Check stored sync state
bun run helpers/check_subgraph_health.js # Run live sync checks
```

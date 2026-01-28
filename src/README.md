# src/ Architecture

## Overview

Core bot logic for monitoring The Graph subgraphs via universal `_meta` query. Compares subgraph block height against chain head (via RPC) to detect sync lag. State-transition alerts prevent notification spam.

## Data Flow

```
bot.js (entry)
    |
    +-- loadEndpoints()     [endpoints.js]
    +-- buildPoll()         [jobs.js] -- 5 min interval
            |
            +-- runSyncChecks()  [sync.js]
            |       |
            |       +-- checkSync() for each endpoint
            |       |       +-- getChainHead()      -- RPC eth_blockNumber
            |       |       +-- getSubgraphBlock()  -- GraphQL _meta query
            |       |
            |       +-- updateSyncAlertState()  -- state transitions
            |
            +-- queueAlerts() -> flushAlerts() -> Telegram
```

## Design Decisions

**Universal `_meta` query**: All Graph subgraphs expose `_meta { block { number } hasIndexingErrors }`. This eliminates the need for custom queries per subgraph type and provides consistent sync monitoring.

**RPC block comparison**: Instead of tracking monotonic values (tx counts), we compare against actual chain head. This gives absolute sync status rather than relative changes.

**State-transition alerting**: Alerts fire only when status changes (ok → lagging, lagging → ok). This prevents spam during persistent issues. State stored in KeyV as `sync:alert:{name}`.

**Transaction pattern for persistence**: `commitEndpoints()` writes JSON to disk before updating in-memory state. This prevents state divergence if the process crashes mid-operation.

## Invariants

- All endpoints must have a `name` and `chain` field
- Sync checks never throw; errors are returned in result objects
- Alerts are queued and only sent after `flushAlerts()` is called
- Endpoints persist to `data/endpoints.json`; in-memory state mirrors disk

## Module Responsibilities

| Module         | Single Responsibility                              |
| -------------- | -------------------------------------------------- |
| `sync.js`      | RPC calls, _meta queries, lag calculation, alerts  |
| `endpoints.js` | Endpoint CRUD and chain grouping                   |
| `jobs.js`      | Poll orchestration and alert batching              |
| `store.js`     | KeyV persistence layer                             |
| `commands.js`  | Telegram command handlers                          |

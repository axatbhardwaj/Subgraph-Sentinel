# src/

Core bot logic for sync-only subgraph monitoring.

## Files

| File           | What                                        | When to read                                              |
| -------------- | ------------------------------------------- | --------------------------------------------------------- |
| `README.md`    | Architecture, design decisions              | Understanding module interactions, sync flow              |
| `bot.js`       | Entry point, Grammy bot initialization      | Modifying startup sequence, adding intervals              |
| `config.js`    | Environment vars, RPC URLs, constants       | Adding config options, modifying RPC endpoints            |
| `commands.js`  | Telegram command handlers                   | Adding bot commands, modifying responses                  |
| `jobs.js`      | Polling orchestration, alert batching       | Modifying poll logic, changing alert aggregation          |
| `endpoints.js` | Endpoint CRUD, chain grouping, persistence  | Adding/removing endpoints, modifying chain inference      |
| `sync.js`      | RPC integration, sync checks, lag detection | Modifying sync thresholds, adding chain support           |
| `store.js`     | KeyV + SQLite persistence                   | Modifying state storage, adding new persisted keys        |
| `logger.js`    | Pino logger configuration                   | Modifying log format, changing log level                  |

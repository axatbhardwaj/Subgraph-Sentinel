# helpers/

Standalone diagnostic scripts for testing subgraph connectivity and sync status.

## Files

| File                       | What                              | When to read                           |
| -------------------------- | --------------------------------- | -------------------------------------- |
| `check_pollings.js`        | Shows sync state for all endpoints| Checking current sync status from store|
| `check_subgraph_health.js` | Live sync checks against RPC      | Running immediate sync health check    |

## Run

```bash
bun run helpers/check_pollings.js       # Show stored sync state
bun run helpers/check_subgraph_health.js # Run live sync checks
```

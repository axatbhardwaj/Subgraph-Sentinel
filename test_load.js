import { logger } from "./src/logger.js";
import { store } from "./src/store.js";
import { buildPoll } from "./src/jobs.js";
import { registerCommands } from "./src/commands.js";

logger.info("Logger works");
console.log("Modules loaded successfully");
process.exit(0);

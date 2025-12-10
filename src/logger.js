import pino from "pino";
import path from "path";
import { LOG_FILE } from "./config.js";

const transport = pino.transport({
  targets: [
    {
      target: "pino/file",
      options: { destination: LOG_FILE },
    },
    {
      target: "pino-pretty",
      options: { colorize: true },
    },
  ],
});

export const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    timestamp: pino.stdTimeFunctions.isoTime,
  },
  transport
);

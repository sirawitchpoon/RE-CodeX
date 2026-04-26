// Single pino instance shared across the process. Pretty transport in dev so
// the console is readable; raw JSON in production for log shippers.

import { pino } from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.LOG_LEVEL,
  ...(env.NODE_ENV === "production"
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:HH:MM:ss.l",
            ignore: "pid,hostname",
          },
        },
      }),
});

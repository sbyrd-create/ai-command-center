import winston from "winston";
import { logFormat, logLevel } from "../config";

const formats =
  logFormat === "json"
    ? winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    : winston.format.combine(
        winston.format.timestamp(),
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp, level, message, ...rest }) =>
            `${timestamp} [${level}]: ${message}${Object.keys(rest).length ? " " + JSON.stringify(rest) : ""}`
        )
      );

export const logger = winston.createLogger({
  level: logLevel,
  format: formats,
  transports: [new winston.transports.Console()],
});

import pino from "pino";

const redactPatterns = [
	"*.password",
	"*.token",
	"*.apiKey",
	"*.secret",
	"*.authorization",
	"*.auth",
	"jira.email",
	"jira.apiToken",
];

export const logger = pino({
	level: process.env.LOG_LEVEL || "info",
	redact: {
		paths: redactPatterns,
		censor: "[REDACTED]",
	},
	transport: {
		target: "pino-pretty",
		options: {
			colorize: true,
			translateTime: "HH:MM:ss",
			ignore: "pid,hostname",
		},
	},
});

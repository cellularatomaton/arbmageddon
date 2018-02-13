const winston = require("winston");

export interface LogEntry {
	level: string;
	message: string;
	data?: any;
}

export class Logger {
	public static get Instance() {
		// Do you need arguments? Make it a regular method instead.
		return Logger.instance || (Logger.instance = new Logger());
	}

	public static log(data: LogEntry) {
		const l = Logger.Instance;
		l.logWinston(data);
	}

	private static instance: Logger;
	private logger: any;
	constructor() {
		this.logger = new winston.Logger({
			level: "info",
			transports: [
				new winston.transports.File({
					filename: "debug.log",
					json: false,
					maxsize: Math.pow(10, 8),
					maxFiles: 1,
					formatter: (logdata: any) => {
						const ts = new Date();
						const msg = logdata.message ? logdata.message : "";
						const obj =
							logdata.meta && Object.keys(logdata.meta).length ? "\n\t" + JSON.stringify(logdata.meta, null, 2) : "";
						return `${ts} ${msg} ${obj}`;
					}
				})
			]
		});
	}

	private logWinston(entry: LogEntry) {
		this.logger.log(entry.level, entry.message, entry.data);
	}
}

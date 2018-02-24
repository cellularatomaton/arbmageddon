import { get as httpGet } from "https";
import { IncomingMessage } from "http";

const log = require("winston");

export class Http {
	static get(url: string, callback: (obj: any) => void) {
		httpGet(url, (res: IncomingMessage) => {
			const statusCode = res.statusCode;
			const contentType = res.headers["content-type"] as string;

			let error;
			if (statusCode !== 200) {
				error = new Error("Request Failed.\n" + `Status Code: ${statusCode}`);
			} else if (!/^application\/json/.test(contentType)) {
				error = new Error(
					"Invalid content-type.\n" +
					`Expected application/json but received ${contentType}`
				);
			}
			if (error) {
				log.error(error.message);
				// consume response data to free up memory
				res.resume();
				return;
			}

			res.setEncoding("utf8");
			let rawData = "";
			res.on("data", chunk => (rawData += chunk));
			res.on("end", () => {
				try {
					const parsedData = JSON.parse(rawData);
					callback(parsedData);
				} catch (e) {
					log.error(e.message);
				}
			});
		}).on("error", e => {
			log.error(`Http error: ${e.message}`);
		});
	}
}

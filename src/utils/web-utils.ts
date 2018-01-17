import { get as httpGet } from 'https';
import { IncomingMessage } from 'http';

export class Http {
	static get(url: string, callback: (obj: any) => void) {
		httpGet(
			url,
			(res: IncomingMessage) => {
				const statusCode = res.statusCode;
				const contentType = <string>res.headers['content-type'];

				let error;
				if (statusCode !== 200) {
					error = new Error('Request Failed.\n' +
						`Status Code: ${statusCode}`);
				} else if (!/^application\/json/.test(contentType)) {
					error = new Error('Invalid content-type.\n' +
						`Expected application/json but received ${contentType}`);
				}
				if (error) {
					console.log(error.message);
					// consume response data to free up memory
					res.resume();
					return;
				}

				res.setEncoding('utf8');
				let rawData = '';
				res.on('data', (chunk) => rawData += chunk);
				res.on('end', () => {
					try {
						const parsedData = JSON.parse(rawData);
						callback(parsedData);
					} catch (e) {
						console.log(e.message);
					}
				});
			}
		).on('error', (e) => {
			console.log(`Http error: ${e.message}`);
		});
	}
}
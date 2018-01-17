import { Hub, Market } from '../markets';
import 'colors';

export class Asset {
	public hubs: Hub[] = [];
	public markets: Market[] = [];
	constructor(public symbol: string) {
	}
	static getAsset(symbol: string, map: Map<string, Asset>): Asset {
		let asset: Asset;
		if (map.has(symbol)) {
			asset = <Asset>map.get(symbol);
		} else {
			asset = new Asset(symbol);
			map.set(symbol, asset);
		}
		return asset;
	}
	public log() {
		console.log(`Asset: ${this.symbol}`.yellow);
		console.log(`Hub count: ${this.hubs.length}`.green);
		const exchanges = this.hubs.map(h => { h.exchange.id }).join(',');
		console.log(`Exchanges: ${exchanges}`.green);
		console.log(`Market Count: ${this.markets.length}`.blue);
	}
};
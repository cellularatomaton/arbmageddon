import { Market, Graph } from '../markets';
import { Asset } from '../assets';
import { Exchange } from '../exchanges';

export class Hub {
	asset: Asset;
	markets: Map<string, Market>;
	constructor(
		symbol: string,
		public exchange: Exchange,
		public graph: Graph) {
		this.asset = Asset.getAsset(symbol, graph.assetMap);
		this.asset.hubs.push(this);
		this.markets = new Map<string, Market>();
	}
	getId() {
		return `${this.exchange.getId()}_${this.asset.symbol}`;
	}
}
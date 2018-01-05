import { Market, Graph } from '../markets';
import { Asset } from '../assets';
import { Exchange } from '../exchanges';

export class Hub {
    asset: Asset;
    markets: Map<string, Market>;
    constructor(
        symbol: string,
        public exchange: Exchange,
        public graph: Graph){
            this.asset = Asset.get_asset(symbol, graph.asset_map);
            this.asset.hubs.push(this);
            this.markets = new Map<string, Market>();
    }
    get_id(){
        return `${this.exchange.get_id()}_${this.asset.symbol}`;
    }
}
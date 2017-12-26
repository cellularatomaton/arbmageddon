import { Market } from '../markets';
import { Asset } from '../assets';
import { Exchange } from '../exchanges';

export class Hub {
    asset: Asset;
    markets: Map<string, Market>;
    constructor(
        symbol: string,
        asset_map: Map<string, Asset>,
        public exchange: Exchange){
            this.asset = Asset.get_asset(symbol, asset_map);
            this.asset.hubs.push(this);
            this.markets = new Map<string, Market>();
    }
    get_id(){
        return `${this.exchange.get_id()}_${this.asset.symbol}`;
    }
}
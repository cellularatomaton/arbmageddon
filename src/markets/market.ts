import { Asset } from '../assets';
import { Hub } from './hub';

export class Market {
    asset: Asset;
    best_bid: number;
    best_ask: number;

    constructor(
        asset_symbol: string,
        asset_map: Map<string, Asset>,
        public hub: Hub){
            this.asset = Asset.get_asset(asset_symbol, asset_map);
            this.asset.markets.push(this);
    }
    get_id(){
        return `${this.hub.exchange.get_id()}_${this.hub.get_id()}_${this.asset.symbol}`;
    }
};

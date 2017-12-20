import { Hub, Market } from '../markets';

export class Asset {
    public hubs: Hub[] = [];
    public markets: Market[] = [];
    constructor(public symbol: string){
    }
    static get_asset(symbol: string, map: Map<string, Asset>): Asset {
        let asset: Asset;
        if(map.has(symbol)){
            asset = <Asset>map.get(symbol);
        }else{
            asset = new Asset(symbol);
            map.set(symbol, asset);
        }
        return asset;
    }
};
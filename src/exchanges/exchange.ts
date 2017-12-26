import { Hub, Market } from '../markets';
import { Asset } from '../assets';

export class Exchange {
    public hubs: Map<string, Hub>;
    constructor(
        public name: string,
        public asset_map: Map<string, Asset>
    ){
        this.hubs = new Map<string, Hub>();
    }
    get_id(){
        return this.name;
    }

    marketBuy(){}
    marketSell(){}
    fillHandler(callback: any){}
    positionHandler(callback: any){}

    map_market(
        hub_symbol: string,
        market_symbol: string): any {
        if(!this.hubs.has(hub_symbol)){
            this.hubs.set(
                hub_symbol, 
                new Hub(
                    hub_symbol,
                    this.asset_map,
                    this
                )
            );
        }
        const hub = this.hubs.get(hub_symbol);
        if(hub && !hub.markets.has(market_symbol)){
            hub.markets.set(
                market_symbol, 
                new Market(
                    market_symbol,
                    this.asset_map,
                    hub
                )
            );
        }
        if(hub){
            const market = hub.markets.get(market_symbol);
            return market;
        }
    }

    update_market(
        hub_symbol: string,
        market_symbol: string,
        best_bid: number,
        best_ask: number,
    ){
        const response = this.map_market(
            hub_symbol,
            market_symbol
        );
        if(response){
            const market = response;
            market.best_bid = Number(best_bid);
            market.best_ask = Number(best_bid);
        }
    }

    public log(){
        console.log(`Exchange: ${this.name}`.green);
        this.hubs.forEach((hub: Hub, symbol: string)=>{
            console.log(`Hub: ${symbol}`.blue);
            let market_list: string[] = [];
            hub.markets.forEach((market: Market, market_symbol: string)=>{
                market_list.push(market_symbol);
            });
            console.log(`Markets: ${market_list.join(',')}`.magenta);
        });
    }
};
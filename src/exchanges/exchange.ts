import { Hub, Market, Graph, Ticker, TradeType } from '../markets';
import { Asset } from '../assets';

export interface HubMarketPair {
    hub_symbol: string;
    market_symbol: string;
}

export class Exchange {
    public hubs: Map<string, Hub>;
    constructor(
        public name: string,
        public graph: Graph
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
                    this,
                    this.graph,
                )
            );
        }
        const hub = this.hubs.get(hub_symbol);
        if(hub && !hub.markets.has(market_symbol)){
            hub.markets.set(
                market_symbol, 
                new Market(
                    market_symbol,
                    hub,
                    this.graph
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
            market.best_ask = Number(best_ask);
        }
    }

    update_ticker(ticker: Ticker){
        const response = this.map_market(
            ticker.hub_symbol,
            ticker.market_symbol
        );
        if(response){
            const market = response;
            // market.update_statistics(ticker);
            market.update_vwap(ticker);
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
import { Graph, GraphEvent, GraphEventType, GraphEdge, Market } from '../markets';

export enum TradeType {
    BUY,
    SELL
}

export interface Ticker {
    hub_symbol: string;
    market_symbol: string;
    time: Date;
    best_ask?: number;
    best_bid?: number;
    price?: number;
    side?: TradeType;
    size?: number;
}

export enum TimeUnit {
    MILLISECOND,
    SECOND,
    MINUTE,
    HOUR
}

export class TickerStatistics {
    window: Ticker[] = [];
    bid_ask_spread_agg: number = 0;
    best_bid_agg: number = 0;
    best_ask_agg: number = 0;
    buy_volume: number = 0;
    sell_volume: number = 0;

    constructor(
        public duration_unit: TimeUnit,
        public duration_count: number,
        public graph: Graph,
        public market: Market
    ){}

    get_bid_ask_spread(){
        return this.bid_ask_spread_agg / this.window.length;
    }

    get_best_bid_avg(){
        return this.best_bid_agg / this.window.length;
    }

    get_best_ask_avg(){
        return this.best_ask_agg / this.window.length;
    }

    get_window_ms(){
        if(this.duration_unit as TimeUnit === TimeUnit.MILLISECOND){
            return this.duration_count;
        }else if(this.duration_unit as TimeUnit === TimeUnit.SECOND){
            return this.duration_count * 1000;
        }else if(this.duration_unit as TimeUnit === TimeUnit.MINUTE){
            return this.duration_count * 60 * 1000;
        }else if(this.duration_unit as TimeUnit === TimeUnit.HOUR){
            return this.duration_count === 60 * 60 * 1000;
        }
    }

    add_ticker(ticker: Ticker){
        // console.log(`Adding ticker: ${JSON.stringify(ticker)}`);
        this.window.push(ticker);
        if(ticker.best_ask && ticker.best_bid){
            this.bid_ask_spread_agg += (ticker.best_ask - ticker.best_bid);
            this.best_bid_agg += ticker.best_bid;
            this.best_ask_agg += ticker.best_ask;
            const edge_event = {
                type: GraphEventType.SPREAD_UPDATE,
                data: {
                    id: `E_${this.market.get_id()}`,
                    from: this.market.hub.get_id(),
                    to: this.market.get_id(),
                    value: this.get_bid_ask_spread()
                }
            }
            this.graph.handle_edge_event(edge_event);
        }
        if(ticker.size && ticker.price){
            const edge_event = {
                type: GraphEventType.FLOW_UPDATE,
                data: {
                    id: `E_${this.market.get_id()}`,
                    from: this.market.hub.get_id(),
                    to: this.market.get_id(),
                    value: 0
                }
            }
            if(ticker.side as TradeType === TradeType.BUY){
                this.buy_volume += ticker.size * ticker.price;
                edge_event.data.value = this.buy_volume;
            }else{
                this.sell_volume += ticker.size * ticker.price;
                edge_event.data.value = this.sell_volume;
            }
            
            this.graph.handle_edge_event(edge_event);
        }
        // console.log(`Stats: S=${this.bid_ask_spread_agg}, BB=${this.best_bid_agg}, BA=${this.best_ask_agg}, BV=${this.buy_volume}, SV=${this.sell_volume}, L=${this.window.length}`)
    }

    remove_ticker(ticker: Ticker | undefined){
        if(ticker){
            if(ticker.best_ask && ticker.best_bid){
                this.bid_ask_spread_agg -= (ticker.best_ask - ticker.best_bid);
                this.best_bid_agg -= ticker.best_bid;
                this.best_ask_agg -= ticker.best_ask;
            }
            if(ticker.size && ticker.price){
                if(ticker.side as TradeType === TradeType.BUY){
                    this.buy_volume -= ticker.size * ticker.price;
                }else{
                    this.sell_volume -= ticker.size * ticker.price;
                }
            }
        }
    }

    handle_ticker(ticker: Ticker){
        const time = ticker.time.getTime();
        const duration = this.get_window_ms() || 15 * 1000;
        let rolling = true;
        while(rolling){
            const oldest_time = this.window[this.window.length-1].time.getTime();
            const stale = duration < (time - oldest_time);
            if(stale){
                const old_ticker = this.window.shift();
                this.remove_ticker(old_ticker);
            }else{
                rolling = false;
            }
        }
        this.add_ticker(ticker);
    }
}
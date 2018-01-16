import { Graph, GraphEvent, GraphEventType, GraphEdge, Market } from '../markets';
import { IEvent, EventImp } from '../utils';

export enum TradeType {
    BUY,
    SELL
}

export interface Ticker {
    exchange_symbol: string;
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

export interface VWAP {
    vwap: number,
    duration: number
}

export class VolumeStatistics {
    window: Ticker[] = [];
    vwap_numerator: number = 0;
    vwap_denominator: number = 0;
    
    on_vwap_updated: EventImp<VWAP> = new EventImp<VWAP>();
    public get vwap_updated() : IEvent<VWAP> {
        return this.on_vwap_updated.expose();
    };

    constructor(private market: Market){}

    get_vwap(){
        return this.vwap_numerator / this.vwap_denominator;
    }

    get_duration(){
        if(this.window.length){
            const oldest = this.window[0].time.getTime();
            const newest = this.window[this.window.length - 1].time.getTime();
            return newest - oldest;
        }else{
            return Number.NaN;
        }
    }

    add_ticker(ticker: Ticker){
        this.window.push(ticker);
        if(ticker.size && ticker.price){
            this.vwap_numerator += ticker.size * ticker.price;
            this.vwap_denominator += ticker.size;
        }
    }

    remove_ticker(ticker: Ticker | undefined){
        if(ticker){
            if(ticker.size && ticker.price){
                this.vwap_numerator -= ticker.size * ticker.price;
                this.vwap_denominator -= ticker.size;
            }
        }
    }

    calc_window_size() : number {
        const graph = this.market.graph;
        const basis_size = graph.basis_size;
        const basis_asset = graph.basis_asset;
        if(basis_asset){
            const hub_asset = this.market.hub.asset;
            const already_priced_in_basis = hub_asset.symbol === basis_asset.symbol;
            const price = this.market.vwap_sell_stats.get_vwap();
            if(already_priced_in_basis){
                const size = basis_size / price;
                return size;
            }else{
                // Look through hub markets for conversion:
                const conversion_market = this.market.hub.markets.get(basis_asset.symbol);
                if(conversion_market){
                    const conversion_price = conversion_market.vwap_sell_stats.get_vwap();
                    const size = basis_size / conversion_price / price;
                    return size;
                }else{
                    return Number.NaN;
                }
            }
        }else{
            return Number.NaN;
        }
    }

    handle_ticker(ticker: Ticker){
        const window_size = this.calc_window_size();
        if(!Number.isNaN(this.vwap_denominator) && !Number.isNaN(window_size)){
            let rolling = true;
            while(rolling){
                const stale = window_size < this.vwap_denominator;
                if(stale){
                    const old_ticker = this.window.shift();
                    this.remove_ticker(old_ticker);
                }else{
                    rolling = false;
                }
            }
        }
        this.add_ticker(ticker);
        const vwap: VWAP = {
            vwap: this.get_vwap(),
            duration: this.get_duration()
        };
        // console.log(`Ticker Triggered VWAP: ${JSON.stringify(vwap)}`);
        this.on_vwap_updated.trigger(vwap);
    }

}
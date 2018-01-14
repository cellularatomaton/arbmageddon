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
    constructor(
        public window_size: number
    ){}

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

    handle_ticker(ticker: Ticker){
        if(!Number.isNaN(this.vwap_denominator)){
            let rolling = true;
            while(rolling){
                const stale = this.window_size < this.vwap_denominator;
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
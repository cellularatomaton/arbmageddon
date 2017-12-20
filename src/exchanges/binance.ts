import { Exchange } from './exchange';
import { Hub, Market } from '../markets';
import { Asset } from '../assets';

const binance = require('node-binance-api');
const hub_symbols = new Set([
    'BTC',
    'ETH',
    'BNB',
    'USDT'
]);

export class BinanceExchange extends Exchange {
    constructor(
        asset_map: Map<string, Asset>
    ){
        super('BINA', asset_map);
        this.update_tickers();
    }
    marketBuy(){}
    marketSell(){}
    update_tickers(){
        const exchange = this;    
        binance.bookTickers(function(tickers: any) {
            // console.log("bookTickers", ticker);
            exchange.handle_tickers(tickers);
        });
    }
    handle_tickers(tickers: any){
        const exchange = this;
        Object.keys(tickers).forEach((key) => {
            let market_symbol = `NOMARKET`;
            let hub_symbol = `NOHUB`;
            const ticker = tickers[key];
            const last_three = key.slice(key.length-3, key.length);
            const found_three = hub_symbols.has(last_three);
            if(found_three){
                market_symbol = key.slice(0,key.length-3);
                hub_symbol = last_three;
            }else{
                const last_four = key.slice(key.length-4, key.length);
                const found_four = hub_symbols.has(last_four);
                if(found_four){
                    market_symbol = key.slice(0,key.length-4);
                    hub_symbol = last_four;
                }
            }
            if(hub_symbol === `NOHUB`){
                console.log(`Binance malformed symbol ${key}`);
            }else{
                exchange.map_ticker(
                    hub_symbol,
                    market_symbol,
                    Number(ticker.bid),
                    Number(ticker.ask)
                );
            }
        });
    }
}
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
        this.update_exchange_info();
        this.bina_market_update_loop();
    }
    marketBuy(){}
    marketSell(){}
    
    update_exchange_info(){
        const exchange = this;
        binance.exchangeInfo((info: any)=>{
            
            const markets = info.symbols;
            markets.forEach((market: any)=>{
                const hub_symbol = market.quoteAsset;
                const market_symbol = market.baseAsset;
                console.log(`Binance mapping symbols: Hub ${hub_symbol} -> Market ${market_symbol}`);
                exchange.map_market(hub_symbol, market_symbol);
            });
        });
    }
    
    bina_market_update_loop(){
        const exchange = this;    
        binance.bookTickers(function(tickers: any) {
            // console.log("bookTickers", ticker);
            exchange.handle_tickers(tickers);
        });
        setTimeout(this.bina_market_update_loop, 1000);
    }
    
    parse_symbols(key: string) : string[]{
        let market_symbol = `NOMARKET`;
        let hub_symbol = `NOHUB`;
        
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
        return [hub_symbol, market_symbol];
    }

    handle_tickers(tickers: any){
        const exchange = this;
        Object.keys(tickers).forEach((key) => {
            const ticker = tickers[key];
            const parsed_symbols = this.parse_symbols(key);
            const hub_symbol = parsed_symbols[0];
            const market_symbol = parsed_symbols[1];
            if(hub_symbol === `NOHUB`){
                console.log(`Binance malformed symbol ${key}`);
            }else{
                exchange.update_market(
                    hub_symbol,
                    market_symbol,
                    Number(ticker.bid),
                    Number(ticker.ask)
                );
            }
        });
    }
}
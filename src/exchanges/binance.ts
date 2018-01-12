import { Exchange } from './exchange';
import { Hub, Market, Graph, TradeType } from '../markets';
import { Asset } from '../assets';

const binance = require('node-binance-api');
const hub_symbols = new Set([
    'BTC',
    'ETH',
    'BNB',
    'USDT'
]);

export class BinanceExchange extends Exchange {
    symbol_list: string[];
    constructor(
        graph: Graph
    ){
        super('BIN', 'BINANCE', graph);
        this.update_exchange_info()
            .then(() => {
                this.setup_websockets(this.symbol_list);
            });
    }
    marketBuy(){}
    marketSell(){}
    
    update_exchange_info() : Promise <void> {
        const exchange = this;
        return new Promise((resolve, reject) => {
            binance.exchangeInfo((info: any)=>{     
                const markets = info.symbols;
                markets.forEach((market: any)=>{
                    const hub_symbol = market.quoteAsset;
                    const market_symbol = market.baseAsset;
                    // console.log(`Binance mapping symbols: Hub ${hub_symbol} -> Market ${market_symbol}`);
                    exchange.map_market(hub_symbol, market_symbol);
                });
                this.symbol_list = markets.map((m: any) => {return m.symbol;});
                resolve();
            });
        });
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

    setup_websockets(symbols: string[]){
        const exchange = this;
        binance.websockets.trades(symbols, function(trades: any) {
            // let {e:eventType, E:eventTime, s:symbol, p:price, q:quantity, m:maker, a:tradeId} = trades;
            // console.log(symbol+" trade update. price: "+price+", quantity: "+quantity+", maker: "+maker);
            const parsed_symbols = exchange.parse_symbols(trades.s);

            exchange.update_ticker({
                exchange_symbol: exchange.id,
                hub_symbol: parsed_symbols[0],
                market_symbol: parsed_symbols[1],
                price: Number(trades.p),
                side: trades.m ? TradeType.SELL : TradeType.BUY,
                time: new Date(trades.T),
                size: Number(trades.q)
            });
          });
    }

    // static bina_market_update_loop(exchange: BinanceExchange){
    //     // const exchange = this;    
    //     binance.bookTickers(function(tickers: any) {
    //         // console.log("bookTickers", ticker);
    //         exchange.handle_tickers(tickers);
    //     });
    //     setTimeout(() => {BinanceExchange.bina_market_update_loop(exchange);}, 1000);
    // }

    // handle_tickers(tickers: any){
    //     const exchange = this;
    //     Object.keys(tickers).forEach((key) => {
    //         const ticker = tickers[key];
    //         const parsed_symbols = this.parse_symbols(key);
    //         const hub_symbol = parsed_symbols[0];
    //         const market_symbol = parsed_symbols[1];
    //         if(hub_symbol === `NOHUB`){
    //             console.log(`Binance malformed symbol ${key}`);
    //         }else{
    //             exchange.update_market(
    //                 hub_symbol,
    //                 market_symbol,
    //                 Number(ticker.bid),
    //                 Number(ticker.ask)
    //             );
                
    //         }
    //     });
    // } 
}
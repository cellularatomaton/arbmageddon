import { Exchange } from './exchange';
import { Hub, Market, Graph, Ticker, TradeType } from '../markets';
import { Asset } from '../assets';

const Gdax = require('gdax');
const PRODS = ['eth-btc', 'ltc-btc'];
const URI = 'wss://ws-feed.gdax.com/';
const AUTH = null;
const HEARTBEAT = false;
const CHANNELS = [
    'heartbeat',
    'ticker'
];
const OPTS = {
    heartbeat: false,
    channels: CHANNELS
}
const websocket = new Gdax.WebsocketClient(PRODS, URI, AUTH, OPTS);
let products = [];

export class GdaxExchange extends Exchange {
    products: any[];
    constructor(
        graph: Graph
    ){
        super('GDAX', graph);
        this.update_products()
            .then(() => { this.setup_websocket(); });
    }
    
    market_buy(){}
    market_sell(){}
    update_products() : Promise<void> {
        return new Promise((resolve, reject) => {
            const publicClient = new Gdax.PublicClient();
            publicClient
                .getProducts()
                .then((data: any) => {
                    this.products = data;
                    this.products.forEach((prod: any)=>{
                        this.map_market(
                            prod.quote_currency,
                            prod.base_currency,
                        )
                    });
                    resolve();
                })
                .catch((error: any) => {
                    console.log(`Gdax products update error: ${error}`);
                });
        });
    }
    
    handle_ticker(exchange: Exchange, data: any){
        // console.log(data);
        const symbols = data.product_id.split('-');
        exchange.update_ticker({
            exchange_symbol: this.name,
            hub_symbol: symbols[0],
            market_symbol: symbols[1],
            best_ask: Number(data.best_ask),
            best_bid: Number(data.best_bid),
            price: Number(data.price),
            side: data.side === 'buy' ? TradeType.BUY : TradeType.SELL,
            time: new Date(data.time),
            size: Number(data.last_size)
        });
    }

    setup_websocket(): any {
        const exchange = this;
        websocket.on('open', function(){
            console.log('Gdax websocket opened.');
        });
        websocket.on('message', function(data: any) { 
            if(data.type === 'ticker' && data.last_size){
                exchange.handle_ticker(exchange, data);
            }
        });
        websocket.on('error', function(err: any){
            console.log(err);
        });
        
        websocket.on('close', function(){
            console.log('Websocket closed.');
        });
    }

    // handle_book(
    //     hub_symbol: string, 
    //     market_symbol: string, 
    //     book: any)
    // {
    //     const best_bid = book.bids && book.bids.length && book.bids[0].length ? Number(book.bids[0][0]) : Number.NaN;
    //         const best_ask = book.asks && book.asks[0] && book.asks[0].length ? Number(book.asks[0][0]) : Number.NaN;
    //         if(!Number.isNaN(best_bid) && !Number.isNaN(best_ask)){
    //             this.update_market(
    //                 hub_symbol,
    //                 market_symbol,
    //                 Number(best_bid),
    //                 Number(best_ask));
    //         }
    // }

    // get_ticker_and_update_market(
    //     hub_symbol: string,
    //     market_symbol: string,
    // ){
    //     const publicClient = new Gdax.PublicClient(`${market_symbol}-${hub_symbol}`);
    //     publicClient.getProductOrderBook()
    //     .then((book: any)=>{
    //         this.handle_book(hub_symbol, market_symbol, book);
    //     })
    //     .catch((error: any)=>{
    //         console.log(`Gdax book update error: ${error}`);
    //     });
    // };

}
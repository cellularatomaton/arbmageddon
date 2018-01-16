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
        super('GDX', 'COINBASE', graph);
        this.updateProducts()
            .then(() => { this.setupWebsocket(); });
    }
    
    marketBuy(){}
    marketSell(){}
    updateProducts() : Promise<void> {
        return new Promise((resolve, reject) => {
            const publicClient = new Gdax.PublicClient();
            publicClient
                .getProducts()
                .then((data: any) => {
                    this.products = data;
                    this.products.forEach((prod: any)=>{
                        this.mapMarket(
                            prod.quote_currency,
                            prod.base_currency,
                        )
                    });
                    this.graph.mapBasis();
                    resolve();
                })
                .catch((error: any) => {
                    console.log(`Gdax products update error: ${error}`);
                });
        });
    }
    
    handleTicker(exchange: Exchange, data: any){
        // console.log(data);
        const symbols = data.product_id.split('-');
        exchange.updateTicker({
            exchangeSymbol: this.id,
            hubSymbol: symbols[0],
            marketSymbol: symbols[1],
            bestAsk: Number(data.best_ask),
            bestBid: Number(data.best_bid),
            price: Number(data.price),
            side: data.side === 'buy' ? TradeType.BUY : TradeType.SELL,
            time: new Date(data.time),
            size: Number(data.last_size)
        });
    }

    setupWebsocket(): any {
        const exchange = this;
        websocket.on('open', function(){
            console.log('Gdax websocket opened.');
        });
        websocket.on('message', function(data: any) { 
            if(data.type === 'ticker' && data.last_size){
                exchange.handleTicker(exchange, data);
            }
        });
        websocket.on('error', function(err: any){
            console.log(err);
        });
        
        websocket.on('close', function(){
            console.log('Websocket closed.');
        });
    }

    // handleBook(
    //     hubSymbol: string, 
    //     marketSymbol: string, 
    //     book: any)
    // {
    //     const bestBid = book.bids && book.bids.length && book.bids[0].length ? Number(book.bids[0][0]) : Number.NaN;
    //         const bestAsk = book.asks && book.asks[0] && book.asks[0].length ? Number(book.asks[0][0]) : Number.NaN;
    //         if(!Number.isNaN(bestBid) && !Number.isNaN(bestAsk)){
    //             this.updateMarket(
    //                 hubSymbol,
    //                 marketSymbol,
    //                 Number(bestBid),
    //                 Number(bestAsk));
    //         }
    // }

    // getTickerAndUpdateMarket(
    //     hubSymbol: string,
    //     marketSymbol: string,
    // ){
    //     const publicClient = new Gdax.PublicClient(`${marketSymbol}-${hubSymbol}`);
    //     publicClient.getProductOrderBook()
    //     .then((book: any)=>{
    //         this.handleBook(hubSymbol, marketSymbol, book);
    //     })
    //     .catch((error: any)=>{
    //         console.log(`Gdax book update error: ${error}`);
    //     });
    // };

}
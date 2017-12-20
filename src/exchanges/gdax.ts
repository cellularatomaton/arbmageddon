import { Exchange } from './exchange';
import { Hub, Market } from '../markets';
import { Asset } from '../assets';

const Gdax = require('gdax');
// const PRODS = ['eth-btc', 'ltc-btc'];
// const URI = 'wss://ws-feed.gdax.com';
// const AUTH = null;
// const HEARTBEAT = false;
// const CHANNELS = [
//     'heartbeat',
//     'ticker'
// ];
// const OPTS = {
//     heartbeat: false,
//     channels: CHANNELS
// }
// const websocket = new Gdax.WebsocketClient(PRODS, URI, AUTH, OPTS);
// let products = [];

export class GdaxExchange extends Exchange {
    products: any[];
    constructor(
        asset_map: Map<string, Asset>
    ){
        super('GDAX', asset_map);
        // this.products = this.get_products();
        this.update_tickers();
    }
    
    market_buy(){}
    market_sell(){}
    update_tickers(){
        const publicClient = new Gdax.PublicClient();
        publicClient.getProducts()
        .then((data: any) => {
            this.products = data;
            this.products.forEach((prod: any)=>{
                this.update_ticker(
                    prod.quote_currency,
                    prod.base_currency,
                )
            });
        })
        .catch((error: any) => {
            console.log(`Gdax products update error: ${error}`);
        });

        
    }
    update_ticker(
        hub_symbol: string,
        market_symbol: string,
    ){
        const publicClient = new Gdax.PublicClient(`${market_symbol}-${hub_symbol}`);
        publicClient.getProductOrderBook()
        .then((book: any)=>{
            const best_bid = book.bids && book.bids.length && book.bids[0].length ? Number(book.bids[0][0]) : Number.NaN;
            const best_ask = book.asks && book.asks[0] && book.asks[0].length ? Number(book.asks[0][0]) : Number.NaN;
            if(!Number.isNaN(best_bid) && !Number.isNaN(best_ask)){
                this.map_ticker(
                    hub_symbol,
                    market_symbol,
                    Number(best_bid),
                    Number(best_ask));
            }
        })
        .catch((error: any)=>{
            console.log(`Gdax book update error: ${error}`);
        });
    };
    
    // get_products(): any {
            // websocket.on('open', function(){
            //     console.log('Gdax websocket opened.');
            // });
            // websocket.on('message', function(data: any) { 
            //     if(data.type === 'ticker' && data.last_size){
            //         // console.log(data);
            //         const symbols = data.product_id.split('-');
            //         const market_symbol = symbols[0]
            //         const hub_symbol = symbols[1];
    
            //         Exchange.map_ticker(
            //             hub_symbol,
            //             market_symbol,
            //             Number(data.best_bid),
            //             Number(data.best_ask),
            //             exchange,
            //             asset_map
            //         );
            //     }
            // });
            // websocket.on('error', function(err: any){
            //     console.log(err);
            // });
            
            // websocket.on('close', function(){
            //     console.log('Websocket closed.');
            // });
    // }

}
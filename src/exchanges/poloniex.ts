import { Exchange, HubMarketPair } from './exchange';
import { Hub, Market, Graph } from '../markets';
import { Asset } from '../assets';
import { Http } from '../utils';
import { symlink } from 'fs';
import { TradeType } from '../markets/ticker';

const WebSocket = require('ws');

export class PoloniexExchange extends Exchange {
    symbol_list: string[];
    id_to_symbol_map: Map<number, HubMarketPair>;
    constructor(
        graph: Graph
    ){
        super('PLX', 'POLONIEX', graph);
        this.id_to_symbol_map = new Map<number, HubMarketPair>();
        this.update_products()
            .then(() => { this.setup_websocket(); });
    }
    marketBuy(){}
    marketSell(){}
    update_products() : Promise<void> {
        const exchange = this;

        return new Promise((resolve, reject) => {
            Http.get(
                `https://poloniex.com/public?command=returnTicker`, 
                ( tickers: any ) => {
                    // console.log(JSON.stringify(tickers));
                    this.symbol_list = [];
                    Object.keys(tickers).forEach((key) => {
                        const ticker = tickers[key];
                        const symbols = key.split('_');
                        const hub_symbol = symbols[0];
                        const market_symbol = symbols[1];
    
                        exchange.map_market(
                            hub_symbol,
                            market_symbol,
                        );
                        this.symbol_list.push(key);
                    });
                    resolve();
                }
            );
        });
    }

    setup_websocket(){
        const exchange = this;
        const ws = new WebSocket('wss://api2.poloniex.com/');

        ws.on('open', function open() {
            exchange.symbol_list.forEach((symbol: string) => {
                const msg = {
                    command: "subscribe",
                    channel: symbol}
                ws.send(JSON.stringify(msg));
            });
            
        });

        ws.on('message', function incoming(msg: string) {
            const data = JSON.parse(msg);
            if(data.length === 3){
                const product_id = data[0];
                const sequence = data[1];
                const messages = data[2];
                messages.forEach((m: any[]) => {
                    const type = m[0];
                    if(type === 'i'){
                        // Initialize:  Symbol mapping and initial book.
                        const initial: any = m[1];
                        const symbol: string = initial.currencyPair;
                        const symbols = symbol.split('_');
                        exchange.id_to_symbol_map.set(
                            product_id, 
                            {
                                hub_symbol: symbols[0],
                                market_symbol: symbols[1]
                            }
                        );
                    }else if(type === 'o'){
                        // Order:
                        const side: TradeType = m[1] ? TradeType.BUY : TradeType.SELL;
                        const price: number = Number(m[2]);
                        const quantity: number = Number(m[3]);
                    }else if(type === 't'){
                        // Trade:
                        const pair: HubMarketPair | undefined = exchange.id_to_symbol_map.get(product_id);
                        if(pair){
                            const trade_id: number = Number(m[1]);
                            exchange.update_ticker({
                                exchange_symbol: exchange.id,
                                hub_symbol: pair.hub_symbol,
                                market_symbol: pair.market_symbol,
                                side: m[2] ? TradeType.BUY : TradeType.SELL,
                                price: Number(m[3]),
                                time: new Date(m[5]*1000),
                                size: Number(m[4])
                            });
                        }
                    }
                });
            }
        });
    }
}
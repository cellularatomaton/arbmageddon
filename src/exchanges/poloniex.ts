import { Exchange } from './exchange';
import { Hub, Market } from '../markets';
import { Asset } from '../assets';
import { Http } from '../utils';


export class PoloniexExchange extends Exchange {
    constructor(
        asset_map: Map<string, Asset>
    ){
        super('POLO', asset_map);
        this.update_tickers();
    }
    marketBuy(){}
    marketSell(){}
    update_tickers(){
        const exchange = this;
        Http.get(
            `https://poloniex.com/public?command=returnTicker`, 
            ( tickers: any ) => {
                // console.log(JSON.stringify(tickers));
                Object.keys(tickers).forEach((key) => {
                    const ticker = tickers[key];
                    const symbols = key.split('_');
                    const hub_symbol = symbols[0];
                    const market_symbol = symbols[1];

                    exchange.update_market(
                        hub_symbol,
                        market_symbol,
                        Number(ticker.highestBid),
                        Number(ticker.lowestAsk),
                    );
                });
            }
        );
    }
}
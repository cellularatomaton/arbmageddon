import { Asset } from './src/assets';
import { Exchange, GdaxExchange, BinanceExchange, PoloniexExchange } from './src/exchanges';
import { Hub, Market } from './src/markets';
import { Arb, ArbType } from './src/strategies';

const asset_map = new Map<string, Asset>();
const exchanges: Exchange[] = [
    new GdaxExchange(asset_map),
    new BinanceExchange(asset_map),
    new PoloniexExchange(asset_map)
];

const print_assets = function(){
    console.log(`*************** PRINT ASSETS ***************`.red);
    asset_map.forEach((asset_value: Asset, asset_key: string) => {
        asset_value.log();
    });
    // setTimeout(print_assets, 5000);
}
const print_exchanges = function(){
    console.log(`*************** PRINT Exchanges ***************`.red);
    console.log(`Timestamp: ${Date.now()}`.yellow);
    exchanges.forEach( (exchange: Exchange) => {
        exchange.log();
    });
    // setTimeout(print_exchanges, 5000);
}

const find_arbs = function(){
    const arbs: Arb[] = []
    asset_map.forEach((asset: Asset, symbol: string)=>{
        asset.markets.forEach((buy_market: Market, buy_index: number)=>{
            asset.markets.forEach((sell_market: Market, sell_index: number)=>{
                const arb = new Arb(buy_market, sell_market);
                const arb_type = arb.type;
                if(arb_type !== ArbType.NONE){
                    arbs.push(arb);
                }
            });
        });
    });
    const sorted_arbs: Arb[] = arbs.sort((a: Arb, b: Arb)=>{
        const a_spread = a.type === ArbType.COMPLEX ? a.get_conversion_spread_percent() : a.get_spread_percent();
        const b_spread = b.type === ArbType.COMPLEX ? b.get_conversion_spread_percent() : b.get_spread_percent();
        return b_spread - a_spread;
    });
    sorted_arbs
    .slice(0, 10)
    .forEach((arb: Arb)=>{
        arb.log_arb();
    });
    sorted_arbs
    .reverse()
    .slice(0, 10)
    .forEach((arb: Arb)=>{
        arb.log_arb();
    });
}
setTimeout(find_arbs, 5000);
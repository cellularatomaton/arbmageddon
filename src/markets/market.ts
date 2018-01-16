import { Asset } from '../assets';
import { Hub } from './hub';
import { Graph, Ticker, TickerStatistics, TradeType } from '../markets';
import { TimeUnit, VolumeStatistics } from './ticker';

export class Market {
    asset: Asset;
    // statistics: TickerStatistics;
    vwap_buy_stats: VolumeStatistics;
    vwap_sell_stats: VolumeStatistics;

    constructor(
        asset_symbol: string,
        public hub: Hub,
        public graph: Graph)
    {
        this.asset = Asset.get_asset(asset_symbol, graph.asset_map);
        this.asset.markets.push(this);
        // this.statistics = new TickerStatistics(TimeUnit.SECOND, 15, graph, this);
        // ToDo: Volume statistics need to be scaled to hub or global units!
        this.vwap_buy_stats = new VolumeStatistics(this);
        this.vwap_sell_stats = new VolumeStatistics(this);
    }
    get_id(){
        return `${this.hub.get_id()}_${this.asset.symbol}`;
    }

    update_vwap(ticker: Ticker){
        // console.log(`Adding ticker: ${JSON.stringify(ticker)}`);
        if(ticker.side as TradeType === TradeType.BUY){
            this.vwap_buy_stats.handle_ticker(ticker);
            // console.log(`Buy vwap: ${this.vwap_buy_stats.get_vwap()}`);
        }else{
            this.vwap_sell_stats.handle_ticker(ticker);
            // console.log(`Sell vwap: ${this.vwap_sell_stats.get_vwap()}`);
        }
    }
};

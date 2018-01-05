import { Asset } from '../assets';
import { Hub } from './hub';
import { Graph, Ticker, TickerStatistics } from '../markets';
import { TimeUnit } from './ticker';

export class Market {
    asset: Asset;
    statistics: TickerStatistics;

    constructor(
        asset_symbol: string,
        public hub: Hub,
        public graph: Graph)
    {
        this.asset = Asset.get_asset(asset_symbol, graph.asset_map);
        this.asset.markets.push(this);
        this.statistics = new TickerStatistics(TimeUnit.SECOND, 15, graph, this);
    }
    get_id(){
        return `${this.hub.get_id()}_${this.asset.symbol}`;
    }

    update_statistics(ticker: Ticker){
        this.statistics.add_ticker(ticker);
    }
};

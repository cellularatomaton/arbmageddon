import { Asset } from '../assets';
import { Hub } from './hub';
import { Graph, Ticker, TradeType } from '../markets';
import { TimeUnit, VolumeStatistics } from './ticker';

export class Market {
    asset: Asset;
    // statistics: TickerStatistics;
    vwapBuyStats: VolumeStatistics;
    vwapSellStats: VolumeStatistics;

    constructor(
        assetSymbol: string,
        public hub: Hub,
        public graph: Graph)
    {
        this.asset = Asset.getAsset(assetSymbol, graph.assetMap);
        this.asset.markets.push(this);
        // this.statistics = new TickerStatistics(TimeUnit.SECOND, 15, graph, this);
        // ToDo: Volume statistics need to be scaled to hub or global units!
        this.vwapBuyStats = new VolumeStatistics(this);
        this.vwapSellStats = new VolumeStatistics(this);
    }
    getId(){
        return `${this.hub.getId()}_${this.asset.symbol}`;
    }

    updateVwap(ticker: Ticker){
        // console.log(`Adding ticker: ${JSON.stringify(ticker)}`);
        if(ticker.side as TradeType === TradeType.BUY){
            this.vwapBuyStats.handleTicker(ticker);
            // console.log(`Buy vwap: ${this.vwapBuyStats.getVwap()}`);
        }else{
            this.vwapSellStats.handleTicker(ticker);
            // console.log(`Sell vwap: ${this.vwapSellStats.getVwap()}`);
        }
    }
};

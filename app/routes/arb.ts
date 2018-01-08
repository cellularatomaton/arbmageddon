import { Graph, Market } from '../../src/markets';
import { Arb, ArbType, ExecutionInstruction } from '../../src/strategies';
import { Asset } from '../../src/assets';
import { ExecutionOperation } from '../../src/strategies/arbitrage';

const express = require('express');
const router = express.Router();

module.exports = function(graph: Graph) {
  router.get('/', function(req, res, next) {
    const arbs: ExecutionInstruction[] = []
    graph.asset_map.forEach((asset: Asset, symbol: string)=>{
        asset.markets.forEach((buy_market: Market, buy_index: number)=>{
            asset.markets.forEach((sell_market: Market, sell_index: number)=>{
                const arb = new Arb(buy_market, sell_market);
                const arb_type = arb.type;
                if(arb_type !== ArbType.NONE){
                    arb.get_instructions().forEach((i) => {
                        arbs.push(i);
                    });
                }
            });
        });
    });
    const sorted_arbs: ExecutionInstruction[] = arbs.sort((a: ExecutionInstruction, b: ExecutionInstruction)=>{
        return b.spread - a.spread;
    });
    res.send(JSON.stringify(sorted_arbs));
  });

  return router;
};
import { Asset } from '../../src/assets';
import { Exchange } from '../../src/exchanges';
import { Hub, Market } from '../../src/markets';
import { Arb, ArbType } from '../../src/strategies';

var express = require('express');
var router = express.Router();

module.exports = function(exchanges: Exchange[]) {
  /* GET users listing. */
  router.get('/', function(req, res, next) {
    const nodes: any[] = [];
    const edges: any[] = [];
    const graph: any = {};
    graph.nodes = nodes;
    graph.edges = edges;
    let hub_index = 0;
    let market_index = 0;
    // console.log(JSON.stringify(exchanges, null, 2));
    // console.log(`Processing ${exchanges.length} exchanges...`);
    exchanges.forEach( (exchange: Exchange, exchange_index: number) => {
      // Add node
      const node = {id: `e${exchange_index}`, label: exchange.name, color: 'blue', value: 10};
      graph.nodes.push(node);
      
      exchanges.forEach((other_exchange: Exchange, other_index: number)=>{
        if(exchange_index < other_index){
          // Add edge
          const exchange_edge: any = {from: `e${exchange_index}`, to: `e${other_index}`};
          graph.edges.push(exchange_edge);
        }
      });
      // console.log(`Processing ${exchange.hubs.size} hubs...`)
      exchange.hubs.forEach((hub: Hub, key: string)=>{
        const hub_node = {id: `h${hub_index}`, label: hub.asset.symbol, color: 'red', value: 5};
        graph.nodes.push(hub_node);
        const hub_edge = {from: `e${exchange_index}`, to: `h${hub_index}`};
        graph.edges.push(hub_edge);
        // console.log(`Processing ${hub.markets.size} markets...`)
        hub.markets.forEach((market: Market, key: string)=>{
          const market_node: any = {id: `m${market_index}`, label: market.asset.symbol, color: 'green', value: 1};
          graph.nodes.push(market_node);
          const market_edge: any = {from: `h${hub_index}`, to: `m${market_index}`};
          graph.edges.push(market_edge);
          market_index++;
        });
        hub_index++;
      });  
    });
    res.send(JSON.stringify(graph));
  });
  return router;
};
import { Asset } from '../../src/assets';
import { Exchange } from '../../src/exchanges';
import { Hub, Market } from '../../src/markets';
import { Arb, ArbType } from '../../src/strategies';

const express = require('express');
const router = express.Router();
const expressWs = require('express-ws');

module.exports = function(exchanges: Exchange[]) {
  /* GET users listing. */

  router.ws('/stream', function(ws, req) {
    ws.on('message', function(msg) {
      console.log(`Graph ws message received: ${msg}`);
      // ws.send(msg);
    });
  });
  var aWss = expressWs.getWss('/stream');

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
      const node = {id: `${exchange.get_id()}`, label: exchange.name, color: 'blue', value: 10};
      graph.nodes.push(node);
      
      exchanges.forEach((other_exchange: Exchange, other_index: number)=>{
        if(exchange_index < other_index){
          // Add edge
          const exchange_edge: any = {from: `${exchange.get_id()}`, to: `${other_exchange.get_id()}`};
          graph.edges.push(exchange_edge);
        }
      });
      // console.log(`Processing ${exchange.hubs.size} hubs...`)
      exchange.hubs.forEach((hub: Hub, key: string)=>{
        const hub_node = {id: `${hub.get_id()}`, label: hub.asset.symbol, color: 'red', value: 5};
        graph.nodes.push(hub_node);
        const hub_edge = {from: `${exchange.get_id()}`, to: `${hub.get_id()}`};
        graph.edges.push(hub_edge);
        // console.log(`Processing ${hub.markets.size} markets...`)
        hub.markets.forEach((market: Market, key: string)=>{
          const market_node: any = {id: `${market.get_id()}`, label: market.asset.symbol, color: 'green', value: 1};
          graph.nodes.push(market_node);
          const market_edge: any = {from: `${hub.get_id()}`, to: `${market.get_id()}`};
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
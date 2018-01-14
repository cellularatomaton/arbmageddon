import { Hub, Market } from '../markets';
import { Asset } from '../assets';
import { Exchange, GdaxExchange, BinanceExchange, PoloniexExchange } from '../exchanges';
import { ExecutionInstruction, Arb, ArbType } from '../strategies';
import { IEvent, EventImp } from '../utils';

import * as _ from "lodash";

// export interface GraphNode {
//     id: string;
//     label: string;
//     color: string;
//     value?: number;
// }

// export interface GraphEdge {
//     id: string;
//     from: string;
//     to: string;
//     value?: number;
// }

// export enum GraphEventType {
//     SPREAD_UPDATE,
//     FLOW_UPDATE,
//     ARB_UPDATE
// }

// export interface GraphEvent<T> {
//     type: GraphEventType;
//     data: T;
// }

// export interface GraphEventHandler{
//     handle_node_event(e: GraphEvent<GraphNode>) : void;
//     handle_edge_event(e: GraphEvent<GraphEdge>) : void;
// }

export class Graph {
    public asset_map: Map<string, Asset>;
    public arb_map: Map<string, Arb>;
    exchanges: Exchange[];
    // event_handler: GraphEventHandler;
    on_arb: EventImp<ExecutionInstruction> = new EventImp<ExecutionInstruction>();
    public get arb() : IEvent<ExecutionInstruction> {
        return this.on_arb.expose();
    };
    constructor(){
        this.asset_map = new Map<string, Asset>();
        this.arb_map = new Map<string, Arb>();
        this.exchanges = [
            new GdaxExchange(this),
            new BinanceExchange(this),
            new PoloniexExchange(this)
        ];
        const arb_finder = ()=>{
            this.find_arbs();
            setTimeout(arb_finder, 1000);
        }
        arb_finder();
    }

    // set_event_handler(handler: GraphEventHandler) {
    //     this.event_handler = handler;
    // }

    // handle_node_event(e: GraphEvent<GraphNode>) {
    //     if(this.event_handler){
    //         this.event_handler.handle_node_event(e);
    //     }
    // }

    // handle_edge_event(e: GraphEvent<GraphEdge>) {
    //     if(this.event_handler){
    //         this.event_handler.handle_edge_event(e);
    //     }
    // }

    // get_inst_string(inst: ExecutionInstruction){
    //     const b_hub = `${inst.buy.exchange}.${inst.buy.hub}`;
    //     const b_mkt = `${inst.buy.exchange}.${inst.buy.market}`;
    //     const s_hub = `${inst.sell.exchange}.${inst.sell.hub}`;
    //     const s_mkt = `${inst.sell.exchange}.${inst.sell.market}`;
    //     if(inst.type === 0){ // Direct
    //         return `DIR:${b_hub}->${b_mkt}->${s_hub}`;
    //     }else if(inst.convert) { // Conversion
    //         const c_hub = `${inst.convert.exchange}:${inst.convert.hub}`;
    //         const c_mkt = `${inst.convert.exchange}:${inst.convert.market}`;
    //         if(inst.type === 1){ // Origin Conversion
    //             return `OCV:${c_hub}->${c_mkt}->${b_mkt}->${s_hub}`;
    //         }else if(inst.type === 2){ // Destination Conversion
    //             return `DCV:${b_hub}->${s_mkt}->${c_mkt}->${c_hub}`;
    //         }
    //     }
    //     return null;
    // }

    find_arbs(){
        // const arbs: ExecutionInstruction[] = []
        this.asset_map.forEach((asset: Asset, symbol: string)=>{
            asset.markets.forEach((origin_market: Market, origin_index: number)=>{
                asset.markets.forEach((destination_market: Market, destination_index: number)=>{
                    const arb = new Arb(origin_market, destination_market);
                    const arb_type = arb.type;
                    if(arb_type !== ArbType.NONE){
                        const id = arb.get_id();
                        if(!this.arb_map.has(id)){
                            // console.log(`Mapping Arb: ${id}`);
                            arb.updated.on( 
                                _.throttle( (inst?: ExecutionInstruction) => {
                                if(inst){
                                    // console.log(`Arb Triggered Instructions: ${JSON.stringify(inst)}`);
                                    this.on_arb.trigger(inst);
                                }
                            }, 1000 ));
                            this.arb_map.set(arb.get_id(), arb);
                            arb.subscribe_to_events();
                        }
                    }else{
                        // console.log(`ArbType: NONE`);
                    }
                });
            });
        });
    }

    // get_instruction_list() : ExecutionInstruction[] {
    //     console.log(`Getting execution instructions.`);
    //     const arbs: ExecutionInstruction[] = []
    //     console.log(`Arbs mapped: ${this.arb_map.size}`);
    //     this.arb_map.forEach((arb: Arb, key: string) => {
    //         arb.get_instructions().forEach((inst) => {
    //             if(inst && inst.spread){
    //                 arbs.push(inst);
    //             }
    //         });
    //     });
    //     console.log(`Arbs retrieved: ${arbs.length}`);
    //     const sorted_arbs: ExecutionInstruction[] = arbs.sort((a: ExecutionInstruction, b: ExecutionInstruction)=>{
    //         return b.spread - a.spread;
    //     });
    //     // console.log(`Sorted arbs: ${sorted_arbs.length}`);
    //     return sorted_arbs;
    // }

    // get_nodes_and_edges() : any { // For vis.js API
    //     const nodes: GraphNode[] = [];
    //     const edges: GraphEdge[] = [];
    //     const graph: any = {};
    //     graph.nodes = nodes;
    //     graph.edges = edges;
    //     let hub_index = 0;
    //     let market_index = 0;
    //     // console.log(JSON.stringify(exchanges, null, 2));
    //     // console.log(`Processing ${exchanges.length} exchanges...`);
    //     this.exchanges.forEach( (exchange: Exchange, exchange_index: number) => {
    //         // Add node
    //         const node: GraphNode = {
    //             id: `${exchange.get_id()}`, 
    //             label: exchange.id, 
    //             color: 'blue', 
    //             value: 10
    //         };
    //         graph.nodes.push(node);
            
    //         this.exchanges.forEach((other_exchange: Exchange, other_index: number)=>{
    //             if(exchange_index < other_index){
    //             // Add edge
    //             const exchange_edge: GraphEdge = {
    //                 id: `E_${exchange.get_id()}_${other_exchange.get_id()}`, 
    //                 from: `${exchange.get_id()}`, 
    //                 to: `${other_exchange.get_id()}`
    //             };
    //             graph.edges.push(exchange_edge);
    //             }
    //         });
    //         // console.log(`Processing ${exchange.hubs.size} hubs...`)
    //         exchange.hubs.forEach((hub: Hub, key: string)=>{
    //             const hub_node: GraphNode = {
    //                 id: `${hub.get_id()}`, 
    //                 label: hub.asset.symbol, 
    //                 color: 'red', 
    //                 value: 5
    //             };
    //             graph.nodes.push(hub_node);
    //             const hub_edge: GraphEdge = {
    //                 id: `E_${hub.get_id()}`,
    //                 from: `${exchange.get_id()}`, 
    //                 to: `${hub.get_id()}`
    //             };
    //             graph.edges.push(hub_edge);
    //             // console.log(`Processing ${hub.markets.size} markets...`)
    //             hub.markets.forEach((market: Market, key: string)=>{
    //             const market_node: GraphNode = {
    //                 id: `${market.get_id()}`, 
    //                 label: market.asset.symbol, 
    //                 color: 'green', 
    //                 value: 1
    //             };
    //             graph.nodes.push(market_node);
    //             const market_edge: GraphEdge = {
    //                 id: `E_${market.get_id()}`, 
    //                 from: `${hub.get_id()}`, 
    //                 to: `${market.get_id()}`
    //             };
    //             graph.edges.push(market_edge);
    //             market_index++;
    //             });
    //             hub_index++;
    //         });  
    //     });
    //     return graph;
    // }
}
import { Hub, Market } from '../markets';
import { Asset } from '../assets';
import { Exchange, GdaxExchange, BinanceExchange, PoloniexExchange } from '../exchanges';


export interface GraphNode {
    id: string;
    label: string;
    color: string;
    value?: number;
}

export interface GraphEdge {
    id: string;
    from: string;
    to: string;
    value?: number;
}

export enum GraphEventType {
    SPREAD_UPDATE,
    FLOW_UPDATE
}

export interface GraphEvent<T> {
    type: GraphEventType;
    data: T;
}

export interface GraphEventHandler{
    handle_node_event(e: GraphEvent<GraphNode>) : void;
    handle_edge_event(e: GraphEvent<GraphEdge>) : void;
}

export class Graph {
    public asset_map: Map<string, Asset>;
    exchanges: Exchange[];
    event_handler: GraphEventHandler;
    constructor(){
        this.asset_map = new Map<string, Asset>();
        this.exchanges = [
            new GdaxExchange(this),
            // new BinanceExchange(this),
            new PoloniexExchange(this)
        ];
    }

    set_event_handler(handler: GraphEventHandler) {
        this.event_handler = handler;
    }

    handle_node_event(e: GraphEvent<GraphNode>) {
        if(this.event_handler){
            this.event_handler.handle_node_event(e);
        }
    }

    handle_edge_event(e: GraphEvent<GraphEdge>) {
        if(this.event_handler){
            this.event_handler.handle_edge_event(e);
        }
    }

    get_nodes_and_edges() : any { // For vis.js API
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const graph: any = {};
        graph.nodes = nodes;
        graph.edges = edges;
        let hub_index = 0;
        let market_index = 0;
        // console.log(JSON.stringify(exchanges, null, 2));
        // console.log(`Processing ${exchanges.length} exchanges...`);
        this.exchanges.forEach( (exchange: Exchange, exchange_index: number) => {
            // Add node
            const node: GraphNode = {
                id: `${exchange.get_id()}`, 
                label: exchange.name, 
                color: 'blue', 
                value: 10
            };
            graph.nodes.push(node);
            
            this.exchanges.forEach((other_exchange: Exchange, other_index: number)=>{
                if(exchange_index < other_index){
                // Add edge
                const exchange_edge: GraphEdge = {
                    id: `E_${exchange.get_id()}_${other_exchange.get_id()}`, 
                    from: `${exchange.get_id()}`, 
                    to: `${other_exchange.get_id()}`
                };
                graph.edges.push(exchange_edge);
                }
            });
            // console.log(`Processing ${exchange.hubs.size} hubs...`)
            exchange.hubs.forEach((hub: Hub, key: string)=>{
                const hub_node: GraphNode = {
                    id: `${hub.get_id()}`, 
                    label: hub.asset.symbol, 
                    color: 'red', 
                    value: 5
                };
                graph.nodes.push(hub_node);
                const hub_edge: GraphEdge = {
                    id: `E_${hub.get_id()}`,
                    from: `${exchange.get_id()}`, 
                    to: `${hub.get_id()}`
                };
                graph.edges.push(hub_edge);
                // console.log(`Processing ${hub.markets.size} markets...`)
                hub.markets.forEach((market: Market, key: string)=>{
                const market_node: GraphNode = {
                    id: `${market.get_id()}`, 
                    label: market.asset.symbol, 
                    color: 'green', 
                    value: 1
                };
                graph.nodes.push(market_node);
                const market_edge: GraphEdge = {
                    id: `E_${market.get_id()}`, 
                    from: `${hub.get_id()}`, 
                    to: `${market.get_id()}`
                };
                graph.edges.push(market_edge);
                market_index++;
                });
                hub_index++;
            });  
        });
        return graph;
    }
}
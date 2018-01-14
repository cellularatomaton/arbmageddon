import { Hub, Market } from '../markets';
import { Asset } from '../assets';
import { Exchange, GdaxExchange, BinanceExchange, PoloniexExchange } from '../exchanges';
import { ExecutionInstruction, Arb, ArbType } from '../strategies';
import { IEvent, EventImp } from '../utils';

import * as _ from "lodash";

export class Graph {
    public asset_map: Map<string, Asset>;
    public arb_map: Map<string, Arb>;
    exchanges: Exchange[];
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

    find_arbs(){
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
}
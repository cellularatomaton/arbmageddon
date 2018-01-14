import { Market } from '../markets';
import { TradeType, VWAP } from '../markets/ticker';
import { ExecutionStrategy } from './execution';
import { IEvent, EventImp } from '../utils';

import 'colors';

export enum ArbType {
    SIMPLE,
    COMPLEX,
    NONE 
}

export enum ArbConversionType {
    BUY_SIDE,
    SELL_SIDE,
    EITHER_SIDE,
    NONE
}

export enum InstructionType {
    DIRECT,
    ORIGIN_CONVERSION,
    DESTINATION_CONVERSION
}

export interface ExecutionOperation {
    exchange: string;
    hub: string;
    market: string;
    price: number;
    duration: number;
}

export interface ExecutionInstruction {
    id: string | null;
    spread: number;
    type: InstructionType;
    buy: ExecutionOperation;
    sell: ExecutionOperation;
    convert?: ExecutionOperation;
}

export class Arb {
    public type: ArbType;
    public conversion_type: ArbConversionType;
    public origin_conversion: Market | null | undefined;
    public destination_conversion: Market | null | undefined;
    on_updated: EventImp<ExecutionInstruction> = new EventImp<ExecutionInstruction>();
    public get updated() : IEvent<ExecutionInstruction> {
        return this.on_updated.expose();
    };
    constructor(
        public origin_market: Market,
        public destination_market: Market
    ){
        // Find buy conversion market
        const origin_exchange = origin_market.hub.exchange;
        const origin_conversion_hub = origin_exchange.hubs.get(destination_market.hub.asset.symbol);
        this.origin_conversion = origin_conversion_hub ? origin_conversion_hub.markets.get(origin_market.hub.asset.symbol) : null;
        // Find sell conversion market
        const destination_exchange = destination_market.hub.exchange;
        const destination_conversion_hub = destination_exchange.hubs.get(origin_market.hub.asset.symbol);
        this.destination_conversion = destination_conversion_hub ? destination_conversion_hub.markets.get(destination_market.hub.asset.symbol) : null;
        if(origin_market.vwap_sell_stats.get_vwap() === 0 || destination_market.vwap_buy_stats.get_vwap() === 0){
            this.type = ArbType.NONE;
            this.conversion_type = ArbConversionType.NONE;
        }
        else if(this.origin_conversion || this.destination_conversion){
            this.type = ArbType.COMPLEX;
            if(this.origin_conversion && this.destination_conversion){
                this.conversion_type = ArbConversionType.EITHER_SIDE;
            } else if(this.origin_conversion){
                this.conversion_type = ArbConversionType.BUY_SIDE;
            }else if(this.destination_conversion){
                this.conversion_type = ArbConversionType.SELL_SIDE;
            }else{
                this.conversion_type = ArbConversionType.NONE;
            }
        }else if(this.is_simple_arb()){
            this.type = ArbType.SIMPLE;
            this.conversion_type = ArbConversionType.NONE;
        }else {
            this.type = ArbType.NONE;
            this.conversion_type = ArbConversionType.NONE;
        }
    }

    subscribe_to_vwap(event: IEvent<VWAP>) {
        event.on((vwap: VWAP | undefined) => {
            const instructions: ExecutionInstruction[] = this.get_instructions();
            instructions.forEach((inst: ExecutionInstruction)=>{
                // console.log(`VWAP Triggered Instructions: ${JSON.stringify(inst)}`);
                this.on_updated.trigger(inst);
            });
        });
    }

    subscribe_to_events() {
        this.subscribe_to_vwap(this.destination_market.vwap_buy_stats.vwap_updated);
        this.subscribe_to_vwap(this.origin_market.vwap_sell_stats.vwap_updated);
        if(this.origin_conversion){
            this.subscribe_to_vwap(this.origin_conversion.vwap_sell_stats.vwap_updated);
        }
        if(this.destination_conversion){
            this.subscribe_to_vwap(this.destination_conversion.vwap_buy_stats.vwap_updated);
        }
    }

    get_id() : string {
        const origin_exchange = this.origin_market.hub.exchange.id;
        const origin_convert = this.origin_conversion ? this.origin_conversion.asset.symbol : 'NULL';
        const origin_market = this.origin_market.asset.symbol;
        const destination_exchange = this.destination_market.hub.exchange.id;
        const destination_market = this.destination_market.asset.symbol;
        const destination_convert = this.destination_conversion ? this.destination_conversion.asset.symbol : 'NULL';
        return `${this.type}.${this.conversion_type}.${origin_exchange}.${origin_convert}.${origin_market}.${destination_exchange}${destination_convert}${destination_market}`;
    }

    get_inst_id(inst_type: InstructionType) : string | null {
        const origin_exchange = this.origin_market.hub.exchange.id;
        const origin_hub = this.origin_market.hub.asset.symbol;
        const origin_market = this.origin_market.asset.symbol;
        const destination_exchange = this.destination_market.hub.exchange.id;
        const destination_hub = this.destination_market.hub.asset.symbol;
        const destination_market = this.destination_market.asset.symbol;
        const origin_convert = this.origin_conversion ? this.origin_conversion.asset.symbol : null;
        const origin_convert_hub = this.origin_conversion ? this.origin_conversion.hub.asset.symbol : null;
        const destination_convert = this.destination_conversion ? this.destination_conversion.asset.symbol : null;
        const destination_convert_hub = this.destination_conversion ? this.destination_conversion.hub.asset.symbol : null;
        
        const o_hub = `${origin_exchange}.${origin_hub}`;
        const o_mkt = `${origin_exchange}.${origin_market}`;
        const d_hub = `${destination_exchange}.${destination_hub}`;
        const d_mkt = `${destination_exchange}.${destination_market}`;
        const oc_hub = `${origin_exchange}.${origin_convert_hub}`;
        const oc_mkt = `${origin_exchange}.${origin_convert}`;
        const dc_hub = `${destination_exchange}.${destination_convert_hub}`;
        const dc_mkt = `${destination_exchange}.${destination_convert}`;

        if(inst_type as InstructionType === InstructionType.DIRECT){ // Direct Arb
            return `DA:${o_hub}->${o_mkt}->${d_hub}`;
        }else if(inst_type as InstructionType === InstructionType.ORIGIN_CONVERSION) { // Origin Conversion
            return `OC:${oc_hub}->${oc_mkt}->${o_mkt}->${d_hub}`;
        }else if(inst_type as InstructionType === InstructionType.DESTINATION_CONVERSION){ // Destination Conversion
            return `DC:${o_hub}->${d_mkt}->${dc_mkt}->${dc_hub}`;
        }
        return null;
    }

    is_simple_arb() : boolean {
        const origin_hub = this.origin_market.hub.asset.symbol;
        const origin_exchange = this.origin_market.hub.exchange.id;
        const destination_hub = this.destination_market.hub.asset.symbol;
        const destination_exchange = this.destination_market.hub.exchange.id;
        const is_same_hub = origin_hub === destination_hub;
        const is_same_exchange = origin_exchange === destination_exchange;
        const is_simple = (is_same_hub && !is_same_exchange);
        return is_simple;
    }

    get_spread(){
        const spread = this.destination_market.vwap_buy_stats.get_vwap() - this.origin_market.vwap_sell_stats.get_vwap();
        return spread;
    }

    get_spread_percent(){
        const spread = this.get_spread();
        if(this.origin_market.vwap_sell_stats.get_vwap() === 0){
            return Number.NaN;
        }else{
            return spread / this.origin_market.vwap_sell_stats.get_vwap();
        }
    }

    get_origin_conversion_spread(){
        if(this.origin_conversion){
            return this.destination_market.vwap_buy_stats.get_vwap() - this.origin_market.vwap_sell_stats.get_vwap() * this.origin_conversion.vwap_sell_stats.get_vwap();
        }else{
            return Number.NaN;
        }
    }

    get_origin_conversion_spread_percent(){
        if(this.origin_conversion){
            const initial_value = this.origin_market.vwap_sell_stats.get_vwap() * this.origin_conversion.vwap_sell_stats.get_vwap();
            if(initial_value === 0){
                return Number.NaN;
            }else{
                return this.get_origin_conversion_spread() / initial_value;
            }
        }else{
            return Number.NaN;
        }
    }

    get_destination_conversion_spread(){
        if(this.destination_conversion){
            return this.destination_market.vwap_buy_stats.get_vwap() * this.destination_conversion.vwap_buy_stats.get_vwap() - this.origin_market.vwap_sell_stats.get_vwap();
        }else{
            return Number.NaN;
        }
    }

    get_destination_conversion_spread_percent(){
        if(this.destination_conversion){
            const initial_value = this.origin_market.vwap_sell_stats.get_vwap();
            if(initial_value === 0){
                return Number.NaN;
            }else{
                return this.get_destination_conversion_spread() / initial_value;
            }
        }else{
            return Number.NaN;
        }
    }

    get_conversion_spread_percent(){
        const origin_conversion_spread = this.get_origin_conversion_spread_percent();
        const destination_conversion_spread = this.get_destination_conversion_spread_percent();
        return this.get_better_spread(origin_conversion_spread, destination_conversion_spread);
    }

    get_conversion_spread(){
        const origin_conversion_spread = this.get_origin_conversion_spread();
        const destination_conversion_spread = this.get_destination_conversion_spread();
        return this.get_better_spread(origin_conversion_spread, destination_conversion_spread);
    }

    get_better_spread(origin_conversion_spread: number, destination_conversion_spread: number){
        const has_origin_conversion = !Number.isNaN(origin_conversion_spread);
        const has_destination_conversion = !Number.isNaN(destination_conversion_spread);

        if(this.conversion_type === ArbConversionType.EITHER_SIDE){
            if(Math.abs(destination_conversion_spread) < Math.abs(origin_conversion_spread)){
                return origin_conversion_spread;
            }else{
                return destination_conversion_spread;
            }
        }else if(this.conversion_type === ArbConversionType.BUY_SIDE){
            return origin_conversion_spread;
        }else if(this.conversion_type === ArbConversionType.SELL_SIDE){
            return destination_conversion_spread;
        }else{
            console.log(`Missing conversion markets!`);
            return Number.NaN;
        }
    }

    // public get_buy_log_string(){
    //     const buy_exchange = this.buy_market.hub.exchange.id.blue;
    //     const buy_symbol = `${this.buy_market.asset.symbol}/${this.buy_market.hub.asset.symbol}`.blue;
    //     const buy_price = this.buy_market.vwap_sell_stats.get_vwap().toString().blue;
    //     const buy_text = `Buy ${buy_exchange} ${buy_symbol} ${buy_price}`.blue;
    //     return buy_text;
    // }

    public get_buy_operation() : ExecutionOperation {
        return {
            exchange: this.origin_market.hub.exchange.id,
            hub: this.origin_market.hub.asset.symbol,
            market: this.origin_market.asset.symbol,
            price: this.origin_market.vwap_sell_stats.get_vwap(),
            duration: this.origin_market.vwap_sell_stats.get_duration()
        };
    }

    // public get_sell_log_string(){
    //     const sell_exchange = this.sell_market.hub.exchange.id.cyan;
    //     const sell_symbol = `${this.sell_market.asset.symbol}/${this.sell_market.hub.asset.symbol}`.cyan;
    //     const sell_price = this.sell_market.vwap_buy_stats.get_vwap().toString().cyan;
    //     const sell_text = `Sell ${sell_exchange} ${sell_symbol} ${sell_price}`.cyan;
    //     return sell_text;
    // }

    public get_sell_operation() : ExecutionOperation {
        return {
            exchange: this.destination_market.hub.exchange.id,
            hub: this.destination_market.hub.asset.symbol,
            market: this.destination_market.asset.symbol,
            price: this.destination_market.vwap_buy_stats.get_vwap(),
            duration: this.destination_market.vwap_buy_stats.get_duration()
        };
    }

    // public get_buy_conv_log_string(){
    //     if(this.buy_conversion){
    //         const buy_conversion_price = this.buy_conversion.vwap_sell_stats.get_vwap().toString().blue;
    //         const buy_conversion_symbol = `${this.buy_conversion.asset.symbol}/${this.buy_conversion.hub.asset.symbol}`.blue;
    //         const buy_convert_text = `Buy Convert: ${buy_conversion_symbol} ${buy_conversion_price}`.blue;
    //         return buy_convert_text;
    //     }else{
    //         return `Undefined Buy Conversion!`;
    //     }
    // }

    public get_origin_conv_operation() : ExecutionOperation | null {
        if(this.origin_conversion){
            return {
                exchange: this.origin_conversion.hub.exchange.id,
                hub: this.origin_conversion.hub.asset.symbol,
                market: this.origin_conversion.asset.symbol,
                price: this.origin_conversion.vwap_sell_stats.get_vwap(),
                duration: this.origin_conversion.vwap_sell_stats.get_duration()
            };
        }else{
            return null;
        }
    }

    // public get_sell_conv_log_string(){
    //     if(this.sell_conversion){
    //         const sell_conversion_price = this.sell_conversion.vwap_buy_stats.get_vwap().toString().cyan;
    //         const sell_conversion_symbol = `${this.sell_conversion.asset.symbol}/${this.sell_conversion.hub.asset.symbol}`.cyan;
    //         const sell_convert_text = `Sell Convert: ${sell_conversion_symbol} ${sell_conversion_price}`.cyan;
    //         return sell_convert_text;
    //     }else{
    //         return `Undefined Sell Conversion!`;
    //     }
    // }

    public get_destination_conv_operation() : ExecutionOperation | null {
        if(this.destination_conversion){
            return {
                exchange: this.destination_conversion.hub.exchange.id,
                hub: this.destination_conversion.hub.asset.symbol,
                market: this.destination_conversion.asset.symbol,
                price: this.destination_conversion.vwap_buy_stats.get_vwap(),
                duration: this.destination_conversion.vwap_buy_stats.get_duration()
            };
        }else{
            return null;
        }
    }

    // public log_arb(){
    //     const symbol = this.buy_market.asset.symbol.yellow;
    //     const arb_type_text = ArbType[this.type].yellow;
    //     const spread = (this.type === ArbType.COMPLEX.valueOf() ? this.get_conversion_spread_percent() : this.get_spread_percent()) * 100;
    //     const spread_text = spread < 0 ? `${spread.toFixed(2)}%`.red : `${spread.toFixed(2)}%`.green;
    //     const arb_text = `${symbol} ${arb_type_text}`.yellow;
    //     if(this.type === ArbType.SIMPLE){
    //         const buy_text = this.get_buy_log_string();
    //         const sell_text = this.get_sell_log_string();
    //         console.log(`${arb_text} ${spread_text} ${buy_text} ${sell_text}`);
    //     }else if(this.type === ArbType.COMPLEX){
    //         if(this.conversion_type === ArbConversionType.EITHER_SIDE){
    //             const buy_text = this.get_buy_log_string();
    //             const sell_text = this.get_sell_log_string();
    //             const buy_convert_text = this.get_buy_conv_log_string();
    //             const sell_convert_text = this.get_sell_conv_log_string();
    //             console.log(`${arb_text} ${spread_text} ${buy_text} ${buy_convert_text} ${sell_text} ${sell_convert_text}`);
    //         }else if(this.conversion_type === ArbConversionType.BUY_SIDE){
    //             const buy_text = this.get_buy_log_string();
    //             const sell_text = this.get_sell_log_string();
    //             const buy_convert_text = this.get_buy_conv_log_string();
    //             console.log(`${arb_text} ${spread_text} ${buy_text} ${buy_convert_text} ${sell_text}`);
    //         }else if(this.conversion_type === ArbConversionType.SELL_SIDE){
    //             const buy_text = this.get_buy_log_string();
    //             const sell_text = this.get_sell_log_string();
    //             const sell_convert_text = this.get_sell_conv_log_string();
    //             console.log(`${arb_text} ${spread_text} ${buy_text} ${sell_text} ${sell_convert_text}`);
    //         }else{
    //             console.log(`No Conversion Type.`);
    //         }
    //     }else{
    //         console.log(`No Arb Type.`);
    //     }
    // }

    public get_direct_instructions() : ExecutionInstruction | null {
        const spread = this.get_spread_percent();
        const buy = this.get_buy_operation();
        const sell = this.get_sell_operation();
        const instructions = {
            id: this.get_inst_id(InstructionType.DIRECT),
            spread: spread,
            type: InstructionType.DIRECT,
            buy: buy,
            sell: sell
        };
        return instructions;
    }

    public get_origin_convert_instructions() : ExecutionInstruction | null {
        const buy_convert_spread = this.get_origin_conversion_spread_percent();
        const buy = this.get_buy_operation();
        const sell = this.get_sell_operation();
        const buy_convert = this.get_origin_conv_operation();
        if(buy_convert){
            const instructions = {
                id: this.get_inst_id(InstructionType.ORIGIN_CONVERSION),
                spread: buy_convert_spread,
                type: InstructionType.ORIGIN_CONVERSION,
                buy: buy,
                sell: sell,
                convert: buy_convert
            };
            return instructions;
        }else{
            return null;
        }
    }

    public get_destination_convert_instructions() : ExecutionInstruction | null {
        const sell_convert_spread = this.get_destination_conversion_spread_percent();
        const buy = this.get_buy_operation();
        const sell = this.get_sell_operation();
        const sell_convert = this.get_destination_conv_operation();
        if(sell_convert){
            const instructions = {
                id: this.get_inst_id(InstructionType.DESTINATION_CONVERSION),
                spread: sell_convert_spread,
                type: InstructionType.DESTINATION_CONVERSION,
                buy: buy,
                sell: sell,
                convert: sell_convert
            };
            return instructions;
        }else{
            return null;
        }
    }

    public get_instructions() : ExecutionInstruction[] {
        const instructions: ExecutionInstruction[] = [];
        if(this.type === ArbType.SIMPLE){
            const instruction = this.get_direct_instructions();
            if(instruction && !Number.isNaN(instruction.spread)){
                instructions.push(instruction);
            }
        }else if(this.type === ArbType.COMPLEX){
            if(this.conversion_type === ArbConversionType.EITHER_SIDE){
                const sell_convert_instruction = this.get_destination_convert_instructions();
                if(sell_convert_instruction && !Number.isNaN(sell_convert_instruction.spread)){
                    instructions.push(sell_convert_instruction);
                }
                const buy_convert_instruction = this.get_origin_convert_instructions();
                if(buy_convert_instruction && ! !Number.isNaN(buy_convert_instruction.spread)){
                    instructions.push(buy_convert_instruction);
                }
            }else if(this.conversion_type === ArbConversionType.BUY_SIDE){
                const buy_convert_instruction = this.get_origin_convert_instructions();
                if(buy_convert_instruction && !Number.isNaN(buy_convert_instruction.spread)){
                    instructions.push(buy_convert_instruction);
                }
            }else if(this.conversion_type === ArbConversionType.SELL_SIDE){
                const sell_convert_instruction = this.get_destination_convert_instructions();
                if(sell_convert_instruction && !Number.isNaN(sell_convert_instruction.spread)){
                    instructions.push(sell_convert_instruction);
                }
            }else{
                console.log(`No Conversion Type.`);
            }
        }else{
            console.log(`No Arb Type.`);
        }
        return instructions;
    }
}
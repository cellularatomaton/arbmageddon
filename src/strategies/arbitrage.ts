import { Market } from '../markets';
import 'colors';
import { TradeType } from '../markets/ticker';
import { ExecutionStrategy } from './execution';

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

export interface ExecutionOperation {
    exchange: string;
    hub: string;
    market: string;
    type: TradeType;
    price: number;
}

export interface ExecutionInstruction {
    operations: ExecutionOperation[];
    spread: number;
}

export class Arb {
    public type: ArbType;
    public conversion_type: ArbConversionType;
    public buy_conversion: Market | null | undefined;
    public sell_conversion: Market | null | undefined;
    
    constructor(
        public buy_market: Market,
        public sell_market: Market
    ){
        // Find buy conversion market
        const buy_exchange = buy_market.hub.exchange;
        const buy_conversion_hub = buy_exchange.hubs.get(sell_market.hub.asset.symbol);
        this.buy_conversion = buy_conversion_hub ? buy_conversion_hub.markets.get(buy_market.hub.asset.symbol) : null;
        // Find sell conversion market
        const sell_exchange = sell_market.hub.exchange;
        const sell_conversion_hub = sell_exchange.hubs.get(buy_market.hub.asset.symbol);
        this.sell_conversion = sell_conversion_hub ? sell_conversion_hub.markets.get(sell_market.hub.asset.symbol) : null;
        if(buy_market.vwap_sell_stats.get_vwap() === 0 || sell_market.vwap_buy_stats.get_vwap() === 0){
            this.type = ArbType.NONE;
            this.conversion_type = ArbConversionType.NONE;
        }
        else if(this.buy_conversion || this.sell_conversion){
            this.type = ArbType.COMPLEX;
            if(this.buy_conversion && this.sell_conversion){
                this.conversion_type = ArbConversionType.EITHER_SIDE;
            } else if(this.buy_conversion){
                this.conversion_type = ArbConversionType.BUY_SIDE;
            }else if(this.sell_conversion){
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

    is_simple_arb() : boolean {
        const buy_hub = this.buy_market.hub.asset.symbol;
        const buy_exchange = this.buy_market.hub.exchange.name;
        const sell_hub = this.sell_market.hub.asset.symbol;
        const sell_exchange = this.sell_market.hub.exchange.name;
        const is_same_hub = buy_hub === sell_hub;
        const is_same_exchange = buy_exchange === sell_exchange;
        const is_simple = (is_same_hub && !is_same_exchange);
        return is_simple;
    }

    get_spread(){
        const spread = this.sell_market.vwap_buy_stats.get_vwap() - this.buy_market.vwap_sell_stats.get_vwap();
        return spread;
    }

    get_spread_percent(){
        const spread = this.get_spread();
        if(this.buy_market.vwap_sell_stats.get_vwap() === 0){
            return Number.NaN;
        }else{
            return spread / this.buy_market.vwap_sell_stats.get_vwap();
        }
    }

    get_buy_conversion_spread(){
        if(this.buy_conversion){
            return this.sell_market.vwap_buy_stats.get_vwap() - this.buy_market.vwap_sell_stats.get_vwap() * this.buy_conversion.vwap_sell_stats.get_vwap();
        }else{
            return Number.NaN;
        }
    }

    get_buy_conversion_spread_percent(){
        if(this.buy_conversion){
            const initial_value = this.buy_market.vwap_sell_stats.get_vwap() * this.buy_conversion.vwap_sell_stats.get_vwap();
            if(initial_value === 0){
                return Number.NaN;
            }else{
                return this.get_buy_conversion_spread() / initial_value;
            }
        }else{
            return Number.NaN;
        }
    }

    get_sell_conversion_spread(){
        if(this.sell_conversion){
            return this.sell_market.vwap_buy_stats.get_vwap() * this.sell_conversion.vwap_buy_stats.get_vwap() - this.buy_market.vwap_sell_stats.get_vwap();
        }else{
            return Number.NaN;
        }
    }

    get_sell_conversion_spread_percent(){
        if(this.sell_conversion){
            const initial_value = this.buy_market.vwap_sell_stats.get_vwap();
            if(initial_value === 0){
                return Number.NaN;
            }else{
                return this.get_sell_conversion_spread() / initial_value;
            }
        }else{
            return Number.NaN;
        }
    }

    get_conversion_spread_percent(){
        const buy_conversion_spread = this.get_buy_conversion_spread_percent();
        const sell_conversion_spread = this.get_sell_conversion_spread_percent();
        return this.get_better_spread(buy_conversion_spread, sell_conversion_spread);
    }

    get_conversion_spread(){
        const buy_conversion_spread = this.get_buy_conversion_spread();
        const sell_conversion_spread = this.get_sell_conversion_spread();
        return this.get_better_spread(buy_conversion_spread, sell_conversion_spread);
    }

    get_better_spread(buy_conversion_spread: number, sell_conversion_spread: number){
        const has_buy_conversion = !Number.isNaN(buy_conversion_spread);
        const has_sell_conversion = !Number.isNaN(sell_conversion_spread);

        if(this.conversion_type === ArbConversionType.EITHER_SIDE){
            if(Math.abs(sell_conversion_spread) < Math.abs(buy_conversion_spread)){
                return buy_conversion_spread;
            }else{
                return sell_conversion_spread;
            }
        }else if(this.conversion_type === ArbConversionType.BUY_SIDE){
            return buy_conversion_spread;
        }else if(this.conversion_type === ArbConversionType.SELL_SIDE){
            return sell_conversion_spread;
        }else{
            console.log(`Missing conversion markets!`);
            return Number.NaN;
        }
    }

    public get_buy_log_string(){
        const buy_exchange = this.buy_market.hub.exchange.name.blue;
        const buy_symbol = `${this.buy_market.asset.symbol}/${this.buy_market.hub.asset.symbol}`.blue;
        const buy_price = this.buy_market.vwap_sell_stats.get_vwap().toString().blue;
        const buy_text = `Buy ${buy_exchange} ${buy_symbol} ${buy_price}`.blue;
        return buy_text;
    }

    public get_buy_operation() : ExecutionOperation {
        return {
            exchange: this.buy_market.hub.exchange.name,
            hub: this.buy_market.hub.asset.symbol,
            market: this.buy_market.asset.symbol,
            type: TradeType.BUY,
            price: this.buy_market.vwap_sell_stats.get_vwap()
        };
    }

    public get_sell_log_string(){
        const sell_exchange = this.sell_market.hub.exchange.name.cyan;
        const sell_symbol = `${this.sell_market.asset.symbol}/${this.sell_market.hub.asset.symbol}`.cyan;
        const sell_price = this.sell_market.vwap_buy_stats.get_vwap().toString().cyan;
        const sell_text = `Sell ${sell_exchange} ${sell_symbol} ${sell_price}`.cyan;
        return sell_text;
    }

    public get_sell_operation() : ExecutionOperation {
        return {
            exchange: this.sell_market.hub.exchange.name,
            hub: this.sell_market.hub.asset.symbol,
            market: this.sell_market.asset.symbol,
            type: TradeType.SELL,
            price: this.sell_market.vwap_buy_stats.get_vwap()
        };
    }

    public get_buy_conv_log_string(){
        if(this.buy_conversion){
            const buy_conversion_price = this.buy_conversion.vwap_sell_stats.get_vwap().toString().blue;
            const buy_conversion_symbol = `${this.buy_conversion.asset.symbol}/${this.buy_conversion.hub.asset.symbol}`.blue;
            const buy_convert_text = `Buy Convert: ${buy_conversion_symbol} ${buy_conversion_price}`.blue;
            return buy_convert_text;
        }else{
            return `Undefined Buy Conversion!`;
        }
    }

    public get_buy_conv_operation() : ExecutionOperation | null {
        if(this.buy_conversion){
            return {
                exchange: this.buy_conversion.hub.exchange.name,
                hub: this.buy_conversion.hub.asset.symbol,
                market: this.buy_conversion.asset.symbol,
                type: TradeType.BUY,
                price: this.buy_conversion.vwap_sell_stats.get_vwap()
            };
        }else{
            return null;
        }
    }

    public get_sell_conv_log_string(){
        if(this.sell_conversion){
            const sell_conversion_price = this.sell_conversion.vwap_buy_stats.get_vwap().toString().cyan;
            const sell_conversion_symbol = `${this.sell_conversion.asset.symbol}/${this.sell_conversion.hub.asset.symbol}`.cyan;
            const sell_convert_text = `Sell Convert: ${sell_conversion_symbol} ${sell_conversion_price}`.cyan;
            return sell_convert_text;
        }else{
            return `Undefined Sell Conversion!`;
        }
    }

    public get_sell_conv_operation() : ExecutionOperation | null {
        if(this.sell_conversion){
            return {
                exchange: this.sell_conversion.hub.exchange.name,
                hub: this.sell_conversion.hub.asset.symbol,
                market: this.sell_conversion.asset.symbol,
                type: TradeType.SELL,
                price: this.sell_conversion.vwap_buy_stats.get_vwap()
            };
        }else{
            return null;
        }
    }

    public log_arb(){
        const symbol = this.buy_market.asset.symbol.yellow;
        const arb_type_text = ArbType[this.type].yellow;
        const spread = (this.type === ArbType.COMPLEX.valueOf() ? this.get_conversion_spread_percent() : this.get_spread_percent()) * 100;
        const spread_text = spread < 0 ? `${spread.toFixed(2)}%`.red : `${spread.toFixed(2)}%`.green;
        const arb_text = `${symbol} ${arb_type_text}`.yellow;
        if(this.type === ArbType.SIMPLE){
            const buy_text = this.get_buy_log_string();
            const sell_text = this.get_sell_log_string();
            console.log(`${arb_text} ${spread_text} ${buy_text} ${sell_text}`);
        }else if(this.type === ArbType.COMPLEX){
            if(this.conversion_type === ArbConversionType.EITHER_SIDE){
                const buy_text = this.get_buy_log_string();
                const sell_text = this.get_sell_log_string();
                const buy_convert_text = this.get_buy_conv_log_string();
                const sell_convert_text = this.get_sell_conv_log_string();
                console.log(`${arb_text} ${spread_text} ${buy_text} ${buy_convert_text} ${sell_text} ${sell_convert_text}`);
            }else if(this.conversion_type === ArbConversionType.BUY_SIDE){
                const buy_text = this.get_buy_log_string();
                const sell_text = this.get_sell_log_string();
                const buy_convert_text = this.get_buy_conv_log_string();
                console.log(`${arb_text} ${spread_text} ${buy_text} ${buy_convert_text} ${sell_text}`);
            }else if(this.conversion_type === ArbConversionType.SELL_SIDE){
                const buy_text = this.get_buy_log_string();
                const sell_text = this.get_sell_log_string();
                const sell_convert_text = this.get_sell_conv_log_string();
                console.log(`${arb_text} ${spread_text} ${buy_text} ${sell_text} ${sell_convert_text}`);
            }else{
                console.log(`No Conversion Type.`);
            }
        }else{
            console.log(`No Arb Type.`);
        }
    }

    public get_simple_instructions() : ExecutionInstruction | null {
        const spread = this.get_spread_percent();
        const buy = this.get_buy_operation();
        const sell = this.get_sell_operation();
        const operations: ExecutionOperation[] = [];
        const instructions = {
            operations: operations,
            spread: spread
        };
        instructions.operations.push(buy);
        instructions.operations.push(sell);
        return instructions;
    }

    public get_buy_convert_instructions() : ExecutionInstruction | null {
        const buy_convert_spread = this.get_buy_conversion_spread_percent();
        const buy = this.get_buy_operation();
        const sell = this.get_sell_operation();
        const buy_convert = this.get_buy_conv_operation();
        if(buy_convert){
            const operations: ExecutionOperation[] = [];
            const instructions = {
                operations: operations,
                spread: buy_convert_spread
            };
            instructions.operations.push(buy_convert);
            instructions.operations.push(buy);
            instructions.operations.push(sell);
            return instructions;
        }else{
            return null;
        }
    }

    public get_sell_convert_instructions() : ExecutionInstruction | null {
        const sell_convert_spread = this.get_sell_conversion_spread_percent();
        const buy = this.get_buy_operation();
        const sell = this.get_sell_operation();
        const sell_convert = this.get_sell_conv_operation();
        if(sell_convert){
            const operations: ExecutionOperation[] = [];
            const instructions = {
                operations: operations,
                spread: sell_convert_spread
            };
            instructions.operations.push(buy);
            instructions.operations.push(sell);
            instructions.operations.push(sell_convert);
            return instructions;
        }else{
            return null;
        }
    }

    public get_instructions() : ExecutionInstruction[] {
        const instructions: ExecutionInstruction[] = [];
        if(this.type === ArbType.SIMPLE){
            const instruction = this.get_simple_instructions();
            if(instruction && !Number.isNaN(instruction.spread)){
                instructions.push(instruction);
            }
        }else if(this.type === ArbType.COMPLEX){
            if(this.conversion_type === ArbConversionType.EITHER_SIDE){
                const sell_convert_instruction = this.get_sell_convert_instructions();
                if(sell_convert_instruction && !Number.isNaN(sell_convert_instruction.spread)){
                    instructions.push(sell_convert_instruction);
                }
                const buy_convert_instruction = this.get_buy_convert_instructions();
                if(buy_convert_instruction && ! !Number.isNaN(buy_convert_instruction.spread)){
                    instructions.push(buy_convert_instruction);
                }
            }else if(this.conversion_type === ArbConversionType.BUY_SIDE){
                const buy_convert_instruction = this.get_buy_convert_instructions();
                if(buy_convert_instruction && !Number.isNaN(buy_convert_instruction.spread)){
                    instructions.push(buy_convert_instruction);
                }
            }else if(this.conversion_type === ArbConversionType.SELL_SIDE){
                const sell_convert_instruction = this.get_sell_convert_instructions();
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
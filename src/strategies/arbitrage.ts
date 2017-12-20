import { Market } from '../markets';
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
        if(buy_market.best_ask === 0 || sell_market.best_bid === 0){
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

    // log_arb_type() {
    //     let arb_type = ArbType.NONE;
    //     const buy_hub = this.buy_market.hub.asset.symbol;
    //     const buy_exchange = this.buy_market.hub.exchange.name;
    //     const sell_hub = this.sell_market.hub.asset.symbol;
    //     const sell_exchange = this.sell_market.hub.exchange.name;
    //     const is_same_hub = buy_hub === sell_hub;
    //     const is_same_exchange = buy_exchange === sell_exchange;
    //     // const is_simple = this.is_simple_arb();
    //     // const is_complex = (is_same_hub) !is_same_exchange;
    //     // Logging:
    //     const is_simple_text = this.type === ArbType. ? is_simple.toString().green : is_simple.toString().red;
    //     const is_same_hub_text = is_same_hub ? is_same_hub.toString().green : is_same_hub.toString().red;
    //     const is_same_exchange_text = is_same_exchange ? is_same_exchange.toString().green : is_same_exchange.toString().red;
    //     const buy_hub_text = buy_hub.blue;
    //     const buy_market_text = buy_market.asset.symbol.blue;
    //     const buy_exchange_text = buy_exchange.blue;
    //     const sell_hub_text = sell_hub.magenta;
    //     const sell_market_text = sell_market.asset.symbol.magenta;
    //     const sell_exchange_text = sell_exchange.magenta;
    
        
    //     if(is_simple){
    //         arb_type = ArbType.SIMPLE;
    //     }else if (is_complex){
    //         arb_type = ArbType.COMPLEX;
    //     }
    //     console.log(`${ArbType[this.type]}: Buy ${buy_market_text} ${buy_hub_text} ${buy_exchange_text}, Sell ${sell_market_text} ${sell_hub_text} ${sell_exchange_text}, Same Hub? ${is_same_hub_text}, Same Exchange ${is_same_exchange_text}`);
    //     return arb_type;
    // }

    get_spread(){
        const spread = this.sell_market.best_bid - this.buy_market.best_ask;
        return spread;
    }

    get_spread_percent(){
        const spread = this.get_spread();
        if(this.buy_market.best_ask === 0){
            return Number.NaN;
        }else{
            return spread / this.buy_market.best_ask;
        }
    }

    get_buy_conversion_spread(){
        if(this.buy_conversion){
            return this.sell_market.best_bid - this.buy_market.best_ask * this.buy_conversion.best_ask;
        }else{
            return Number.NaN;
        }
    }

    get_buy_conversion_spread_percent(){
        if(this.buy_conversion){
            const initial_value = this.buy_market.best_ask * this.buy_conversion.best_ask;
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
            return this.sell_market.best_bid * this.sell_conversion.best_bid - this.buy_market.best_ask;
        }else{
            return Number.NaN;
        }
    }

    get_sell_conversion_spread_percent(){
        if(this.sell_conversion){
            const initial_value = this.buy_market.best_ask;
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
        const buy_price = this.buy_market.best_ask.toString().blue;
        const buy_text = `Buy ${buy_exchange} ${buy_symbol} ${buy_price}`.blue;
        return buy_text;
    }

    public get_sell_log_string(){
        const sell_exchange = this.sell_market.hub.exchange.name.cyan;
        const sell_symbol = `${this.sell_market.asset.symbol}/${this.sell_market.hub.asset.symbol}`.cyan;
        const sell_price = this.sell_market.best_bid.toString().cyan;
        const sell_text = `Sell ${sell_exchange} ${sell_symbol} ${sell_price}`.cyan;
        return sell_text;
    }

    public get_buy_conv_log_string(){
        const buy_conversion_price = this.buy_conversion.best_ask.toString().blue;
        const buy_conversion_symbol = `${this.buy_conversion.asset.symbol}/${this.buy_conversion.hub.asset.symbol}`.blue;
        const buy_convert_text = `Buy Convert: ${buy_conversion_symbol} ${buy_conversion_price}`.blue;
        return buy_convert_text;
    }

    public get_sell_conv_log_string(){
        const sell_conversion_price = this.sell_conversion.best_ask.toString().cyan;
        const sell_conversion_symbol = `${this.sell_conversion.asset.symbol}/${this.sell_conversion.hub.asset.symbol}`.cyan;
        const sell_convert_text = `Sell Convert: ${sell_conversion_symbol} ${sell_conversion_price}`.cyan;
        return sell_convert_text;
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
}
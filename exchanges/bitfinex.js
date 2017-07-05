var Exchange = require('./exchange.js');

class BitfinexExchange extends Exchange {
    constructor(){
        super();
    }
    marketBuy(){}
    marketSell(){}
}

exports.BitfinexExchange = BitfinexExchange;
var Exchange = require('./exchange.js');

class BittrexExchange extends Exchange {
    constructor(){
        super();
    }
    marketBuy(){}
    marketSell(){}
}

exports.BittrexExchange = BittrexExchange;
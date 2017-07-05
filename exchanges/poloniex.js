var Exchange = require('./exchange.js');

class PoloniexExchange extends Exchange {
    constructor(){
        super();
    }
    marketBuy(){}
    marketSell(){}
}

exports.PoloniexExchange = PoloniexExchange;
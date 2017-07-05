var Exchange = require('./exchange.js');

class GdaxExchange extends Exchange {
    constructor(){
        super();
    }
    marketBuy(){}
    marketSell(){}
}

exports.GdaxExchange = GdaxExchange;
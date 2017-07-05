var Portfolio = require('./portfolio').Portfolio;
var RebalanceStrategy = require('../strategies').RebalanceStrategy;
var ExecutionStrategy = require('../strategies').ExecutionStrategy;

class PortfolioManager {
    constructor(){
        this.portfolio = new Portfolio();
        this.rebalanceStrategy = new RebalanceStrategy();
        this.executionStrategy = new ExecutionStrategy();
        this.markets = [];
    }
};  

exports.PortfolioManager = PortfolioManager;
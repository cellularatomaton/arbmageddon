import { Portfolio } from './portfolio';
import { RebalanceStrategy, ExecutionStrategy } from '../strategies';

export class PortfolioManager {
    portfolio: Portfolio;
    rebalanceStrategy: RebalanceStrategy;
    executionStrategy: ExecutionStrategy;
    constructor(){
        this.portfolio = new Portfolio();
        this.rebalanceStrategy = new RebalanceStrategy();
        this.executionStrategy = new ExecutionStrategy();
        // this.markets = [];
    }
};  
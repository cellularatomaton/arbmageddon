import { Asset } from "../common/assets";
import { Hub, Market, Graph } from "../common/markets";
import { Exchange, GdaxExchange, BinanceExchange, PoloniexExchange } from "../common/exchanges";
import { SpreadExecution } from "../common/strategies";
import { NextFunction, Request, Response, Router } from "express";
import { GraphParameters, WebsocketMessage } from "../common/markets/graph";
import { Logger } from "../common/utils/logger";
import { Book, BookSnapshot } from "../common/markets/book";
import { SubscriptionData, MarketParameters } from "../common/markets/market";

const express = require("express");
const path = require("path");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const usersRoute = require("./routes/users");
const graphRoute = require("./routes/graph");
const arbRoute = require("./routes/arb");
const WebSocket = require("ws");
const cors = require("cors");
const app = express();

const graphModel = new Graph();
const dataPath = path.join(path.dirname(__dirname), "node_modules/vis/dist");

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(dataPath));
app.use(express.static(path.join(__dirname, "public")));

app.use("/users", usersRoute);
app.use("/graph", graphRoute(graphModel));
app.use("/arbs", arbRoute(graphModel));

const wss = new WebSocket.Server({ port: 8081 });
wss.broadcast = (event: any) => {
	wss.clients.forEach((client: any) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(event));
		}
	});
};

graphModel.arb.on((spread?: SpreadExecution) => {
	Logger.log({
		level: "silly",
		message: `Graph Triggered Instructions: ${JSON.stringify(spread)}`
	});
	if (spread) {
		Logger.log({
			level: "silly",
			message: `Broadcasting...`
		});
		wss.broadcast({
			action: "update",
			type: "arb",
			data: spread
		});
	}
});

graphModel.book.on((book: Book) => {
	Logger.log({
		level: "silly",
		message: `Book update broadcast ${book.marketId}`
	});
	wss.broadcast({
		action: "update",
		type: "book",
		data: book.getAggregateBook(25)
	} as WebsocketMessage<BookSnapshot>);
});

wss.on("connection", (ws: any) => {
	ws.on("message", (payload: string) => {
		const message: WebsocketMessage<any> = JSON.parse(payload);
		Logger.log({
			level: "info",
			message: `Websocket message received: ${JSON.stringify(message)}`
		});
		if (message.type === "graphparams") {
			if (message.action === "set") {
				Logger.log({
					level: "info",
					message: `Setting graph params: ${JSON.stringify(message.data)}`
				});
				graphModel.updateParams(message.data as GraphParameters);
			} else if (message.action === "get") {
				Logger.log({
					level: "info",
					message: `Sending graph params: ${JSON.stringify(graphModel.parameters)}`
				});
				wss.broadcast({
					type: "graphparams",
					action: "set",
					data: graphModel.parameters
				} as WebsocketMessage<GraphParameters>);
			}
		} else if (message.type === "marketparams") {
			if (message.action === "set") {
				graphModel.updateMarketParams(message.data as MarketParameters);
			}
		} else if (message.type === "book") {
			if (message.action === "subscribe") {
				graphModel.subscribeToBook(message.data as SubscriptionData);
			} else if (message.action === "unsubscribe") {
				graphModel.unsubscribeFromBook(message.data as SubscriptionData);
			}
		}
	});
});

// catch 404 and forward to error handler
app.use((req: Request, res: Response, next: NextFunction) => {
	const err: any = new Error("Not Found");
	err.status = 404;
	next(err);
});

// error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
	console.error(err.stack);
	// set locals, only providing error in development
	res.locals.message = err.message;
	res.locals.error = req.app.get("env") === "development" ? err : {};
	// render the error page
	res.status(err.status || 500);
	res.render("error.html");
});

module.exports = app;

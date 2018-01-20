import { Asset } from "../src/assets";
import { Hub, Market, Graph } from "../src/markets";
import {
	Exchange,
	GdaxExchange,
	BinanceExchange,
	PoloniexExchange
} from "../src/exchanges";
import { ExecutionInstruction } from "../src/strategies";
import { NextFunction, Request, Response, Router } from "express";
import { GraphParameters } from "../src/markets/graph";

const express = require("express");
const path = require("path");
const favicon = require("serve-favicon");
const logger = require("morgan");
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const usersRoute = require("./routes/users");
const graphRoute = require("./routes/graph");
const arbRoute = require("./routes/arb");
const WebSocket = require("ws");

const app = express();
const graphModel = new Graph();
const dataPath = path.join(path.dirname(__dirname), "node_modules/vis/dist");
const goHome = (req: Request, res: Response) => {
	res.redirect("/dashboard");
};
// view engine setup
app.set("views", __dirname + "/views");
app.engine(".html", require("ejs").renderFile);

// uncomment after placing your favicon in /public
// app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(dataPath));
app.use(express.static(path.join(__dirname, "public")));

app.get("/dashboard", (req: Request, res: Response) => {
	res.render("dashboard.html");
});

app.get("/dash", goHome);
app.get("/", goHome);
app.use("/users", usersRoute);
app.use("/graph", graphRoute(graphModel));
app.use("/arbs", arbRoute(graphModel));

// Websocket:
const wss = new WebSocket.Server({ port: 8080 });
// Broadcast to all.
wss.broadcast = (event: any) => {
	wss.clients.forEach((client: any) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(JSON.stringify(event));
		}
	});
};

graphModel.arb.on((inst?: ExecutionInstruction) => {
	// console.log(`Graph Triggered Instructions: ${JSON.stringify(inst)}`)
	if (inst) {
		// console.log(`Broadcasting...`);
		wss.broadcast({
			from: "graph",
			to: "gui",
			action: "update",
			type: "arb",
			data: inst
		});
	}
});

wss.on("connection", (ws: any) => {
	ws.on("message", (message: any) => {
		console.log(`Websocket message received: ${JSON.stringify(message)}`);
		if (
			message.from === "gui" &&
			message.to === "graph" &&
			message.type === "params"
		) {
			if (message.action === "set") {
				console.log(`Setting graph params: ${JSON.stringify(message.data)}`);
				graphModel.updateParams(message.data as GraphParameters);
			} else if (message.action === "get") {
				wss.send(
					JSON.stringify({
						from: "graph",
						to: "gui",
						type: "params",
						action: "set",
						data: graphModel.parameters
					})
				);
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

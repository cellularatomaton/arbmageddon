import { Asset } from '../src/assets';
import { Hub, Market, Graph, GraphEvent, GraphEdge, GraphNode } from '../src/markets';
import { Exchange, GdaxExchange, BinanceExchange, PoloniexExchange } from '../src/exchanges';

const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const index_route = require('./routes/index');
const index_dash = require('./routes/dash');
const users_route = require('./routes/users');
const graph_route = require('./routes/graph');
const arb_route = require('./routes/arb');
const WebSocket = require('ws');

const app = express();
const graph_model = new Graph(); 

// view engine setup
app.set('views', __dirname + '/views');
app.engine('.html', require('ejs').renderFile);
// app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
const dataPath = path.join(path.dirname(__dirname), 'node_modules/vis/dist');
app.use(express.static(dataPath));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index_route);
app.get('/dash', function (req, res)
{
    res.render('dash.html');
});

app.use('/users', users_route);
app.use('/graph', graph_route(graph_model));
app.use('/arbs', arb_route(graph_model));

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

graph_model.set_event_handler({
  handle_edge_event(edge_event: GraphEvent<GraphEdge>){
    wss.broadcast(edge_event);
  },
  handle_node_event(node_event: GraphEvent<GraphNode>){
    wss.broadcast(node_event);
  }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error.html');
});

module.exports = app;

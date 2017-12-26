import { Asset } from '../src/assets';
import { Exchange, GdaxExchange, BinanceExchange, PoloniexExchange } from '../src/exchanges';

const express = require('express');
const path = require('path');
const favicon = require('serve-favicon');
const logger = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const index = require('./routes/index');
const users = require('./routes/users');
const graph = require('./routes/graph');
const enableWs = require('express-ws');

const app = express();
enableWs(app);
const asset_map = new Map<string, Asset>();
const exchanges: Exchange[] = [
    new GdaxExchange(asset_map),
    new BinanceExchange(asset_map),
    new PoloniexExchange(asset_map)
];

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
const dataPath = path.join(path.dirname(__dirname), 'node_modules/vis/dist');
app.use(express.static(dataPath));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', index);
app.use('/users', users);
app.use('/graph', graph(exchanges));

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
  res.render('error');
});

module.exports = app;

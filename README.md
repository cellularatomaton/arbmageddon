# ArbMageddon:
Cryptocurrency arbitrage toolset based on node.

## Layout:
The top level projects in Arbmageddon are:
* common: All of the models, strategies, exchange integrations, pricing logic, etc.
* server: An express server which hosts an instance of the graph object from common. IO to graph via websocket or http.
* spa: User interface.

## Getting Started:
You must have a working NodeJs installation with the NPM toolset installed.  Next, install typescript:

`npm install -g typescript`

## Run server:
Clone the repository and:

```
cd /path/to/arbmageddon/server

# install dependencies
npm install
```

Now you should be ready to run the server:

`DEBUG=app:* npm start`

That launches the back end server which connects to the various exchanges and builds the asset graph.  In order to launch the GUI, point your browser to:

`localhost:3000/dash`

## Run spa:
```
cd /path/to/arbmageddon/spa

# install dependencies
npm install

# serve with hot reload at localhost:8080
npm run dev

# build for production with minification
npm run build
```

For detailed explanation on how things work, consult the [docs for vue-loader](http://vuejs.github.io/vue-loader).
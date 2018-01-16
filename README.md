# ArbMageddon
Cryptocurrency arbitrage toolset based on node.

## Getting Started
You must have a working NodeJs installation with the NPM toolset installed.  Next, install typescript:

`npm install -g typescript`

Clone the repository and:

```
cd /path/to/arbmageddon
npm install
```

Now you should be ready to run the server:

`DEBUG=app:* npm start`

That launches the back end server which connects to the various exchanges and builds the asset graph.  In order to launch the GUI, point your browser to:

`localhost:3000/dash`
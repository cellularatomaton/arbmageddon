var http = require('http');
var Gdax = require('gdax');


var apiURI = 'https://api.gdax.com';
var sandboxURI = 'https://api-public.sandbox.gdax.com';
 
// Defaults to https://api.gdax.com if apiURI omitted 
var authedClient = new Gdax.AuthenticatedClient(
  key, b64secret, passphrase, apiURI);

authedClient.getAccounts((err, response, data)=>{
    // Get GDAX Position
});


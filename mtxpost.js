#!/usr/bin/node

const https = require("https");
const fs = require("fs");
const sdk = require("matrix-js-sdk");


const CAPATH="/usr/local/etc/ssl/current/ca.crt";

const MATRIXURL  = "https://matrix.mydomain.vpn";
const MATRIXHOME = MATRIXURL+"/_matrix/client";
const MATRIXUSER = "@myuser:matrix.mydomain.vpn";
const MATRIXPASS = "secretpassword";
const MATRIXROOMID = "!PUfEKBLsOrcVwwOHOy:matrix.mydomain.vpn";


debugger;

// Read the self-signed certificate file
const caCert = fs.readFileSync(CAPATH,'utf8');


// Configure the agent with the custom certificate
const agent = new https.Agent({
  ca: caCert,
});

console.log("Testing Self-signed CA Certificate connection to '"+MATRIXURL+"'");

const httpsoptions = {
  hostname: 'matrix.mydomain.vpn',
  port: 443,
  path: '/_matrix/client/r0/login',
  method: 'GET',
  agent: agent,
};

const req = https.request(httpsoptions, (res) => {
  console.log('Response status code:', res.statusCode);
  
  doMatrixLogin();
  

});

req.on('error', (error) => {
  console.error('| - Request error:', error);
  process.exit(1);
});

req.end();






function doMatrixLogin()
{

  // Create Matrix Client
  console.log("Creating Matrix Client");
  
  debugger;
  
  const client = sdk.createClient({
    baseUrl: MATRIXURL,
    homeserverUrl: MATRIXHOME,
    verbose: true,
    agent: agent
//  accessToken: accessToken,
//  userId: userId,
  });
  
  const MATRIXCREDS = {
    user: MATRIXUSER,
    password: MATRIXPASS,
  };



  // Login with your credentials
  console.log("Logging into '"+MATRIXURL+"'...");
  console.log("> Credentials: '"+JSON.stringify(MATRIXCREDS)+"'");

  var loginResponse = null;
  var accessToken = null;

  try 
  {
      debugger;

      client.login("m.login.password", MATRIXCREDS)
        .then((loginResponse) => {
//          accessToken = loginResponse.access_token;

            console.log("LOGIN RESPONSE CONTENTS: '"+JSON.stringify(loginResponse)+"'");
        })
        
        .catch((loginError) => {
          console.error("LOGIN FAILED (1): "+loginError);
        });

//      console.log("ACCESS TOKEN:");
//      console.log(accessToken);
    
  } catch (error) {

      console.error("LOGIN FAILED (2): "+error);
  }
  
}


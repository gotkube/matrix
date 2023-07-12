#!/usr/bin/node

const https = require("https");
const fs = require("fs");
const sdk = require("matrix-js-sdk");


const WHITEFLAMECAPATH="/usr/local/etc/ssl/current/ca.crt";

const MATRIXURL  = "https://matrix.mydomain.vpn";
const MATRIXHOME = MATRIXURL+"/_matrix/client";
const MATRIXUSER = "@myuser:matrix.mydomain.vpn";
const MATRIXPASS = "secretpassword";
const MATRIXROOMID = "!PUfEKBLsOrcVwwOHOy:matrix.mydomain.vpn";


debugger;

// Read the self-signed certificate file
const caCert = fs.readFileSync(WHITEFLAMECAPATH,'utf8');




function doMatrixLogin()
{

  // Create Matrix Client
  console.log("Creating Matrix Client");
  
  debugger;

  const fetchFn = (url, opts) => {
  
    return new Promise((resolve, reject) => {
    
      debugger;  // MAKING REQUEST
      
      
      const httpsoptions1 = {
        ...opts,
        ca: caCert,
      };
      
    
      const req = https.request(url, httpsoptions1, (res) => {
      
        debugger; // RESPONSE!
      
        const chunks = [];

        res.on("data", (chunk) => {
          chunks.push(chunk);
        });

        res.on("end", () => {
          const response = {
            status: res.statusCode,
            headers: res.headers,
            data: Buffer.concat(chunks).toString(),
          };
          
          resolve(response);
        });
        
      });

      req.on("error", (error) => {
        reject(error);
      });



      req.end();
    });
  
  };

  
  
  const MATRIXCLIENT = {
    baseUrl: MATRIXURL,
    homeserverUrl: MATRIXHOME,
    verbose: true,
    fetchFn,
  };
  
  
  const client = sdk.createClient(MATRIXCLIENT);
  
  const MATRIXCREDS = { "user": MATRIXUSER, "password": MATRIXPASS };
  
  const MATRIXCREDSSTR = JSON.stringify(MATRIXCREDS);


  // Login with your credentials
  console.log("Logging into '"+MATRIXURL+"'...");
  console.log("  Credentials: '"+MATRIXCREDS+"'");
  console.log("  Credentials (String): '"+MATRIXCREDSSTR+"'");

  var loginResponse = null;
  var accessToken = null;

  try 
  {
      debugger; // LOGGING IN

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



doMatrixLogin();
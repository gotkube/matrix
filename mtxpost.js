

const http2 = require('http2');
const fs = require("fs");
global.Olm = require('@matrix-org/olm');
const sdk = require("matrix-js-sdk");
const crypto = require("crypto");

const { LocalStorage } = require('node-localstorage');
const localStorage = new LocalStorage('./scratch');
const { LocalStorageCryptoStore, } = require('matrix-js-sdk/lib/crypto/store/localStorage-crypto-store');


const CAPATH = "/usr/local/etc/ssl/current/ca.crt";
const SCRIPTID = "Mtxpost";

const MATRIXURL  = "https://mydomain.com";
const MATRIXHOME = MATRIXURL+"/_matrix/client";
const MATRIXUSER = "@gotkube:mydomain.com";
const MATRIXPASS = "supersecretpassword";
const MATRIXROOMID = "!PUfEKBLsOrcVwwOHOy:mydomain.com";
const MATRIXDEVICENAME = SCRIPTID+"_"+MATRIXUSER;

const STOREACCESSTOKENID="accessToken-"+MATRIXUSER;
const STOREDEVICEID="deviceId-"+MATRIXUSER;
const STORESESSIONID="sessionId-"+MATRIXUSER;
const STOREBLOCKEDID="blocked-"+MATRIXUSER;

const echoOut = console.log;


var FetchID = "";
var FETCHES = [];


// FETCHFN FUNCTION

async function fetchFn(url, opts)
{
    const currFetchID = FetchID;
    
    if ( !FETCHES[currFetchID] )
        FETCHES[currFetchID] = [];

    FETCHES[currFetchID][url.href] = [];
    
  
    FETCHES[currFetchID][url.href]['promise'] = new Promise(async (resolve, reject) => {
    
        // Store Fetch identifier keys
        const fetchId = currFetchID;
        const fetchHref = url.href;

        // Provide external pointers to this Promise object's resolve & reject functions
        FETCHES[fetchId][fetchHref]['resolveFn'] = resolve;
        FETCHES[fetchId][fetchHref]['rejectFn'] = reject;    


        // HTTP2 Connection Options
        const http2opts = {
            ...opts,
            cert: fs.readFileSync(CAPATH,'utf8'),
            rejectUnauthorized: false,
        };


        const http2connection = http2.connect(url, http2opts);

        // Make request with HTTP2 connection
        const req = await http2connection.request({
            ':method': opts.method,
            ':path': url.pathname,
            ...opts.headers,
        });
        
        
        // REQUEST RESPONSE
        req.on('response', (headers, flags) => {
        
            let data = '';
            

            // REQUEST DATA CHUNK
            req.on('data', (chunk) => {
              data += chunk;
            });



            // REQUEST END
            req.on('end', () => {

              // Retrieve the response Status code              
              responseStatus = headers[':status'];

              if ( responseStatus == 200 )
              {                            
                  // Create new Response object containing response data & headers            
                  const response = new Response( data, {
                      status: headers[':status'],
                      headers: headers,
                  });              
                  
                  
                  // Store our Response object in the Fetches array, for now
                  FETCHES[fetchId][fetchHref]['response'] = response;

                  // Resolve our inherent Promise with our Response object              
                  resolve(response);    
              }
              else
              {
                  const dataObj = JSON.parse(data);
                  
                  var responseError = handleMatrixErrors(fetchId, fetchHref, headers, dataObj);

                  // Store our Error object in the Fetches array                
                  FETCHES[fetchId][fetchHref]['response'] = responseError;


                  // Reject our inherent Promise with our Error object
                  reject(responseError);
              }
              

              http2connection.close();
            });
            
        });


        // REQUEST ERROR      
        req.on('error', (error) => {
            reject(error);
            http2connection.close();
        });

        
        // Write our Options Body to the request stream (contains our login credentials)
        if (opts.body) 
        {
          req.write(opts.body);
        }

        req.end();
        
    }); // Promise object END
    
    
    // Return a handle to our Promise object
    return FETCHES[FetchID][url.href]['promise'];
    
} // fetchFn END  







// DO MATRIX LOGIN - Build Matrix Client configuration and create client object

async function doMatrixLogin()
{
  var returnLoginOk = false;		// Default return value


  // MATRIX Client Configuration
  const MATRIXCLIENT = {
    baseUrl: MATRIXURL,
    homeserverUrl: MATRIXHOME,
    userId: MATRIXUSER,
  };


  // MATRIX Client Authorization Configuration  
  var MATRIXCLIENTAUTH = {
    deviceId: MATRIXDEVICEID,
//    sessionId: MATRIXSESSIONID,
//    accessToken: MATRIXACCESSTOKEN,
  };
  

  // MATRIX Client Store Configuration
  const MATRIXCLIENTSTORES = {
    store: new sdk.MemoryStore({ localStorage }),
    cryptoStore: new LocalStorageCryptoStore(localStorage),
  };
  

  // MATRIX Login Credentials
  const MATRIXCREDSPASSWORD = { 
      password: MATRIXPASS, 
      identifier: { 
          type:'m.id.user',
          user: MATRIXUSER
      }
  };
  


  // Build Matrix Client object
  try
  {
      clientObj = await sdk.createClient( { ...MATRIXCLIENT, ...MATRIXCLIENTAUTH, ...MATRIXCLIENTSTORES, fetchFn } );
      
  } catch(err) {
      echoOut("Matrix Client Creation Failed: '"+err+"'");
      process.exit(1);
  }
  

  // Setup Matrix Client object Event Handlers
  await setupClientListeners();
  

  // If we already have an Access Token, Device ID and Session ID, then we're already logged in; return true
  if ( MATRIXACCESSTOKEN && MATRIXDEVICEID && MATRIXSESSIONID )
      return true;



  // MATRIX LOGIN
  return new Promise( async (resolve, reject) => {
  
      var isLoginOk = false;
      var loginAttempts = 2;
      do
      {
  
          // Attempt Login
          try
          {
              // Determine Login Type and              
              var TMPLOGINTYPE = "m.login.password";
              var TMPLOGINCREDS = MATRIXCREDSPASSWORD;
              
              // Login with your credentials
              FetchID = "login";
              
              const loginResponse = await clientObj.login(TMPLOGINTYPE, TMPLOGINCREDS);

              
              if ( loginResponse.access_token )
                  MATRIXACCESSTOKEN = loginResponse.access_token;
              
              if ( loginResponse.device_id )
                  MATRIXDEVICEID = loginResponse.device_id;


              // Set Matrix Device Name              
              await clientObj.setDeviceDetails(MATRIXDEVICEID, {
                  display_name: MATRIXDEVICENAME,
              });
                            

              // Store access token & device id from login response locally
              localStorage.setItem(STOREACCESSTOKENID, MATRIXACCESSTOKEN);
              
              localStorage.setItem(STOREDEVICEID, MATRIXDEVICEID);
              
              localStorage.setItem(STORESESSIONID, clientObj.getSessionId());                  


              isLoginOk = true;
              

          // LOGIN ERROR
          } catch (loginError) {
          
              // Iterate through the Matrix Errors and display to the screen
              if ( MATRIXERRORS[ FetchID ].length > 0 )
              {
                  MATRIXERRORS[ FetchID ].forEach( (currError) => {
                      echoOut("MATRIX LOGIN ERROR '"+currError.status+"': '"+currError.error+"'");
                      switch (currError.status)
                      {
                          case 429:
                              echoOut("Retry in '"+currError.retry+"'");
                              loginAttempts = 0;
                              break;
                      }
                  });
              }
              else
                  echoOut("LOGIN ERROR 101 : '"+loginError+"'");
              
              
              if ( loginAttempts-- > 0 )
                  echoOut(" - Attempting Login Again...");
              else	// No more login tries. Game over.
                  process.exit(1);          
          }
    
    
      } while (!isLoginOk);


    resolve( true );

  }); // End Promise Object

} // End doMatrixLogin








// SETUP CLIENT LISTENERS - Assign event listeners & associated inline handler functions for client object

var NOTIFICATIONS = [];

async function setupClientListeners()
{

    return new Promise( async (resolve, reject) => {

        try
        {
            // Matrix Client Event Handlers

            // SYNC EVENT HANDLER
            clientObj.on("sync", (state, prevState, data) => {
            
                if (state == "PREPARED") 			// we never seem to get here
                {
                    echoOut("SYNC PREPARED:");
                    echoOut("'"+JSON.stringify(data,null,2)+"'");
                }
            
                else if (state === "SYNCING")
                {
                    echoOut("Syncing... '"+JSON.stringify(data)+"'");
              
                } 
                else if (state === "SYNCED")
                {
                    echoOut("Synced!"); 			// we never get here either
                }
                else
                {
                    echoOut("UNKNOWN SYNC STATE '"+state+"'");
                }

            });

            
            
            // TODEVICEEVENT EVENT HANDLER
            // <!!> WORK-IN-PROGRESS <!!> - Detect and respond to device verification request
            clientObj.on("toDeviceEvent", (event) => {
          
                const TMPEVENTTYPE = event.getType();
                
                if ( !NOTIFICATIONS[ TMPEVENTTYPE ] )
                {                
                    echoOut("TO DEVICE EVENT DETECTED. TYPE: '"+TMPEVENTTYPE+"'");


                    // VERIFICATION REQUEST
                    if ( TMPEVENTTYPE === "m.key.verification.request" )
                    {
                
                            if ( !NOTIFICATIONS[ TMPEVENTTYPE ] )
                            {
                                NOTIFICATIONS[ TMPEVENTTYPE ] = true;
                                echoOut("Received a verification request: '"+JSON.stringify(event,null,2)+"'");
                            }
                        

                            // Collect all the event data                
                            try 
                            {
                                const TMPEVENTCONTENT = event.getContent();
  
                                const TMPEVENTSENDER = event.getSender();
                                const TMPEVENTMETHODS = TMPEVENTCONTENT.methods;
                                const TMPEVENTTRANSACTIONID = TMPEVENTCONTENT.transaction_id;
                                const TMPEVENTDEVICE = TMPEVENTCONTENT.from_device;
                                const TMPDATE = new Date(TMPEVENTCONTENT.timestamp);
                                const TMPDATESTR = `${TMPDATE.getMonth()}/${TMPDATE.getDate()}/${TMPDATE.getFullYear()} ${TMPDATE.getHours()}:${TMPDATE.getMinutes() < 10 ? '0' : ''}${TMPDATE.getMinutes()}:${TMPDATE.getSeconds()}`;

                                const TMPTSNOW = new Date();
                                const TMPTS10PAST = new Date(TMPTSNOW.getTime()-10*60*1000);
                                const TMPTS5FUT = new Date(TMPTSNOW.getTime()+5*60*1000);


                                echoOut("Event Type:        '"+TMPEVENTTYPE+"'");
                                echoOut("Event sender:      '"+TMPEVENTSENDER+"'");
                                echoOut("Event Content:"); //     '"+JSON.stringify(TMPEVENTCONTENT)+"'");
                                echoOut(" - Methods:        '"+JSON.stringify(TMPEVENTMETHODS)+"'");
                                echoOut(" - Transaction ID: '"+TMPEVENTTRANSACTIONID+"'");
                                echoOut(" - From Device:    '"+TMPEVENTDEVICE+"'");
                                echoOut(" - Timestamp:      '"+TMPEVENTCONTENT.timestamp+"' ("+TMPDATESTR+")");
                            
                                if ( TMPDATE < TMPTSNOW )
                                    echoOut("STALE REQUEST: Request more than 10 minutes old.");
                                else if ( TMPDATE > TMPTS5FUT )
                                    echoOut("INVALID REQUEST: Request is timestamped more than 5 minutes into the future.");
                        
                        
                                // Assemble verification response
                                const VERIFYRESPONSE = {
                            
                                    eventType: "m.key.verification.ready",
                                    batch: {
                        
                                        [TMPEVENTSENDER]: {
                                            [TMPEVENTTRANSACTIONID]: {
                                                transaction_id: TMPEVENTTRANSACTIONID,
                                                methods: ["m.sas.v1"],
                                            }
                                        }
                                    },
                                
                                };
                        
                        
                                // 1. Respond to verification request with 'Ready'
                        
                                echoOut("Responding to Verification Request...");
                                echoOut(JSON.stringify(VERIFYRESPONSE));

                                try
                                {
                                    clientObj.queueToDevice( VERIFYRESPONSE );
                                    echoOut("Response Sent??");
                                
                                } catch(err) {
                                    errorOut("Verification Response Error: '"+err+"'");
                                }
                            
                            
                            // 2. Send a 'Start' request
//  	                          VERIFYRESPONSE.eventType = "m.key.verification.start";
// 	                          clientObj.queueToDevice( VERIFYRESPONSE );
                    

    			    } catch(err) {
                                errorOut("Verification request handling error: '"+err+"'");
                            }
                    }

                    // VERIFICATION START
                    else if ( TMPEVENTTYPE === "m.key.verification.start" )
                    {
                            if ( !NOTIFICATIONS[ TMPEVENTTYPE ] )
                            {
	                            NOTIFICATIONS[ TMPEVENTTYPE ] = true;

                                // Handle the verification request here.
                                noticeOut("Received a verification START event: '"+JSON.stringify(event,null,2)+"'");
                            }
                    }
                
                    // VERIFICATION CANCEL
                    else if ( TMPEVENTTYPE === "m.key.verification.cancel" )
                    {
                            if ( !NOTIFICATIONS[ TMPEVENTTYPE ] )
                            {
                                NOTIFICATIONS[ TMPEVENTTYPE ] = true;

                                // Handle the verification request here.
                                noticeOut("Received a verification CANCEL event: '"+JSON.stringify(event,null,2)+"'");
                            }                
                            
                            
                            try
                            {
                                const TMPEVENTCONTENT = event.getContent();
                                
                                const TMPEVENTSENDER = event.getSender();
                                const TMPEVENTTRANSACTIONID = TMPEVENTCONTENT.transaction_id;
                                const TMPEVENTCODE = TMPEVENTCONTENT.code;
                                const TMPEVENTREASON = TMPEVENTCONTENT.reason;
                                
                                
                                echoOut("Event Type:        '"+TMPEVENTTYPE+"'");
                                echoOut("Event sender:      '"+TMPEVENTSENDER+"'");
                                echoOut("Event Content:"); //     '"+JSON.stringify(TMPEVENTCONTENT)+"'");
                                echoOut(" - Code:           '"+TMPEVENTCODE+"'");
                                echoOut(" - Reason:         '"+TMPEVENTREASON+"'");
                                echoOut(" - Transaction ID: '"+TMPEVENTTRANSACTIONID+"'");
                    
                            } catch(err) {
                                errorOut("Verification Cancel Handling Error: '"+err+"'");
                            }
                    }
                    
                }
                
            });
        

        // If an error occurs while assigning client event handlers, display an error    
        } catch(err) {
            errorOut("Matrix Client Event Listener Setup Error: '"+err+"'");
            
            resolve(false);
        }
        
        
        // Resolve true
        resolve(true);
        
    });

}


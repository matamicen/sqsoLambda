var mysql = require("mysql");
var warmer = require("lambda-warmer");
const { google } = require("googleapis");
var pub = google.androidpublisher("v3");
exports.handler = async(event, context, callback) => {
  // if a warming event
  if (await warmer(event)) return "warmed";
  context.callbackWaitsForEmptyEventLoop = false;

  var response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // Required for CORS support to work
      "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
    },
    body: {
      error: null,
      message: null
    }
  };
  //***********************************************************
  // let qra = event.body.qra;
  // let env = event.body.env;
  // let packageName = event.body.packageName;
  // let productId = event.body.productId;
  // let purchaseToken = event.body.purchaseToken;
  // let action = event.body.action;
  //***********************************************************
  process.env["GOOGLE_APPLICATION_CREDENTIALS"] = "superqso.json";
  if (!event["stage-variables"]) {
    console.log("Stage Variables Missing");
    conn.destroy();
    response.body.error = 1;
    response.body.message = "Stage Variables Missing";
    return callback(null, response);
  }
  let url = event["stage-variables"].url;
  var conn = await mysql.createConnection({
    host: event["stage-variables"].db_host, // give your RDS endpoint  here
    user: event["stage-variables"].db_user, // Enter your  MySQL username
    password: event["stage-variables"].db_password, // Enter your  MySQL password
    database: event["stage-variables"].db_database // Enter your  MySQL database name.
  });
  //***********************************************************
  try {
    let iap_records = await getIAP();

    if (!iap_records) {
      console.log("no IAP to process");
      conn.destroy();
      response.body.error = 0;
      response.body.message = "no IAP to process";
      return callback(null, response);
    }
    var now = new Date();
    console.log("Records Found: " + iap_records.length);

    await Promise.all(
      iap_records.map(async i => {

        let end_date = new Date(i.end_date);

        const diffTime = now.getTime() - end_date.getTime();

        var diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if ((diffDays === 3)) {
        await verifyNew(i);
        }
      })
    );
  }
  catch (e) {
    console.log("Error in IAP GOOGLE JOB");
    console.log(e);
    conn.destroy();
    response.body.error = 1;
    response.body.message = "Error when select QRA";
    return callback(null, response);
  }
  async function verifyNew(iap) {
    console.log("verifyNew " + iap.idiap)
    // This method looks for the GCLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS
    // environment variables.
    const auth = await new google.auth.GoogleAuth({
      // Scopes can be specified either as an array or as a single, space-delimited string.
      scopes: ["https://www.googleapis.com/auth/androidpublisher"]
    });

    const authClient = await auth.getClient();

    await authClient.authorize(function(err, tokens) {
      if (err) {
        console.log("authClient.authorize")
        console.log(err.message);
        return console.log(err);
      }
      
    });
    var res = await pub.purchases.subscriptions.get({
      auth: authClient,
      packageName: iap.packageName,
      subscriptionId: iap.productId,
      token: iap.purchaseToken
    });

    console.log(iap.orderId);
    
    var not_exp = await validateReceipt(res);
    
    if (not_exp) {
      await insertIAP(iap, not_exp);
    }
    else {
      await downgradeQRA(iap.idqra);
    }
    return null;

  }

  function downgradeQRA(idqras) {
    console.log("downgradeQRA " + idqras);
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.

      conn.query(
        "UPDATE qras SET account_type=1 WHERE idqras=?",
        idqras,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }

          resolve(JSON.parse(JSON.stringify(info)));
        }
      );
    });
  }

  function getIAP() {
    console.log("getIAP");
    return new Promise(function(resolve, reject) {
      conn.query(
        "select * from iap t1 join (SELECT max(end_Date) end_date, purchaseToken  FROM sqso.iap where device_type = 'android' group by purchaseToken) t2 on t1.purchaseToken = t2.purchaseToken and t1.end_date = t2.end_date ",

        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }
          if (info.length > 0) resolve(JSON.parse(JSON.stringify(info)));
          else resolve();
        }
      );
    });
  }

  function insertIAP(iap, not_exp) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("insertIAP");
      var start = new Date(0);
      start.setUTCMilliseconds(not_exp.startTimeMillis);
      var end = new Date(0);
      end.setUTCMilliseconds(not_exp.expiryTimeMillis);
      let post = {
        idqra: iap.idqra,
        device_type: "android",
        productId: iap.productId,
        purchaseToken: iap.purchaseToken,
        packageName: iap.packageName,
        start_date: start,
        end_date: end,
        orderId: not_exp.orderId
      };
      console.log(post);
      conn.query("INSERT INTO sqso.iap SET ?", post, function(err, info) {
        // Call reject on error states, call resolve with results
        if (err) {
          console.log(err);
          return reject(err);
        }

        resolve(JSON.parse(JSON.stringify(info)));
      });
    });
  }

  async function validateReceipt(res) {
    console.log("validateReceipt");
    var date = new Date();
    if (res.data.expiryTimeMillis > date.getTime()) return res.data;
    else return null;
  }
};

const fetch = require("node-fetch");
var mysql = require("mysql");
var warmer = require("lambda-warmer");
const { google } = require("googleapis");
var pub = google.androidpublisher("v3");
exports.handler = async (event, context, callback) => {
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
  let qra = event.body.qra;
  let env = event.body.env;
  let packageName = event.body.packageName;
  let productId = event.body.productId;
  let purchaseToken = event.body.purchaseToken;
  let action = event.body.action;
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
    let idqras_owner = await getQRA(qra);
    if (!idqras_owner) {
      console.log("QRA does not exist");
      conn.destroy();
      response.body.error = 1;
      response.body.message = "QRA does not exist";
      return callback(null, response);
    }

    if (action === "BUY") return doBuy(idqras_owner);
    else if (action === "RESTORE") return doRestore(idqras_owner);
  } catch (e) {
    console.log("Error in IAP APPLE VALIDATE");
    console.log(e);
    conn.destroy();
    response.body.error = 1;
    response.body.message = "Error when select QRA";
    return callback(null, response);
  }
  async function doRestore(idqras_owner) {
    var current_record = await getIAP();
    console.log();

    if (!current_record) return doBuy(idqras_owner);
    else if (current_record && current_record.idqra !== idqras_owner) {
      await downgradeQRA(current_record.idqra);
      current_record.idqra = idqras_owner;
      await updateIAP(current_record);
      await upgradeQRA(idqras_owner);
      conn.destroy();
      response.body.error = 0;
      response.body.message = current_record;
      return callback(null, response);
    } else {
      conn.destroy();
      response.body.error = 1;
      response.body.message = current_record;
      return callback(null, response);
    }
  }
  async function doBuy(idqras_owner) {
    console.log("Action: BUY");

    // This method looks for the GCLOUD_PROJECT and GOOGLE_APPLICATION_CREDENTIALS
    // environment variables.
    const auth = new google.auth.GoogleAuth({
      // Scopes can be specified either as an array or as a single, space-delimited string.
      scopes: ["https://www.googleapis.com/auth/androidpublisher"]
    });
    const authClient = await auth.getClient();
    await authClient.authorize().catch(function(error) {
      console.log(error);
    });

    var res = await pub.purchases.subscriptions
      .get({
        auth: authClient,
        packageName: packageName,
        subscriptionId: productId,
        token:
          // "lpbkmknfaaneapjglmflcgmk.AO-J1OxOS726GtSA6l5TLc4ZyLWmF0PqrCXXMQegk1Nw7bbUcOezqnqSBX-eRa-4pfM1vKyxrSbcsNxPwAN8VIuMe-zrbUvT666MUoqwm5AZ3RKDTn2gGQM"
          // "jeocdifjcdkeafebfomcannm.AO-J1OwGp47oFxczJpUPoq7sw3nf-wWabE87QqlgIfMiNcIh59Bdtxz7uNBOXxcZvLmuQZ8maNCV6WpncKjT6LW9OVfwKMn8-G_K4-fuL86isIXOLAwyLsU"
          purchaseToken
      })
      .catch(console.log("error"));

   
    var not_exp = await validateReceipt(res);

    if (not_exp) {
      await insertIAP(idqras_owner, not_exp);
      await upgradeQRA(idqras_owner);
      conn.destroy();
      response.body.error = 0;
      response.body.message = not_exp;
      return callback(null, response);
    } else {
      conn.destroy();
      response.body.error = 1;
      response.body.message = not_exp;
      return callback(null, response);
    }
  }
  function downgradeQRA(idqras) {
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
  function upgradeQRA(idqras) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.

      conn.query(
        "UPDATE qras SET account_type=2 WHERE idqras=?",
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
  function updateIAP(iap) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.

      conn.query(
        "UPDATE iap SET idqra=? WHERE idiap=?",
        [iap.idqra, iap.idiap],
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
    console.log("getIAP " + purchaseToken);
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
      // from Congito ID");
      conn.query(
        "SELECT * FROM iap where purchaseToken=?  order by end_date desc limit 1",
        purchaseToken,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }

          if (info.length > 0) resolve(JSON.parse(JSON.stringify(info))[0]);
          else resolve();
        }
      );
    });
  }
  function insertIAP(idqras_owner, not_exp) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("insertIAP");
      var start = new Date(0)
      start.setUTCMilliseconds(not_exp.startTimeMillis);
      var end = new Date(0);
      end.setUTCMilliseconds(not_exp.expiryTimeMillis);
      let post = {
        idqra: idqras_owner,
        device_type: "android",
        product_id: productId,
        purchaseToken: purchaseToken, 
        packageName: packageName,        
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
  function getQRA(qra) {
    console.log("getQRA " + qra);
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
      // from Congito ID");
      conn.query("SELECT idqras FROM qras where qras.qra=?", qra, function(
        err,
        info
      ) {
        // Call reject on error states, call resolve with results
        if (err) {
          return reject(err);
        }
        if (info.length > 0)
          resolve(JSON.parse(JSON.stringify(info))[0].idqras);
        else resolve();
      });
    });
  }
  async function validateReceipt(res) {
    console.log("validateReceipt");
    var date = new Date();
    if (res.data.expiryTimeMillis < date.getTime()) return res.data;
    else return null;
  }
  
};

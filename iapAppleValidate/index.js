const fetch = require("node-fetch");
var mysql = require("mysql");
var warmer = require("lambda-warmer");

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
  let transactionReceipt = event.body.transactionReceipt;
  let transactionId = event.body.transactionId;
  let originalTransactionId = event.body.originalTransactionId;
  let action = event.body.action;
  //***********************************************************
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
   
    
    if (!current_record) return doBuy(idqras_owner);
    else if (current_record && current_record.idqra !== idqras_owner) {
      var now = new Date();
      var end_date = new Date(current_record.end_date);

      if (end_date < now)
      {
        
       conn.destroy();
      response.body.error = 2;
      response.body.message = current_record;
      return callback(null, response);
      }
      await downgradeQRA(current_record.idqra);
      current_record.idqra = idqras_owner;
      await updateIAP(current_record);
      await upgradeQRA(idqras_owner);
      conn.destroy();
      response.body.error = 0;
      response.body.message = current_record;
      return callback(null, response);
    }
    else {
      conn.destroy();
      response.body.error = 1;
      response.body.message = current_record;
      return callback(null, response);
    }
  }
  async function doBuy(idqras_owner) {
    console.log("Action: BUY");
    const body = JSON.stringify({
      "receipt-data": transactionReceipt,
      // Set in App Store Connect
      password: event["stage-variables"].iapAppleSecret,
      "exclude-old-transactions": false
    });
    if (env === "QA") var res = await sandbox(body);
    else if (env === "QA") res = await prd(body);

    console.log("Transactions " + res.latest_receipt_info.length);
    var not_exp = await validateReceipt(res);

    if (not_exp.length > 0) {
      await insertIAP(idqras_owner, not_exp[0], res.latest_receipt);
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
    console.log("getIAP " + originalTransactionId);
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
      // from Congito ID");
      conn.query(
        "SELECT * FROM iap where original_transaction_id=?  order by end_date desc limit 1",
        originalTransactionId,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }
          
          if (info.length > 0)
            resolve(JSON.parse(JSON.stringify(info))[0]);
          else resolve();
        }
      );
    });
  }
  function insertIAP(idqras_owner, not_exp, latest_receipt) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("insertIAP");

      let post = {
        idqra: idqras_owner,
        device_type: "ios",
        product_id: not_exp.product_id,

        original_transaction_id: not_exp.original_transaction_id,
        start_date: not_exp.original_purchase_date,
        end_date: not_exp.expires_date,
        latest_receipt: latest_receipt,
        transactionId: transactionId
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

    var not_exp = res.latest_receipt_info.filter(i => {
      return (
        i.original_transaction_id === originalTransactionId &&
        i.expires_date_ms > date.getTime()
      );
    });
    console.log("Not Expired: " + not_exp.length);
    return not_exp;
  }
  async function sandbox(body) {
    return await fetch("https://sandbox.itunes.apple.com/verifyReceipt", {
      method: "POST",
      body
    }).then(res => res.json());
  }
  async function prd(body) {
    return await fetch("https://buy.itunes.apple.com/verifyReceipt", {
      method: "POST",
      body
    }).then(res => res.json());
  }
};

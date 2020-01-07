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
  // let qra = event.body.qra;
  let env = event.body.env;
  // let transactionReceipt = event.body.transactionReceipt;
  // let transactionId = event.body.transactionId;
  // let originalTransactionId = event.body.originalTransactionId;
  // let action = event.body.action;
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

        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 3) {
          await verifyNew(i);
        }
      })
    );
  } catch (e) {
    console.log("Error in IAP APPLE VALIDATE");
    console.log(e);
    conn.destroy();
    response.body.error = 1;
    response.body.message = "Error when select QRA";
    return callback(null, response);
  }

  async function verifyNew(iap) {
    const body = JSON.stringify({
      "receipt-data": iap.latest_receipt,
      // Set in App Store Connect
      password: event["stage-variables"].iapAppleSecret,
      "exclude-old-transactions": false
    });

    // if (env === "QA") var res = await sandbox(body);
    // else if (env === "PRD") res = await prd(body);
    var res = await prd(body);
    if (res.status === 21007) res = await sandbox(body);
    console.log("Verifying ID: " + iap.idiap);
    console.log("Transactions " + res.latest_receipt_info.length);
    var not_exp = await validateReceipt(res, iap.original_transaction_id);

    if (not_exp.length > 0) {
      await insertIAP(
        iap.idqra,
        not_exp[0],
        res.latest_receipt,
        iap.transactionId
      );
    } else {
      await downgradeQRA(iap.idqra);
    }
    return null;
  }
  function downgradeQRA(idqras) {
    console.log("downgradeQRA: " + idqras);
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

  function insertIAP(idqras_owner, not_exp, latest_receipt, transactionId) {
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
        console.log(info);
        resolve(JSON.parse(JSON.stringify(info)));
      });
    });
  }
  function getIAP() {
    console.log("getIAP");
    return new Promise(function(resolve, reject) {
      conn.query(
        "select * from iap t1 join (SELECT max(end_Date) end_date, original_transaction_id  FROM sqso.iap where device_type = 'ios' group by original_transaction_id) t2 on t1.original_transaction_id = t2.original_transaction_id and t1.end_date = t2.end_date ",

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
  async function validateReceipt(res, originalTransactionId) {
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
    })
      .then(res => res.json())
      .catch(function(e) {
        console.log(e);
      });
  }
  async function prd(body) {
    return await fetch("https://buy.itunes.apple.com/verifyReceipt", {
      method: "POST",
      body
    }).then(res => res.json());
  }
};

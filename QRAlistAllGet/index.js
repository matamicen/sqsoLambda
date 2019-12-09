var mysql = require("mysql");

var warmer = require("lambda-warmer");

exports.handler = async (event, context, callback) => {
  console.log(event);
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
  if (!event["stage-variables"]) {
    console.log("Stage Variables Missing");
    conn.destroy();
    response.body.error = 1;
    response.body.message = "Stage Variables Missing";
    return callback(null, response);
  }

  var conn = await mysql.createConnection({
    host: event["stage-variables"].db_host, // give your RDS endpoint  here
    user: event["stage-variables"].db_user, // Enter your  MySQL username
    password: event["stage-variables"].db_password, // Enter your  MySQL password
    database: event["stage-variables"].db_database // Enter your  MySQL database name.
  });

  try {
    var qras = await getQRAs();

    if (qras) {
      console.log("Push_Devices Add Done");
      conn.destroy();
      response.body.error = 0;
      response.body.message = qras;
      return callback(null, response);
    } else {
      conn.destroy();
      console.log("Push_Devices Add Done");
      response.body.error = 0;
      response.body.message = [];
      return callback(null, response);
    }
  } catch (e) {
    console.log("Error executing QRAlistGet");
    console.log(e);
    conn.destroy();

    response.body.error = 1;
    response.body.message = e;
    callback(null, response);
    return context.fail(response);
  }

  function getQRAs() {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("getQRA");
      conn.query(
        "SELECT qra, CONCAT(COALESCE(qra,''), ' ', COALESCE(firstname,''),' ', COALESCE(l" +
          "astname,'')) AS name, profilepic, avatarpic  FROM qras where disabled = '0'",

        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }
          if (info.length > 0) {
            resolve(JSON.parse(JSON.stringify(info)));
          } else {
            resolve();
          }
        }
      );
    });
  }
};

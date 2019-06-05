var mysql = require("./node_modules/mysql");
const warmer = require("./node_modules/lambda-warmer");
var AWS = require("./node_modules/aws-sdk");
AWS.config.region = "us-east-1";

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

  var sub = event.context.sub;
  var action = event.body.action;
  var username = event.body.username;

  //***********************************************************

  if (!event["stage-variables"]) {
    console.log("Stage Variables Missing");
    response.body.error = 1;
    response.body.message = "Stage Variables Missing";
    return callback(null, response);
  }

  try {
    var conn = await mysql.createConnection({
      host: event["stage-variables"].db_host, // give your RDS endpoint  here
      user: event["stage-variables"].db_user, // Enter your  MySQL username
      password: event["stage-variables"].db_password, // Enter your  MySQL password
      database: event["stage-variables"].db_database // Enter your  MySQL database name.
    });

    let idqras_owner = await getAdmin(sub);
    if (!idqras_owner) {
      console.log("User is not admin");
      conn.destroy();
      response.body.error = 1;
      response.body.message = "User is not admin";
      return callback(null, response);
    }
    let info;
    switch (action) {
      case "L":
        info = await disableUser(username);
        // await changeStatus(username, "1");
        break;
      case "U":
        info = await enableUser(username);
        // await changeStatus(username, "0");
        break;
      case "D":
        info = await disableUser(username);
        await changeStatus(username, "1");
        break;
      case "E":
        info = await enableUser(username);
        await changeStatus(username, "0");
        break;
      default:
        break;
    }
    conn.destroy();
    response.body.error = 0;
    response.body.message = info;
    context.succeed(response);
  } catch (e) {
    console.log("Error when select QRA");
    console.log(e);
    conn.destroy();
    response.body.error = 1;
    response.body.message = "Error when select QRA";
    return callback(null, response);
  }
  function changeStatus(qra, disabled) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.

      conn.query(
        "UPDATE qras SET disabled=? WHERE qra=?",
        [disabled, qra],
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }
          console.log(info);
          resolve(JSON.parse(JSON.stringify(info)));
        }
      );
    });
  }
  function getAdmin(sub) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      conn.query(
        "SELECT qras.idqras FROM qras inner join users on qras.idqras = users.idqras wher" +
          "e qras.idcognito=? and users.admin=1 ",
        sub,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }
          if (info.length > 0) {
            resolve(JSON.parse(JSON.stringify(info))[0].idqras);
          } else {
            resolve();
          }
        }
      );
    });
  }

  function disableUser(username) {
    var params = {
      Username: username,
      UserPoolId: event["stage-variables"].UserPoolId
    };
    return new Promise((resolve, reject) => {
      var cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
      cognitoidentityserviceprovider.adminDisableUser(params, (err, data) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          console.log(data);
          resolve(data);
        }
      });
    });
  }

  function enableUser(username) {
    var params = {
      Username: username,
      UserPoolId: event["stage-variables"].UserPoolId
    };
    return new Promise((resolve, reject) => {
      var cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
      cognitoidentityserviceprovider.adminEnableUser(params, (err, data) => {
        if (err) {
          console.log(err);
          reject(err);
        } else {
          console.log(data);
          resolve(data);
        }
      });
    });
  }
};

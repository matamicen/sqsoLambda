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

  if (!event["stage-variables"]) {
    console.log("Stage Variables Missing");
    conn.destroy();
    response.body.error = 1;
    response.body.message = "Stage Variables Missing";
    return callback(null, response);
  }
  var url = event["stage-variables"].url;
  var conn = mysql.createConnection({
    host: event["stage-variables"].db_host, // give your RDS endpoint  here
    user: event["stage-variables"].db_user, // Enter your  MySQL username
    password: event["stage-variables"].db_password, // Enter your  MySQL password
    database: event["stage-variables"].db_database // Enter your  MySQL database name.
  });
  try {
    let qra_owner = await checkQraCognito(event.context.sub);
    if (!qra_owner) {
      console.log("User does not exist");
      conn.destroy();
      response.body.error = 1;
      response.body.message = "User does not exist";
      return callback(null, response);
    }
    let qra = await getQraInfo(event.body.qra);

    if (!qra) {
      response.body.error = 0;
      response.body.message = {
        qra: event.body.qra,
        url: null,
        url_avatar: null,
        following: "NOT_EXIST"
      };
      return callback(null, response);
    }
    let info = await getFollowedInfo(qra_owner.idqras, qra.idqras);
    if (info) {
      response.body.error = 0;
      response.body.message = {
        qra: event.body.qra,
        url: qra.profilepic,
        url_avatar: qra.avatarpic,
        following: "TRUE"
      };
      return callback(null, response);
    } else {
      response.body.error = 0;
      response.body.message = {
        qra: event.body.qra,
        url: qra.profilepic,
        url_avatar: qra.avatarpic,
        following: "FALSE"
      };
      return callback(null, response);
    }
  } catch (e) {
    console.log("Error executing QRA get Profile Pic");
    console.log(e);
    conn.destroy();

    response.body.error = 1;
    response.body.message = e.message;
    return callback(null, response);
  }

  function getFollowedInfo(idqras_owner, idqras) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("getQRA");
      conn.query(
        "SELECT idqra FROM qra_followers where idqra=? and idqra_followed=?",
        [idqras_owner, idqras],
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }
          if (info.length > 0) {
            resolve(JSON.parse(JSON.stringify(info))[0]);
          } else {
            resolve();
          }
        }
      );
    });
  }

  function checkQraCognito(sub) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("checkQraCognito");
      conn.query(
        "SELECT qras.idqras FROM qras where idcognito=? LIMIT 1",
        sub,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }

          resolve(JSON.parse(JSON.stringify(info))[0]);
        }
      );
    });
  }

  function getQraInfo(qra) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("getQRA " + qra);
      conn.query(
        "SELECT idqras, profilepic, avatarpic FROM qras where qra=?",
        qra,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }

          resolve(JSON.parse(JSON.stringify(info))[0]);
        }
      );
    });
  }
};

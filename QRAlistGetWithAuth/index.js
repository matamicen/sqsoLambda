var mysql = require("mysql");

var warmer = require("lambda-warmer");

exports.handler = async (event, context, callback) => {
  console.log(event);
  // if a warming event
  if (await warmer(event)) return "warmed";
  context.callbackWaitsForEmptyEventLoop = false;

  var qra;

  var msg;
  var sub;
  var qras = [];

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
  var url = event["stage-variables"].url;
  var conn = mysql.createConnection({
    host: event["stage-variables"].db_host, // give your RDS endpoint  here
    user: event["stage-variables"].db_user, // Enter your  MySQL username
    password: event["stage-variables"].db_password, // Enter your  MySQL password
    database: event["stage-variables"].db_database // Enter your  MySQL database name.
  });

  try {
    let idqras_owner = await getQRA(event.context.sub);
    if (!idqras_owner) {
      console.log("User does not exist");
      conn.destroy();
      response.body.error = 1;
      response.body.message = "User does not exist";
      return callback(null, response);
    }
    let followings = await getFollowings(idqras_owner);

    let qras = await getQRAs(event.body.qra.toUpperCase());

    if (qras.length == 0) {
      conn.destroy();
      response.body.error = 1;
      response.body.message = {
        qra: qra,
        url: "null",
        following: "NOT_EXIST"
      };
      return callback(null, response);
    }
    qras = await verifyFollowings(qras, followings);

    conn.destroy();
    response.body.error = 1;
    response.body.message = {
      error: 0,
      message: qras
    };
    return callback(null, response);
  } catch (e) {
    console.log("Error executing QRA get ListwithAuth");
    console.log(e);
    conn.destroy();

    response.body.error = 1;
    response.body.message = e.message;
    return callback(null, response);
  }

  function verifyFollowings(qras, following) {
    console.log("verifyFollowings");
    for (let i = 0; i < qras.length; i++) {
      // if (following.filter( (f) => { f.idqra_followed=== qras.idqras; }).length >
      // 0){

      if (following.some(f => f.idqra_followed === qras[i].idqras)) {
        qras[i].following = "TRUE";
        console.log("true");
      } else {
        qras[i].following = "FALSE";
        console.log("false");
      }
    }

    return qras;
  }

  function getFollowings(idqras_owner) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("getFollowings");
      conn.query(
        "SELECT * FROM qra_followers where idqra=?",
        idqras_owner,
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

  function getQRAs(qra) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("getQRAs");
      conn.query(
        "SELECT qra, CONCAT(COALESCE(qra,''), ' ', COALESCE(firstname,''),' ', COALESCE(l" +
          "astname,'')) AS name, profilepic, avatarpic, idqras  FROM qras where qra LIKE ?",
        qra + "%",
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

  function getQRA(sub) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("getQRA");
      conn.query(
        "SELECT idqras FROM qras where idcognito=? LIMIT 1",
        sub,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }

          resolve(JSON.parse(JSON.stringify(info))[0].idqras);
        }
      );
    });
  }
};

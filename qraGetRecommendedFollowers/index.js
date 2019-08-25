var mysql = require("mysql");
const warmer = require("lambda-warmer");
var AWS = require("aws-sdk");
AWS.config.region = "us-east-1";

exports.handler = async(event, context, callback) => {
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

  if (!event.context.sub) {
    console.log("Params Missing");
    response.body.error = 1;
    response.body.message = "Params Missing";
    return callback(null, response);
  }

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

    let idqra_owner = await checkQraCognito(event.context.sub);
    if (!idqra_owner) {
      console.log("QRA does not exist");
      conn.destroy();
      response.body.error = 1;
      response.body.message = "QRA does not exist";

      return callback(null, response);
    }
    let output = {};
    output.followingMe = await getFollowingMe(idqra_owner);
    output.taggedMe = await getTaggedMe(idqra_owner);
    output.taggedByMe = await getTaggedByMe(idqra_owner);
    output.topFollowed = await getTopFollowed(idqra_owner);

    conn.destroy();
    response.body.error = 0;
    response.body.message = output;
    context.succeed(response);
  }
  catch (e) {
    console.log("Error when select QRA");
    console.log(e);
    conn.destroy();
    response.body.error = 1;
    response.body.message = "Error when select QRA";
    return callback(null, response);
  }

  function checkQraCognito(sub) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("checkQraCognito" + sub);
      conn.query(
        "SELECT idqras FROM qras where idcognito=? LIMIT 1",
        sub,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }
          if (info.length > 0) {
            resolve(JSON.parse(JSON.stringify(info))[0].idqras);
          }
          else {
            resolve();
          }
        }
      );
    });
  }

  function getFollowingMe(idqra) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      conn.query(
        "SELECT qras.idqras, qras.qra, qras.avatarpic, qras.firstname, qras.lastname,  followers_counter, qsos_counter, " +
        "qras.comments_counter " +
        " FROM sqso.qra_followers as fme " +
        " left outer join  sqso.qra_followers as fing " +
        " on fme.idqra = fing.idqra_followed " +
        " and fme.idqra_followed = fing.idqra " +
        " inner join qras on fme.idqra = qras.idqras" +
        " where fme.idqra_followed = ? " +
        " and fing.idqra is null",
        idqra,
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

  function getTaggedByMe(idqra) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      conn.query(
        "SELECT qras.idqras, qras.qra, qras.avatarpic, qras.firstname, qras.lastname,  followers_counter, qsos_counter, " +
        "qras.comments_counter " +
        "from qsos as q " +
        "inner join qsos_qras as qqr on " +
        "q.idqsos = qqr.idqso " +
        "left outer join  sqso.qra_followers as fing " +
        "on qqr.idqra = fing.idqra_followed  " +
        "and q.idqra_owner = fing.idqra " +
        "inner join qras on qqr.idqra = qras.idqras " +
        "where q.idqra_owner = ? " +
        "and isOwner = 0 " +
        "and fing.idqra is null " +
        "group by qqr.idqra",
        idqra,
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

  function getTaggedMe(idqra) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      conn.query(
        "SELECT qras.idqras, qras.qra, qras.avatarpic, qras.firstname, qras.lastname,  followers_counter, qsos_counter, " +
        "qras.comments_counter " +
        "from qsos as q " +
        "inner join qsos_qras as qqr on " +
        "q.idqsos = qqr.idqso " +
        "left outer join  sqso.qra_followers as fing " +
        "on q.idqra_owner = fing.idqra_followed  " +
        "and qqr.idqra = fing.idqra " +
        "inner join qras on q.idqra_owner = qras.idqras " +
        "where qqr.idqra = ? " +
        "and isOwner = 0 " +
        "and fing.idqra is null " +
        "group by q.idqra_owner",
        idqra,
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

  function getTopFollowed(idqra) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      conn.query(
        "SELECT qras.idqras, qras.qra, qras.avatarpic, qras.firstname, qras.lastname,  followers_counter, qsos_counter " +
        "FROM sqso.qras " +
        "where idqras <> ? and " +
        "disabled = 0 " +
        "order by   followers_counter desc " +
        "limit 50",
        idqra,
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
};

var mysql = require("mysql");
var warmer = require("lambda-warmer");

exports.handler = async (event, context, callback) => {
  console.log(event);
  // if a warming event
  if (await warmer(event)) return "warmed";

  context.callbackWaitsForEmptyEventLoop = false;

  let response = {
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
  let url = event["stage-variables"].url;
  var conn = await mysql.createConnection({
    host: event["stage-variables"].db_host, // give your RDS endpoint  here
    user: event["stage-variables"].db_user, // Enter your  MySQL username
    password: event["stage-variables"].db_password, // Enter your  MySQL password
    database: event["stage-variables"].db_database // Enter your  MySQL database name.
  });

  try {
    let qsos = await getQsos();

    let qsos_output = await processQsos(qsos);

    conn.destroy();
    response.body.error = 0;
    response.body.message = qsos_output;
    return callback(null, response);
  } catch (e) {
    console.log("Error when select Public QSO Feed");
    console.log(e);
    conn.destroy();

    response.body.error = 1;
    response.body.message = e;
    return callback(null, response);
  }

  async function getQsos() {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.

      conn.query("CALL qsopubliclistget2()", function(err, info) {
        // Call reject on error states, call resolve with results
        if (err) {
          return reject(err);
        }
        resolve(JSON.parse(JSON.stringify(info)));
      });
    });
  }
  async function processQsos(qsos) {
    let qsos_aux = qsos[0];

    let qso_qras = qsos[1];
    let qso_comments = qsos[2];
    let qso_likes = qsos[3];
    let qso_media = qsos[4];
    let qso_orig = qsos[5];
    let qso_links = qsos[6];
    let qsosOutput = [];

    for (let i = 0; i < qsos_aux.length; i++) {
      let qso = qsos_aux[i];
      if (i % 2 === 0 && i !== 0) {
        //     console.log('Ad')

        qsosOutput.push({
          type: "AD",
          source: "FEED"
        });
      }
      qso.qras = qso_qras.filter(
        obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared
      );
      qso.comments = qso_comments.filter(obj => obj.idqso === qso.idqsos);
      qso.likes = qso_likes.filter(obj => obj.idqso === qso.idqsos);
      qso.media = qso_media.filter(
        obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared
      );
      qso.original = qso_orig.filter(obj => obj.idqsos === qso.idqso_shared);
      qso.links = qso_links.filter(
        obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared
      );
      qsosOutput.push(qso);
    }
    return qsosOutput;
  }
};

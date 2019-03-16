var mysql = require('mysql');
var warmer = require('lambda-warmer');

exports.handler = async(event, context, callback) => {
    // if a warming event
    if (await warmer(event))
        return 'warmed';
    context.callbackWaitsForEmptyEventLoop = false;

    var response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
        },
        body: {
            "error": null,
            "message": null
        }
    };

    let qra = event.body.qra;

    //***********************************************************
    if (!event['stage-variables']) {
        console.log("Stage Variables Missing");
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }
    let url = event['stage-variables'].url;
    var conn = await mysql.createConnection({
        host: event['stage-variables'].db_host, // give your RDS endpoint  here
        user: event['stage-variables'].db_user, // Enter your  MySQL username
        password: event['stage-variables'].db_password, // Enter your  MySQL password
        database: event['stage-variables'].db_database // Enter your  MySQL database name.
    });

    try {
        let qraData = await getQRA(qra);
        if (!qraData) {
            console.log("QRA does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "QRA does not exist";

            callback("User does not exist");
            return context.fail(response);
        }
      
        console.log(qraData);
        conn.destroy();
        response.body.error = 0;
        response.body.message = qraData;
        context.succeed(response);

    }
    catch (e) {
        console.log("Error when select QRA");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Error when select QRA"
        return context.fail(response);
    }

    function getQRA(qra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            conn
                .query("SELECT qra, firstname, lastname, avatarpic FROM qras where qras.qra=? LIMIT 1", qra, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info))[0]);
                });
        });
    }
   



};

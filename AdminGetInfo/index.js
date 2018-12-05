var mysql = require('mysql');
const warmer = require('lambda-warmer');

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

    var sub = event.context.sub;

    //***********************************************************
    if (!event['stage-variables']) {
        console.log("Stage Variables Missing");
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }

    var conn = await mysql.createConnection({
        host: event['stage-variables'].db_host, // give your RDS endpoint  here
        user: event['stage-variables'].db_user, // Enter your  MySQL username
        password: event['stage-variables'].db_password, // Enter your  MySQL password
        database: event['stage-variables'].db_database // Enter your  MySQL database name.
    });


    try {
        let idqras_owner = await getAdmin(sub);
        if (!idqras_owner) {
            console.log("QRA does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "QRA does not exist";

            callback("User does not exist");
            return context.fail(response);
        }
        let qra_output = await getQRAinfo(idqras_owner);
        console.log(qra_output);
        conn.destroy();
        response.body.error = 0;
        response.body.message = qra_output;
        context.succeed(response);

    }
    catch (e) {
        console.log("Error when select QRA");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Error when select QRA";
        return context.fail(response);
    }

    function getAdmin(qra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            conn
                .query("SELECT qras.idqras FROM qras inner join users on qras.idqras = users.idqras wher" +
                    "e qras.idcognito=? and users.admin=1 ",
                    sub,
                    function(err, info) {
                        // Call reject on error states, call resolve with results
                        if (err) {
                            return reject(err);
                        }
                        resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                    });
        });
    }
    async function getQRAinfo(idqra) {
        let qra_output = {};
        qra_output.qra = await getQRAdata(idqra);
        qra_output.contentReported = await getContentReported();
        return (qra_output);
    }

    function getQRAdata(idqra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT * from qras where qras.idqras=?", idqra, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info))[0]);
                });
        });
    }

    function getContentReported() {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getContentReported");
            conn.query("SELECT *, qras.qra FROM content_reported inner join qras on content_reported.idq" +
                "ra  = qras.idqras where deleted is null",
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    if (info.length > 0) {
                        resolve(JSON.parse(JSON.stringify(info)));
                    }
                    else {
                        resolve();
                    }
                });
        });
    }

};

var mysql = require('mysql');

exports.handler = async(event, context, callback) => {
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
    var conn = await mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {
        let idqras_owner = await getQRA(sub);
        if (!idqras_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";

            return callback(null, response);
        }

        response.body.error = 0;
        response.body.message = await getNotifications(idqras_owner);
        conn.destroy();
        return callback(null, response);

    }
    catch (e) {
        console.log("Error executing GetNotifications");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Error executing GetNotifications";
        callback(null, response);
        return context.fail(response);
    }

    function getQRA(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQRA");
            conn.query("SELECT idqras FROM qras where idcognito=? LIMIT 1", sub, function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info))[0].idqras);
            });
        });
    }

    function getNotifications(idqra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getNotifications");
            console.log(idqra);
            conn.query("SELECT qra_notifications.* FROM qra_notifications where idqra = ? and qra_notifications.read IS NU" +
                "LL order by qra_notifications.datetime DESC",
                idqra,
                function(err, info) {
                    // Call reject on error states, call resolve with results

                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }
};

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
    var idnotif = event.body.idqra_notifications;

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
        let info = await setNotificationAsRead(idqras_owner, idnotif);
        console.log(info)
        if (info.changedRows) {
            response.body.error = 0;
            response.body.message = info;
        }
        else {
            response.body.error = 1;
            response.body.message = info;
        }

        conn.destroy();
        return callback(null, response);

    }
    catch (e) {
        console.log("Error executing SetNotificationAsRead");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = e;
        return callback(null, response);
    }

    function getQRA(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQRA");
            conn.query("SELECT idqras FROM qras where idcognito=?", sub, function(err, info) {
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

            });
        });
    }

    function setNotificationAsRead(idqras, idnotif) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("setNotificationAsRead");

            conn.query("UPDATE qra_notifications SET qra_notifications.read=1 WHERE idqra_notifications=? and idqra=?", [
                    idnotif, idqras
                ],
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

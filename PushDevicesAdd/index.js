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

    var qra = event.body.qra;
    var token = event.body.token;
    var device_type = event.body.device_type;
    var sub = event.context.sub;

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
        let idqras_owner = await getQRA(sub);
        if (!idqras_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }
        let idqra = await getQraInfo(qra);
        let info = await insertDevice(idqra, token, device_type);

        console.log("Push_Devices Add Done");
        response.body.error = 0;
        response.body.message = info;
        return callback(null, response);

    }
    catch (e) {
        console.log("Error executing Push_Devices Add");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e;
        callback(null, response);
        return context.fail(response);
    }


    function insertDevice(idqra, token, device_type) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("insertDevice")

            conn.query("INSERT INTO push_devices ( token, qra, device_type, datetime) VALUES( ?, ?, ?, NOW" +
                "()) ON DUPLICATE KEY UPDATE qra = ?, datetime=NOW()", [
                    token, idqra, device_type, idqra
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

    function getQraInfo(qra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQRA");
            conn.query("SELECT idqras FROM qras where qra=? LIMIT 1", qra, function(err, info) {
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
                if (info.length > 0) {
                    resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                }
                else {
                    resolve();
                }
            });
        });
    }

};

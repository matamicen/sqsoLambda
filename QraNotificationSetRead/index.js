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

    
    let idnotif = event.body.idqra_notifications;
    let idactivity = event.body.idactivity;

 //***********************************************************
 if (!event['stage-variables']) {
    console.log("Stage Variables Missing");
    conn.destroy();
    response.body.error = 1;
    response.body.message = "Stage Variables Missing";
    return callback(null, response);
}
var url = event['stage-variables'].url;
var conn = await mysql.createConnection({
    host: event['stage-variables'].db_host, // give your RDS endpoint  here
    user: event['stage-variables'].db_user, // Enter your  MySQL username
    password: event['stage-variables'].db_password, // Enter your  MySQL password
    database: event['stage-variables'].db_database // Enter your  MySQL database name.
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
        let info = await setNotificationAsRead(idqras_owner, idnotif, idactivity);
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

    function setNotificationAsRead(idqras, idnotif, idactivity) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("setNotificationAsRead");
 if (idnotif) {
            conn.query("DELETE from qra_notifications WHERE idqra_notifications=? and idqra=?", [
                    idnotif, idqras
                ],
                function(err, info) {
                    // Call reject on error states, call resolve with results

                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
            }
            else if (idactivity) {
                conn.query("DELETE from  qra_notifications WHERE idqra_activity=? and idqra=?", [
                    idactivity, idqras
                ],
                function(err, info) {
                    // Call reject on error states, call resolve with results

                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
            }
        });
    }
};

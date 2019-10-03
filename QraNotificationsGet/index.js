var mysql = require('mysql');

const warmer = require('lambda-warmer');

exports.handler = async(event, context, callback) => {
    console.log(event);
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
    var url = event['stage-variables'].url;
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
            conn.query("SELECT n.idqra_notifications, n.activity_type, n.qra, n.message, n.REF_QRA, n.QSO_GUID,  q.avatarpic as qra_avatarpic " +
                " FROM qra_notifications as n " +
                " inner join qras as q " +
                " on n.qra = q.QRA where idqra = ? order by " +
                "n.idqra_notifications DESC",
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

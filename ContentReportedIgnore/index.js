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

    var idreport = event.body.idreport;
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
        let idqras_owner = await getQRAadmin(sub);
        if (!idqras_owner) {
            console.log("Caller is not QSO ADMIN");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "Caller is not QSO ADMIN";
            conn.destroy();
            return callback(null, response);
        }
        let reportedContent = await ignoreReportedContent(idreport);

        console.log(info);
        if (info.affectedRows) {

            console.log("QSO Deleted");
            response.body.error = 0;
            response.body.message = "QSO Deleted";
            conn.destroy();
            return callback(null, response);
        } //ENDIF

    } catch (e) {
        console.log("Error executing Content Reported Ignore");
        console.log(e);
        response.body.error = 1;
        response.body.message = e;
        conn.destroy();
        return callback(null, response);
    }

    function ignoreReportedContent(idreport) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("delReportedContent" + idreport);
            conn.query("UPDATE content_reported SET deleted=1, action='IGNORE' where idreport= ?", idreport, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }

    function getQRAadmin(sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQRA");
            conn.query("SELECT qras.idqras FROM qras inner join users on qras.idqras = users.idqras wher" +
                    "e qras.idcognito=? and users.admin=1 ",
            sub, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                if (info.length > 0) {
                    resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                } else {
                    resolve();
                }
            });
        });
    }
};

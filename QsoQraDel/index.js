var fs = require('fs');
var mysql = require('mysql');
const warmer = require('lambda-warmer');

exports.handler = async(event, context, callback) => {

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


    var idqso = event.body.qso;
    var qras = event.body.qras;
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
        let qra_owner = await checkOwnerInQso(idqso, sub);
        if (!qra_owner) {
            console.log("Caller is not QSO Owner");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "Error when select QRA to get ID of Owner";

            return callback(null, response);
        }
        let info = await delQsoQras(idqso, qras);
        console.log(info)
        if (info.affectedRows)
            response.body.error = 0;
        else
            response.body.error = 1;

        response.body.message = info;
        conn.destroy();
        console.log("qso qra deleted ");
        return callback(null, response);

    }
    catch (e) {
        console.log("Error executing Qso Qra Del");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e;

        return callback(null, response);
    }

    function checkOwnerInQso(idqso, sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qras.idqras from qras inner join qsos on qras.idqras = qsos.idqra_owner w" +
                    "here qsos.idqsos=? and qras.idcognito=?", [
                    idqso, sub
                ],
                    function(err, info) {
                        // Call reject on error states, call resolve with results
                        if (err) {
                            return reject(err);
                        }

                        if (info.length > 0) {
                            resolve(JSON.parse(JSON.stringify(info))[0]);
                        }
                        else {
                            resolve();
                        }
                    });
        });
    }
    async function delQsoQras(idqso, qras) {
        let info;
        for (var a = 0; a < qras.length; a++) {
            info = await deleteQSOQRA(idqso, qras[a]);
        }
        return info;
    }

    function deleteQSOQRA(idqso, qra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("DELETE q from qsos_qras as q inner join qras as r on q.idqra = r.idqras where q." +
                    "idqso = ? and r.qra = ? ", [
                    idqso, qra
                ],
                    function(err, info) {
                        // Call reject on error states, call resolve with results
                        if (err) {
                            return reject(err);
                        }

                        if (info) {
                            resolve(JSON.parse(JSON.stringify(info)));
                        }
                        else {
                            resolve();
                        }
                    });
        });
    }
};

var mysql = require('mysql');
// var async = require('async'); var AWS = require('aws-sdk'); AWS.config.region
// = 'us-east-1';

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

    var qso = event.body.qso;
    var sub = event.context.sub;

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
    //***********************************************************
    if (!event['stage-variables']) {
        console.log("Stage Variables Missing");
        
        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }
    var url = event['stage-variables'].url;
    var conn = mysql.createConnection({
        host: event['stage-variables'].db_host, // give your RDS endpoint  here
        user: event['stage-variables'].db_user, // Enter your  MySQL username
        password: event['stage-variables'].db_password, // Enter your  MySQL password
        database: event['stage-variables'].db_database // Enter your  MySQL database name.
    });
    try {
        let idqras_owner = await getQRA(qso, sub);
        if (!idqras_owner) {
            console.log("Caller is not QSO Owner");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            conn.destroy();
            return callback(null, response);
        }
        let info = await delQSO(qso);
        await UpdateQsosCounterInQra(idqras_owner);
        await deleteRelatedQSOs(qso);
        if (info.affectedRows) {
            console.log("QSO Deleted");
            response.body.error = 0;
            response.body.message = "QSO Deleted";
            conn.destroy();
            return callback(null, response);
        } //ENDIF

    } catch (e) {
        console.log("Error executing QsoDel");
        console.log(e);
        response.body.error = 1;
        response.body.message = e;
        conn.destroy();
        return callback(null, response);
    }
    async function deleteRelatedQSOs(idqso) {
        let qsos = await getRelatedQSOs(idqso);
        for (let i = 0; i < qsos.length; i++) {
            let info = await delQSO(qsos[i].idqsos);
            await UpdateQsosCounterInQra(qsos[i].idqra_owner);
        }
        return null;
    }
    function getRelatedQSOs(idqso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getRelatedQSOs");
            conn.query("SELECT idqsos, idqra_owner from qsos where idqso_shared= ?", [idqso], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function getQRA(idqso, sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qras.idqras from qras inner join qsos on qras.idqras = qsos.idqra_owner w" +
                        "here qsos.idqsos=? and qras.idcognito=?",
                [
                    idqso, sub
                ], function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                });
        });
    }
    function delQSO(idqso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("UPDATE qsos SET deleted=1 WHERE idqsos=?", idqso, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    // console.log(info);
                });
        });
    }
    function UpdateQsosCounterInQra(idqras) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            // ***********************************************************
            conn
                .query('UPDATE sqso.qras SET qsos_counter = qsos_counter-1 WHERE idqras=?', idqras, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    // console.log(info);
                });
        });
    }
};
var fs = require('fs');
var mysql = require('mysql');

exports.handler = async(event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;

    var newqso;
    var datetime;
    var type;
    var sub;
    var qso;

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

    if (event.qso) {
        type = event.type;
        qso = event.qso;
        datetime = event.datetime;
        sub = event.sub;
    } else {

        type = event.body.type;
        qso = event.body.qso;
        datetime = event.body.datetime;
        sub = event.context.sub;
    }
    console.log(sub);

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
            callback(null, response);
            return context.fail(response);
        }
        newqso = await saveQSO(idqras_owner, datetime, type, qso);
        await UpdateSharesCounterInQso(qso);
        await UpdateQsosCounterInQra(idqras_owner);
        var info = await saveQRA(newqso, idqras_owner);
        if (info.insertId) {
            conn.destroy();
            response.body.error = 0;
            response.body.message = "New QSO Created " + newqso;
            return callback(null, response);
        }

    } catch (e) {
        console.log("Error executing QsoShare");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Error executing QsoShare";
        callback(null, response);
        return context.fail(response);
    }

    function getQRA(sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQRA");
            conn.query("SELECT idqras FROM qras where idcognito=? LIMIT 1", sub, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info))[0].idqras);
            });
        });
    }
    function saveQSO(idqras, datetime, type, qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("saveQSO");
            conn.query("INSERT INTO qsos  SET idqra_owner=?, datetime=?, type = ?, GUID_QR = UUID(), GUI" +
                    "D_URL = UUID(), idqso_shared= ?",
            [
                idqras, datetime, type, qso
            ], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)).insertId);
                // console.log(info);
            });
        });
    }
    function UpdateSharesCounterInQso(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateSharesCounterInQso");
            conn.query('UPDATE sqso.qsos SET shares_counter = shares_counter+1 WHERE idqsos=?', qso, function (err, info) {
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
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateQsosCounterInQra");
            conn.query('UPDATE sqso.qras SET qsos_counter = qsos_counter+1, last_created_qso=NOW() WHERE' +
                    ' idqras=?',
            idqras, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }
    function saveQRA(newqso, idqras) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("saveQRA");
            let post = {
                "idqso": newqso,
                "idqra": idqras,
                "isOwner": true
            };

            //***********************************************************
            conn.query('INSERT INTO qsos_qras SET ?', post, function (err, info) {
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
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

    let guid = event.body.qso;

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
        let qso = await getQSO(guid);
        if (!qso) {
            console.log("QSO does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "QSO does not exist";

            return callback(null, response);
        }
        let qra = await getQRAofOwnerQSO(qso);
        qso.qra = qra.qra;
        qso.profilepic = qra.profilepic;
        qso.avatarpic = qra.avatarpic;
        qso.qras = await getQRASofQSO(qso);
        qso.media = await getMEDIAofQSO(qso);
        console.log(qso);
        conn.destroy();
        response.body.error = 0;
        response.body.message = qso;
        context.succeed(response);

    } catch (e) {
        console.log("ERROR In Get QSOS Detail");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = "ERROR In Get QSOS Detail";
        return callback(null, response);
    }
    function getQSO(guid) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQSO");
            conn.query("SELECT * from qsos WHERE GUID_URL =?", guid, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info))[0]);
            });
        });
    }
    function getQRAofOwnerQSO(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQRAofOwnerQSO");
            conn.query("SELECT qra, profilepic, avatarpic from qras WHERE idqras = ? LIMIT 1", qso.idqra_owner, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info))[0]);
            });
        });
    }
    function getQRASofQSO(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQRASofQSO");

            conn.query("SELECT qra, profilepic, avatarpic FROM sqso.qras where  idqras in ( SELECT idqra" +
                    " FROM sqso.qsos_qras where isOwner <> true and idqso = ? )",
            qso.idqsos, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function getMEDIAofQSO(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getMEDIAofQSO");
            conn.query("SELECT * from qsos_media WHERE idqso =? and type = 'image' LIMIT 1 ", qso.idqsos, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }

};
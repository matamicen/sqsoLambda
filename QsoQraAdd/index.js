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

    var idqso = event.body.qso;
    var qras = event.body.qras;
    var sub = event.context.sub;
    var datetime = new Date();

    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });

    try {
        let qra_owner = await checkOwnerInQso(idqso, sub);
        if (!qra_owner) {
            console.log("Caller is not QSO Owner");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "Caller is not QSO Owner";
            return callback(null, response);
        }
        var qras_output = await saveQrasInQso(qras, idqso, qra_owner, datetime);
        if (qras_output) {

            console.log("QSOQRA inserted", idqso);
            conn.destroy();
            response.body.error = 0;
            response.body.message = qras_output;
            return callback(null, response);
        }

    }
    catch (e) {
        console.log("Error executing QsoQraAdd");
        console.log(e);
        conn.destroy();
        // callback(e.message);
        response.body.error = 1;
        response.body.message = e.message;
        return callback(null, response);
    }

    function checkOwnerInQso(idqso, sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkOwnerInQso");
            conn.query("SELECT qras.idqras, qras.qra, qras.avatarpic, qsos.guid_URL from qras inner join" +
                " qsos on qras.idqras = qsos.idqra_owner where qsos.idqsos=? and qras.idcognito=?", [
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
    async function saveQrasInQso(qras, idqso, qra_owner, datetime) {
        console.log("saveQrasInQso");
        let qras_output = [];
        let idqra;
        for (var i = 0; i < qras.length; i++) {
            var qra = await getQra(qras[i]);
            if (!qra) {
                await qras_output.push({ qra: qras[i], url: null });
                idqra = await saveQra(qras[i]);
            }
            else {
                qras_output.push({ "qra": qra.qra, "url": qra.profilepic, "url_avatar": qra.avatarpic });
                idqra = qra.idqras;
            }

            await saveQraInQso(idqra, idqso);
            let idActivity = await saveActivity(qra_owner.idqras, idqso, idqra, datetime);
            if (idActivity) {
                await saveNotification(idActivity, idqra, idqso, qra_owner, datetime, qras[i]);
            }
        }
        return qras_output;
    }

    function saveQra(qra) {
        console.log("saveQra");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query('INSERT INTO qras SET qra=?', qra.toUpperCase(), function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    else {

                        resolve(JSON.parse(JSON.stringify(info)).insertId);
                    }

                });
        });
    }

    function getQra(qra) {
        console.log("getQra");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT * FROM qras where qra=? LIMIT 1", qra.toUpperCase(), function(err, info) {
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

    function saveQraInQso(idqra, idqso) {
        console.log("saveQraInQso");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query('INSERT INTO qsos_qras SET idqso=?, idqra=?, isOwner=?', [
                    idqso, idqra, false
                ], function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    else {
                        resolve(JSON.parse(JSON.stringify(info)));
                    }
                });
        });

    }

    function saveActivity(idqras_owner, idqso, ref_idqra, datetime) {
        console.log("saveActivity");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("INSERT INTO qra_activities SET idqra = ?, activity_type='12', ref_idqso=?, ref_i" +
                    "dqra=?, datetime=?", [
                        idqras_owner, idqso, ref_idqra, datetime
                    ],
                    function(err, info) {
                        // Call reject on error states, call resolve with results
                        if (err) {
                            return reject(err);
                        }

                        resolve(JSON.parse(JSON.stringify(info)).insertId);
                    });
        });
    }

    function saveNotification(idActivity, idqra, idqso, qra_owner, datetime, qra) {
        console.log("insertNotification");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=? , datetime=?, acti" +
                    "vity_type='12', qra=?,  qra_avatarpic=?, QSO_GUID=?, REF_QRA=? ", [
                        idqra,
                        idActivity,
                        datetime,
                        qra_owner.qra,
                        qra_owner.avatarpic,
                        qra_owner.guid_URL,
                        qra
                    ],
                    function(err, info) {
                        // Call reject on error states, call resolve with results
                        if (err) {
                            return reject(err);
                        }

                        resolve(JSON.parse(JSON.stringify(info)).insertId);
                    });
        });
    }

};

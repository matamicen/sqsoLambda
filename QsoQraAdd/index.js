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
        let idqras_owner = await checkOwnerInQso(idqso, sub);
        if (!idqras_owner) {
            console.log("Caller is not QSO Owner");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "Caller is not QSO Owner";
            return callback(null, response);
        }
        var qras_output = await saveQrasInQso(qras, idqso);

        let followers = await getFollowers(idqras_owner);

        let idActivity = await saveActivity(idqras_owner, idqso, datetime);
        if (idActivity) {

            await createNotifications(idActivity, followers);
        }
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
        callback(e.message);
        response.body.error = 1;
        response.body.message = e.message;
        return callback(null, response);
    }



    function checkOwnerInQso(idqso, sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkOwnerInQso");
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
                            resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                        }
                        else {
                            resolve();
                        }
                    });
        });
    }
    async function saveQrasInQso(qras, idqso) {
        console.log("saveQrasInQso");
        let qras_output = [];
        for (var i = 0; i < qras.length; i++) {
            var qra = await getQra(qras[i]);
            var idqra = qra.idqra;
            if (!qra) {
                await qras_output.push({ qra: qras[i], url: null });
                idqra = await saveQra(qras[i]);
            }
            else {
                qras_output.push({ "qra": qra.qra, "url": qra.profilepic, "url_avatar": qra.avatarpic });
            }
            await saveQraInQso(idqra, idqso);

        }
        return qras_output;
    }

    function saveQra(qra) {
        console.log("saveQra");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.


            //***********************************************************
            conn.query('INSERT INTO qras SET qra=?', qra.toUpperCase(), function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                else {
                    resolve(JSON.parse(JSON.stringify(info)));
                }
                // console.log(info);
            });
        });
    }


    function getQra(qra) {
        console.log("getQra");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn.query("SELECT * FROM qras where qra=? LIMIT 1", qra.toUpperCase(), function(err, info) {
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


            //***********************************************************
            conn.query('INSERT INTO qsos_qras SET idqso=?, idqra=?, isOwner=?', [
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

    function saveActivity(idqras_owner, idqso, datetime) {
        console.log("saveActivity");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("INSERT INTO qra_activities SET idqra = ?, activity_type='12', ref_idqso=?, datet" +
                    "ime=?", [
                        idqras_owner, idqso, datetime
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
    async function createNotifications(idActivity, followers) {
        console.log("createNotifications");
        for (let i = 0; i < followers.length; i++) {
            await insertNotification(idActivity, followers[i]);
        }
    }

    function insertNotification(idActivity, follower) {
        console.log("insertNotification");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=?", [
                    follower.idqra_followed, idActivity
                ], function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                });
        });
    }

    function getFollowers(idqra_owner) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qra_followers.* from qra_followers WHERE qra_followers.idqra = ?", idqra_owner, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }

};

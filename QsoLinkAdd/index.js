var mysql = require('mysql');

exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var qsos_rel = [];

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
    qsos_rel = event.body.qsos_rel;
    var sub = event.context.sub;
    var datetime = new Date();

    // ***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {
        let idqras_owner = await checkOwnerInQso(qso, sub);
        if (!idqras_owner) {
            console.log("Caller is not QSO Owner");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "You are not the Owner of the main QSO";

            return callback(null, response);
        }

        await UpdateLinksInQso(qso, qsos_rel.length);
        await UpdateLinksInQraOwner(idqras_owner, qsos_rel.length);
        let info = await addQSOlinks(qso, qsos_rel, idqras_owner, datetime);
        if (info.affectedRows) {

            console.log("QSOLink Added");
            response.body.error = 0;
            response.body.message = info;

            return callback(null, response);
        } //ENDIF

    }
    catch (e) {
        console.log("Error executing Qso link add");
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
                            resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                        }
                        else {
                            resolve();
                        }
                    });
        });
    }
    async function addQSOlinks(qso, qsos_rel, idqras_owner, datetime) {
        let info;
        let qrasAll = [];
        console.log("saveActivity");
        let idActivity = await saveActivity(idqras_owner, qso, datetime);
        if (idActivity) {
            console.log("Get Stakeholders of QSO");
            let qras = await getQsoStakeholders(qso);

            qrasAll = await createNotifications(idActivity, qrasAll, qras, idqras_owner);

            console.log("getFollowing Me");
            let followingMe = await getFollowingMe(idqras_owner);

            qrasAll = await createNotifications(idActivity, qrasAll, followingMe, idqras_owner);

        }

        for (let i = 0; i < qsos_rel.length; i++) {
            info = await addQSOlink(qso, qsos_rel[i].qso);
            console.log("Get Stakeholders of QSO");
            let stakeholders = await getQsoStakeholders(qsos_rel[i].qso);

            console.log("createNotifications");
            qrasAll = await createNotifications(idActivity, qrasAll, stakeholders, idqras_owner);

        }

        return info;
    }

    function addQSOlink(qso, idqso_rel) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("addQSOlink" + idqso_rel);

            //***********************************************************
            conn.query('INSERT INTO qsos_links SET idqso=?, idqso_rel=?, datetime=NOW()', [
                qso, idqso_rel
            ], function(err, info) {
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

    function UpdateLinksInQso(qso, counter) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateLinksInQso" + qso + counter);
            conn.query('UPDATE sqso.qsos SET links_counter = links_counter+? WHERE idqsos=?', [
                counter, qso
            ], function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }

    function UpdateLinksInQraOwner(idqras, counter) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateLinksInQraOwner" + idqras + counter);
            conn.query('UPDATE sqso.qras SET links_created = qsos_counter+? WHERE idqras=?', [
                counter, idqras
            ], function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));

            });
        });
    }

    function getFollowingMe(idqra_owner) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qra_followers.* from qra_followers WHERE qra_followers.idqra_followed = ?", idqra_owner, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }

    function getQsoStakeholders(idqso) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("Select distinct idqra from qsos_qras where idqso=?", idqso, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });

    }

    function saveActivity(idqras_owner, newqso, datetime) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("INSERT INTO qra_activities SET idqra = ?, activity_type='20', ref_idqso=?, datet" +
                    "ime=?", [
                        idqras_owner, newqso, datetime
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
    async function createNotifications(idActivity, qrasAll, qras, idqras_owner) {

        for (let i = 0; i < qras.length; i++) {

            if (!qrasAll.some(elem => elem.idqra === qras[i].idqra) && (qras[i].idqra !== idqras_owner)) {
                await insertNotification(idActivity, qras[i].idqra);
                qrasAll.push({ idqra: qras[i].idqra });
            }
        }
        return qrasAll;
    }

    function insertNotification(idActivity, idqra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=?", [
                    idqra, idActivity
                ], function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                });
        });
    }

};

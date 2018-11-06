var mysql = require('mysql');
const uuidv4 = require('uuid/v4');

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

    let mode = event.body.mode;
    let band = event.body.band;
    let latitude = event.body.latitude;
    let longitude = event.body.longitude;
    let datetime = event.body.datetime;
    let type = event.body.type;
    let sub = event.context.sub;
    let uuid_QR = uuidv4();
    console.log(uuid_QR)
    let uuid_URL = uuidv4();
    console.log(uuid_URL)

    //***********************************************************
    var conn = await mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {
        let qra_owner = await getQRA(sub);
        if (!qra_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }
        let newqso = await saveQSO(qra_owner.idqras, mode, band, datetime, type, longitude, latitude);
        console.log("getFollowing Me");
        let followers = await getFollowingMe(qra_owner.idqras);
        console.log("saveActivity");
        let idActivity = await saveActivity(qra_owner, newqso, datetime);
        if (idActivity) {
            console.log("createNotifications");
            await createNotifications(idActivity, qra_owner, followers, datetime, band, mode, type, uuid_URL);
        }
        await UpdateQsosCounterInQra(qra_owner.idqras);
        var info = await saveQRA(newqso, qra_owner.idqras);

        if (info.insertId) {

            conn.destroy();
            response.body.error = 0;
            response.body.message = newqso;
            return callback(null, response);
        }

    }
    catch (e) {
        console.log("Error executing QsoNew");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = e.message;
        return callback(null, response);
    }

    function getQRA(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            conn
                .query("SELECT idqras, qra, avatarpic FROM qras where idcognito=? LIMIT 1", sub, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0]);
                });
        });
    }

    function saveQSO(idqras, mode, band, datetime, type, longitude, latitude) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            let location = "POINT(" + longitude + " " + latitude + ")";
            conn.query("INSERT INTO qsos  SET idqra_owner=?, location = GeomFromText(?), mode = ?, band " +
                "= ?, datetime = ?, type = ?, GUID_QR = ?, GUID_URL = ?", [
                    idqras,
                    location,
                    mode,
                    band,
                    datetime,
                    type,
                    uuid_QR,
                    uuid_URL
                ],
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                    // console.log(info);
                });
        });
    }

    function saveQRA(newqso, idqras) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            let post = {
                "idqso": newqso,
                "idqra": idqras,
                "isOwner": true
            };

            //***********************************************************
            conn.query('INSERT INTO qsos_qras SET ?', post, function(err, info) {
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
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query('UPDATE sqso.qras SET qsos_counter = qsos_counter+1, last_created_qso=NOW() WHERE' +
                    ' idqras=?',
                    idqras,
                    function(err, info) {
                        // Call reject on error states, call resolve with results
                        if (err) {
                            return reject(err);
                        }
                        resolve(JSON.parse(JSON.stringify(info)));
                        // console.log(info);
                    });
        });
    }

    function saveActivity(qra_owner, newqso, datetime) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("INSERT INTO qra_activities SET idqra = ?, activity_type='10', ref_idqso=?, datet" +
                    "ime=?", [
                        qra_owner.idqras, newqso, datetime
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
    async function createNotifications(idActivity, qra_owner, followers, datetime, band, mode, type, uuid_URL) {

        for (let i = 0; i < followers.length; i++) {
            await insertNotification(idActivity, qra_owner, followers[i], datetime, band, mode, type, uuid_URL);
        }
    }

    function insertNotification(idActivity, qra_owner, follower, datetime, band, mode, type, uuid_URL) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=?, datetime=?, activ" +
                    "ity_type='10', qra=?,  qra_avatarpic=?, qso_band=?, qso_mode=?, qso_ty" +
                    "pe=?, qso_guid=?", [
                        follower.idqra,
                        idActivity,
                        datetime,
                        qra_owner.qra,
                        qra_owner.avatarpic,
                        band,
                        mode,
                        type,
                        uuid_URL
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
};

var mysql = require('mysql');
const uuidv4 = require('uuid/v4');
var AWS = require("aws-sdk");
var pinpoint = new AWS.Pinpoint({ "region": 'us-east-1' });
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
            let idnotif = await insertNotification(idActivity, qra_owner, followers[i], datetime, band, mode, type, uuid_URL);
            let qra_devices = await getDeviceInfo(followers[i].idqra);
            if (qra_devices)
                await sendPushNotification(qra_devices, qra_owner, datetime, band, mode, type, uuid_URL, idnotif);
        }
    }

    function getDeviceInfo(idqra) {
        console.log("getDeviceInfo " + idqra);
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT * FROM push_devices where qra=?", idqra, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    if (info.length > 0) {
                        resolve(JSON.parse(JSON.stringify(info)));
                    }
                    else {
                        resolve();
                    }
                });
        });
    }

    function insertNotification(idActivity, qra_owner, follower, datetime, band, mode, type, uuid_URL) {
        console.log("insertNotification");
        var date = new Date(datetime);
        let message;
        if (type === 'QSO')
            message = qra_owner.qra + " worked a QSO on Mode: " + mode + ' Band: ' + band + " QTR(UTC): " + date.getUTCHours() + ':' + date.getMinutes();
        if (type === 'LISTEN')
            message = qra_owner.qra + " listened a QSO on Mode: " + mode + ' Band: ' + band + " QTR(UTC): " + date.getUTCHours() + ':' + date.getMinutes();

        let final_url = url + "qso/" + uuid_URL;


        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=?, datetime=?, activ" +
                    "ity_type='10', qra=?,  qra_avatarpic=?, qso_band=?, qso_mode=?, qso_type=?, qso_" +
                    "guid=?, message=?, url=? ", [
                        follower.idqra,
                        idActivity,
                        datetime,
                        qra_owner.qra,
                        qra_owner.avatarpic,
                        band,
                        mode,
                        type,
                        uuid_URL,
                        message,
                        final_url

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
                .query("SELECT qra_followers.* from qra_followers WHERE qra_followers.idqra_followed = ?",
                    idqra_owner,
                    function(err, info) {
                        // Call reject on error states, call resolve with results
                        if (err) {
                            return reject(err);
                        }

                        resolve(JSON.parse(JSON.stringify(info)));
                    });
        });
    }
    async function sendPushNotification(qra_devices, qra_owner, datetime, band, mode, type, uuid_URL, idnotif) {
        console.log("sendPushNotification");
        var date = new Date(datetime);
        let channel;
        let title;
        if (type === 'QSO')
            title = qra_owner.qra + " worked a QSO";
        if (type === 'LISTEN')
            title = qra_owner.qra + " listened a QSO";
        let body = 'Mode: ' + mode + ' Band: ' + band + " QTR (UTC): " + date.getUTCHours() + ':' + date.getMinutes();
        let final_url = url + "qso/" + uuid_URL;
        let addresses = {};
        let notif = JSON.stringify(idnotif);
        for (let i = 0; i < qra_devices.length; i++) {

            qra_devices[i].device_type === 'androi ?d' ?
                channel = 'GC :M' :
                channel = 'APNS';

            addresses[qra_devices[i].token] = {
                ChannelType: channel
            };
            var params = {
                ApplicationId: 'b5a50c31fd004a20a1a2fe4f357c8e89',
                /* required */
                MessageRequest: { /* required */
                    Addresses: addresses,

                    MessageConfiguration: {

                        DefaultPushNotificationMessage: {
                            Action: 'URL',
                            Body: body,
                            Data: {
                                'QRA': qra_owner.qra,
                                'AVATAR': qra_owner.avatarpic,
                                'IDNOTIF': notif
                            },
                            // SilentPush: false,
                            Title: title,
                            Url: final_url
                        },
                        GCMMessage: {
                            Action: 'URL',
                            Body: body,
                            Data: {
                                'QRA': qra_owner.qra,
                                'AVATAR': qra_owner.avatarpic,
                                'IDNOTIF': notif
                            },
                            Title: title,
                            Url: final_url
                        }
                    },
                    // TraceId: 'STRING_VALUE'
                }
            };

            let status = await sendMessages(params);
            console.log(status);
            if (status !== 200) {
                await deleteDevice(qra_devices[i].token);

            }
        }
    }

    function deleteDevice(token) {
        console.log("deleteDevice");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query('DELETE FROM push_devices where token=?', token, function(err, info) {
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

    function sendMessages(params) {
        console.log("sendMessages");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            pinpoint
                .sendMessages(params, function(err, data) {

                    if (err)
                        return reject(err);


                    else {
                        var status = data.MessageResponse.Result[Object.keys(data.MessageResponse.Result)[0]].StatusCode;

                        resolve(status);
                    }
                });
        });

    }
};

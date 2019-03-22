var mysql = require('mysql');
var AWS = require("aws-sdk");
AWS.config.region = 'us-east-1';
var lambda = new AWS.Lambda();
const warmer = require('lambda-warmer');

exports.handler = async(event, context, callback) => {
    // if a warming event
    if (await warmer(event))
        return 'warmed';

    context.callbackWaitsForEmptyEventLoop = true;

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
    let addresses = {};
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
            conn.query("SELECT qras.idqras, qras.qra, qras.avatarpic, qsos.guid_URL, qsos.mode, qsos.band from qras inner join" +
                " qsos on qras.idqras = qsos.idqra_owner  where qsos.idqsos=? and qras.idcognito=?", [
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
        let idActivity;
        // let qsoNotifications = await getQSONotifications(idqso);
        for (var i = 0; i < qras.length; i++) {
            console.log(qras[i]);
            var qra = await getQra(qras[i]);
            if (!qra) {
                await qras_output.push({ qra: qras[i], url: null });
                idqra = await saveQra(qras[i]);
            }
            else {
                qras_output.push({ "qra": qra.qra, "url": qra.profilepic, "url_avatar": qra.avatarpic });
                idqra = qra.idqras;
            }
            console.log(idqra);

            await saveQraInQso(idqra, idqso);

            idActivity = await saveActivity(qra_owner.idqras, idqso, idqra, datetime);
            if (idActivity) {
                //Notify QRA added to the QSO
                await saveNotification(idActivity, idqra, qra_owner, datetime, qras[i], idqso, idqra);
                // if (!qsoNotifications.some(elem => elem.idqra === idqra)) {
                let qra_devices = await getDeviceInfo(idqra);
                if (qra_devices)
                    await sendPushNotification(qra_devices, qra_owner, idqso, idqra, qras[i], idActivity);
                // }
                //Notify Followers
                let followers = await getQRAFollowers(idqra);
                //if the follower is not a QRA nor following other QRAS nor following QSO_OWNER
                for (let j = 0; j < followers.length; j++) {
                    if ((idqra !== followers[j].idqra) && (qra_owner.idqras !== followers[j].idqra)) {
                        await saveNotification(idActivity, followers[j].idqra, qra_owner, datetime, qras[i], idqso, idqra);

                    }
                }
            }
        }
        if (Object.keys(addresses).length > 0) {
            await sendMessages(qra_owner, idActivity);
            addresses = {};
        }
        return qras_output;
    }

    function getQRAFollowers(idqras) {
        console.log("getQRAFollowers" + idqras);
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qra_followers.* from qra_followers WHERE qra_followers.idqra_followed = ?", idqras, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
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

    async function sendPushNotification(qra_devices, qra_owner, idqso, idqra, qras, idActivity) {
        console.log("sendPushNotification");
        let channel;

        for (let i = 0; i < qra_devices.length; i++) {

            qra_devices[i].device_type === 'android' ?
                channel = 'GCM' :
                channel = 'APNS';


            addresses[qra_devices[i].token] = {
                ChannelType: channel
            };


            if (Object.keys(addresses).length == 100) {
                await sendMessages(qra_owner, idActivity);
                addresses = {};
            }

        }

    }



    function sendMessages(qra_owner, idActivity) {
        console.log("sendMessages");
        let params;
        let title = qra_owner.qra + " included you on his new QSO";
        let body = "Mode: " + qra_owner.mode + " Band: " + qra_owner.band;
        let final_url = url + 'qso/' + qra_owner.guid_URL;
        let activ = JSON.stringify(idActivity);
        params = {
            ApplicationId: 'b5a50c31fd004a20a1a2fe4f357c8e89',
            /* required */
            MessageRequest: { /* required */
                Addresses: addresses,

                MessageConfiguration: {
                    APNSMessage: {
                        Body: body,
                        Title: title,
                        Action: 'OPEN_APP',
                        Url: final_url,
                        // SilentPush: false,
                        Data: {

                            'QRA': qra_owner.qra,
                            'AVATAR': qra_owner.avatarpic,
                            'IDACTIVITY': activ

                        }
                        // MediaUrl: qra_owner.avatarpic,

                    },

                    GCMMessage: {
                        Action: 'OPEN_APP',
                        Body: body,
                        Data: {

                            'QRA': qra_owner.qra,
                            'AVATAR': qra_owner.avatarpic,
                            'IDACTIVITY': activ

                        },
                        Title: title,
                        Url: final_url
                    }
                }
            }
        };

        //PUSH Notification

        let payload = {
            "body": {
                "source": "QsoQraAdd",
                "params": params
            },
            "stage-variables": {
                "db_host": event['stage-variables'].db_host,
                "db_user": event['stage-variables'].db_user,
                "db_password": event['stage-variables'].db_password,
                "db_database": event['stage-variables'].db_database
            }
        };


        let paramslambda = {
            FunctionName: 'PinpointSendMessages', // the lambda function we are going to invoke
            InvocationType: 'Event',
            LogType: 'None',
            Payload: JSON.stringify(payload)
        };

        lambda.invoke(paramslambda, function(err, data) {

            if (err) {
                console.log("lambda error");
                console.log(err);
            }

        });

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

    function saveNotification(idActivity, idqra, qra_owner, datetime, qra, idqso, idqra_added) {
        console.log("insertNotification" + idqra + " " + idqra_added + " " + qra);
        let message;
        if (idqra_added === idqra)
            message = qra_owner.qra + " included you on his new QSO";
        else
            message = qra_owner.qra + " included " + qra + " on his new QSO";
        let final_url = url + 'qso/' + qra_owner.guid_URL;
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=? , datetime=?, acti" +
                    "vity_type='12', qra=?,  qra_avatarpic=?, QSO_GUID=?, REF_QRA=?, message=?, url=?, idqsos=?" +
                    " ", [
                        idqra,
                        idActivity,
                        datetime,
                        qra_owner.qra,
                        qra_owner.avatarpic,
                        qra_owner.guid_URL,
                        qra,
                        message,
                        final_url,
                        idqso
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

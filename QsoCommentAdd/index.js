var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');
var AWS = require("aws-sdk");
var pinpoint = new AWS.Pinpoint({ "region": 'us-east-1' });


exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var payload;
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
    var comment = event.body.comment;
    var datetime = event.body.datetime;
    var sub = event.context.sub;

    //***********************************************************
    //   "stage-variables": {
    //     "db_host": "sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com",
    //     "db_user": "sqso",
    //     "db_password": "parquepatricios",
    //     "db_database": "sqso",
    //     "url": "http://d3cevjpdxmn966.cloudfront.net/"
    //   }
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
        let qra_owner = await checkQraCognito(sub);
        if (!qra_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }
        let insertId = await insertComment(idqso, qra_owner.idqras, datetime, comment);
        if (insertId) {
            let qso = await getQsoInfo(idqso);
            console.log("saveActivity");
            let idActivity = await saveActivity(qra_owner.idqras, qso, insertId, datetime);
            if (idActivity) {
                console.log("getFollowing Me");
                let followers = await getFollowingMe(qra_owner.idqras);
                console.log("Get Stakeholders of QSO");
                let stakeholders = await getQsoStakeholders(idqso, qra_owner.idqras);
                console.log("get Other Comment Writters");
                let commentWriters = await getQsoCommentWriters(idqso, qra_owner.idqras);
                console.log("createNotifications");
                await createNotifications(idActivity, followers, stakeholders, commentWriters, qra_owner, qso, datetime);
            }
            await UpdateCommentCounterInQso(idqso);

            let info = await getComments(idqso);
            if (info) {
                conn.destroy();
                response.body.error = 0;
                response.body.message = info;
                console.log("new comment ");
                return callback(null, response);
            }
        }
    }
    catch (e) {
        console.log("Error executing QRA Comment Add");
        console.log(e);
        conn.destroy();
        callback(e.message);
        var msg = {
            "error": 1,
            "message": e.message
        };
        return context.fail(msg);
    }

    function UpdateCommentCounterInQso(qso) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateCommentCounterInQso" + qso);
            //***********************************************************
            conn.query('UPDATE sqso.qsos SET comments_counter = comments_counter+1  WHERE idqsos=?', qso, function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }

    function insertComment(idqsos, idqras, datetime, comment) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("insertComment");
            conn.query('INSERT INTO qsos_comments SET idqso = ?, idqra=?, datetime=?, comment=?', [
                idqsos, idqras, datetime, comment
            ], function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)).insertId);
            });
        });
    }

    function checkQraCognito(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito" + sub);
            conn.query("SELECT qras.idqras, qras.qra, qras.avatarpic FROM qras where idcognito=? LIMIT 1", sub, function(err, info) {
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

    function getQsoInfo(idqsos) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito" + idqsos);
            conn.query("SELECT qsos.idqsos, qsos.guid_URL, qras.qra FROM qsos inner join qras on qras.id" +
                "qras = qsos.idqra_owner where idqsos=? ", idqsos,
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

    function getComments(qso) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getComments" + qso);
            conn.query("SELECT qsos_comments.*, qras.qra FROM qsos_comments inner join qras on qsos_comm" +
                "ents.idqra = qras.idqras where  idqso=?",
                qso,
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }

    function saveActivity(idqras, idqsos, idcomment, datetime) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("INSERT INTO qra_activities SET idqra = ?, activity_type='18', ref_idqso=?, ref_i" +
                    "dqso_comment=?, datetime=?", [
                        idqras, idqsos.idqsos, idcomment, datetime
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
    async function createNotifications(idActivity, followers, stakeholders, commentWriters, qra_owner, qso, datetime) {

        for (let i = 0; i < followers.length; i++) {
            await insertNotification(idActivity, followers[i].idqra, qra_owner, qso, datetime);
        }

        for (let i = 0; i < stakeholders.length; i++) {
            if (!followers.some(elem => elem.idqra === stakeholders[i].idqra)) {
                await insertNotification(idActivity, stakeholders[i].idqra, qra_owner, qso, datetime);
                let qra_devices = await getDeviceInfo(stakeholders[i].idqra);
                if (qra_devices)
                    await sendPushNotification(qra_devices, qra_owner);
            }
        }

        for (let i = 0; i < commentWriters.length; i++) {
            if (!followers.some(elem => elem.idqra === commentWriters[i].idqra) && !stakeholders.some(elem => elem.idqra === commentWriters[i].idqra)) {

                await insertNotification(idActivity, commentWriters[i].idqra, qra_owner, qso, datetime);
                let qra_devices = await getDeviceInfo(commentWriters[i].idqra);
                if (qra_devices)
                    await sendPushNotification(qra_devices, qra_owner);
            }
        }
    }

    function insertNotification(idActivity, idqra, qra_owner, qso, datetime) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=? , datetime=?, acti" +
                    "vity_type='18', qra=?,  qra_avatarpic=?, QSO_GUID=?, REF_QRA=? ", [
                        idqra,
                        idActivity,
                        datetime,
                        qra_owner.qra,
                        qra_owner.avatarpic,
                        qso.guid_URL,
                        qso.qra
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

    function getQsoStakeholders(idqso, idqraCommentOwner) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("Select distinct idqra from qsos_qras where idqso=? and idqra!=?", [
                    idqso, idqraCommentOwner
                ], function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });

    }

    function getQsoCommentWriters(idqso, idqraCommentOwner) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("Select distinct idqra from qsos_comments where idqso=? and idqra!=?", [
                    idqso, idqraCommentOwner
                ], function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });

    }

    function getDeviceInfo(idqra) {
        console.log("getDeviceInfo" + idqra);
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getDeviceInfo");
            conn.query("SELECT * FROM push_devices where qra=?", idqra, function(err, info) {
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

    async function sendPushNotification(qra_devices, qra_owner, idqso, idqra, qra) {
        console.log("sendPushNotification");
        let channel;
        let title = qra_owner.qra + " commented a QSO you have participated";
        let final_url = "http://d3cevjpdxmn966.cloudfront.net/qso/" + qra_owner.guid_URL;
        let addresses = {};
        console.log(qra_devices);
        for (let i = 0; i < qra_devices.length; i++) {

            qra_devices[i].device_type === 'android' ?
                channel = 'GCM' :
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
                            Body: title,
                            Data: {

                                /*
                                               '<__string>': ... */
                            },
                            SilentPush: false,
                            Title: title,
                            Url: final_url
                        },
                        GCMMessage: {
                            Action: 'URL',
                            Body: title,
                            CollapseKey: 'STRING_VALUE',

                            // IconReference: 'STRING_VALUE',
                            ImageIconUrl: qra_owner.avatarpic,
                            ImageUrl: qra_owner.avatarpic,
                            // Priority: 'STRING_VALUE', RawContent: 'STRING_VALUE', RestrictedPackageName:
                            // 'STRING_VALUE',
                            SilentPush: false,
                            SmallImageIconUrl: qra_owner.avatarpic,
                            Sound: 'STRING_VALUE',
                            // Substitutions: {//     '<__string>': [         'STRING_VALUE',         /*
                            // more items */     ],     /* '<__string>': ... */ }, TimeToLive: 10,
                            Title: title,
                            Url: final_url
                        }
                    },
                    TraceId: 'STRING_VALUE'
                }
            };

            await sendMessages(params);
        }
    }

    function sendMessages(params) {
        console.log("sendMessages");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            pinpoint.sendMessages(params, function(err, data) {

                console.log(data.MessageResponse.Result[Object.keys(data.MessageResponse.Result)[0]]);
                if (err)
                    return reject(err);

                else
                    resolve(data.MessageResponse.Result);

            });
        });

    }
};

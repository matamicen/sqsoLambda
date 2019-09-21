var mysql = require("mysql");
var AWS = require("aws-sdk");
AWS.config.region = "us-east-1";
var lambda = new AWS.Lambda();

const warmer = require("lambda-warmer");

exports.handler = async(event, context, callback) => {
    // if a warming event
    if (await warmer(event)) return "warmed";

    context.callbackWaitsForEmptyEventLoop = false;

    var response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
        },
        body: {
            error: null,
            message: null
        }
    };
    console.log(event);
    var idqso = event.body.qso;
    var sub = event.context.sub;
    var datetime = new Date();
    let qrasAll = [];
    let final_url;
    let notifs = [];
    if (!event["stage-variables"]) {
        console.log("Stage Variables Missing");
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }
    var url = event["stage-variables"].url;
    var conn = await mysql.createConnection({
        host: event["stage-variables"].db_host, // give your RDS endpoint  here
        user: event["stage-variables"].db_user, // Enter your  MySQL username
        password: event["stage-variables"].db_password, // Enter your  MySQL password
        database: event["stage-variables"].db_database // Enter your  MySQL database name.
    });
    let addresses = {};
    try {
        let qra_owner = await checkQraCognito(sub);
        if (!qra_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }

        let likes = await getLikes(idqso);
        let found = likes.find(o => o.idqra === qra_owner.idqras);
        if (found) {
            console.log("QSO " + idqso + " already liked by " + qra_owner.idqras);
            //like already exist => do not insert again
            response.body.error = 400;
            response.body.message = likes.length;
            return callback(null, response);
        }

        let info = await insertLike(qra_owner.idqras, idqso);

        if (info) {
            let qso = await getQsoInfo(idqso);
            let idActivity = await saveActivity(qra_owner.idqras, idqso, datetime);
            if (idActivity) {
                let qras;
                qras = await getQsoStakeholders(idqso);
                console.log("Get Stakeholders of QSO: " + qras.length);
                final_url = url + "qso/" + qso.guid_URL;
                let message = qra_owner.qra + " liked a QSO you are participating";
                for (let i = 0; i < qras.length; i++) {
                    if (!qrasAll.some(elem => elem.idqra === qras[i].idqra) &&
                        qras[i].idqra !== qra_owner.idqras
                    ) {
                        notifs.push([
                            idActivity, //idActivity
                            qras[i].idqra, //idqra
                            qra_owner.qra, //qra
                            qra_owner.avatarpic, //qra_avatarpic
                            qso.guid_URL, //qso_guid
                            qso.qra, //ref_qra
                            datetime, //datetime
                            message, //message
                            final_url, //url
                            idqso, //idqsos
                            23 //activity_type
                        ]);
                        qrasAll.push({ idqra: qras[i].idqra });
                        let qra_devices = await getDeviceInfo(qras[i].idqra, qras[i].qra);

                        if (qra_devices)
                            await sendPushNotification(
                                qra_devices,
                                qra_owner,
                                qso,
                                idActivity
                            );
                    }
                }
                if (Object.keys(addresses).length > 0) {
                    await sendMessages(qra_owner, qso, idActivity);
                    addresses = {};
                }
                console.log("getFollowing Me " + qra_owner.idqras);
                qras = await getFollowingMe(qra_owner.idqras);
                qrasAll = await createNotifications(
                    idActivity,
                    qrasAll,
                    qras,
                    qra_owner,
                    qso,
                    datetime
                );
                await insertNotifications(notifs);
            }
            await UpdateLikesCounterInQso(idqso);

            conn.destroy();
            response.body.error = 0;
            response.body.message = likes.length + 1;
            return callback(null, response);
        }
    }
    catch (e) {
        console.log("Error executing QSO Likes Add");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = e.message;
        return callback(null, response);
    }

    function getDeviceInfo(idqra, qra) {
        console.log("getDeviceInfo " + idqra + " " + qra);
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn.query("SELECT * FROM push_devices where qra=?", idqra, function(
                err,
                info
            ) {
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

    function getQsoInfo(idqsos) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQsoInfo " + idqsos);
            conn.query(
                "SELECT qsos.idqsos, qsos.guid_URL, qras.qra FROM qsos inner join qras on qras.id" +
                "qras = qsos.idqra_owner where idqsos=? ",
                idqsos,
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
                }
            );
        });
    }

    function UpdateLikesCounterInQso(qso) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateLikesCounterInQso");
            conn.query(
                "UPDATE sqso.qsos SET likes_counter = likes_counter+1  WHERE idqsos=?",
                qso,
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    // console.log(info);
                }
            );
        });
    }

    function checkQraCognito(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito");
            conn.query(
                "SELECT qras.idqras, qras.qra, qras.avatarpic FROM qras where idcognito=? LIMIT 1",
                sub,
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0]);
                }
            );
        });
    }

    function getLikes(qso) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQsoAlreadyLiked");
            conn.query("SELECT * from qsos_likes WHERE idqso = ?", [qso], function(
                err,
                info
            ) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }

    function insertLike(idqra_owner, qso) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("insertLike: " + qso + " " + idqra_owner);
            conn.query(
                "INSERT INTO qsos_likes SET idqso = ?, idqra=?, timestamp=NOW()", [qso, idqra_owner],
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                }
            );
        });
    }

    function saveActivity(idqras_owner, newqso, datetime) {
        console.log("saveActivity");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn.query(
                "INSERT INTO qra_activities SET idqra = ?, activity_type='23', ref_idqso=?, datet" +
                "ime=?", [idqras_owner, newqso, datetime],
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                }
            );
        });
    }

    function getQsoStakeholders(idqso) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn.query(
                "Select distinct q.idqra, r.qra from qsos_qras as q inner join qras as r on q.idq" +
                "ra = r.idqras where q.idqso=?",
                idqso,
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                }
            );
        });
    }
    async function createNotifications(
        idActivity,
        qrasAll,
        qras,
        qra_owner,
        qso,
        datetime
    ) {
        let message = qra_owner.qra + " liked a QSO created by " + qso.qra;
        console.log("createNotifications");
        final_url = url + "qso/" + qso.guid_URL;
        for (let i = 0; i < qras.length; i++) {
            if (!qrasAll.some(elem => elem.idqra === qras[i].idqra) &&
                qras[i].idqra !== qra_owner.idqras
            ) {
                notifs.push([
                    idActivity, //idActivity
                    qras[i].idqra, //idqra
                    qra_owner.qra, //qra
                    qra_owner.avatarpic, //qra_avatarpic
                    qso.guid_URL, //qso_guid
                    qso.qra, //ref_qra
                    datetime, //datetime
                    message, //message
                    final_url, //url
                    idqso, //idqsos
                    23 //activity_type
                ]);
                qrasAll.push({ idqra: qras[i].idqra });
            }
        }
        return qrasAll;
    }

    function insertNotifications(notifs) {
        console.log("insertNotifications " + notifs.length);
        return new Promise(function(resolve, reject) {
            conn.query(
                "INSERT INTO qra_notifications (idqra_activity, idqra, qra, qra_avatarpic, QSO_GUID, REF_QRA, datetime, " +
                "message, url, idqsos, activity_type) VALUES ?", [notifs],
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err); //TODO mandar a sentry
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                }
            );
        });
    }

    function getFollowingMe(idqra_owner) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn.query(
                "SELECT f.*, r.qra from qra_followers as f inner join qras as r on f.idqra_follow" +
                "ed = r.idqras  WHERE f.idqra_followed = ?",
                idqra_owner,
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                }
            );
        });
    }
    async function sendPushNotification(qra_devices, qra_owner, qso, idActivity) {
        console.log("sendPushNotification " + qra_devices.length);
        let channel;

        for (let i = 0; i < qra_devices.length; i++) {
            qra_devices[i].device_type === "android" ?
                (channel = "GCM") :
                (channel = "APNS");

            addresses[qra_devices[i].token] = {
                ChannelType: channel
            };

            if (Object.keys(addresses).length == 100) {
                await sendMessages(qra_owner, qso, idActivity);
                addresses = {};
            }
        }
    }

    async function sendMessages(qra_owner, qso, idActivity) {
        context.callbackWaitsForEmptyEventLoop = true;

        console.log("sendMessages");
        let title = qra_owner.qra + " liked a QSO you are participating";
        let final_url = url + "qso/" + qso.guid_URL;
        let appId = event["stage-variables"].pinpointAppId;

        let activ = JSON.stringify(idActivity);
        var params = {
            ApplicationId: appId,
            /* required */
            MessageRequest: {
                /* required */
                Addresses: addresses,

                MessageConfiguration: {
                    APNSMessage: {
                        Body: "Click to see the QSO ",
                        Title: title,
                        Action: "OPEN_APP",
                        Url: final_url,
                        // SilentPush: false,
                        Data: {
                            QRA: qra_owner.qra,
                            AVATAR: qra_owner.avatarpic,
                            IDACTIVITY: activ
                        }
                        // MediaUrl: qra_owner.avatarpic
                    },
                    GCMMessage: {
                        Action: "OPEN_APP",
                        Body: "Click to see the QSO ",
                        Data: {
                            QRA: qra_owner.qra,
                            AVATAR: qra_owner.avatarpic,
                            IDACTIVITY: activ,
                            URL: final_url
                        },

                        Title: title,
                        Url: final_url
                    }
                }
            }
        };
        //PUSH Notification

        let payload = {
            body: {
                source: "QsoLikeAdd",
                params: params
            },
            "stage-variables": {
                db_host: event["stage-variables"].db_host,
                db_user: event["stage-variables"].db_user,
                db_password: event["stage-variables"].db_password,
                db_database: event["stage-variables"].db_database
            }
        };

        let paramslambda = {
            FunctionName: "PinpointSendMessages", // the lambda function we are going to invoke
            InvocationType: "Event",
            LogType: "None",
            Payload: JSON.stringify(payload)
        };
        console.log("invoke Lambda");

        lambda.invoke(paramslambda, function(err, data) {
            if (err) {
                console.log("lambda error");
                console.log(err);
            }
        });
    }
};

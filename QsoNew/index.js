var mysql = require("mysql");
const uuidv4 = require("uuid/v4");
var AWS = require("aws-sdk");
AWS.config.region = "us-east-1";
var lambda = new AWS.Lambda();

var warmer = require("lambda-warmer");

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

    console.log("QSOnew");
    let mode = event.body.mode;
    let band = event.body.band;
    let latitude = event.body.latitude;
    let longitude = event.body.longitude;
    let datetime = event.body.datetime;
    let type = event.body.type;
    let sub = event.context.sub;
    let uuid_QR = uuidv4();

    let uuid_URL = uuidv4();
    let addresses = {};

    //***********************************************************
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
    try {
        let qra_owner = await getQRA(sub);
        if (!qra_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }
        let newqso = await saveQSO(
            qra_owner.idqras,
            mode,
            band,
            datetime,
            type,
            longitude,
            latitude
        );

        let followers = await getFollowingMe(qra_owner.idqras);

        let idActivity = await saveActivity(qra_owner, newqso, datetime);
        if (idActivity) {
            await createNotifications(
                idActivity,
                qra_owner,
                followers,
                datetime,
                band,
                mode,
                type,
                uuid_URL,
                newqso
            );
        }
        await UpdateQsosCounterInQra(qra_owner.idqras);
        var info = await saveQRA(newqso, qra_owner.idqras);

        if (info.insertId) {
            await updateMonthlyCounterInQra(sub);
            conn.destroy();
            response.body.error = 0;
            response.body.message = {
                newqso: newqso,
                monthly_qso_new: qra_owner.monthly_qso_new + 1
            };
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
        console.log("getQra");
        return new Promise(function(resolve, reject) {
           conn.query(
                "SELECT idqras, qra, avatarpic, monthly_qso_new FROM qras where idcognito=? LIMIT" +
                " 1",
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

    function saveQSO(idqras, mode, band, datetime, type, longitude, latitude) {
        console.log("saveQSO");
        return new Promise(function(resolve, reject) {
            let location = "POINT(" + longitude + " " + latitude + ")";
            conn.query(
                "INSERT INTO qsos  SET idqra_owner=?, location = GeomFromText(?), mode = ?, band " +
                "= ?, datetime = ?, type = ?, GUID_QR = ?, GUID_URL = ?", [idqras, location, mode, band, datetime, type, uuid_QR, uuid_URL],
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                    // console.log(info);
                }
            );
        });
    }

    function saveQRA(newqso, idqras) {
        return new Promise(function(resolve, reject) {
           let post = {
                idqso: newqso,
                idqra: idqras,
                isOwner: true
            };

            //***********************************************************
            conn.query("INSERT INTO qsos_qras SET ?", post, function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }

    function updateMonthlyCounterInQra(sub) {
        return new Promise(function(resolve, reject) {
           conn.query(
                "UPDATE sqso.qras SET monthly_qso_new = monthly_qso_new+1  WHERE idcognito=?",
                sub,
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

    function UpdateQsosCounterInQra(idqras) {
        return new Promise(function(resolve, reject) {
            conn.query(
                "UPDATE sqso.qras SET qsos_counter = qsos_counter+1, last_created_qso=NOW() WHERE" +
                " idqras=?",
                idqras,
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

    function saveActivity(qra_owner, newqso, datetime) {
        console.log("saveActivity");
        return new Promise(function(resolve, reject) {
             conn.query(
                "INSERT INTO qra_activities SET idqra = ?, activity_type='10', ref_idqso=?, datet" +
                "ime=?", [qra_owner.idqras, newqso, datetime],
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
    async function createNotifications(
        idActivity,
        qra_owner,
        followers,
        datetime,
        band,
        mode,
        type,
        uuid_URL,
        idqsos
    ) {
        console.log("createNotifications: " + followers.length);
        let channel;
        let notif = [];
        var date = new Date(datetime);
        let message;

        let final_url = url + "qso/" + uuid_URL;
        for (let i = 0; i < followers.length; i++) {
           
            if (type === "QSO")
                message =
                qra_owner.qra +
                " worked a QSO on Mode: " +
                mode +
                " Band: " +
                band +
                " QTR(UTC): " +
                date.getUTCHours() +
                ":" +
                date.getMinutes();
            if (type === "LISTEN")
                message =
                qra_owner.qra +
                " listened a QSO on Mode: " +
                mode +
                " Band: " +
                band +
                " QTR(UTC): " +
                date.getUTCHours() +
                ":" +
                date.getMinutes();

            notif.push([
                idActivity, //idActivity
                followers[i].idqra, //idqra
                qra_owner.qra, //qra
                qra_owner.avatarpic, //qra_avatarpic
                uuid_URL, //qso_guid
                datetime, //datetime
                message, //message
                final_url, //url
                idqsos, //idqsos
                band,
                mode,
                type,
                10 //activity_type
            ]);
            let qra_devices = await getDeviceInfo(followers[i].idqra);
            if (qra_devices) {
                 console.log("getDeviceInfo " + followers[i].idqra + " : " + qra_devices.length);
                for (let i = 0; i < qra_devices.length; i++) {
                    qra_devices[i].device_type === "android" ?
                        (channel = "GCM") :
                        (channel = "APNS");
                    addresses[qra_devices[i].token] = {
                        ChannelType: channel
                    };

                    if (Object.keys(addresses).length == 100) {
                        await sendPushNotification(
                            qra_owner,
                            datetime,
                            band,
                            mode,
                            type,
                            uuid_URL,
                            idActivity
                        );
                        addresses = {};
                    }
                }
            }
        }
        await insertNotifications(notif);
        if (Object.keys(addresses).length > 0) {
            await sendPushNotification(
                qra_owner,
                datetime,
                band,
                mode,
                type,
                uuid_URL,
                idActivity
            );
            addresses = {};
        }
    }

    function getDeviceInfo(idqra) {
       
        return new Promise(function(resolve, reject) {
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

    function insertNotifications(notifs) {
        console.log("insertNotifications " + notifs.length);

        return new Promise(function(resolve, reject) {
          
            conn.query(
                "INSERT INTO qra_notifications (idqra_activity, idqra, qra, qra_avatarpic, QSO_GUID, datetime, " +
                "message, url, idqsos, qso_band, qso_mode, qso_type,  activity_type) VALUES ?", [notifs],
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
        console.log("getFollowingMe: " + idqra_owner);
        return new Promise(function(resolve, reject) {
           
            conn.query(
                "SELECT qra_followers.* from qra_followers WHERE qra_followers.idqra_followed = ?",
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
    async function sendPushNotification(
        qra_owner,
        datetime,
        band,
        mode,
        type,
        uuid_URL,
        idActivity
    ) {
        console.log("sendPushNotification");
        context.callbackWaitsForEmptyEventLoop = true;

        var date = new Date(datetime);

        let title;
        if (type === "QSO") title = qra_owner.qra + " worked a QSO";
        if (type === "LISTEN") title = qra_owner.qra + " listened a QSO";
        let body =
            "Mode: " +
            mode +
            " Band: " +
            band +
            " QTR (UTC): " +
            date.getUTCHours() +
            ":" +
            date.getMinutes();
        let final_url = url + "qso/" + uuid_URL;
        let idAct = JSON.stringify(idActivity);
        let appId = event["stage-variables"].pinpointAppId;

        var params = {
            ApplicationId: appId,
            /* required */
            MessageRequest: {
                /* required */
                Addresses: addresses,

                MessageConfiguration: {
                    APNSMessage: {
                        Body: title,
                        Title: title,
                        Action: "OPEN_APP",
                        Url: final_url,
                        // SilentPush: false,
                        Data: {
                            QRA: qra_owner.qra,
                            AVATAR: qra_owner.avatarpic,
                            IDACTIVITY: idAct
                        }
                        // MediaUrl: qra_owner.avatarpic
                    },
                    GCMMessage: {
                        Action: "OPEN_APP",
                        Body: body,
                        Data: {
                            QRA: qra_owner.qra,
                            AVATAR: qra_owner.avatarpic,
                            IDACTIVITY: idAct,
                            URL: final_url
                        },
                        Title: title,
                        Url: final_url
                    }
                }
                // TraceId: 'STRING_VALUE'
            }
        };

        //PUSH Notification

        let payload = {
            body: {
                source: "QsoNEW",
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

        lambda.invoke(paramslambda, function(err, data) {
            // console.log("lambda");
            if (err) {
                console.log("error");
                // console.log(err);
            }
            // else { console.log(data.Payload); }
        });
    }
};

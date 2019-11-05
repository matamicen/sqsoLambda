var mysql = require("mysql");
var AWS = require("aws-sdk");
AWS.config.region = "us-east-1";
var lambda = new AWS.Lambda();
const warmer = require("lambda-warmer");

exports.handler = async(event, context, callback) => {
    // if a warming event
    if (await warmer(event)) return "warmed";

    context.callbackWaitsForEmptyEventLoop = false;

    var qsos_rel = [];

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

    var idqso = event.body.qso;
    console.log("qso " + idqso);
    qsos_rel = event.body.qsos_rel;
    console.log(qsos_rel);

    var sub = event.context.sub;
    var datetime = new Date();
    let addresses = {};
    let notif = [];

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
        let qra_owner = await checkOwnerInQso(idqso, sub);
        console.log("owner " + qra_owner.idqras);
        if (!qra_owner) {
            console.log("Caller is not QSO Owner");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "You are not the Owner of the main QSO";

            return callback(null, response);
        }

        let qso = await getQsoInfo(idqso);
        let info = await addQSOlinks(idqso, qsos_rel, qra_owner, datetime, qso);
        
        if (info.affectedRows) {
            await UpdateLinksInQso(idqso, qsos_rel.length);
            await UpdateLinksInQraOwner(qra_owner.idqras, qsos_rel.length);
            console.log("QSOLink Added");
            response.body.error = 0;
            response.body.message = {
                info: info,
                monthly_links: qra_owner.monthly_links + 1,
                monthly_scans: qra_owner.monthly_scans
            };

            return response;
        }
        else {
            console.log("QSOLink Already exist");
            response.body.error = 1;
            response.body.message = "QSOLink Already exist";

            return callback(null, response);
        }
    }
    catch (e) {
        console.log("Error executing Qso link add");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e;

        return callback(null, response);
    }

    function getQsoInfo(idqsos) {
        console.log("getQsoInfo " + idqsos);
        return new Promise(function(resolve, reject) {
            conn.query(
                "SELECT qsos.idqsos, idqra_owner, qsos.guid_URL, qras.qra FROM qsos inner join qr" +
                "as on qras.idqras = qsos.idqra_owner where idqsos=? ",
                idqsos,
                function(err, info) {
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

    function checkOwnerInQso(idqso, sub) {
        console.log("checkOwnerInQso " + idqso + " " + sub);
        return new Promise(function(resolve, reject) {
            conn.query(
                "SELECT qras.idqras, qras.qra, qras.avatarpic, qsos.guid_URL, monthly_links, mont" +
                "hly_scans from qras inner join qsos on qras.idqras = qsos.idqra_owner where qsos" +
                ".idqsos=? and qras.idcognito=?", [idqso, sub],
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
    async function addQSOlinks(idqso, qsos_rel, qra_owner, datetime, qso) {
        console.log("addQSOlink " + idqso);
        let info;
        let qrasAll = [];
        let stakeholders;
        let final_url = url + "qso/" + qso.guid_URL;
        let message;
        let idActivity;


        for (let i = 0; i < qsos_rel.length; i++) {
            console.log("--------------------" + qsos_rel[i].qso);
            info = await checkQSOlink(idqso, qsos_rel[i].qso);
            if (info.length > 0) {
                return info;
            }
            if (!idActivity) {
                idActivity = await saveActivity(qra_owner.idqras, idqso, datetime);
            }
            info = await addQSOlink(idqso, qsos_rel[i].qso);
            info.affectedRows = 1;

            stakeholders = await getQsoStakeholders(qsos_rel[i].qso);
            console.log("QSO Linked Stakeholders: " + qsos_rel[i].qso + " " + stakeholders.length);
            let qso_rel = await getQsoInfo(qsos_rel[i].qso);

            for (let j = 0; j < stakeholders.length; j++) {
                if (!qrasAll.some(elem => elem.idqra === stakeholders[j].idqra) &&
                    stakeholders[j].idqra !== qra_owner.idqras
                ) {
                    console.log("-------" + stakeholders[j].idqra);

                    
                    if (qso_rel.qra === stakeholders[j].qra)
                        message =
                        qra_owner.qra + " linked a QSO with another created by you ";
                    else
                        message =
                        qra_owner.qra +
                        " linked a QSO with another you are participating ";
                    notif.push([
                        idActivity, //idActivity
                        stakeholders[j].idqra, //idqra
                        qra_owner.qra, //qra
                        qra_owner.avatarpic, //qra_avatarpic
                        qso.guid_URL, //qso_guid
                        qso_rel.qra, //ref_qra
                        datetime, //datetime
                        message, //message
                        final_url, //url
                        idqso, //idqsos
                        20 //activity_type
                    ]);
                    qrasAll.push({ idqra: stakeholders[j].idqra });
                    let qra_devices = await getDeviceInfo(
                        stakeholders[j].idqra,
                        stakeholders[j].qra
                    );

                    if (qra_devices)
                        await sendPushNotification(qra_devices, qra_owner, qso, idActivity);
                }
            }

            //Inform Followers of QRA REL OWNER
            let followingMe = await getFollowingQRA(qso_rel.idqra_owner);
            console.log("following me: " + followingMe.length);
            qrasAll = await createNotifications(
                idActivity,
                qrasAll,
                followingMe,
                qra_owner,
                datetime,
                qso,
                qso_rel.qra
            );
        }
        if (idActivity) {

            stakeholders = await getQsoStakeholders(idqso);
            console.log("QSO Origin Stakeholders: " + stakeholders.length);
            for (let j = 0; j < stakeholders.length; j++) {

                if (!qrasAll.some(elem => elem.idqra === stakeholders[j].idqra) &&
                    stakeholders[j].idqra !== qra_owner.idqras
                ) {
                    console.log("-------" + stakeholders[j].idqra);
                    
                    message =
                        qra_owner.qra + " linked a QSO with another you are participating";
                    notif.push([
                        idActivity, //idActivity
                        stakeholders[j].idqra, //idqra
                        qra_owner.qra, //qra
                        qra_owner.avatarpic, //qra_avatarpic
                        qso.guid_URL, //qso_guid
                        stakeholders[j].qra, //ref_qra
                        datetime, //datetime
                        message, //message
                        final_url, //url
                        idqso, //idqsos
                        20 //activity_type
                    ]);
                    qrasAll.push({ idqra: stakeholders[j].idqra });
                    let qra_devices = await getDeviceInfo(stakeholders[j].idqra, stakeholders[j].qra);

                    if (qra_devices)
                        await sendPushNotification(qra_devices, qra_owner, qso);
                }
            }
            if (Object.keys(addresses).length > 0) {
                await sendMessages(qra_owner, qso, idActivity);
                addresses = {};
            }

            let followingMe = await getFollowingQRA(qra_owner.idqras);
            qrasAll = await createNotifications(
                idActivity,
                qrasAll,
                followingMe,
                qra_owner,
                datetime,
                qso
            );
            await insertNotifications(notif);
            return info;
        }
    }

    function checkQSOlink(qso, idqso_rel) {
        console.log("CheckQSOlink " + qso + " " + idqso_rel);
        return new Promise(function(resolve, reject) {


            conn.query(
                "SELECT * FROM qsos_links where idqso=? and idqso_Rel=?", [qso, idqso_rel],
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    else {
                        resolve(JSON.parse(JSON.stringify(info)));
                    }
                    // console.log(info);
                }
            );
        });
    }

    function addQSOlink(qso, idqso_rel) {
        console.log("addQSOlink " + qso + " " + idqso_rel);
        return new Promise(function(resolve, reject) {


            conn.query(
                "INSERT INTO qsos_links SET idqso=?, idqso_rel=?, datetime=NOW()", [qso, idqso_rel],
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    else {
                        resolve(JSON.parse(JSON.stringify(info)));
                    }
                    // console.log(info);
                }
            );
        });
    }

    function UpdateLinksInQso(qso, counter) {
        console.log("UpdateLinksInQso " + qso + " counter " + counter);
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn.query(
                "UPDATE sqso.qsos SET links_counter = links_counter+? WHERE idqsos=?", [counter, qso],
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

    function UpdateLinksInQraOwner(idqras, counter) {
        console.log("UpdateLinksInQraOwner " + idqras + " counter " + counter);
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn.query(
                "UPDATE sqso.qras SET links_created = qsos_counter+?, monthly_links = monthly_lin" +
                "ks+? WHERE idqras=?", [counter, counter, idqras],
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

    function getFollowingQRA(idqra_owner) {
        console.log("getFollowingQRA_Owner " + idqra_owner);
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn.query(
                "SELECT f.*, q.qra from qra_followers as f inner join qras as q on f.idqra_follow" +
                "ed = q.idqras WHERE f.idqra_followed = ?",
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

    function getQsoStakeholders(idqso) {
        console.log("getQsoStakeholders " + idqso);
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn.query(
                "Select distinct idqra, q.qra from qsos_qras as qs inner join qras as q on qs.idq" +
                "ra = q.idqras  where idqso=?",
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

    function saveActivity(idqras_owner, newqso, datetime) {
        console.log("SaveActivity" + newqso);

        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn.query(
                "INSERT INTO qra_activities SET idqra = ?, activity_type='20', ref_idqso=?, datet" +
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
    async function createNotifications(
        idActivity,
        qrasAll,
        qras,
        qra_owner,
        datetime,
        qso,
        qso_rel_qra
    ) {
        let final_url = url + "qso/" + qso.guid_URL;
        let message;
        for (let i = 0; i < qras.length; i++) {
            if (!qrasAll.some(elem => elem.idqra === qras[i].idqra) &&
                qras[i].idqra !== qra_owner.idqras
            ) {
                

                if (qso_rel_qra === qras.qra)
                    message =
                    qra_owner.qra + " linked a QSO with another you are participating ";
                else message = qra_owner.qra + " linked a QSO";

                notif.push([
                    idActivity, //idActivity
                    qras[i].idqra, //idqra
                    qra_owner.qra, //qra
                    qra_owner.avatarpic, //qra_avatarpic
                    qso.guid_URL, //qso_guid
                    qso_rel_qra, //ref_qra
                    datetime, //datetime
                    message, //message
                    final_url, //url
                    idqso, //idqsos
                    20 //activity_type
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
   

    function getDeviceInfo(idqra, qra) {
        console.log("getDeviceInfo " + idqra + " " + qra);
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

    function sendPushNotification(qra_devices, qra_owner, qso, idActivity) {
        console.log("sendPushNotification " + qra_devices.length);
        let channel;
        context.callbackWaitsForEmptyEventLoop = true;

        for (let i = 0; i < qra_devices.length; i++) {
            qra_devices[i].device_type === "android" ?
                (channel = "GCM") :
                (channel = "APNS");

            addresses[qra_devices[i].token] = {
                ChannelType: channel
            };

            if (Object.keys(addresses).length == 100) {
                sendMessages(qra_owner, qso, idActivity);
                addresses = {};
            }
        }
    }

    function sendMessages(qra_owner, qso, idActivity) {
        console.log("sendMessages");
        let title = qra_owner.qra + " linked a QSO you are participating";
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
                source: "QsoLinkAdd",
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
            if (err) {
                console.log("lambda error");
                console.log(err);
            }
        });
    }
};

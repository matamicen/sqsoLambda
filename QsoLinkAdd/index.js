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

    var idqso = event.body.qso;
    qsos_rel = event.body.qsos_rel;
    var sub = event.context.sub;
    var datetime = new Date();
    let addresses = {};

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
            response.body.message = "You are not the Owner of the main QSO";

            return callback(null, response);
        }

        await UpdateLinksInQso(idqso, qsos_rel.length);
        await UpdateLinksInQraOwner(qra_owner.idqras, qsos_rel.length);
        let qso = await getQsoInfo(idqso);
        let info = await addQSOlinks(idqso, qsos_rel, qra_owner, datetime, qso);
        if (info.affectedRows) {

            console.log("QSOLink Added");
            response.body.error = 0;
            response.body.message = {
                info: info,
                monthly_links: qra_owner.monthly_links + 1,
                monthly_scans: qra_owner.monthly_scans
            };

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

    function getQsoInfo(idqsos) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQsoInfo" + idqsos);
            conn.query("SELECT qsos.idqsos, idqra_owner, qsos.guid_URL, qras.qra FROM qsos inner join qras on qras.id" +
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
                });
        });
    }

    function checkOwnerInQso(idqso, sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qras.idqras, qras.qra, qras.avatarpic, qsos.guid_URL, monthly_links, monthly_scans from qras inner join qsos on qras.i" +
                    "dqras = qsos.idqra_owner where qsos.idqsos=? and qras.idcognito=?", [
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
    async function addQSOlinks(idqso, qsos_rel, qra_owner, datetime, qso) {
        let info;
        let qrasAll = [];
        let stakeholders;
        console.log("addQSOlink" + idqso);

        let idActivity = await saveActivity(qra_owner.idqras, idqso, datetime);
        if (idActivity) {


            console.log("Loop Qsos Rel ");
            for (let i = 0; i < qsos_rel.length; i++) {
                info = await addQSOlink(idqso, qsos_rel[i].qso);
                console.log("Links QSO Stakeholders" + qsos_rel[i].qso);
                stakeholders = await getQsoStakeholders(qsos_rel[i].qso);
                let qso_rel = await getQsoInfo(qsos_rel[i].qso);
                console.log(qso_rel);
                console.log(stakeholders);
                console.log("createNotifications");
                for (let j = 0; j < stakeholders.length; j++) {

                    if (!qrasAll.some(elem => elem.idqra === stakeholders[j].idqra) && (stakeholders[i].idqra !== qra_owner.idqras)) {

                        let idnotif = await insertNotification(idActivity, stakeholders[j].idqra, qra_owner, datetime, qso, stakeholders[j].qra, qso_rel.qra);
                        qrasAll.push({ idqra: stakeholders[j].idqra });
                        let qra_devices = await getDeviceInfo(stakeholders[j].idqra, stakeholders[j].qra);

                        if (qra_devices)
                            await sendPushNotification(qra_devices, qra_owner, idnotif, qso, idActivity);


                    }
                }

                //Inform Followers of QRA REL OWNER
                let followingMe = await getFollowingQRA(qso_rel.idqra_owner);
                console.log("following QSO REL QRA OWNER " + qso_rel.idqra_owner);
                qrasAll = await createNotifications(idActivity, qrasAll, followingMe, qra_owner, datetime, qso, qso_rel.qra);
            }
            console.log("Original QSO Stakeholders");
            stakeholders = await getQsoStakeholders(idqso);

            for (let j = 0; j < stakeholders.length; j++) {

                if (!qrasAll.some(elem => elem.idqra === stakeholders[j].idqra) && (stakeholders[j].idqra !== qra_owner.idqras)) {

                    let idnotif = await insertNotification(idActivity, stakeholders[j].idqra, qra_owner, datetime, qso, stakeholders[j].qra);
                    qrasAll.push({ idqra: stakeholders[j].idqra });
                    let qra_devices = await getDeviceInfo(stakeholders[j].idqra);
                    console.log(qra_devices);
                    if (qra_devices)
                        await sendPushNotification(qra_devices, qra_owner, idnotif, qso);
                }
            }
            if (Object.keys(addresses).length > 0) {
                await sendMessages(qra_owner, qso, idActivity);
                addresses = {};
            }
            console.log("getFollowing Me");
            let followingMe = await getFollowingQRA(qra_owner.idqras);
            qrasAll = await createNotifications(idActivity, qrasAll, followingMe, qra_owner, datetime, qso);




            return info;
        }
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
            console.log("UpdateLinksInQso");
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
            conn.query('UPDATE sqso.qras SET links_created = qsos_counter+?, monthly_links = monthly_links+? WHERE idqras=?', [
                counter, counter, idqras
            ], function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));

            });
        });
    }

    function getFollowingQRA(idqra_owner) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT f.*, q.qra from qra_followers as f inner join qras as q on f.idqra_followed = q.idqras WHERE f.idqra_followed = ?", idqra_owner, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }

    function getQsoStakeholders(idqso) {
        console.log("getQsoStakeholders" + idqso);
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("Select distinct idqra, q.qra from qsos_qras as qs inner join qras as q on qs.idqra = q.idqras  where idqso=?", idqso, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });

    }

    function saveActivity(idqras_owner, newqso, datetime) {
        console.log("SaveActivity" + newqso);

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
    async function createNotifications(idActivity, qrasAll, qras, qra_owner, datetime, qso, qso_rel_qra) {

        for (let i = 0; i < qras.length; i++) {

            if (!qrasAll.some(elem => elem.idqra === qras[i].idqra) && (qras[i].idqra !== qra_owner.idqras)) {
                await insertNotification(idActivity, qras[i].idqra, qra_owner, datetime, qso, qras.qra, qso_rel_qra);
                qrasAll.push({ idqra: qras[i].idqra });
            }
        }
        return qrasAll;
    }

    function insertNotification(idActivity, idqra_dest, qra_owner, datetime, qso, qra_dest, qso_rel_qra) {
        console.log("insertNotification: To " + idqra_dest + qra_dest + " QSO_OWNER " +
            qso.qra + "  " + " QSO_REL_QRA " + qso_rel_qra);
        let message;
        if (qso_rel_qra === qra_dest)
            message = qra_owner.qra + " linked a QSO with another created by you ";
        else if (qso_rel_qra)
            message = qra_owner.qra + " linked a QSO with another created by " + qso_rel_qra;
        else
            message = qra_owner.qra + " linked a QSO";

        let final_url = url + 'qso/' + qso.guid_URL;
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=? , datetime=?, acti" +
                    "vity_type='20', qra=?,  qra_avatarpic=?, QSO_GUID=?, REF_QRA=?, message=?, url=?" +
                    ", idqsos=? ", [
                        idqra_dest,
                        idActivity,
                        datetime,
                        qra_owner.qra,
                        qra_owner.avatarpic,
                        qso.guid_URL,
                        qso_rel_qra,
                        message,
                        final_url,
                        qso.idqsos
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

    function getDeviceInfo(idqra, qra) {
        console.log("getDeviceInfo " + idqra + " " + qra);
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

    async function sendPushNotification(qra_devices, qra_owner, idnotif, qso, idActivity) {
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
                await sendMessages(qra_owner, qso, idActivity);
                addresses = {};
            }

        }
    }


    function sendMessages(qra_owner, qso, idActivity) {
        console.log("sendMessages");
        let title = qra_owner.qra + " linked a QSO you are participating";
        let final_url = url + "qso/" + qso.guid_URL;

        let activ = JSON.stringify(idActivity);
        var params = {
            ApplicationId: 'b5a50c31fd004a20a1a2fe4f357c8e89',
            /* required */
            MessageRequest: { /* required */
                Addresses: addresses,

                MessageConfiguration: {

                    APNSMessage: {
                        Body: title,
                        Title: title,
                        Action: 'OPEN_APP',
                        Url: final_url,
                        // SilentPush: false,
                        Data: {

                            'QRA': qra_owner.qra,
                            'AVATAR': qra_owner.avatarpic,
                            'IDACTIVITY': activ
                        }
                        // MediaUrl: qra_owner.avatarpic
                    },
                    GCMMessage: {
                        Action: 'OPEN_APP',
                        Body: title,
                        Data: {

                            'QRA': qra_owner.qra,
                            'AVATAR': qra_owner.avatarpic,
                            'IDACTIVITY': activ
                        },

                        Title: title,
                        Url: final_url
                    }
                },

            }
        };

        //PUSH Notification

        let payload = {
            "body": {
                "source": "QsoLinkAdd",
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

};

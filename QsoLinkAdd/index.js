var mysql = require('mysql');
var AWS = require("aws-sdk");
var pinpoint = new AWS.Pinpoint({ "region": 'us-east-1' });
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

    var idqso = event.body.qso;
    qsos_rel = event.body.qsos_rel;
    var sub = event.context.sub;
    var datetime = new Date();


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

    function getQsoInfo(idqsos) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito");
            conn.query("SELECT qsos.idqsos, qsos.guid_URL, qras.qra FROM qsos inner join qras on qras.id" +
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
                .query("SELECT qras.idqras, qras.qra, qras.avatarpic from qras inner join" +
                    " qsos on qras.idqras = qsos.idqra_owner where qsos.idqsos=? and qras.idcognito=?", [
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
        console.log("addQSOlink" + idqso);

        let idActivity = await saveActivity(qra_owner.idqras, idqso, datetime);
        if (idActivity) {
            console.log("Get Stakeholders of QSO");
            let qras = await getQsoStakeholders(idqso);

            qrasAll = await createNotifications(idActivity, qrasAll, qras, qra_owner, datetime, qso);

            console.log("getFollowing Me");
            let followingMe = await getFollowingMe(qra_owner.idqras);

            qrasAll = await createNotifications(idActivity, qrasAll, followingMe, qra_owner, datetime, qso);



            for (let i = 0; i < qsos_rel.length; i++) {
                info = await addQSOlink(idqso, qsos_rel[i].qso);
                console.log("Get Stakeholders of QSO");
                let stakeholders = await getQsoStakeholders(qsos_rel[i].qso);

                console.log("createNotifications");
                qrasAll = await createNotifications(idActivity, qrasAll, stakeholders, qra_owner, datetime, qso);
                for (var s = 0; s < stakeholders.length; s++) {
                    let qra_devices = await getDeviceInfo(stakeholders[s].idqra);
                    if (qra_devices)
                        await sendPushNotification(qra_devices, qra_owner);
                }
            }
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
    async function createNotifications(idActivity, qrasAll, qras, qra_owner, datetime, qso) {

        for (let i = 0; i < qras.length; i++) {

            if (!qrasAll.some(elem => elem.idqra === qras[i].idqra) && (qras[i].idqra !== qra_owner.idqras)) {
                await insertNotification(idActivity, qras[i].idqra, qra_owner, datetime, qso);
                qrasAll.push({ idqra: qras[i].idqra });
            }
        }
        return qrasAll;
    }

    function insertNotification(idActivity, idqra, qra_owner, datetime, qso) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=? , datetime=?, acti" +
                    "vity_type='20', qra=?,  qra_avatarpic=?, QSO_GUID=?, REF_QRA=? ", [
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

    function getDeviceInfo(idqra) {
        console.log("getDeviceInfo" + idqra);
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

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
        let title = qra_owner.qra + " linked a QSO you have participated";
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

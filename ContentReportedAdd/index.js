var mysql = require('mysql');
const warmer = require('lambda-warmer');
var AWS = require("aws-sdk");
var pinpoint = new AWS.Pinpoint({ "region": 'us-east-1' });

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

    var datetime = event.body.datetime;
    var idqso = event.body.idqso;
    var idcomment = event.body.idcomment;
    var idmedia = event.body.idmedia;
    var detail = event.body.detail;
    var sub = event.context.sub;

    //***********************************************************
    if (!event['stage-variables']) {
        console.log("Stage Variables Missing");
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }

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

        let info = await insertReportedContent(qra_owner.idqras, idqso, idcomment, idmedia, detail, datetime);
        if (info.insertId) {
            await push2Admin(qra_owner);
            console.log("Reported Content Added");
            response.body.error = 0;
            response.body.message = info;
            return callback(null, response);
        }
        else {
            console.log("Reported Content NOT Added");
            response.body.error = 1;
            response.body.message = info;
            return callback(null, response);
        }

    }
    catch (e) {
        console.log("Error executing Reported Content Get");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e;
        callback(null, response);
        return context.fail(response);
    }
    async function push2Admin(qra_owner) {
        console.log("push2Admin");
        let devices = await getDeviceInfo();
        await sendPushNotification(devices, qra_owner);

    }

    function checkQraCognito(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito");
            conn.query("SELECT qras.idqras, qras.qra, qras.avatarpic FROM qras where idcognito=? LIMIT 1", sub, function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info))[0]);
            });
        });
    }

    function insertReportedContent(idqra, idqso, idcomment, idmedia, detail, datetime) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("insertReportedContent")
            let content_type;
            if (idcomment) {
                content_type = 'COMMENT'
            }
            else if (idmedia) {
                content_type = 'MEDIA'
            }
            else
                content_type = 'QSO';
            let post = {
                "content_type": content_type,
                "idqra": idqra,
                "idqso": idqso,
                "idcomment": idcomment,
                "idmedia": idmedia,
                "detail": detail,
                "datetime": datetime
            };
            conn.query('INSERT INTO sqso.content_reported SET ?', post, function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }

    function getDeviceInfo() {
        console.log("getDeviceInfo ");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT * FROM push_devices as p inner join users as u on u.idqras = p.qra  where" +
                    " admin=1",
                    function(err, info) {
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

    async function sendPushNotification(qra_devices, qra_owner) {
        console.log("sendPushNotification");
        let channel;
        let params;
        let title = qra_owner.qra + " reported content";

        let addresses = {};

        for (let i = 0; i < qra_devices.length; i++) {

            qra_devices[i].device_type === 'android' ?
                channel = 'GCM' :
                channel = 'APNS';

            addresses = {};
            addresses[qra_devices[i].token] = {
                ChannelType: channel
            };
            params = {
                ApplicationId: 'b5a50c31fd004a20a1a2fe4f357c8e89',
                /* required */
                MessageRequest: { /* required */
                    Addresses: addresses,

                    MessageConfiguration: {
                        APNSMessage: {
                            Body: title,
                            Title: title,
                            Action: 'OPEN_APP',
                            // Url: final_url, SilentPush: false,
                            Data: {

                                'QRA': qra_owner.qra,
                                'AVATAR': qra_owner.avatarpic
                            }
                            // MediaUrl: qra_owner.avatarpic
                        },
                       
                        GCMMessage: {
                            Action: 'OPEN_APP',
                            Body: title,
                            Data: {

                                'QRA': qra_owner.qra,
                                'AVATAR': qra_owner.avatarpic
                            },
                            // CollapseKey: 'STRING_VALUE', IconReference: 'STRING_VALUE', ImageIconUrl:
                            // 'https://s3.amazonaws.com/sqso-static/res/drawable-xxxhdpi/ic_stat_ham_radio_
                            // i con_25.png', ImageUrl: qra_owner.avatarpic, Priority: 'STRING_VALUE',
                            // RawContent: 'STRING_VALUE', RestrictedPackageName: 'STRING_VALUE',
                            // SilentPush: false, SmallImageIconUrl:
                            // 'https://s3.amazonaws.com/sqso-static/res/drawable-xxxhdpi/ic_stat_ham_radio_
                            // i con_25.png', Sound: 'STRING_VALUE', Substitutions: {//     '<__string>': [
                            //     'STRING_VALUE',         /* more items */     ],     /* '<__string>': ...
                            // */ }, TimeToLive: 10,
                            Title: title
                            // Url: final_url
                        }
                    },
                    TraceId: 'STRING_VALUE'
                }
            };
            // console.log(qra_devices[i]);
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

}

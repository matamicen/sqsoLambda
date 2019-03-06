var mysql = require('mysql');
const warmer = require('lambda-warmer');
var AWS = require("aws-sdk");
AWS.config.region = 'us-east-1';
var lambda = new AWS.Lambda();



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
            console.log("insertReportedContent");
            let content_type;
            if (idcomment) {
                content_type = 'COMMENT';
            }
            else if (idmedia) {
                content_type = 'MEDIA';
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

        for (let i = 0; i < qra_devices.length; i++) {

            qra_devices[i].device_type === 'android' ?
                channel = 'GCM' :
                channel = 'APNS';


            addresses[qra_devices[i].token] = {
                ChannelType: channel
            };

            if (Object.keys(addresses).length == 100) {
                await sendMessages(qra_owner, datetime, qra_owner);
                addresses = {};
            }
        }
        if (Object.keys(addresses).length > 0) {
            await sendMessages(qra_owner, datetime, qra_owner);
            addresses = {};
        }


    }


    function sendMessages(qra_owner) {
        console.log("sendMessages");
        let title = qra_owner.qra + " reported content";

        let params = {
            ApplicationId: 'b5a50c31fd004a20a1a2fe4f357c8e89',
            /* required */
            MessageRequest: { /* required */
                Addresses: addresses,

                MessageConfiguration: {
                    APNSMessage: {
                        Body: title,
                        Title: title,
                        Action: 'OPEN_APP',

                        Data: {

                            'QRA': qra_owner.qra,
                            'AVATAR': qra_owner.avatarpic,
                            "IDACTIVITY": "CONTENT_REPORTED"
                        }

                    },

                    GCMMessage: {
                        Action: 'OPEN_APP',
                        Body: title,
                        Data: {

                            'QRA': qra_owner.qra,
                            'AVATAR': qra_owner.avatarpic,
                            "IDACTIVITY": "CONTENT_REPORTED"
                        },

                        Title: title

                    }
                }

            }
        };

        //PUSH Notification

        let payload = {
            "body": {
                "source": "ContentReportedAdd",
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
                console.log(err)               
            }

        });
    }

};

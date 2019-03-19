// var fs = require('fs');
var mysql = require('mysql');
var AWS = require("aws-sdk");
AWS.config.region = 'us-east-1';
var lambda = new AWS.Lambda();
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

    var qra = event.body.qra;
    var datetime = event.body.datetime;
    var sub = event.context.sub;
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
        console.log("checkQraCognito");
        let qra_owner = await checkQraCognito(sub);
        console.log(qra_owner.qra + " follow " +
            qra + " " + datetime);
        if (!qra_owner) {
            console.log("User does not exist");
            response.body.error = 1;
            response.body.message = "User does not exist";
            conn.destroy();
            return callback(null, response);
        }
        console.log("getQra");
        var qra_follower = await getQra(qra);
        if (!qra_follower) {
            console.log("User does not exist");
            response.body.error = 400;
            response.body.message = "Error: FOLLOWER User does not exist";
            conn.destroy();
            return callback(null, response);
        }
        console.log("checkQraAlreadyFollowing");
        let info = await checkQraAlreadyFollowing(qra_owner.idqras, qra_follower.idqras);
        if (info.length > 0) {
            response.body.error = 1;
            response.body.message = info;
            conn.destroy();
            return callback(null, response);
        }
        console.log("insertFollower");
        let insertId = await insertFollower(qra_owner.idqras, qra_follower.idqras, datetime);
        if (insertId) {
            console.log("UpdateFollowersCounterInQra");
            await updateFollowersCounterInQra(qra_follower.idqras);
            let followingMe = await getFollowingMe(qra_owner.idqras);
            console.log("saveActivity");
            let idActivity = await saveActivity(qra_owner, qra_follower, datetime);
            if (idActivity) {
                console.log("createNotifications");
                await createNotifications(idActivity, qra_owner, qra_follower, datetime, followingMe);
                //inform the new follower the action
                console.log("createNotification4Follower");
                let idnotif = await insertNotification(idActivity, qra_follower, qra_owner, qra_follower, datetime);
                let qra_devices = await getDeviceInfo(qra_follower.idqras);
                if (qra_devices)
                    await sendPushNotification(qra_devices, qra_owner, idnotif, idActivity);
            }
            console.log("getFollowers");
            let followers = await getFollowers(qra_owner.idqras);
            if (followers) {
                conn.destroy();
                response.body.error = 0;
                response.body.message = followers;
                console.log("new follower ");
                return callback(null, response);
            }
        }

    }
    catch (e) {
        console.log("Error executing QRA Follower Add");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = e;

        return callback(null, response);
    }

    function updateFollowersCounterInQra(idqras) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query('UPDATE sqso.qras SET followers_counter = followers_counter+1  WHERE idqras=?', idqras, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    // console.log(info);
                });
        });
    }

    function checkQraCognito(sub) {
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

    function getQra(qracode) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qras.idqras, qra, avatarpic from qras where qras.qra=?", qracode, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0]);
                });
        });
    }

    function checkQraAlreadyFollowing(idqra_owner, idqra_follower) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT * from qra_followers WHERE idqra = ? and idqra_followed=?", [
                    idqra_owner, idqra_follower
                ], function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }

    function insertFollower(idqra_owner, idqra_follower, datetime) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_followers SET idqra = ?, idqra_followed=?, datetime=?", [
                    idqra_owner, idqra_follower, datetime
                ], function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                });
        });
    }

    function getFollowingMe(idqra_owner) {
        console.log("getFollowingMe " + idqra_owner);
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

    function saveActivity(qra_owner, qra_follower, datetime) {

        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("INSERT INTO qra_activities SET idqra = ?, activity_type='1', ref_idqra=?, dateti" +
                    "me=?", [
                        qra_owner.idqras, qra_follower.idqras, datetime
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

    async function createNotifications(idActivity, qra_owner, qra_follower, datetime, followers) {

        //inform followings the action
        for (var i = 0; i < followers.length; i++) {
            if (followers[i].idqra !== qra_follower.idqras)
                await insertNotification(idActivity, followers[i], qra_owner, qra_follower, datetime);
        }


    }

    function insertNotification(idActivity, follower, qra_owner, qra_follower, datetime) {
        console.log("InsertNotification ", follower.idqra);

        let message;
        let final_url;
        if (follower.idqras === qra_follower.idqras) {
            message = qra_owner.qra + " now follows you";
            follower.idqra = follower.idqras;
            final_url = url + qra_owner.qra;
        }
        else {
            message = qra_owner.qra + " started to follow " + qra_follower.qra;
            final_url = url + qra_follower.qra;
        }

        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=?, datetime=?, activ" +
                    "ity_type='1', qra=?, ref_qra=?, qra_avatarpic=?, message=?, url=?", [
                        follower.idqra,
                        idActivity,
                        datetime,
                        qra_owner.qra,
                        qra_follower.qra,
                        qra_owner.avatarpic,
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

    function getFollowers(idqra_owner) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_fol" +
                    "lowers inner join qras on qra_followers.idqra_followed = qras.idqras WHERE qra_f" +
                    "ollowers.idqra = ?",
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

    async function sendPushNotification(qra_devices, qra_owner, idnotif, idActivity) {
        console.log("sendPushNotification");
        let channel;

        console.log(qra_devices);

        let activ = JSON.stringify(idActivity);

        for (let i = 0; i < qra_devices.length; i++) {

            qra_devices[i].device_type === 'android' ?
                channel = 'GCM' :
                channel = 'APNS';


            addresses[qra_devices[i].token] = {
                ChannelType: channel
            };

            if (Object.keys(addresses).length == 100) {
                await sendMessages(qra_owner, activ);
                addresses = {};
            }
        }

        if (Object.keys(addresses).length > 0) {
            await sendMessages(qra_owner, activ);
            addresses = {};
        }
    }


    function sendMessages(qra_owner, activ) {
        console.log("sendMessages");
        let title = qra_owner.qra + " started to follow you ";
        let final_url = url + qra_owner.qra;
        console.log(addresses);
        let params = {
            ApplicationId: 'b5a50c31fd004a20a1a2fe4f357c8e89',
            /* required */
            MessageRequest: { /* required */
                Addresses: addresses,

                MessageConfiguration: {
                    APNSMessage: {
                        Body: " ",
                        Title: title,
                        Action: 'OPEN_APP',
                        Url: final_url,
                        Priority: '10',
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
                        Body: " ",
                        Data: {

                            'QRA': qra_owner.qra,
                            'AVATAR': qra_owner.avatarpic,
                            'IDACTIVITY': activ
                        },
                        Priority: '10',
                        "TimeToLive": 0,
                        Title: title,
                        Url: final_url
                    }
                },

            }
        };
        //PUSH Notification

        let payload = {
            "body": {
                "source": "QraFollowerAdd " + qra_owner.qra + " " + qra,
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
            InvocationType: 'RequestResponse',
            LogType: 'Tail',
            Payload: JSON.stringify(payload)

        };
        console.log("invoke Lambda");
        lambda.invoke(paramslambda, function(err, data) {
            console.log(data);
            console.log(err);
            if (err) {
                console.log("lambda error");
                console.log(err);
            }

        });

    }

};

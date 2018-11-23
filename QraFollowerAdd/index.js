// var fs = require('fs');
var mysql = require('mysql');
var AWS = require("aws-sdk");
var pinpoint = new AWS.Pinpoint({ "region": 'us-east-1' });

exports.handler = async(event, context, callback) => {

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
            console.log("getFollowingMe");
            let followingMe = await getFollowingMe(qra_owner.idqras);
            console.log("saveActivity");
            let idActivity = await saveActivity(qra_owner, qra_follower, datetime);
            if (idActivity) {
                console.log("createNotifications");
                await createNotifications(idActivity, qra_owner, qra_follower, datetime, followingMe);
                let qra_devices = await getDeviceInfo(qra_follower.idqras);
                if (qra_devices)
                    await sendPushNotification(qra_devices, qra_owner);
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

        for (var i = 0; i < followers.length; i++) {
            await insertNotification(idActivity, followers[i], qra_owner, qra_follower, datetime);
        }
    }

    function insertNotification(idActivity, follower, qra_owner, qra_follower, datetime) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=?, datetime=?, activ" +
                    "ity_type='1', qra=?, ref_qra=?, qra_avatarpic=?", [
                        follower.idqra,
                        idActivity,
                        datetime,
                        qra_owner.qra,
                        qra_follower.qra,
                        qra_owner.avatarpic
                    ],
                    function(err, info) {
                        // Call reject on error states, call resolve with results
                        if (err) {
                            return reject(err);
                        }

                        resolve();
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
        console.log("getDeviceInfo " +
            idqra);
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

    async function sendPushNotification(qra_devices, qra_owner) {
        console.log("sendPushNotification");
        let channel;
        let params;
        let title = qra_owner.qra + " started to follow you ";
        let final_url = url + qra_owner.qra;
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
                            Action: 'URL',
                            Url: final_url,
                            SilentPush: false,
                            Data: {

                                /*
                                               '<__string>': ... */
                            },
                            MediaUrl: qra_owner.avatarpic,



                        },

                        GCMMessage: {
                            Action: 'URL',
                            Body: title,
                            CollapseKey: 'STRING_VALUE',

                            // IconReference: 'STRING_VALUE',
                            ImageIconUrl: 'https://s3.amazonaws.com/sqso-static/res/drawable-xxxhdpi/ic_stat_ham_radio_icon_25.png',
                            ImageUrl: qra_owner.avatarpic,
                            // Priority: 'STRING_VALUE', RawContent: 'STRING_VALUE', RestrictedPackageName:
                            // 'STRING_VALUE',
                            SilentPush: false,
                            SmallImageIconUrl: 'https://s3.amazonaws.com/sqso-static/res/drawable-xxxhdpi/ic_stat_ham_radio_icon_25.png',
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
            console.log(qra_devices[i]);
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
            pinpoint.sendMessages(params, function(err, data) {


                if (err)
                    return reject(err);

                else {
                    var status = data.MessageResponse.Result[Object.keys(data.MessageResponse.Result)[0]].StatusCode;

                    resolve(status);
                }
            });
        });

    }


};

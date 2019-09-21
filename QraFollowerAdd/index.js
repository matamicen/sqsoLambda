// var fs = require("fs");
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

        var qra = event.body.qra;
        var datetime = event.body.datetime;
        var sub = event.context.sub;
        let addresses = {};
        let notif = [];

        let message;
        let final_url;
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

                let qra_owner = await checkQraCognito(sub);
                console.log(qra_owner.qra + " follow " + qra + " " + datetime);
                if (!qra_owner) {
                        console.log("User does not exist");
                        response.body.error = 1;
                        response.body.message = "User does not exist";
                        conn.destroy();
                        return callback(null, response);
                }

                var qra_follower = await getQra(qra);
                if (!qra_follower) {
                        console.log("User does not exist");
                        response.body.error = 400;
                        response.body.message = "Error: FOLLOWER User does not exist";
                        conn.destroy();
                        return callback(null, response);
                }

                let info = await checkQraAlreadyFollowing(
                        qra_owner.idqras,
                        qra_follower.idqras
                );
                if (info.length > 0) {
                        console.log("Already following QRA");
                        response.body.error = 1;
                        response.body.message = info;
                        conn.destroy();
                        return callback(null, response);
                }

                let insertId = await insertFollower(
                        qra_owner.idqras,
                        qra_follower.idqras,
                        datetime
                );
                if (insertId) {
                        await updateFollowersCounterInQra(qra_follower.idqras);
                        let followingMe = await getFollowingMe(qra_owner.idqras);
                        let idActivity = await saveActivity(qra_owner, qra_follower, datetime);
                        if (idActivity) {
                                await createNotifications(
                                        idActivity,
                                        qra_owner,
                                        qra_follower,
                                        datetime,
                                        followingMe
                                );
                                //inform the new follower the action
                                console.log("createNotification4Follower");

                                message = qra_owner.qra + " now follows you";
                                qra_follower.idqra = qra_follower.idqras;
                                final_url = url + qra_owner.qra;

                                notif.push([
                                        idActivity, //idActivity
                                        qra_follower.idqra, //idqra
                                        qra_owner.qra, //qra
                                        qra_owner.avatarpic, //qra_avatarpic
                                        qra_follower.qra, //ref_qra
                                        datetime, //datetime
                                        message, //message
                                        final_url, //url
                                        1 //activity_type
                                ]);
                                await insertNotifications(notif);
                                let qra_devices = await getDeviceInfo(qra_follower.idqras);
                                if (qra_devices)
                                        await sendPushNotification(
                                                qra_devices,
                                                qra_owner,
                                                idActivity
                                        );
                        }
                        console.log("getFollowers");
                        let followers = await getFollowers(qra_owner.idqras);
                        if (followers) {
                                conn.destroy();
                                response.body.error = 0;
                                response.body.message = followers;
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
                console.log("updateFollowersCounterInQra");
                return new Promise(function(resolve, reject) {
                        // The Promise constructor should catch any errors thrown on this tick.
                        // Alternately, try/catch and reject(err) on catch.
                        // ***********************************************************
                        conn.query(
                                "UPDATE sqso.qras SET followers_counter = followers_counter+1  WHERE idqras=?",
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

        function checkQraCognito(sub) {
                console.log("checkQraCognito");
                return new Promise(function(resolve, reject) {
                        // The Promise constructor should catch any errors thrown on this tick.
                        // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
                        // from Congito ID");
                        conn.query(
                                "SELECT idqras, qra, avatarpic FROM qras where idcognito=? LIMIT 1",
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

        function getQra(qracode) {
                console.log("getQra");
                return new Promise(function(resolve, reject) {
                        // The Promise constructor should catch any errors thrown on this tick.
                        // Alternately, try/catch and reject(err) on catch.

                        conn.query(
                                "SELECT qras.idqras, qra, avatarpic from qras where qras.qra=?",
                                qracode,
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

        function checkQraAlreadyFollowing(idqra_owner, idqra_follower) {
                console.log("checkQraAlreadyFollowing: " + idqra_owner + " " + idqra_follower);
                return new Promise(function(resolve, reject) {
                        // The Promise constructor should catch any errors thrown on this tick.
                        // Alternately, try/catch and reject(err) on catch.

                        conn.query(
                                "SELECT * from qra_followers WHERE idqra = ? and idqra_followed=?", [idqra_owner, idqra_follower],
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

        function insertFollower(idqra_owner, idqra_follower, datetime) {
                console.log("insertFollower");
                return new Promise(function(resolve, reject) {
                        // The Promise constructor should catch any errors thrown on this tick.
                        // Alternately, try/catch and reject(err) on catch.

                        conn.query(
                                "INSERT INTO qra_followers SET idqra = ?, idqra_followed=?, datetime=?", [idqra_owner, idqra_follower, datetime],
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

        function getFollowingMe(idqra_owner) {
                console.log("getFollowingMe " + idqra_owner);
                return new Promise(function(resolve, reject) {
                        // The Promise constructor should catch any errors thrown on this tick.
                        // Alternately, try/catch and reject(err) on catch.

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

        function saveActivity(qra_owner, qra_follower, datetime) {
                console.log("saveActivity");
                return new Promise(function(resolve, reject) {
                        // The Promise constructor should catch any errors thrown on this tick.
                        // Alternately, try/catch and reject(err) on catch.
                        // ***********************************************************
                        conn.query(
                                "INSERT INTO qra_activities SET idqra = ?, activity_type='1', ref_idqra = ? , dat" +
                                "etime=?", [qra_owner.idqras, qra_follower.idqras, datetime],
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
                qra_follower,
                datetime,
                followers
        ) {
                console.log("CreateNotifications");

                //inform the action to followers
                for (var i = 0; i < followers.length; i++) {
                        if (followers[i].idqra !== qra_follower.idqras) {
                                if (followers[i].idqras === qra_follower.idqras) {
                                        message = qra_owner.qra + " now follows you";
                                        followers[i].idqra = followers[i].idqras;
                                        final_url = url + qra_owner.qra;
                                }
                                else {
                                        message = qra_owner.qra + " started to follow " + qra_follower.qra;
                                        final_url = url + qra_follower.qra;
                                }
                                
                                notif.push([
                                        idActivity, //idActivity
                                        followers[i].idqra, //idqra
                                        qra_owner.qra, //qra
                                        qra_owner.avatarpic, //qra_avatarpic
                                        qra_follower.qra, //ref_qra
                                        datetime, //datetime
                                        message, //message
                                        final_url, //url
                                        1 //activity_type
                                ]);
                        }
                }

        }

      
        function insertNotifications(notifs) {
                console.log("insertNotifications " + notifs.length);

                return new Promise(function(resolve, reject) {
                        // The Promise constructor should catch any errors thrown on this tick.
                        // Alternately, try/catch and reject(err) on catch.

                        conn.query(
                                "INSERT INTO qra_notifications (idqra_activity, idqra, qra, qra_avatarpic, REF_QRA, datetime, " +
                                "message, url, activity_type) VALUES ?", [notifs],
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

        function getFollowers(idqra_owner) {
                return new Promise(function(resolve, reject) {
                        // The Promise constructor should catch any errors thrown on this tick.
                        // Alternately, try/catch and reject(err) on catch.

                        conn.query(
                                "SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_fol" +
                                "lowers inner join qras on qra_followers.idqra_followed = qras.idqras WHERE qra_f" +
                                "ollowers.idqra = ?",
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

        function getDeviceInfo(idqra) {
                console.log("getDeviceInfo " + idqra);
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

        async function sendPushNotification(
                qra_devices,
                qra_owner,
                idActivity
        ) {
                console.log("sendPushNotification to: " + qra_devices.length );
                let channel;

                let activ = JSON.stringify(idActivity);

                for (let i = 0; i < qra_devices.length; i++) {
                        qra_devices[i].device_type === "android" ?
                                (channel = "GCM") :
                                (channel = "APNS");

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
                context.callbackWaitsForEmptyEventLoop = true;

                let title = qra_owner.qra + " started to follow you ";
                let final_url = url + qra_owner.qra;
                let appId = event["stage-variables"].pinpointAppId;
                let params = {
                        ApplicationId: appId,
                        /* required */
                        MessageRequest: {
                                /* required */
                                Addresses: addresses,

                                MessageConfiguration: {
                                        APNSMessage: {
                                                Body: "Click to see his profile ",
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
                                                Body: "Click to see his profile ",
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
                                source: "QraFollowerAdd " + qra_owner.qra + " " + qra,
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

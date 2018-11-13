// var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');

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
    var conn = await mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
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

        if (info.length > 0) { //     console.log("already followed");

            //like already exist => do not insert again

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

    } catch (e) {
        console.log("Error executing QRA Follower Add");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = e;
        
        return callback(null, response);
    }

    function updateFollowersCounterInQra(idqras) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query('UPDATE sqso.qras SET followers_counter = followers_counter+1  WHERE idqras=?', idqras, function (err, info) {
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
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            conn
                .query("SELECT idqras, qra, avatarpic FROM qras where idcognito=? LIMIT 1", sub, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0]);
                });
        });
    }

    function getQra(qracode) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qras.idqras, qra, avatarpic from qras where qras.qra=?", qracode, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0]);
                });
        });
    }

    function checkQraAlreadyFollowing(idqra_owner, idqra_follower) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT * from qra_followers WHERE idqra = ? and idqra_followed=?", [
                    idqra_owner, idqra_follower
                ], function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }

    function insertFollower(idqra_owner, idqra_follower, datetime) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_followers SET idqra = ?, idqra_followed=?, datetime=?", [
                    idqra_owner, idqra_follower, datetime
                ], function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                });
        });
    }

    function getFollowingMe(idqra_owner) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qra_followers.* from qra_followers WHERE qra_followers.idqra_followed = ?", idqra_owner, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));

                });
        });
    }

    function saveActivity(qra_owner, qra_follower, datetime) {

        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("INSERT INTO qra_activities SET idqra = ?, activity_type='1', ref_idqra=?, dateti" +
                        "me=?",
                [
                    qra_owner.idqras, qra_follower.idqras, datetime
                ], function (err, info) {
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
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=?, datetime=?, activ" +
                        "ity_type='1', qra=?, ref_qra=?, qra_avatarpic=?",
                [
                    follower.idqra,
                    idActivity,
                    datetime,
                    qra_owner.qra,
                    qra_follower.qra,
                    qra_owner.avatarpic
                ], function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve();
                });
        });
    }

    function getFollowers(idqra_owner) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_fol" +
                        "lowers inner join qras on qra_followers.idqra_followed = qras.idqras WHERE qra_f" +
                        "ollowers.idqra = ?",
                idqra_owner, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }

};

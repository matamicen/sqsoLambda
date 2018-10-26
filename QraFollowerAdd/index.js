// var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');

exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var sub;
    var idqra_follower;
    var qra;
    var datetime;

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

    // var count;

    qra = event.body.qra;
    datetime = event.body.datetime;
    sub = event.context.sub;

    //***********************************************************
    var conn = await mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {
        console.log("checkQraCognito");
        let idqras_owner = await checkQraCognito(sub);
        if (!idqras_owner) {
            console.log("User does not exist");
            conn.destroy();
            msg = {
                "error": "1",
                "message": "User does not exist"
            };
            callback("User does not exist");
            return context.fail(msg);
        }
        console.log("getQra");
        idqra_follower = await getQra(qra);
        if (!idqra_follower) {
            console.log("User does not exist");
            response.body.error = 400;
            response.body.message = "Error: FOLLOWER User does not exist";
            conn.destroy();
            return callback(null, response);
        }
        console.log("checkQraAlreadyFollowing");
        let info = await checkQraAlreadyFollowing(idqras_owner, idqra_follower);
        if (info.length > 0) {
            console.log("already followed");
            //like already exist => do not insert again
            response.body.error = 400;
            response.body.message = info;
            return callback(null, response);
        }
        console.log("insertFollower");
        let insertId = await insertFollower(idqras_owner, idqra_follower, datetime);
        if (insertId) {
            console.log("UpdateFollowersCounterInQra");
            await updateFollowersCounterInQra(idqra_follower);
            console.log("getFollowers");
            let followers = await getFollowers(idqras_owner);
            console.log("saveActivity");
            let idActivity = await saveActivity(idqras_owner, idqra_follower, datetime);
            if (idActivity) {
                console.log("createNotifications");
                await createNotifications(idActivity, followers);
            }
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
        callback(e.message);
        var msg = {
            "error": 1,
            "message": e.message
        };
        return context.fail(msg);
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
                .query("SELECT idqras FROM qras where idcognito=? LIMIT 1", sub, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                });
        });
    }

    function getQra(qracode) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qras.idqras from qras where qras.qra=?", qracode, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0].idqras);
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

    function saveActivity(idqras_owner, idqra_follower, datetime) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("INSERT INTO qra_activities SET idqra = ?, activity_type='1', ref_idqra=?, datetime=?", [
                    idqras_owner, idqra_follower, datetime
                ], function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                });
        });
    }
    async function createNotifications(idActivity, followers) {
        console.log(followers);
        for (let i = 0; i < followers.length; i++) {
            await insertNotification(idActivity, followers[i]);
        }
    }

    function insertNotification(idActivity, follower ) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=?", [
                    follower.idqra_followed, idActivity, datetime
                ], function(err, info) {
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

            conn.query("SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_followers inner joi" +
                "n qras on qra_followers.idqra_followed = qras.idqras WHERE qra_followers.idqra =" +
                " ?",
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

};

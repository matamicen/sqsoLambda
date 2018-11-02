var fs = require('fs');
var mysql = require('mysql');
var async = require('async');

exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var result = {};
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

    let sub = event.context.sub;

    //***********************************************************
    var conn = await mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {

        result.qra = await getQRAinfo(sub);

        if (!result.qra) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);

        }

        result.following = await getFollowings(result.qra);

        result.followers = await getFollowers(result.qra);
        result.notifications = await getNotifications(result.qra);

        conn.destroy();
        response.body.error = 0;
        response.body.message = result;
        console.log("User Info " + response.body.message);
        return callback(null, response);
    }
    catch (e) {
        console.log("Error when select QRA to get ID of Owner");
        console.log(e);
        conn.destroy();
        response.body.error = 8;
        response.body.message = e;

        return callback(null, response);
    }

    function getQRAinfo(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("get QRA info from Congito ID");
            conn.query("SELECT * FROM qras where idcognito=? LIMIT 1", sub, function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info))[0]);
            });
        });
    }

    function getFollowings(qra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("get Followings");

            conn.query("SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_fol" +
                "lowers inner join qras on qra_followers.idqra_followed = qras.idqras WHERE qra_f" +
                "ollowers.idqra = ?",
                qra.idqras,
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }

    function getFollowers(qra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("get Followers");

            conn.query("SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_fol" +
                "lowers inner join qras on qra_followers.idqra = qras.idqras WHERE qra_followers." +
                "idqra_followed = ?",
                qra.idqras,
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }

    function getNotifications(qra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getNotifications");
            conn.query("SELECT qra_notifications.* FROM qra_notifications where idqra = ? and qra_notifications.read IS NU" +
            "LL order by qra_notifications.datetime DESC",
                qra.idqras,
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

var fs = require('fs');
var mysql = require('mysql');
var async = require('async');

exports.handler = async(event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;

    var Sub;
    var msg;
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

    if (event.sub) {
        Sub = event.sub;
    }
    else if (event.context.sub) {
        Sub = event.context.sub;
    }



    //***********************************************************
    var conn = await mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {


        var qra = await getQRAinfo(Sub);

        if (qra.length === 0) {
            console.log("User does not exist");
            conn.destroy();
            msg = {
                "error": "1",
                "message": "User does not exist"
            };
            callback("User does not exist");
            return context.fail(msg);
        }
        result.qra = await JSON.parse(JSON.stringify(qra))[0];

        var followings = await getFollowings(JSON.parse(JSON.stringify(qra))[0]);

        result.followings = await JSON.parse(JSON.stringify(followings));

        var followers = await getFollowers(JSON.parse(JSON.stringify(qra))[0]);

        result.followers = await JSON.parse(JSON.stringify(followers));

    
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
        callback(e.message);
        msg = {
            "error": "1",
            "message": "Error when select QRA to get ID of Owner"
        };
        return context.fail(msg);
    }

    function getQRAinfo(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on
            // this tick. Alternately, try/catch and reject(err) on catch.
            console.log("get QRA info from Congito ID");
            conn.query("SELECT * from qras where qras.idcognito=?", sub, function(err, info) {
                // Call reject on error states,
                // call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(info);
            });
        });
    }

    function getFollowings(qra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on
            // this tick. Alternately, try/catch and reject(err) on catch.
            console.log("get Followings");
            
            conn.query("SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_followers inner join qras on qra_followers.idqra_followed = qras.idqras WHERE qra_followers.idqra = ?", qra.idqras, function(err, info) {
                // Call reject on error states,
                // call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(info);
            });
        });
    }

    function getFollowers(qra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on
            // this tick. Alternately, try/catch and reject(err) on catch.
            console.log("get Followers");
            
            conn.query("SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_followers inner join qras on qra_followers.idqra = qras.idqras WHERE qra_followers.idqra_followed = ?", qra.idqras, function(err, info) {
                // Call reject on error states,
                // call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(info);
            });
        });
    }
};


var mysql = require('mysql');
const warmer = require('lambda-warmer');

exports.handler = async(event, context, callback) => {

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
        let idqras_owner = await checkQraCognito(sub);
        if (!idqras_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            conn.destroy();
            return callback(null, response);
        }
        console.log("getQra");
        var idqra_follower = await getQra(qra);
        if (!idqra_follower) {
            console.log("User does not exist");
            response.body.error = 400;
            response.body.message = "Error: FOLLOWER User does not exist";
            conn.destroy();
            return callback(null, response);
        }
        console.log("checkQraAlreadyFollowing");
        let info = await checkQraAlreadyFollowing(idqras_owner, idqra_follower);
        if (info.length === 0) {
            console.log("QRA not followed");
            response.body.error = 400;
            response.body.message = info;
            return callback(null, response);
        }
        console.log("insertFollower");
        let affectedRows = await deleteFollower(idqras_owner, idqra_follower);

        if (affectedRows) {
            console.log("UpdateFollowersCounterInQra");
            info = await UpdateFollowersCounterInQra(idqra_follower);

            console.log("getFollowers");
            info = await getFollowers(idqras_owner);
            if (info) {
                conn.destroy();
                response.body.error = 0;
                response.body.message = info;
                console.log("follower deleted ");
                return callback(null, response);
            }
        }

    }
    catch (e) {
        console.log("Error executing QRA Follower Del");
        console.log(e);
        conn.destroy();
        callback(e.message);
        response.body.error = 1;
        response.body.message = e;
        conn.destroy();
        return callback(null, response);
    }

    function UpdateFollowersCounterInQra(idqras) {

        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. 
            conn
                .query('UPDATE qras SET qras.followers_counter = (qras.followers_counter - 1)  WHERE idqras=?', idqras, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));

                });
        });
    }

    function checkQraCognito(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. 
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

    function deleteFollower(idqra_owner, idqra_follower) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("DELETE FROM qra_followers where idqra=? and idqra_followed=?", [
                    idqra_owner, idqra_follower
                ], function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).affectedRows);
                });
        });
    }

    function getFollowers(idqra_owner) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log(idqra_owner);
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
}

var mysql = require('mysql');

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

    var bio = event.body.bio;
    var datetime = new Date();

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

        let qra_owner = await checkQraCognito(event.context.sub);
        if (!qra_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }

        let info = await updateBio(bio, qra_owner);
        if (info.affectedRows) {
            let followingMe = await getFollowingMe(qra_owner.idqras);
            console.log("saveActivity");
            let idActivity = await saveActivity(qra_owner, datetime);
            if (idActivity) {
                console.log("createNotifications");
                await createNotifications(idActivity, qra_owner, datetime, followingMe);
            }
            qra_owner.bio = bio;
            response.body.message = qra_owner;
            response.body.error = 0;
        }
        else {
            response.body.message = info;
            response.body.error = 1;
        }
        conn.destroy();

        return callback(null, response);

    }
    catch (e) {
        console.log("Error executing QRA Bio Update");
        console.log(e);
        conn.destroy();
        callback(e.message);
        response.body.error = 1;
        response.body.message = e.message;
        callback(null, response);
        return context.fail(response);
    }

    function updateBio(bio, qra_owner) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateBIO");
            //***********************************************************
            conn.query('UPDATE qras SET bio = ?  WHERE idqras=?', [
                bio, qra_owner.idqras
            ], function(err, info) {
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
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito");
            conn.query("SELECT * FROM qras where idcognito=? LIMIT 1", sub, function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info))[0]);
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

    function saveActivity(qra_owner, datetime) {

        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("INSERT INTO qra_activities SET idqra = ?, activity_type='50', datetime=?", [
                    qra_owner.idqras, datetime
                ], function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                });
        });
    }

    async function createNotifications(idActivity, qra_owner, datetime, followers) {

        //inform followings the action
        for (var i = 0; i < followers.length; i++) {

            await insertNotification(idActivity, followers[i], qra_owner, datetime);

        }
    }

    function insertNotification(idActivity, follower, qra_owner, datetime) {
        console.log("InsertNotification ", follower.idqra);

        let message;
        let final_url;

        message = qra_owner.qra + " updated his Biografy";
        final_url = url + qra_owner.qra;

        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=?, datetime=?, activ" +
                    "ity_type='50', qra=?,  qra_avatarpic=?, message=?, url=?", [
                        follower.idqra,
                        idActivity,
                        datetime,
                        qra_owner.qra,
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
};

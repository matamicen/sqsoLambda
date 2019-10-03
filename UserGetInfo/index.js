var mysql = require('mysql');

const warmer = require('lambda-warmer');

exports.handler = async(event, context, callback) => {
    console.log(event);
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
    var result = {};
    try {

        let qra = await getQRAinfo(event.context.sub);
        const {
            bio,
            idqras,
            idcognito,
            identityId,
            ...noBio
        } = qra;
        result.qra = noBio;
        if (!result.qra) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);

        }
        let account_type = await getAccountInfo(qra);
        result.qra = { ...result.qra,
            account_type
        };

        result.following = await getFollowings(qra);

        result.followers = await getFollowers(qra);
        result.notifications = await getNotifications(qra);

        await updateLastLoginInQra(qra.idqras);
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

    function getAccountInfo(qra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("get Account Info");

            conn.query("SELECT * from account_types where idaccount_types = ?",
                qra.account_type,
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0]);
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
  conn.query("SELECT n.idqra_notifications, n.activity_type, n.qra, n.message, n.REF_QRA, n.QSO_GUID,  q.avatarpic as qra_avatarpic " +
                " FROM qra_notifications as n " +
                " inner join qras as q " +
                " on n.qra = q.QRA where idqra = ? order by " +
                "n.idqra_notifications DESC",
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

    function updateLastLoginInQra(idqra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("UPDATE sqso.qras SET last_login = NOW()  WHERE idqras=?", idqra, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    // console.log(info);
                });
        });
    }
};

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

    try {
        let idqras_owner = await getQRA(event.context.sub);
        if (!idqras_owner) {
            console.log("QRA does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "QRA does not exist";

            callback("User does not exist");
            return context.fail(response);
        }
        let qra_output = await getQRAinfo(idqras_owner);
        console.log(qra_output);
        conn.destroy();
        response.body.error = 0;
        response.body.message = qra_output;
        context.succeed(response);

    }
    catch (e) {
        console.log("Error when select QRA");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Error when select QRA"
        return context.fail(response);
    }

    function getQRA(sub) {
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
    async function getQRAinfo(idqra) {
        let qra_output = {};
        qra_output.qra = await getQRAdata(idqra);
        qra_output.following = await getQRAfollowing(idqra);
        qra_output.followers = await getQRAfollowers(idqra);
        // qra_output.qsos = await getQRAqsos(idqra);
        return (qra_output);
    }

    function getQRAdata(idqra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT * from qras where qras.idqras=?", idqra, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info))[0]);
                });
        });
    }

    function getQRAfollowing(idqra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_followers inner joi" +
                    "n qras on qra_followers.idqra_followed = qras.idqras WHERE qra_followers.idqra =" +
                    " ?",
                    idqra,
                    function(err, info) {
                        // Call reject on error states, call resolve with results
                        if (err) {
                            return reject(err);
                        }
                        resolve(JSON.parse(JSON.stringify(info)));
                    });
        });
    }

    function getQRAfollowers(idqra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_followers inner joi" +
                    "n qras on qra_followers.idqra = qras.idqras WHERE qra_followers.idqra_followed =" +
                    " ?",
                    idqra,
                    function(err, info) {
                        // Call reject on error states, call resolve with results
                        if (err) {
                            return reject(err);
                        }
                        resolve(JSON.parse(JSON.stringify(info)));
                    });
        });
    }

    function getQRAqsos(idqra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            conn
                .query("CALL qraqsofeedget2(?)", idqra, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    let qsos = JSON.parse(JSON.stringify(info))[0];
                    let qso_qras = JSON.parse(JSON.stringify(info))[1];
                    let qso_comments = JSON.parse(JSON.stringify(info))[2];
                    let qso_likes = JSON.parse(JSON.stringify(info))[3];
                    let qso_media = JSON.parse(JSON.stringify(info))[4];
                    let qso_orig = JSON.parse(JSON.stringify(info))[5];
                    let qso_links = JSON.parse(JSON.stringify(info))[6];

                    qsos.map(qso => {
                        qso.qras = qso_qras.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
                        qso.comments = qso_comments.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
                        qso.likes = qso_likes.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
                        qso.media = qso_media.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
                        qso.original = qso_orig.filter(obj => obj.idqsos === qso.idqso_shared);
                        qso.links = qso_links.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
                    });

                    resolve(qsos);

                });
        });

    }

};

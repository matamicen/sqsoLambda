var mysql = require('mysql');

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

    let qra = event.body.qra;

    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });

    try {
        let idqras_owner = await getQRA(qra);
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

    } catch (e) {
        console.log("Error when select QRA");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Error when select QRA"
        return context.fail(response);
    }
    function getQRA(qra) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            conn
                .query("SELECT idqras FROM qras where qras.qra=? LIMIT 1", qra, function (err, info) {
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
        qra_output.qsos = await getQRAqsos(idqra);
        return (qra_output);
    }
    function getQRAdata(idqra) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT * from qras where qras.idqras=?", idqra, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info))[0]);
                });
        });
    }
    function getQRAfollowing(idqra) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qra_followers.*,  qras.qra, qras.profilepic, avatarpic  from qra_followers inner joi" +
                        "n qras on qra_followers.idqra_followed = qras.idqras WHERE qra_followers.idqra =" +
                        " ?",
                idqra, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }
    function getQRAfollowers(idqra) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qra_followers.*,  qras.qra, qras.profilepic, avatarpic  from qra_followers inner joi" +
                        "n qras on qra_followers.idqra = qras.idqras WHERE qra_followers.idqra_followed =" +
                        " ?",
                idqra, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }
    function getQRAqsos(idqra) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            conn
                .query("CALL qraqsofeedget2(?)", qra, function (err, info) {
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
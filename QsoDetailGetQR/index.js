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

    let guid = event.body.qso;

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
        let qra = await checkQraCognito(event.context.sub);

        if (!qra) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }
        let qso = {};
        qso = await getQso(guid);
        if (!qso) {
            console.log("QSO does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "QSO does not exist";
            return callback(null, response);
        }

        await UpdateScansInQraOwner(qra.idqras);
        conn.destroy();
        response.body.error = 0;
        response.body.message = {
            qso: qso,
            monthly_scans: qra.monthly_scans + 1,
            monthly_links: qra.monthly_links
        };

        return callback(null, response);

    }
    catch (e) {
        console.log("Error executing QSO Get Detail");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e.message;

        return callback(null, response);
    }

    function checkQraCognito(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito");
            conn.query("SELECT qras.idqras, monthly_scans, monthly_links FROM qras where idcognito=? ",
                sub,
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0]);
                });
        });
    }
    async function getQso(guid) {
        let lqso = {};
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            conn
                .query("CALL `qso-detail-get-qr`(?)", guid, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    let qso_comments = JSON.parse(JSON.stringify(info))[2];
                    let qso_likes = JSON.parse(JSON.stringify(info))[3];
                    lqso = JSON.parse(JSON.stringify(info))[0][0];
                    lqso['qras'] = JSON.parse(JSON.stringify(info))[1];
                    lqso.comments = qso_comments.filter(obj => obj.idqso === lqso.idqsos);
                    lqso.likes = qso_likes.filter(obj => obj.idqso === lqso.idqsos);
                    lqso.media = JSON.parse(JSON.stringify(info))[4];
                    lqso.original = JSON.parse(JSON.stringify(info))[5];
                    lqso.links = JSON.parse(JSON.stringify(info))[6];

                    resolve(lqso);
                });
        });

    }

    function UpdateScansInQraOwner(idqras) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateLinksInQraOwner" + idqras);
            conn.query('UPDATE sqso.qras SET monthly_scans = monthly_scans+1 WHERE idqras=?', [idqras], function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));

            });
        });
    }
};

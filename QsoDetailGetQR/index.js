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
    let isScan = event.body.scan;
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
    let scanCounter = 0;
    try {
        let qra = await checkQraCognito(event.context.sub);
        if (isScan) 
            scanCounter = 1;
        if (!qra) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }
        let qso = {};
        qso = await getQsoLinks(await getQso(guid));
        updateViewsCounterInQsos(qso.idqsos);
        if (!qso) {
            console.log("QSO does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "QSO does not exist";
            return callback(null, response);
        }

        await UpdateScansInQraOwner(qra.idqras, scanCounter);
        await updateScansCounterInQso(qso.idqsos);
        conn.destroy();
        response.body.error = 0;
        response.body.message = {
            qso: qso,
            monthly_scans: qra.monthly_scans + scanCounter,
            monthly_links: qra.monthly_links
        };

        return callback(null, response);

    } catch (e) {
        console.log("Error executing QSO Get Detail");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e.message;

        return callback(null, response);
    }

    function checkQraCognito(sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito");
            conn.query("SELECT qras.idqras, monthly_scans, monthly_links FROM qras where idcognito=? ", sub, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                if (info.length > 0) {
                    resolve(JSON.parse(JSON.stringify(info))[0]);
                } else {
                    resolve();
                }
            });
        });
    }
    async function getLink(GUID_QR) {
        return new Promise(function (resolve, reject) {
            let link = getQso(GUID_QR);

            resolve(link);
        });
    }
    async function getQsoLinks(qso) {
        if (!qso) 
            return null;
        let links = qso.links;
        const p2 = links.map(async l => {
            console.log(l.GUID_QR);
            l = await getLink(l.GUID_QR);
            return l;
        });
        qso.links = await Promise.all(p2);

        return qso;
    }

    async function getQso(guid) {
        console.log("getQso");
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            conn
                .query("CALL `qso-detail-get-qr`(?)", guid, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    let qso = JSON.parse(JSON.stringify(info))[0][0];
                    let qso_qras = JSON.parse(JSON.stringify(info))[1];
                    let qso_comments = JSON.parse(JSON.stringify(info))[2];
                    let qso_likes = JSON.parse(JSON.stringify(info))[3];
                    let qso_media = JSON.parse(JSON.stringify(info))[4];
                    let qso_orig = JSON.parse(JSON.stringify(info))[5];
                    let qso_links = JSON.parse(JSON.stringify(info))[6];

                    if (!qso) 
                        return resolve();
                    
                    qso.qras = qso_qras.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);

                    qso.comments = qso_comments.filter(obj => obj.idqso === qso.idqsos);

                    qso.likes = qso_likes.filter(obj => obj.idqso === qso.idqsos);

                    qso.media = qso_media.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);

                    qso.original = qso_orig.filter(obj => obj.idqsos === qso.idqso_shared);

                    qso.links = qso_links.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);

                    resolve(qso);
                });
        });
    }

    function updateViewsCounterInQsos(idqsos) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("UPDATE sqso.qsos SET views_counter = views_counter+1  WHERE idqsos=?", idqsos, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    // console.log(info);
                });
        });
    }

    function updateScansCounterInQso(idqso) {
        console.log("updateScansCounterInQra");
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("UPDATE sqso.qsos SET scans_counter = scans_counter+1  WHERE idqsos=?", idqso, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    // console.log(info);
                });
        });
    }

    function UpdateScansInQraOwner(idqras, scanCounter) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateLinksInQraOwner" + idqras);
            conn.query('UPDATE sqso.qras SET monthly_scans = monthly_scans+? WHERE idqras=?', [
                scanCounter, idqras
            ], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));

            });
        });
    }
};

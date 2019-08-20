var mysql = require('mysql');
var warmer = require('lambda-warmer');

exports.handler = async(event, context, callback) => {
    console.log(event);
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

    let qra = event.body.qra;
    let sub = event.context.sub;
    //***********************************************************
    if (!event['stage-variables']) {
        console.log("Stage Variables Missing");
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }
    let url = event['stage-variables'].url;
    var conn = await mysql.createConnection({
        host: event['stage-variables'].db_host, // give your RDS endpoint  here
        user: event['stage-variables'].db_user, // Enter your  MySQL username
        password: event['stage-variables'].db_password, // Enter your  MySQL password
        database: event['stage-variables'].db_database // Enter your  MySQL database name.
    });

    try {
        let idqras_owner = await getQRA(qra);
        if (!idqras_owner) {
            console.log("QRA does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "QRA does not exist";

            return callback(null, response);
        }
        let qra_output = await getQRAinfo(idqras_owner);
        await updateViewsCounterInQra(idqras_owner);
        if (sub) {
            qra_output.monthly_qra_views = await getMonthlyViewsCounter(sub) + 1;

            await updateMonthlyViewsCounterInQra(sub);
        }

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

    function getQRA(qra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            conn
                .query("SELECT idqras FROM qras where qras.qra=?", qra, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    if (info.length > 0)
                        resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                    else
                        resolve();


                });
        });
    }

    function getMonthlyViewsCounter(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            conn
                .query("SELECT monthly_qra_views FROM qras where idcognito=?", sub, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info))[0].monthly_qra_views);
                });
        });
    }

    function updateMonthlyViewsCounterInQra(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("UPDATE sqso.qras SET monthly_qra_views = monthly_qra_views+1  WHERE idcognito=?", sub, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    console.log(info);
                });
        });
    }

    function updateViewsCounterInQra(idqras) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("UPDATE sqso.qras SET views_counter = views_counter+1  WHERE idqras=?", idqras, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    // console.log(info);
                });
        });
    }
    async function getQRAinfo(idqra) {
        let qra_output = {};
        qra_output.qra = await getQRAdata(idqra);
        qra_output.following = await getQRAfollowing(idqra);
        qra_output.followers = await getQRAfollowers(idqra);
        let qsos = await getQRAqsos(idqra);
        qra_output.qsos = await processQsos(qsos);
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
                .query("SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_fol" +
                    "lowers inner join qras on qra_followers.idqra_followed = qras.idqras WHERE qra_f" +
                    "ollowers.idqra = ?",
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
                .query("SELECT qra_followers.*,  qras.qra, qras.profilepic, qras.avatarpic  from qra_fol" +
                    "lowers inner join qras on qra_followers.idqra = qras.idqras WHERE qra_followers." +
                    "idqra_followed = ?",
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
                .query("CALL qraqsofeedget2(?)", qra, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }
    async function processQsos(qsos) {
        let qsos_aux = qsos[0];

        let qso_qras = qsos[1];
        let qso_comments = qsos[2];
        let qso_likes = qsos[3];
        let qso_media = qsos[4];
        let qso_orig = qsos[5];
        let qso_links = qsos[6];
        let qsosOutput = [];

        for (let i = 0; i < qsos_aux.length; i++) {
            let qso = qsos_aux[i];
            if (i % 2 === 0 && i !== 0) { //     console.log('Ad')

                qsosOutput.push({ type: 'AD', source: 'FEED' });

            }
            qso.qras = qso_qras.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
            qso.comments = qso_comments.filter(obj => obj.idqso === qso.idqsos);
            qso.likes = qso_likes.filter(obj => obj.idqso === qso.idqsos);
            qso.media = qso_media.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
            qso.original = qso_orig.filter(obj => obj.idqsos === qso.idqso_shared);
            qso.links = qso_links.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
            qsosOutput.push(qso);
        }
        return (qsosOutput);
    }

};

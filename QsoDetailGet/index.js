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

    let guid = event.body.guid;

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
        var qso = {};
        qso = await getQso(guid);
        if (!qso) {
            console.log("QSO does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "QSO does not exist";

            return callback(null, response);
        }
        await updateViewsCounterInQsos(qso.idqsos);
        if (event.context.sub) 
            await updateMonthlyViewsCounterInQra(event.context.sub);
        conn.destroy();
        response.body.error = 0;
        response.body.message = qso;
        console.log("new follower ");
        return callback(null, response);

    } catch (e) {
        console.log("Error executing QSO Get Detail");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e.message;

        return callback(null, response);
    }
    async function getQso(guid) {
        let qso = {};
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            conn
                .query("CALL `qso-detail-get`(?)", guid, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    let qso_comments = JSON.parse(JSON.stringify(info))[2];
                    let qso_likes = JSON.parse(JSON.stringify(info))[3];
                    qso = JSON.parse(JSON.stringify(info))[0][0];
                    qso['qras'] = JSON.parse(JSON.stringify(info))[1];
                    qso.comments = qso_comments.filter(obj => obj.idqso === qso.idqsos);
                    qso.likes = qso_likes.filter(obj => obj.idqso === qso.idqsos);
                    qso.media = JSON.parse(JSON.stringify(info))[4];
                    qso.original = JSON.parse(JSON.stringify(info))[5];
                    qso.links = JSON.parse(JSON.stringify(info))[6];

                    resolve(qso);
                });
        });

    }

    function updateMonthlyViewsCounterInQra(sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("UPDATE sqso.qras SET monthly_qso_views = monthly_qso_views+1  WHERE idcognito=?", sub, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    // console.log(info);
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
};

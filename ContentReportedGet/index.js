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

    var sub = event.context.sub;

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
        let idqras_owner = await getQRAadmin(sub);
        if (!idqras_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }

        let info = await getContentReported();

        console.log("Reported Content found");
        response.body.error = 0;
        response.body.message = info;
        return callback(null, response);

    }
    catch (e) {
        console.log("Error executing Reported Content Get");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e;
        callback(null, response);
        return context.fail(response);
    }

    function getContentReported() {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getContentReported");
            conn.query("SELECT cr.*, qras.qra, qsos.datetime as qso_datetime, qsos.GUID_URL, qr.qra as q" +
            "so_owner, cmt.comment, qrcmt.qra as cmtqra, m.url  FROM content_reported as cr i" +
            "nner join qras on cr.idqra  = qras.idqras inner join qsos on cr.idqso = qsos.idq" +
            "sos inner join qras as qr on qsos.idqra_owner = qr.idqras LEFT OUTER JOIN qsos_c" +
            "omments as cmt on cr.idcomment = cmt.idqsos_comments LEFT OUTER JOIN qras as qrc" +
            "mt on cmt.idqra = qrcmt.idqras LEFT OUTER JOIN qsos_media as m on cr.idmedia = m" +
            ".idqsos_media   where cr.deleted is null order by datetime desc",
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    if (info.length > 0) {
                        resolve(JSON.parse(JSON.stringify(info)));
                    }
                    else {
                        resolve();
                    }
                });
        });
    }

    function getQRAadmin(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQRA");
            conn.query("SELECT qras.idqras FROM qras inner join users on qras.idqras = users.idqras where " +
                "qras.idcognito=? and users.admin=1 ",
                sub,
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    if (info.length > 0) {
                        resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                    }
                    else {
                        resolve();
                    }
                });
        });
    }

};

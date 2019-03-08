
var mysql = require('mysql');
// var async = require('async');
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';


exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var sub;
    var qso;
    var idcomment;
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

    if (event.qso) {
        qso = event.qso;
        idcomment = event.idcomment;
        sub = event.sub;
    } else {
        qso = event.body.qso;
        idcomment = event.body.idcomment;
        sub = event.context.sub;
    }
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
        
        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }
    var url = event['stage-variables'].url;
    var conn = mysql.createConnection({
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
            return callback(null, response);
        }
        let info = await deleteComment(idcomment);
        if (info) {
            await UpdateCommentCounterInQso(qso);
            conn.destroy();
            response.body.error = 0;
            response.body.message = info;
            console.log("comment deleted ");
            return callback(null, response);
        }

    } catch (e) {
        console.log("Error executing QRA Comment Del");
        console.log(e);
        conn.destroy();
        callback(e.message);
        response.body.error = 1;
        response.body.message = e.message;
        return callback(null, response);
    }
    function UpdateCommentCounterInQso(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateCommentCounterInQso");
            //***********************************************************
            conn.query('UPDATE sqso.qsos SET comments_counter = comments_counter-1  WHERE idqsos=?', qso, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }
    function deleteComment(idcomment) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("insertComment");
            conn.query('UPDATE qsos_comments SET deleted=1 WHERE idqsos_comments=?', [idcomment], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function checkQraCognito(sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito");
            conn.query("SELECT idqras FROM qras where idcognito=? LIMIT 1", sub, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                if (info.length > 0) {
                    resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                } else {
                    resolve();
                }
            });
        });
    }

};

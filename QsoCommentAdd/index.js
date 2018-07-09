var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
var lambda = new AWS.Lambda();

exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var sub;
    var qso;
    var datetime;
    var comment;
    var payload;
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
        comment = event.comment;
        datetime = event.datetime;
        sub = event.sub;
    } else {
        qso = event.body.qso;
        comment = event.body.comment;
        datetime = event.body.datetime;
        sub = event.context.sub;
    }

    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
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
        let insertId = await insertComment(qso, idqras_owner, datetime, comment);
        if (insertId) {
            await UpdateCommentCounterInQso(qso);
            await pushNotification(qso, insertId);
            let info = await getComments(qso);
            if (info) {
                conn.destroy();
                response.body.error = 0;
                response.body.message = info;
                console.log("new comment ");
                return callback(null, response);
            }
        }
    } catch (e) {
        console.log("Error executing QRA Comment Add");
        console.log(e);
        conn.destroy();
        callback(e.message);
        var msg = {
            "error": 1,
            "message": e.message
        };
        return context.fail(msg);
    }
    function UpdateCommentCounterInQso(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateCommentCounterInQso");
            //***********************************************************
            conn.query('UPDATE sqso.qsos SET comments_counter = comments_counter+1  WHERE idqsos=?', qso, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }
    function insertComment(idqso, idqra, datetime, comment) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("insertComment");
            conn.query('INSERT INTO qsos_comments SET idqso = ?, idqra=?, datetime=?, comment=?', [
                qso, idqra, datetime, comment
            ], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)).insertId);
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
    function getComments(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getComments");
            conn.query("SELECT qsos_comments.*, qras.qra FROM qsos_comments inner join qras on qsos_comm" +
                    "ents.idqra = qras.idqras where  idqso=?",
            qso, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function pushNotification(qso, commentID) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("pushNotification");
            payload = {
                "commentID": commentID,
                "qso": qso
            };
            var params = {
                FunctionName: 'snsPushUser', // the lambda function we are going to invoke
                InvocationType: 'RequestResponse',
                LogType: 'Tail',
                Payload: JSON.stringify(payload)
            };

            lambda.invoke(params, function (err, data) {
                if (err) {
                    console.log(err);
                    return reject(err);
                } else {
                    console.log("push OK");
                    resolve();
                }
            });
        });
    }

};
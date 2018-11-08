var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
var lambda = new AWS.Lambda();

exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

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

    var idqso = event.body.qso;
    var comment = event.body.comment;
    var datetime = event.body.datetime;
    var sub = event.context.sub;

    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {
        let qra_owner = await checkQraCognito(sub);
        if (!qra_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }
        let insertId = await insertComment(idqso, qra_owner.idqras, datetime, comment);
        if (insertId) {
            let qso = await getQsoInfo(idqso);
            console.log("saveActivity");
            let idActivity = await saveActivity(qra_owner.idqras, qso, insertId, datetime);
            if (idActivity) {
                console.log("getFollowing Me");
                let followers = await getFollowingMe(qra_owner.idqras);
                console.log("Get Stakeholders of QSO");
                let stakeholders = await getQsoStakeholders(idqso, qra_owner.idqras);
                console.log("get Other Comment Writters");
                let commentWriters = await getQsoCommentWriters(idqso, qra_owner.idqras);
                console.log("createNotifications");
                await createNotifications(idActivity, followers, stakeholders, commentWriters, qra_owner, qso, datetime);
            }
            await UpdateCommentCounterInQso(idqso);
            await pushNotification(idqso, insertId);
            let info = await getComments(idqso);
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

    function insertComment(idqsos, idqqras, datetime, comment) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("insertComment");
            conn.query('INSERT INTO qsos_comments SET idqso = ?, idqra=?, datetime=?, comment=?', [
                idqsos, idqras, datetime, comment
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
            conn.query("SELECT qras.idqras, qras.qra, qras.avatarpic FROM qras where idcognito=? LIMIT 1", sub, function (err, info) {
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
    function getQsoInfo(idqsos) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito");
            conn.query("SELECT qsos.idqsos, qsos.guid_URL FROM qsos where idqsos=? ", idqsos, function (err, info) {
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

    function saveActivity(idqras, idqsos, idcomment, datetime) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("INSERT INTO qra_activities SET idqra = ?, activity_type='18', ref_idqso=?, ref_i" +
                        "dqso_comment=?, datetime=?",
                [
                    idqras, idqsos, idcomment, datetime
                ], function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                });
        });
    }
    async function createNotifications(idActivity, followers, stakeholders, commentWriters, qra_owner, qso, datetime) {

        for (let i = 0; i < followers.length; i++) {
            await insertNotification(idActivity, followers[i].idqra, qra_owner, qso, datetime);
        }

        for (let i = 0; i < stakeholders.length; i++) {
            if (!followers.some(elem => elem.idqra === stakeholders[i].idqra)) {
                await insertNotification(idActivity, stakeholders[i].idqra, qra_owner, qso, datetime);
            }
        }

        for (let i = 0; i < commentWriters.length; i++) {
            if (!followers.some(elem => elem.idqra === commentWriters[i].idqra) && !stakeholders.some(elem => elem.idqra === commentWriters[i].idqra)) {

                await insertNotification(idActivity, commentWriters[i].idqra, qra_owner, qso, datetime);
            }
        }
    }

    function insertNotification(idActivity, idqra, qra_owner, qso, datetime) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("INSERT INTO qra_notifications SET idqra = ?, idqra_activity=? , datetime=?, acti" +
                        "vity_type='18', qra=?,  qra_avatarpic=?, QSO_GUID=? ",
                [
                    idqra,
                    idActivity,
                    datetime,
                    qra_owner.qra,
                    qra_owner.avatarpic,
                    qso.guid_URL
                ], function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).insertId);
                });
        });
    }

    function getFollowingMe(idqra_owner) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qra_followers.* from qra_followers WHERE qra_followers.idqra_followed = ?", idqra_owner, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }

    function getQsoStakeholders(idqso, idqraCommentOwner) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("Select distinct idqra from qsos_qras where idqso=? and idqra!=?", [
                    idqso, idqraCommentOwner
                ], function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });

    }

    function getQsoCommentWriters(idqso, idqraCommentOwner) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("Select distinct idqra from qsos_comments where idqso=? and idqra!=?", [
                    idqso, idqraCommentOwner
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

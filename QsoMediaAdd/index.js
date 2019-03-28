var mysql = require('mysql');
// var async = require('async');
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
var lambda = new AWS.Lambda();
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
    var qso = event.body.qso;
    var type = event.body.type;
    var url = event.body.url;
    var datasize = event.body.datasize;
    var datetime = event.body.datetime;
    var description = event.body.description;
    var height = event.body.height;
    var width = event.body.width;
    var identityId = event.body.identityId;

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
    if (!qso) {
        response.body.error = 1;
        response.body.message = "QSO parameter missing";

        return callback(null, response);
    }
    try {
        let qra_owner = await checkOwnerInQso(qso, sub);
        if (!qra_owner) {
            console.log("Caller is not QSO Owner");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "Caller is not QSO Owner";

            return callback(null, response);
        }

        if (!qra_owner.identityId) 
            await updateIdentityId(qra_owner, identityId);
        
        if (type === 'image') {
            let image_nsfw = await checkImageNSFW(url);

            if (image_nsfw === 'true') {
                await updateNSFWCounterInQra(qra_owner.idqras);
                console.log("Image is NSFW");
                conn.destroy();
                response.body.error = 1;
                response.body.message = "NSFW";
                // callback("User does not exist");
                return callback(null, response);
            }
        }
        let info;
        try {
            info = await addQSOMedia(qso, type, url, datasize, datetime, description, height, width);
        } catch (e) {
            console.log(e.code);
            info = {
                affectedRows: 1
            };

        }
        if (info.affectedRows) {
            console.log("QSOMEDIA inserted", info.insertId);
            conn.destroy();
            response.body.error = 0;
            response.body.message = url;
            return callback(null, response);
        } //ENDIF
    } catch (e) {
        console.log("Error executing Qso Media add");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e;
        callback(null, response);
        return context.fail(response);
    }

    function updateIdentityId(qra_owner, identityId) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateIdentityId");
            //***********************************************************
            conn.query('UPDATE qras SET identityId = ?  WHERE idqras=?', [
                identityId, qra_owner.idqras
            ], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }

    function checkOwnerInQso(idqso, sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qras.idqras, qras.identityId from qras inner join qsos on qras.idqras = q" +
                        "sos.idqra_owner where qsos.idqsos=? and qras.idcognito=?",
                [
                    idqso, sub
                ], function (err, info) {
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

    function addQSOMedia(qso, type, url, datasize, datetime, description, height, width) {

        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("addQSOMedia");

            //***********************************************************
            conn.query('INSERT INTO qsos_media SET idqso = ?, type = ?, url = ?, datasize = ?, datetime ' +
                    '= ?, description=?, height=?, width=?',
            [
                qso,
                type,
                url,
                datasize,
                datetime,
                description,
                height,
                width
            ], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                } else {
                    resolve(JSON.parse(JSON.stringify(info)));
                }
                // console.log(info);
            });

        });
    }

    function checkImageNSFW(url) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log(" checkImage(url)");

            //PUSH Notification
            var payload = {
                "body": {
                    "url": url
                }
            };
            var params = {
                FunctionName: 'image-check-nsfw', // the lambda function we are going to invoke
                InvocationType: 'RequestResponse',
                LogType: 'Tail',
                Payload: JSON.stringify(payload)
            };

            lambda.invoke(params, function (err, data) {
                console.log("lambda");
                if (err) {
                    console.log("error");
                    console.log(err);
                    return reject(err);
                } else {
                    console.log(data.Payload);
                    resolve(data.Payload);
                }
            });

        });
    }

    function updateNSFWCounterInQra(idqras) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query("UPDATE sqso.qras SET nsfw_counter = nsfw_counter+1  WHERE idqras=?", idqras, function (err, info) {
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

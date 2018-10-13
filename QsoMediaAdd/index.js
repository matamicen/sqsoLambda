var mysql = require('mysql');
// var async = require('async');
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';
var lambda = new AWS.Lambda();

exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var sub;
    var datetime;
    var type;
    var url;
    var datasize;
    var qra_owner;
    var qso;
    var description;
    var height;
    var width;

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
    sub = event.context.sub;
    qso = event.body.qso;
    type = event.body.type;
    url = event.body.url;
    datasize = event.body.datasize;
    datetime = event.body.datetime;
    description = event.body.description;
    height = event.body.height;
    width = event.body.width;

    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {
        let idqras_owner = await checkOwnerInQso(qso, sub);
        if (!idqras_owner) {
            console.log("Caller is not QSO Owner");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            callback("User does not exist");
            return context.fail(response);
        }
        if (type === 'image') {
            let image_nsfw = await checkImageNSFW(url);
            if (image_nsfw) {
                console.log("Image is NSFW");
                conn.destroy();
                response.body.error = 1;
                response.body.message = "NSFW";
                // callback("User does not exist");
                return callback(null, response);
            }
        }
        let info = await addQSOMedia(qso, type, url, datasize, datetime, description, height, width);

        if (info.affectedRows) {
            await triggerSNS(qso, info.insertID, idqras_owner, qra_owner);
            console.log("QSOMEDIA inserted", info.insertId);
            conn.destroy();
            response.body.error = 0;
            response.body.message = url;
            return callback(null, response);
        } //ENDIF
    }
    catch (e) {
        console.log("Error executing Qso Media add");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e;
        callback(null, response);
        return context.fail(response);
    }

    function checkOwnerInQso(idqso, sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qras.idqras from qras inner join qsos on qras.idqras = qsos.idqra_owner w" +
                    "here qsos.idqsos=? and qras.idcognito=?", [
                        idqso, sub
                    ],
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

    function addQSOMedia(qso, type, url, datasize, datetime, description, height, width) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("addQSOMedia");

            //***********************************************************
            conn.query('INSERT INTO qsos_media SET idqso = ?, type = ?, url = ?, datasize = ?, datetime ' +
                '= ?, description=?, height=?, width=?', [
                    qso,
                    type,
                    url,
                    datasize,
                    datetime,
                    description,
                    height,
                    width
                ],
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    else {
                        resolve(JSON.parse(JSON.stringify(info)));
                    }
                    // console.log(info);
                });
        });
    }

    function triggerSNS(qso, insertID, idqra_owner, qra_owner) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("triggerSNS");

            //PUSH Notification
            var payload = {
                "commentID": insertID,
                "qso": qso,
                "owner": idqra_owner
            };
            var params = {
                FunctionName: 'SNS-Media-Add', // the lambda function we are going to invoke
                InvocationType: 'RequestResponse',
                LogType: 'Tail',
                Payload: JSON.stringify(payload)
            };

            lambda.invoke(params, function(err, data) {
                console.log("lambda");
                if (err) {
                    return reject(err);
                }
                else {
                    resolve();
                }
            });

        });
    }

    function checkImageNSFW(url) {
        return new Promise(function(resolve, reject) {
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

            lambda.invoke(params, function(err, data) {
                console.log("lambda");
                if (err) {
                    console.log("error");
                    console.log(err);
                    return reject(err);
                }
                else {
                    console.log(data.Payload);
                    resolve(data.Payload);
                }
            });

        });
    }

}

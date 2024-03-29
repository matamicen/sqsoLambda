var mysql = require('mysql');
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

    var url_profilepic = event.body.url;
    var url_avatar = event.body.url_avatar;
    var sub = event.context.sub;
    var mode = event.body.mode;

    //***********************************************************
    var identityId = event.body.identityId;
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
        if (mode === 'NSFW') {
            let image_nsfw = await checkImageNSFW(url_profilepic);
            if (image_nsfw === 'true') {
                console.log("Image is NSFW");
                conn.destroy();
                response.body.error = 1;
                response.body.message = "NSFW";
                // callback("User does not exist");
                return callback(null, response);
            } else {
                console.log("Image is not NSFW");
                conn.destroy();
                response.body.error = 0;
                response.body.message = "OK";
                // callback("User does not exist");
                return callback(null, response);
            }
        } else if (mode === 'PERSIST') {
            let info = await updatePic(url_profilepic, sub, url_avatar);
           
            await updateIdentityId(sub, identityId);
        
            if (info.affectedRows) {

                console.log("QRA Profile Pic updated", info.affectedRows);
                conn.destroy();
                response.body.error = 0;
                response.body.message = info;
                return callback(null, response);
            } else {
                console.log("QRA not found");
                conn.destroy();
                response.body.error = 1;
                response.body.message = "QRA not found";
                return callback(null, response);
            } //ENDIF
        }
    } catch (e) {
        console.log("Error executing QRA set Profile PIC");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e;
        callback(null, response);
        return context.fail(response);
    }
    function updateIdentityId(sub, identityId) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateIdentityId");
            //***********************************************************
            conn.query('UPDATE qras SET identityId = ?  WHERE idcognito=? and identityId is NULL', [
                identityId, sub
            ], function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }
    function updatePic(url_profilepic, sub, url_avatar) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("updatePic");

            //***********************************************************
            conn.query('UPDATE qras SET profilepic=?, avatarpic=? WHERE idcognito=?', [
                url_profilepic, url_avatar, sub
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

    function checkImageNSFW(url_profilepic) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log(" checkImage(url_profilepic)");

            //PUSH Notification
            var payload = {
                "body": {
                    "url": url_profilepic
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
};

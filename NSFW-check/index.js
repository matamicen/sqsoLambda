var mysql = require('mysql');
const AWS = require('aws-sdk');
const warmer = require('lambda-warmer');
const rekognition = new AWS.Rekognition();
const request = require('request');
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

        let qra_owner = await checkQraCognito(event.context.sub);
        if (!qra_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }


        response.body.message = await isNSFW(event.body.url);
        if (response.body.message.length > 0)
            response.body.error = 1;
        else
            response.body.error = 0;

        conn.destroy();

        return callback(null, response);

    }
    catch (e) {
        console.log("Error executing QRA Bio Update");
        console.log(e);
        conn.destroy();
        callback(e.message);
        response.body.error = 1;
        response.body.message = e.message;
        callback(null, response);
        return context.fail(response);
    }

    function isNSFW(url) {
        return new Promise(function(resolve, reject) {
            request({
                method: "GET",
                url: url,
                encoding: null
            }, (err, response, body) => {
                if (err) {
                    reject(err);
                }

                rekognition.detectModerationLabels({
                    Image: {
                        Bytes: body
                    },
                    MinConfidence: 50.0
                }, (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(data.ModerationLabels);
                });
            });
        });
    }

    function checkQraCognito(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito");
            conn.query("SELECT * FROM qras where idcognito=? LIMIT 1", sub, function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info))[0]);
            });
        });
    }

};

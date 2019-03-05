var mysql = require('mysql');

var AWS = require("aws-sdk");
var pinpoint = new AWS.Pinpoint({ "region": 'us-east-1' });
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

        let result = await sendMessages(event.body.params);


        let status;
        let token;
        let counter = 0;
        for (let i = 0; i < Object.keys(result).length; i++) {

            // console.log(data.MessageResponse.Result[Object.keys(data.MessageResponse.Result)[i]])
            status = result[Object.keys(result)[i]].StatusCode;
            token = Object.keys(result)[i];
            console.log(token + " " + status);
            if (status !== 200)
                await deleteDevice(token);
            else {
                counter++;

            }
        }
        conn.destroy();
        response.body.error = 0;
        response.body.message = counter;
        return callback(null, response);
    }
    catch (e) {
        console.log("Error executing Send Messages");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = e.message;
        return callback(null, response);
    }





    function sendMessages(params) {
        console.log("sendMessages");

        return new Promise(function(resolve, reject) {

            pinpoint
                .sendMessages(params, function(err, data) {

                    if (err)
                        return reject(err);
                    else {

                        resolve(data.MessageResponse.Result);
                    }
                });
        });

    }

    function deleteDevice(token) {
        console.log("deleteDevice");
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // ***********************************************************
            conn
                .query('DELETE FROM push_devices where token=?', token, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);

                    }
                    else {

                        resolve(JSON.parse(JSON.stringify(info)));
                        console.log(JSON.parse(JSON.stringify(info)))
                    }

                });
        });
    }


};

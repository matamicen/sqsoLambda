var mysql = require('mysql');
const warmer = require('lambda-warmer');
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';

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

    //***********************************************************

    if (!event['stage-variables']) {
        console.log("Stage Variables Missing");
        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }



    try {
        var conn = await mysql.createConnection({
            host: event['stage-variables'].db_host, // give your RDS endpoint  here
            user: event['stage-variables'].db_user, // Enter your  MySQL username
            password: event['stage-variables'].db_password, // Enter your  MySQL password
            database: event['stage-variables'].db_database // Enter your  MySQL database name.
        });

        let idqras_owner = await getAdmin(sub);
        if (!idqras_owner) {
            console.log("QRA does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "QRA does not exist";

            return callback(null, response);
        }
        let users = await getUsers();
        conn.destroy();
        response.body.error = 0;
        response.body.message = users;
        context.succeed(response);

    }
    catch (e) {
        console.log("Error when select QRA");
        console.log(e);
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Error when select QRA";
        return context.fail(response);
    }

    function getAdmin(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            conn
                .query("SELECT qras.idqras FROM qras inner join users on qras.idqras = users.idqras wher" +
                    "e qras.idcognito=? and users.admin=1 ",
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
    async function getUsers() {

        let cognitoUsers = await getCognitoUsers();
        let qraUsers = await getQRAusers();
        let users = await concatAttr(cognitoUsers, qraUsers);

        return users;
    }

    function concatAttr(cognitoUsers, qraUsers) {
        console.log("concatAttr");
        let users = [];

        for (let i = 0; i < cognitoUsers.length; i++) {

            let sub = cognitoUsers[i]
                .Attributes
                .filter(obj => obj.Name === 'sub')[0].Value;

            let newUser = {
                ...cognitoUsers[i],
                ...qraUsers.filter(obj => obj.idcognito === sub)[0]
            };
            console.log(newUser);
            users.push(newUser);
        }
        return users;
    }

    function getCognitoUsers() {
        var params = {
            UserPoolId: event['stage-variables'].UserPoolId

        };
        return new Promise((resolve, reject) => {
            // AWS.config.update({ region: 'us-east-1', 'accessKeyId': AWS_ACCESS_KEY_ID,
            // 'secretAccessKey': AWS_SECRET_KEY });
            var cognitoidentityserviceprovider = new AWS.CognitoIdentityServiceProvider();
            cognitoidentityserviceprovider.listUsers(params, (err, data) => {
                if (err) {
                    console.log(err);
                    reject(err);
                }
                else {
                    resolve(data.Users);
                }
            });
        });
    }

    function getQRAusers() {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT * from qras", function(err, info) {
                    // Call reject on error states, call resolve with results

                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }
};

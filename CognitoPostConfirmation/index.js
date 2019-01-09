var mysql = require('mysql');
const warmer = require('lambda-warmer');


exports.handler = async(event, context, callback) => {

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

    var Sub = event.request.userAttributes.sub;
    var email = event.request.userAttributes.email;
    var birthdate = new Date(event.request.userAttributes.birthdate);
    var firstname = event.request.userAttributes["custom:firstName"];
    var lastname = event.request.userAttributes["custom:lastName"];
    var country = event.request.userAttributes["custom:country"];
    var Name = event
        .userName
        .toUpperCase();


    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {
        let info = await addQRA();
        conn.destroy();

        response.body.error = 0;
        response.body.message = info;

        context.done(null, event);
    }
    catch (e) {
        console.log("Error executing Cognito Post Processing");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e.message;

        return callback(null, response);
    }

    function addQRA() {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("addQRA");

            conn.query("INSERT INTO qras " +
                "(qra, email, birthday, idcognito, firstname, lastname, country)" +
                "VALUES( ? , ? , ? , ?, ?, ?, ?) " +
                "ON DUPLICATE KEY UPDATE email = ?, birthday = ?, idcognito = ?, firstname = ?, lastname = ?, country = ?", [
                    Name.toUpperCase(), email, birthdate, Sub, firstname, lastname, country, email, birthdate, Sub, firstname, lastname, country
                ],
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }
};

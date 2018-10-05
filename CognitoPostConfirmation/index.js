var mysql = require('mysql');

/**
 * Pass the data to send as `event.data`, and the request options as
 * `event.options`. For more information see the HTTPS module documentation
 * at https://nodejs.org/api/https.html.
 *
 * Will succeed with the response body.
 */

exports.handler = (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;
    console.log('Received event:', JSON.stringify(event, null, 2));

    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });

    conn.connect(function (err) { // connecting to database
        if (err) {
            console.log('error connecting: ' + err.stack);
            callback(err.stack);
        }
        console.log('connected as id ' + conn.threadId); //console.log(conn);
    });

    var Sub = event.request.userAttributes.sub;
    var email = event.request.userAttributes.email;
    var birthdate = new Date(event.request.userAttributes.birthdate);
    var firstname = event.request.userAttributes["custom:firstName"];
    var lastname = event.request.userAttributes["custom:lastName"];
    var country = event.request.userAttributes["custom:country"];
    var Name = event
        .userName
        .toUpperCase();

    conn.query("SELECT * FROM qras where qra=? LIMIT 1", Name.toUpperCase(), function (error, info) { // querying the database

        if (error) {
            console.log('error select: ' + error);
            callback(error);
        }
        if (info.length === 0) {
            //QRA Not Found => INSERT
            var post = {
                "qra": Name.toUpperCase(),
                "email": email,
                "birthday": birthdate,
                "idcognito": Sub,
                "firstname": firstname,
                "lastname": lastname,
                "country": country
            };
            console.log('POST' + post);
            conn.query('INSERT INTO qras SET ?', post, function (error, info) { // querying the database
                if (error) {
                    console.log(error.message);
                    if (error.errno == 1062) 
                        console.log("already exists");
                    context.done(null, event);
                    conn.destroy();
                    callback(error.message);
                } else {
                    console.log("data inserted");
                    console.log(info);
                    conn.destroy();
                    callback(null, event);
                }
            }); //end Insert
        } else {
            //QRA FOUND => Update QRA with ID Cognito
            var qra = JSON.stringify(info);
            var json = JSON.parse(qra);
            var idqras = json[0].idqras;
            console.log("idqras=", idqras);
            conn.query('UPDATE qras SET birthday=?, email=?, idcognito=?, firstname=?, lastname=?, count' +
                    'ry=? WHERE idqras=?',
            [
                birthdate,
                email,
                Sub,
                firstname,
                lastname,
                country,
                idqras
            ], function (error, info) { // querying the database
                if (error) {
                    console.log(error.message);
                    context.done(null, event);
                    conn.destroy();
                    callback(error.message);
                } else {
                    console.log("data updated");
                    console.log(info);
                    conn.destroy();
                    callback(null, event);
                }
            }); //end Update
        } //end elseif
    });
    context.succeed;

};

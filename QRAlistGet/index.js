var fs = require('fs');
var mysql = require('mysql');

exports.handler = (event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;
    console.log('Received event:', JSON.stringify(event, null, 2));
    // console.log('Received context:', JSON.stringify(context, null, 2));

    var qra;
    var qra_res;
    var msg;
    
    if (event.qra) {
        qra = event.qra;
    } else {
        qra = event.params.querystring.qra;
    }

    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });

    //QRA FOUND => Update QRA with ID Cognito

    conn.query("SELECT qra, CONCAT(COALESCE(qra,''), ' ', COALESCE(firstname,''),' ', COALESCE(l" +
            "astname,'')) AS name, profilepic, avatarpic  FROM qras where qra LIKE ?",
    qra.toUpperCase() + '%', function (error, info) { // querying the database
        if (error) {
            console.log(error.message);
            // context.done(null,event);
            conn.destroy();
            msg = {
                "error": "1",
                "message": "Could not get profile picture"
            };
            return context.fail(msg);
        } else if (info.length > 0) {
            console.log("data updated");
            console.log(info);
            conn.destroy();
            qra_res = JSON.parse(JSON.stringify(info));
            msg = {
                "error": "0",
                "message": qra_res
            };

            context.succeed(msg);
        } else {
            //context.done(null,event);
            conn.destroy();
            msg = {
                "error": "0",
                "message": {
                    "qra": qra,
                    "url": null
                }
            };
            return context.succeed(msg);
        }
    });

};
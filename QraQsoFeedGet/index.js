var fs = require('fs');
var mysql = require('mysql');
var async = require('async');


exports.handler = (event, context, callback) =>
{
    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Received context:', JSON.stringify(context, null, 2));

    context.callbackWaitsForEmptyEventLoop = false;


    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com',  // give your RDS endpoint  here
        user: 'sqso',  // Enter your  MySQL username
        password: 'parquepatricios',  // Enter your  MySQL password
        database: 'sqso'    // Enter your  MySQL database name.
    });

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
    var date = new Date();
    var qra;
    var qsos = [];
    var qsos_output = [];
    var qso;
    var qso_media = [];
    var qso_likes = [];
    var qso_comments = [];
    var qso_qras = [];


    if (process.env.TEST) {
        qra = "LU2ACH";
    } else if (event.context.sub) {
        qra = event.context.qra;
    }

    conn.query("CALL qraqsofeedget(?)", qra, function (error, info) {
        console.log(error);
        // console.log(info.length);
        if (error) {
            console.log("Error when selecting QRA");

            conn.destroy();
            response.body.error = 400;
            response.body.message = "Error: Error when selecting QRA";
            // return context.fail( "Error: Error when selecting QRA");
            return callback(null, response);
        }
        else if (info.length > 0) {
            response.body.error = 0;


            qsos = JSON.parse(JSON.stringify(info))[0];
            qso_qras = JSON.parse(JSON.stringify(info))[2];
            qso_comments = JSON.parse(JSON.stringify(info))[3];
            qso_likes = JSON.parse(JSON.stringify(info))[4];
            qso_media = JSON.parse(JSON.stringify(info))[5];


            qsos_output = qsos.map(qso = > {
                qso.qso_qras = qso_qras.filter(obj = > obj.idqsos === qso.idqsos
        )
            ;
            qso.qso_comments = qso_comments.filter(obj = > obj.idqsos === qso.idqsos
        )
            ;
            qso.qso_likes = qso_likes.filter(obj = > obj.idqsos === qso.idqsos
        )
            ;
            qso.qso_media = qso_media.filter(obj = > obj.idqsos === qso.idqsos
        )
            ;
            return qso;
        })
            ;

            response.body.message = qsos_output;
            return callback(null, response);
        }
    });
}
;

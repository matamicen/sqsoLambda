var fs = require('fs');
var mysql = require('mysql');
var async = require('async');

exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;
    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Received context:', JSON.stringify(context, null, 2));

    var qra;
    var qra_res;
    var msg;
    if (process.env.TEST) {
        var test = {
            "qra": "lu8aj"
        };
        qra = test.qra;
    }
    else {
        qra = event.body.qra;
    }

    //***********************************************************
    var conn = mysql.createConnection({
        host      :  'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com' ,  // give your RDS endpoint  here
        user      :  'sqso' ,  // Enter your  MySQL username
        password  :  'parquepatricios' ,  // Enter your  MySQL password
        database  :  'sqso'    // Enter your  MySQL database name.
    });



    //QRA FOUND => Update QRA with ID Cognito


    conn.query ( "SELECT * FROM qras where qra=? LIMIT 1", qra.toUpperCase(),   function(error,info) {  // querying the database
        if (error) {
            console.log(error.message);
            // context.done(null,event);
            conn.destroy();
            msg = { "error": "1",
                "message": "Could not get profile picture" };
            return context.fail(msg);
        }
        else if (info.length > 0) {
            console.log("data updated");
            console.log(info);
            conn.destroy();
            qra_res =  JSON.parse(JSON.stringify(info));
            if (qra_res[0].profilepic)
            {
                msg = {
                    "error": "0",
                    "message": { "qra" : qra,
                        "url" : qra_res[0].profilepic }
                };
            } else {
                msg = {
                    "error": "0",
                    "message": { "qra": qra,
                        "url": "empty"}
                };
            }

            context.succeed(msg);
        } else {
            //context.done(null,event);
            conn.destroy();
            msg = {
                "error": "0",
                "message": { "qra": qra,
                    "url": "empty"}
            };
            return context.succeed(msg);
        }
    });


};
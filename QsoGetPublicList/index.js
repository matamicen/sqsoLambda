var fs = require('fs');
var mysql = require('mysql');
var async = require('async');


exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;

    var msg;


    //***********************************************************
    var conn = mysql.createConnection({
        host      :  'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com' ,  // give your RDS endpoint  here
        user      :  'sqso' ,  // Enter your  MySQL username
        password  :  'parquepatricios' ,  // Enter your  MySQL password
        database  :  'sqso'    // Enter your  MySQL database name.
    });


    var date = new Date();
    console.log(date);

    console.log("Get QSOS up to today" + date);
    conn.query ( "SELECT * from qsos WHERE datetime <=? LIMIT 100", date,   function(error,qsos) {
        if (error) {
            console.log("ERROR In Get QSOS up to today" + date);
            console.log(error);
            conn.destroy();
            callback(error.message);
            msg = { "error": "1",
                "message": "ERROR In Get QSOS up to today" + date };
            return context.fail(msg);
        } else {
            console.log(JSON.stringify(qsos));

            // async.map lets us apply a function to a collection.
            async.map(qsos, [{
                function (qso, callback) {
                    conn.query ( "SELECT * from qsos WHERE datetime <=? LIMIT 100", date,   function(error,qsos) {
                        if (error) {
                            console.log("ERROR In Get QSOS up to today" + date);
                            console.log(error);
                            conn.destroy();
                            callback(error.message);
                            msg = { "error": "1",
                                "message": "ERROR In Get QSOS up to today" + date };
                            return context.fail(msg);
                        }
                    });
                }
            },
                {

                }
            ]);
        }
    });


};
var fs = require('fs');
var mysql = require('mysql');
var async = require('async');


exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;




    //***********************************************************
    var conn = mysql.createConnection({
        host      :  'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com' ,  // give your RDS endpoint  here
        user      :  'sqso' ,  // Enter your  MySQL username
        password  :  'parquepatricios' ,  // Enter your  MySQL password
        database  :  'sqso'    // Enter your  MySQL database name.
    });


    var date = new Date();
    var qso_qras;
    var qso_medias;
    var qsos = [];
    var msg;
    var idqsos;
    console.log(date);

    console.log("Get QSOS up to today" + date);
    conn.query ( "SELECT * from qsos WHERE datetime <=? LIMIT 100", date,   function(error,rows) {
        if (error) {
            console.log("ERROR In Get QSOS up to today" + date);
            console.log(error);
            conn.destroy();
            callback(error.message);
            msg = { "error": "1",
                "message": "ERROR In Get QSOS up to today" + date };
            return context.fail(msg);
        } else {
            // console.log(JSON.stringify(qsos));
            qsos = JSON.parse(JSON.stringify(rows));
            console.log(qsos);
            async.mapSeries(qsos,
                function(qso,callback1)
                {
                    console.log("each item" + JSON.stringify(qso));
                    async.series([
                            function(callback2) {
                                idqsos = JSON.stringify(qso.idqsos);
                                console.log("function1" + idqsos);
                                conn.query ( "SELECT * from qsos_qras WHERE idqso = ?", idqsos,   function(error,qras) {
                                    if (!error) {
                                        console.log(qras);
                                        qso_qras = JSON.parse(JSON.stringify(qras));
                                        qso.qras = qso_qras;
                                        // qsos.push(JSON.parse(JSON.stringify(qso)));
                                        console.log(qso);
                                        callback2();
                                    }

                                });

                            },
                            function(callback2) {
                                idqsos = JSON.stringify(qso.idqsos);
                                console.log("function2" + idqsos);
                                conn.query ( "SELECT * from qsos_media WHERE idqso =? ", idqsos,   function(error,media) {
                                    if (!error) {
                                        qso_media = JSON.parse(JSON.stringify(media));
                                        qso.media = qso_media;
                                        //qsos.push(JSON.parse(JSON.stringify(qso)));
                                        console.log(qso);
                                        callback2();
                                    }

                                });

                            } ],
                        function(err){
                            console.log("All tasks are done now");
                            // doSomethingOnceAllAreDone();
                            console.log(qso);
                            callback1();

                        });
                },

                // 3rd param is the function to call when everything's done
                function(err){
                    console.log("All tasks are done now");
                    // doSomethingOnceAllAreDone();
                    console.log(qsos);
                    context.succeed(qsos);
                }

            );
        }
    });


};
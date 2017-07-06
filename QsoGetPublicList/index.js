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
    var qra;
    var qsos = [];
    var qsos_output = [];
    var msg;
    var idqsos;
    console.log(date);

    console.log("Get QSOS up to today" + date);
    conn.query ( "SELECT * from qsos WHERE datetime <=? order by datetime desc LIMIT 50", date,   function(error,rows) {
        //    conn.query ( "SELECT * from qsos WHERE idqsos = 399 order by datetime desc LIMIT 1",   function(error,rows) {
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
                            function(callback2) { //GET QRA of QSO_OWNER
                                idqsos = JSON.stringify(qso.idqsos);
                                console.log("qra_owner - " + idqsos);
                                conn.query ( "SELECT qra, profilepic from qras WHERE idqras = ? LIMIT 1", qso.idqra_owner,   function(error,info) {
                                    if (!error) {
                                        //console.log(info);
                                        qra = JSON.parse(JSON.stringify(info));
                                        //console.log(qra[0].qra);
                                        //console.log(qra[0].profilepic);
                                        qso.qra = qra[0].qra;
                                        qso.profilepic = qra[0].profilepic;
                                        // qsos.push(JSON.parse(JSON.stringify(qso)));
                                        console.log(qso);
                                        callback2();
                                    }else{
                                        console.log(error);
                                        callback2();
                                    }

                                });

                            },
                            function(callback2) { //GET QRAS of QSO
                                idqsos = JSON.stringify(qso.idqsos);
                                console.log("qsos_qras" + idqsos);
                                conn.query ( "SELECT qra, profilepic FROM sqso.qras where  idqras in ( SELECT idqra FROM sqso.qsos_qras where isOwner <> true and idqso = ? ) ", idqsos,   function(error,qras) {
                                    if (!error) {
                                        console.log(qras);
                                        qso_qras = JSON.parse(JSON.stringify(qras));
                                        qso.qras = qso_qras;
                                        // qsos.push(JSON.parse(JSON.stringify(qso)));
                                        //  console.log(qso);
                                        callback2();
                                    }else{
                                        console.log(error);
                                        callback2();
                                    }

                                });

                            },
                            function(callback2) { //GET MEDIA
                                idqsos = JSON.stringify(qso.idqsos);
                                console.log("function2" + idqsos);
                                conn.query ( "SELECT * from qsos_media WHERE idqso =? ", idqsos,   function(error,media) {
                                    if (!error) {
                                        qso_media = JSON.parse(JSON.stringify(media));
                                        qso.media = qso_media;
                                        //qsos.push(JSON.parse(JSON.stringify(qso)));
                                        //     console.log(qso);
                                        callback2();
                                    }

                                });

                            },
                            function (callback3) { //GET LIKES
                                idqsos = JSON.stringify(qso.idqsos);
                                console.log("GET LIKES" + idqsos);
                                conn.query("SELECT qra, profilepic FROM sqso.qras where  idqras in (SELECT idqra from qsos_likes WHERE idqso =? )", idqsos, function (error, likes) {
                                    if (!error) {
                                        console.log(likes);
                                        qso_likes = JSON.parse(JSON.stringify(likes));
                                        qso.likes = qso_likes;
                                        //qsos.push(JSON.parse(JSON.stringify(qso)));
                                        //     console.log(qso);
                                        callback3();
                                    }
                                    else {
                                        console.log(error);
                                        callback2();
                                    }

                                });

                            } ],
                        function(err){
                            console.log("All tasks are done now");
                            // doSomethingOnceAllAreDone();
                            //    console.log(qso);
                            qsos_output.push(qso);
                            callback1();

                        });
                },

                // 3rd param is the function to call when everything's done
                function(err){
                    console.log("All tasks are done now");
                    // doSomethingOnceAllAreDone();
                    console.log(qsos_output);
                    conn.destroy();
                    context.succeed(qsos_output);
                }

            );
        }
    });


};
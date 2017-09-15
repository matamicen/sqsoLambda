var fs = require('fs');
var mysql = require('mysql');
var async = require('async');


exports.handler = (event, context, callback) =>
{


    context.callbackWaitsForEmptyEventLoop = false;


    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com',  // give your RDS endpoint  here
        user: 'sqso',  // Enter your  MySQL username
        password: 'parquepatricios',  // Enter your  MySQL password
        database: 'sqso'    // Enter your  MySQL database name.
    });


    var qso_qras;
    var qso_medias;
    var qso_comments;
    var qso_likes;
    var qra;
    var qso_output;
    var qsos_output = [];
    var msg;
    var idqsos;
    var qso;
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
    if (process.env.TEST) {
        var test = {
            "qso": "658"
        };
        qso = test.qso;
    }
    else {
        qso = event.body.qso;
    }


    console.log("Get QSO data for " + qso);
    conn.query("SELECT * from qsos WHERE idqsos =?", qso, function (error, info) {
        //    conn.query ( "SELECT * from qsos WHERE idqsos = 399 order by datetime desc LIMIT 1",   function(error,rows) {
        if (error) {
            console.log("ERROR In Get QSOS Detail" + qso);
            console.log(error);
            conn.destroy();
            callback(error.message);
            msg = {
                "error": "1",
                "message": "ERROR In Get QSOS detail" + qso
            };
            return context.fail(msg);
        } else {
            // console.log(JSON.stringify(qsos));
            qso_output = JSON.parse(JSON.stringify(info))[0];
            console.log(qso_output);


            async.series([
                    function (callback2) { //GET QRA of QSO_OWNER
                        console.log("qra_owner - " + qso);
                        conn.query("SELECT qra, profilepic from qras WHERE idqras = ? LIMIT 1", qso_output.idqra_owner, function (error, info) {
                            if (!error) {
                                //console.log(info);
                                qra = JSON.parse(JSON.stringify(info));
                                //console.log(qra[0].qra);
                                //console.log(qra[0].profilepic);
                                qso_output.qra = qra[0].qra;
                                qso_output.profilepic = qra[0].profilepic;
                                // qsos.push(JSON.parse(JSON.stringify(qso)));
                                console.log(qso);
                                callback2();
                            } else {
                                console.log(error);
                                callback2();
                            }

                        });

                    },
                    function (callback3) { //GET QRAS of QSO

                        console.log("qsos_qras " + qso);
                        conn.query("SELECT qra, profilepic FROM sqso.qras where  idqras in ( SELECT idqra FROM sqso.qsos_qras where isOwner <> true and idqso = ? ) ", qso, function (error, qras) {
                            if (!error) {
                                console.log(qras);
                                qso_qras = JSON.parse(JSON.stringify(qras));
                                qso_output.qras = qso_qras;
                                // qsos.push(JSON.parse(JSON.stringify(qso)));
                                //  console.log(qso);
                                callback3();
                            } else {
                                console.log(error);
                                callback3();
                            }

                        });

                    },
                    function (callback4) { //GET MEDIA

                        console.log("media " + qso);
                        conn.query("SELECT * from qsos_media WHERE idqso =? ", qso, function (error, media) {
                            if (!error) {
                                qso_media = JSON.parse(JSON.stringify(media));
                                qso_output.media = qso_media;
                                //qsos.push(JSON.parse(JSON.stringify(qso)));
                                //     console.log(qso);
                                callback4();
                            } else {
                                console.log(error);
                                callback4();
                            }

                        });

                    },
                    function (callback5) { //GET LIKES
                        console.log("GET LIKES" + qso);
                        conn.query("SELECT qra, profilepic FROM sqso.qras where  idqras in (SELECT idqra from qsos_likes WHERE idqso =? )", qso, function (error, likes) {
                            if (!error) {
                                console.log(likes);
                                qso_likes = JSON.parse(JSON.stringify(likes));
                                qso_output.likes = qso_likes;
                                //qsos.push(JSON.parse(JSON.stringify(qso)));
                                //     console.log(qso);
                                callback5();
                            }
                            else {
                                console.log(error);
                                callback5();
                            }

                        });

                    },
                    function (callback5) { //GET Comments
                        console.log("GET Comments " + qso);
                        conn.query("SELECT qsos_comments.*, qras.qra FROM qsos_comments inner join qras on qsos_comments.idqra = qras.idqras where  idqso=?", qso, function (error, comments) {
                            if (!error) {
                                console.log(comments);
                                qso_comments = JSON.parse(JSON.stringify(comments));
                                qso_output.comments = qso_comments;
                                //qsos.push(JSON.parse(JSON.stringify(qso)));
                                //     console.log(qso);
                                callback5();
                            }
                            else {
                                console.log(error);
                                callback5();
                            }

                        });

                    }],
                function (err) {
                    console.log("All tasks are done now");
                    // doSomethingOnceAllAreDone();
                    //    console.log(qso);
                    console.log(qso_output);
                    conn.destroy();
                    context.succeed(qso_output);

                });

        }
    });


}
;
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


    var date = new Date();
    var qso_qras;
    var qra;
    var qsos = [];
    var qsos_output = [];
    var msg;
    var idqsos;
    var sub;
    var qso_media;
    var idqra_owner;

    if (process.env.TEST) {
        sub = "7bec5f23-6661-4ba2-baae-d1d4f0440038";
    } else if (event.context.sub) {
        sub = event.context.sub;
    }
    console.log(sub);
    conn.query("SELECT * FROM qras where idcognito=? LIMIT 1", sub, function (error, info) {
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();

            msg = {
                "error": "1",
                "message": "Error when select QRA to get ID of Owner"
            };
            error = new Error("Error when select QRA to get ID of Owner");
            callback(error);
            return context.fail(msg);
        }
        else if (info.length === 0) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();

            msg = {
                "error": "1",
                "message": "Error when select QRA to get ID of Owner"
            };
            error = new Error("Error when select QRA to get ID of Owner");
            callback(error);
            return context.fail(msg);
        }
        else if (info.length > 0) {
            // console.log(info);
            idqra_owner = JSON.parse(JSON.stringify(info))[0].idqras;

            console.log("Get QSOS up to today" + date);
            conn.query("SELECT qsos.* from qsos INNER JOIN qsos_qras on qsos.idqsos = qsos_qras.idqso WHERE qsos.datetime <=? and qsos_qras.idqra = ? order by datetime desc LIMIT 50", [date, idqra_owner], function (error, rows) {
                //    conn.query ( "SELECT * from qsos WHERE idqsos = 399 order by datetime desc LIMIT 1",   function(error,rows) {
                if (error) {
                    console.log("ERROR In Get QSOS up to today" + date);
                    console.log(error);
                    conn.destroy();
                    callback(error.message);
                    msg = {
                        "error": "1",
                        "message": "ERROR In Get QSOS up to today" + date
                    };
                    return context.fail(msg);
                } else {
                    // console.log(JSON.stringify(qsos));
                    qsos = JSON.parse(JSON.stringify(rows));
                    console.log(qsos);
                    async.mapSeries(qsos,
                        function (qso, callback1) {
                            console.log("each item" + JSON.stringify(qso));

                            async.series([
                                    function (callback1) { //GET QRA of QSO_OWNER
                                        idqsos = JSON.stringify(qso.idqsos);
                                        console.log("qra_owner - " + idqsos);
                                        conn.query("SELECT * from qras WHERE idqras = ? LIMIT 1", qso.idqra_owner, function (error, info) {
                                            if (!error) {
                                                //console.log(info);
                                                qra = JSON.parse(JSON.stringify(info));
                                                //console.log(qra[0].qra);
                                                //console.log(qra[0].profilepic);
                                                qso.qra = qra[0].qra;
                                                qso.profilepic = qra[0].profilepic;
                                                // qsos.push(JSON.parse(JSON.stringify(qso)));
                                                console.log(qso);
                                                callback1();
                                            } else {
                                                console.log(error);
                                                callback1();
                                            }

                                        });

                                    },
                                    function (callback2) { //GET QRAS of QSO
                                        idqsos = JSON.stringify(qso.idqsos);
                                        console.log("qsos_qras" + idqsos);
                                        conn.query("SELECT * FROM sqso.qras where idqras in ( SELECT idqra FROM sqso.qsos_qras where isOwner = false and idqso = ? ) ", idqsos, function (error, qras) {
                                            if (!error) {
                                                console.log(qras);
                                                qso_qras = JSON.parse(JSON.stringify(qras));
                                                qso.qras = qso_qras;
                                                // qsos.push(JSON.parse(JSON.stringify(qso)));
                                                //  console.log(qso);
                                                callback2();
                                            } else {
                                                console.log(error);
                                                callback2();
                                            }

                                        });

                                    },
                                    function (callback3) { //GET MEDIA
                                        idqsos = JSON.stringify(qso.idqsos);
                                        console.log("GET MEDIA" + idqsos);
                                        conn.query("SELECT * from qsos_media WHERE idqso =? ", idqsos, function (error, media) {
                                            if (!error) {
                                                console.log(media);
                                                qso_media = JSON.parse(JSON.stringify(media));
                                                qso.media = qso_media;
                                                //qsos.push(JSON.parse(JSON.stringify(qso)));
                                                //     console.log(qso);
                                                callback3();
                                            }
                                            else {
                                                console.log(error);
                                                callback2();
                                            }

                                        });

                                    }],
                                function (err) {
                                    console.log("All tasks are done now");
                                    // doSomethingOnceAllAreDone();
                                    //    console.log(qso);
                                    qsos_output.push(qso);
                                    callback1();

                                });
                        },

                        // 3rd param is the function to call when everything's done
                        function (err) {
                            console.log("All tasks are done now");
                            // doSomethingOnceAllAreDone();
                            console.log(qsos_output);
                            conn.destroy();
                            context.succeed(qsos_output);
                        }
                    );
                }
            });

        }
    });
}

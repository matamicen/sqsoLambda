var fs = require('fs');
var mysql = require('mysql');
var async = require('async');


exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;

    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });



    var qso_qras;
    var qso_media;
    var qso_comments;
    var qso_likes;
    var qsos = [];
    var qsos_output = [];
    var msg;



    conn.query("CALL qsopubliclistget( )", function(error, info) {
        //    conn.query ( "SELECT * from qsos WHERE idqsos = 399 order by datetime desc LIMIT 1",   function(error,rows) {
        if (error) {
            console.log("ERROR In Get QSOS up to today");
            console.log(error);
            conn.destroy();
            callback(error.message);
            msg = {
                "error": "1",
                "message": "ERROR In Get QSOS up to today"
            };
            return context.fail(msg);
        }
        else {
            qsos = JSON.parse(JSON.stringify(info))[0];
            qso_qras = JSON.parse(JSON.stringify(info))[1];
            qso_comments = JSON.parse(JSON.stringify(info))[2];
            qso_likes = JSON.parse(JSON.stringify(info))[3];
            qso_media = JSON.parse(JSON.stringify(info))[4];

            qsos_output = qsos.map(qso => {
                qso.qras = qso_qras.filter(obj => obj.idqsos === qso.idqsos);
            qso.comments = qso_comments.filter(obj => obj.idqsos === qso.idqsos);
            qso.likes = qso_likes.filter(obj => obj.idqsos === qso.idqsos);
            qso.media = qso_media.filter(obj => obj.idqsos === qso.idqsos);
            return qso;
        });
            qsos_output = qsos_output.filter(obj => obj.media.length > 0);
            console.log(qsos_output);
            conn.destroy();
            context.succeed(qsos_output);

        }
    });
};

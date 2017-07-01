var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');

exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;

    var Sub;
    var Name;
    var post;
    var datetime;
    var media;
    var json;
    var type;
    var url;
    var datasize;
    var qso;
    var response = {
        "message": "",
        "error": ""
    };

    // var count;
    if (process.env.TEST) {
        var test = {     "qso": "447",
            "type":  "image",
            "url": "http://www.google.com",
            "datetime": "2016-04-28 14:12:00",
            "datasize": "22"
        };
        qso = test.qso;
        type = test.type;
        datetime = test.datetime;
        url = test.url;
        datasize = test.datasize;
    }
    else {
        qso = event.body.qso;
        type = event.body.type;
        url = event.body.url;
        datasize = event.body.datasize;
        datetime = event.body.datetime;
    }

    if (process.env.TEST){
        Sub = "7bec5f23-6661-4ba2-baae-d1d4f0440038";
    }else if (event.context.sub){
        Sub = event.context.sub;
    }
    console.log("sub =", Sub);


    //***********************************************************
    var conn = mysql.createConnection({
        host      :  'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com' ,  // give your RDS endpoint  here
        user      :  'sqso' ,  // Enter your  MySQL username
        password  :  'parquepatricios' ,  // Enter your  MySQL password
        database  :  'sqso'    // Enter your  MySQL database name.
    });

    // GET QRA ID of OWNER
    console.log("select QRA to get ID of Owner");
    console.log(qso);
    conn.query ( "SELECT qras.idcognito from qras inner join qsos on qras.idqras = qsos.idqra_owner where qsos.idqsos =? and qras.idcognito=?", [qso , Sub],   function(error,info) {
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();
            response.error = 400;
            response.message = "Error: select QRA to get ID of Owner";
            // return context.fail( "Error: select QRA to get ID of Owner");
            return context.succeed(response);
        }

        console.log("info" + info);

        if (info.length === 0){
            console.log("Caller user is not the QSO Owner");
            response.error = 400;
            response.message = "Error: Caller user is not the QSO Owner";
            conn.destroy();
            //return context.fail( "Error: Caller user is not the QSO Owner");
            return context.succeed(response);
        }
    });
    //***********************************************************
    post  = {"idqso": qso,
        "type": type,
        "url": url,
        "datasize": datasize
    };
    conn.query('INSERT INTO qsos_media SET idqso = ?, type = ?, url = ?, datasize = ?, datetime = ?', [qso, type, url, datasize, datetime], function(error, info) {
        if (error) {
            console.log("Error when Insert QSO MEDIA");
            console.log(error.message);
            conn.destroy();
            response.error = 400;
            response.message = "Error when Insert QSO MEDIA";
            //return context.fail( "Error when Insert QSO MEDIA");
            return context.succeed(response);
        } //End If
        if (info.insertId){
            console.log("QSOMEDIA inserted", info.insertId);
            conn.destroy();
            response.error = 0;
            response.message = url;
            return context.succeed(response);
        }
    }); //End Insert

};
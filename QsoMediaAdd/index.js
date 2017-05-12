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
    // var count;
    if (process.env.TEST) {
        var test = {     "qso": "333",
            "type":  "1",
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
        Sub = "57d6d760-c5ff-40e5-8fc8-943fa37d6987";
    }else if (event.context.sub){
        Sub = event.context.sub;
    }
    console.log("sub =", Sub);

    if (process.env.TEST){
        Name = "test";
    }else if (event.context.nickname){
        Name = event.context.nickname;
    }

    console.log('userName =', Name);

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
            callback(error.message);
            return context.fail(error);
        }

        console.log("info" + info);

        if (info.length === 0){
            console.log("Caller user is not the QSO Owner");
            console.log('error select: ' + error);
            callback(error);
            return context.fail(error);
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
            callback(error.message);
            return callback.fail(error);
        } //End If
        if (info.insertId){
            console.log("QSOMEDIA inserted", info.insertId);
            var msg = { "error": "0",
                "message": qso };
            context.succeed(msg);
        }
    }); //End Insert

};
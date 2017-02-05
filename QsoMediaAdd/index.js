var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');

exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = true;

    var Sub;
    var Name;
    var post;
    var media;
    var json;
    var type;
    var url;
    var datasize;
    // var count;
    if (process.env.TEST) {
        var test = {     "qso": "59",
            "type":  "1",
            "url": "http://www.google.com",
            "datasize": "22"
        };
        qso = test.qso;
        type = test.type;
        url = test.url;
        datasize = test.datasize;
    }
    else {
        qso = event.body.qso;
        type = event.body.type;
        url = event.body.url;
        datasize = event.body.datasize;
    }

    if (process.env.TEST){
        Sub = "ac73c8e5-77d1-4ec4-9384-b49076c9d580";
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


    //***********************************************************
    post  = {"idqso": qso,
        "type": type,
        "url": url,
        "datasize": datasize
    };
    conn.query('INSERT INTO qsos_media SET ?', post, function(error, info) {
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
var fs = require('fs');
var mysql = require('mysql');
var async = require('async');

exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;

    var sub;
    var qso;
    var Name;
    var post;
    var json;
    var mode;
    var band;
    var type;
    // var count;
    if (process.env.TEST) {
        var test = {  "qso": 327,
            "mode": "mod1",
            "band": "ba1",
            "type": "Q1O"
        };
        qso = test.qso;
        type = test.type;
        mode = test.mode;
        band = test.band;
        sub = '9970517e-ed39-4f0e-939e-930924dd7f73';
    }
    else {
        qso = event.body.qso;
        type = event.body.type;
        mode = event.body.mode;
        band = event.body.band;
        sub = event.context.sub;
    }


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
    conn.query ( "SELECT qras.idcognito from qras inner join qsos on qras.idqras = qsos.idqra_owner where qsos.idqsos =? and qras.idcognito=?", [qso , sub],   function(error,info) {
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

    async.series([
        function(callback){
            console.log("type" +  type);
            if (type){
                conn.query('update qsos set type=? where idqsos = ?',[type , qso], function(error, info) {
                    if (error) {
                        console.log("Error when Insert TYPE in QSO ");
                        console.log(error.message);
                        conn.destroy();
                        callback(error.message);
                        return callback.fail(error);
                    } else{
                        console.log("TYPE Updated inserted", type, qso);
                        var msg = { "error": "0",
                            "message": qso };
                        //  context.succeed(msg);
                        callback();
                    }
                }); //End Update
            } else{
                callback();//end type update
            }
        }, //end f1
        function(callback){
            console.log("mode" + mode);
            if (mode){
                conn.query('update qsos set mode=? where idqsos = ?',[mode , qso], function(error, info) {
                    if (error) {
                        console.log("Error when Insert MODE in QSO ");
                        console.log(error.message);
                        conn.destroy();
                        callback(error.message);
                        return callback.fail(error);
                    } else{
                        console.log("MODE Updated inserted", mode, qso);
                        var msg = { "error": "0",
                            "message": qso };
                        callback();
                    }
                }); //End Update
            } else{
                callback();//end type update
            }
        }, // end f2
        function(callback){
            console.log("band" + band);
            if (band){
                conn.query('update qsos set band=? where idqsos = ?',[band , qso], function(error, info) {
                    if (error) {
                        console.log("Error when Insert band in QSO ");
                        console.log(error.message);
                        conn.destroy();
                        callback(error.message);
                        return callback.fail(error);
                    } else{
                        console.log("band Updated inserted", band, qso);
                        var msg = { "error": "0",
                            "message": qso };
                        callback();
                    }
                }); //End Update
            } else{
                callback();//end type update
            }
        } //end f3
        , function(err, results){
            console.log("final task");
            var msg = { "error": "0",
                "message": qso };
            context.succeed(msg);
        }]);

};
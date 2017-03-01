var fs = require('fs');
var mysql = require('mysql');

/*{  "mode": "modetest",
 "band": "bandtest",
 "qra_owner": "lu2ach",
 "gps": "gpstest",
 "state": "statetest",
 "qras":  [ "qratest1", "qratest2" ]
 }
 */


exports.handler = (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = true;
    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Received context:', JSON.stringify(context, null, 2));

    var post;
    var qra;
    var qra_owner;
    var qras;
    var json;
    var idqras;
    var newqso;
    var mode;
    var band;
    var gps;
    if (process.env.TEST) {
        var test = {     "mode": "modetest1",
            "band": "bandtest1",
            "qra_owner": "LU2ACH",
            "gps": "gpstest1",
            "state": "statetest1",
            "qras":  [ "test_qra2",
                "test_qra",
                "test_qra3"]
        };
        mode = test.mode;
        band = test.band;
        gps = test.gps;
        qra_owner = test.qra_owner;
        qras = test.qras;
    }
    else {
        mode = event.body.mode;
        band = event.body.band;
        gps = event.body.gps;
        qras = event.body.qras;
        qra_owner = event.body.qra_owner;
        console.log("QRAS",qras);
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
    conn.query ( "SELECT * FROM qras where qra=? LIMIT 1", qra_owner,   function(error,info) {
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();
            callback(error.message);
            return context.fail(error);
        }
        // console.log(info);
        qra = JSON.stringify(info);
        json =  JSON.parse(qra);
        idqras = json[0].idqras;


        post  = {"idqra_owner": idqras,
            "mode": mode,
            "band": band,
            "gps": gps };


        //INSERT INTO QSO TABLE
        conn.query ( 'INSERT INTO qsos SET ?', post,   function(error,info) {
            console.log("insert QSO");
            if (error) {
                console.log("Error when insert QSO");
                console.log(error.message);
                conn.destroy();
                callback(error.message);
                return context.fail(error);
            }

            console.log("QSO inserted", info.insertId);
            qso = JSON.stringify(info);
            json =  JSON.parse(qso);
            newqso = json.insertId;
            var msg = { "error": "0",
                "message": newqso };
            context.succeed(msg);
        });
    }); //END SELECT QRA
};
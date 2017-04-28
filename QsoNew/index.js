var fs = require('fs');
var mysql = require('mysql');

/*{     "mode": "modetest1",
 "band": "bandtest1",
 "qra_owner": "lu2ach",
 "longitude": "1",
 "latitude": "1",
 "datetime": "2016-04-28 14:12:00",
 "state": "statetest1",
 "type": "QSO",
 "qras": ["LU1BJW",
 "LU3QQQ",
 "LU8AJ",
 "LU9DO"],
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
    var location;
    var latitude;
    var longitude;
    var datetime;
    var type;
    if (process.env.TEST) {
        var test = {     "mode": "modetest1",
            "band": "bandtest1",
            "qra_owner": "lu2ach",
            "longitude": "1",
            "latitude": "1",
            "datetime": "2016-04-28 14:12:00",
            "state": "statetest1",
            "type": "QSO",
            "qras": ["LU1BJW",
                "LU3QQQ",
                "LU8AJ",
                "LU9DO"],
        };
        mode = test.mode;
        band = test.band;
        latitude = test.latitude;
        longitude = test.longitude;
        datetime = test.datetime;
        qra_owner = test.qra_owner.toUpperCase();
        qras = test.qras;
        type = test.type;
    }
    else {
        mode = event.body.mode;
        band = event.body.band;
        latitude = event.body.latitude;
        longitude = event.body.longitude;
        datetime = event.body.datetime;
        qras = event.body.qras;
        type = event.body.type;
        qra_owner = event.body.qra_owner.toUpperCase();
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

        location = "POINT(" + longitude + " " + latitude + ")";
        console.log(location);
        post  = {"idqra_owner": idqras,
            "mode": mode,
            "band": band,
            "location": location,
            "datetime": datetime,
            "type": type
        };
        console.log(post);

        //INSERT INTO QSO TABLE
        //    conn.query ( 'INSERT INTO qsos SET ?', post,   function(error,info) {
        conn.query ( 'INSERT INTO qsos  SET idqra_owner = ?, location = GeomFromText(?), mode = ?, band = ?, datetime = ?, type = ?', [idqras, location, mode, band, datetime, type],   function(error,info) {
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
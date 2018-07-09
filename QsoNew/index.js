var fs = require('fs');
var mysql = require('mysql');



exports.handler = async (event, context, callback) =>
{
    context.callbackWaitsForEmptyEventLoop = false;

    var post;
    // var qra_owner;
    var idqras;
    var newqso;
    var mode;
    var band;
    var location;
    var latitude;
    var longitude;
    var datetime;
    var type;
    var sub;
    var msg;

    if (event.qra_owner) {
     
        mode = event.mode;
        band = event.band;
        latitude = event.latitude;
        longitude = event.longitude;
        datetime = event.datetime;
        // qra_owner = event.qra_owner.toUpperCase();
        
        type = event.type;
        sub = event.sub;
    }
    else {
        mode = event.body.mode;
        band = event.body.band;
        latitude = event.body.latitude;
        longitude = event.body.longitude;
        datetime = event.body.datetime;
        // qras = event.body.qras;
        type = event.body.type;
        // qra_owner = event.body.qra_owner.toUpperCase();
        sub = event.context.sub;
    }
    console.log(sub);

    //***********************************************************
    var conn = await mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com',  // give your RDS endpoint  here
        user: 'sqso',  // Enter your  MySQL username
        password: 'parquepatricios',  // Enter your  MySQL password
        database: 'sqso'    // Enter your  MySQL database name.
    });
    try {
        let idqras_owner = await getQRA(sub);
        if (!idqras_owner) {
            console.log("User does not exist");
            conn.destroy();
            msg = {
                "error": "1",
                "message": "User does not exist"
            };
            callback("User does not exist");
            return context.fail(msg);
        }
        newqso = await saveQSO(idqras_owner,mode, band, datetime, type, longitude, latitude);
        await UpdateQsosCounterInQra(idqras_owner);
        var info = await saveQRA(newqso, idqras_owner);
        
        if (info.insertId) {
            msg = {
                    "error": "0",
                    "message": newqso
                };
             conn.destroy();
        return callback(null, msg);
        }
    
    
    } catch (e) {
        console.log("Error executing QsoNew");
        console.log(e);
        conn.destroy();
        callback(e.message);
        msg = {
            "error": "1",
            "message": e.message
        };
        return context.fail(msg);
    }

    function getQRA(sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QRA info from Congito ID");
            conn.query("SELECT idqras FROM qras where idcognito=? LIMIT 1", sub, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                
                resolve(JSON.parse(JSON.stringify(info))[0].idqras);
            });
        });
    }
    function saveQSO(idqras, mode, band, datetime, type, longitude, latitude) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QRA info from Congito ID");
            location = "POINT(" + longitude + " " + latitude + ")";
            conn.query("INSERT INTO qsos  SET idqra_owner=?, location = GeomFromText(?), mode = ?, band = ?, datetime = ?, type = ?, GUID_QR = UUID(), GUID_URL = UUID()", [ idqras, location, mode, band, datetime, type], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)).insertId);
                // console.log(info);
            });
        });
    }
    function saveQRA(newqso, idqras) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QRA info from Congito ID");
            post = {
                "idqso": newqso,
                "idqra": idqras,
                "isOwner": true
            };

            //***********************************************************
            conn.query('INSERT INTO qsos_qras SET ?', post, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }
        function UpdateQsosCounterInQra(idqras) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QRA info from Congito ID");

            
            //***********************************************************
            conn.query('UPDATE sqso.qras SET qsos_counter = qsos_counter+1, last_created_qso=NOW() WHERE idqras=?',idqras, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }
};
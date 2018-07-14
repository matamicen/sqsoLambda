var mysql = require('mysql');
// var async = require('async');
// var AWS = require('aws-sdk');
// AWS.config.region = 'us-east-1';

exports.handler = async (event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var sub;

    var qso;
    
    // var count;
    if (event.qso) {      
        qso = event.qso;
        sub = event.sub;
    } else {
        qso = event.body.qso;
        sub = event.context.sub;
    }

    // ***********************************************************
    var conn =mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {
        let idqras_owner = await getQRA(qso,sub);
        if (!idqras_owner) {
            console.log("Caller is not QSO Owner");
            conn.destroy();
            msg = {
                "error": 1,
                "message": "User does not exist"
            };
            callback("User does not exist");
            return context.fail(msg);
        }        
        let info = await delQSO(qso);
        await UpdateQsosCounterInQra(idqras_owner);
        await deleteRelatedQSOs(qso);
        if (info.affectedRows) {
            console.log("QSO Deleted");
            var msg = {
                "error": 0,
                "message": info.message
            };
            conn.destroy();
            return callback(null, msg);
        } //ENDIF

    } catch (e) {
        console.log("Error executing QsoDel");
        console.log(e);
        conn.destroy();
        callback(e.message);
        msg = {
            "error": 1,
            "message": e.message
        };
        return context.fail(msg);
    }
    async function deleteRelatedQSOs(idqso) {
        let qsos = await getRelatedQSOs(idqso);
        for (let i = 0; i < qsos.length; i++) {
            let info = await delQSO(qsos[i].idqsos);
            await UpdateQsosCounterInQra(qsos[i].idqra_owner);
        }
        return null;
    }
    function getRelatedQSOs(idqso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. 
            console.log("getRelatedQSOs");
            conn
                .query("SELECT idqsos, idqra_owner from qsos where idqso_shared= ?", [ idqso ], function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }
    function getQRA(idqso, sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch. 
            
            conn
                .query("SELECT qras.idqras from qras inner join qsos on qras.idqras = qsos.idqra_owner where qsos.idqsos=? and qras.idcognito=?", [ idqso , sub ], function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                });
        });
    }
    function delQSO(idqso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("UPDATE qsos SET deleted=1 WHERE idqsos=?", idqso, function (err, info) {
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
            // Alternately, try/catch and reject(err) on catch. console.log("get QRA info
            // from Congito ID");
            // ***********************************************************
            conn
                .query('UPDATE sqso.qras SET qsos_counter = qsos_counter-1 WHERE' +
                        ' idqras=?',
                idqras, function (err, info) {
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
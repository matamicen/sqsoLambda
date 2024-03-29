var mysql = require('mysql');

exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var sub;
    var qsos_rel ;
    var qso;

    var response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
        },
        body: {
            "error": null,
            "message": null
        }
    };

    if (event.qso) {
        qso = event.qso;
        qsos_rel = event.qsos_rel;
        sub = event.sub;
    } else {
        qso = event.body.qso;
        qsos_rel = event.body.qsos_rel;
        sub = event.context.sub;
    }

    // ***********************************************************
    if (!event['stage-variables']) {
        console.log("Stage Variables Missing");
        
        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }
    var url = event['stage-variables'].url;
    var conn = mysql.createConnection({
        host: event['stage-variables'].db_host, // give your RDS endpoint  here
        user: event['stage-variables'].db_user, // Enter your  MySQL username
        password: event['stage-variables'].db_password, // Enter your  MySQL password
        database: event['stage-variables'].db_database // Enter your  MySQL database name.
    });
    try {
        let idqras_owner = await checkOwnerInQso(qsos_rel, sub);
        if (!idqras_owner) {
            console.log("Caller is not QSO Owner");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            callback("User does not exist");
            return context.fail(response);
        }
      
      
        let info = await confirmQSOlink(qso, qsos_rel);
        if (info.affectedRows) {
              await UpdateLinksInQso(qso);
        await UpdateLinksInQraOwner(idqras_owner);
        }
            console.log("QSOLink Confirmed");
            response.body.error = 0;
            response.body.message = info.message;            
            return callback(null, response);
         //ENDIF

    } catch (e) {
        console.log("Error executing Qso link del");
        console.log(e);
        conn.destroy();
     
        response.body.error = 1;
        response.body.message = e;
        callback(null, response);
        return context.fail(response);
    }
    function checkOwnerInQso(idqso, sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qras.idqras from qras inner join qsos on qras.idqras = qsos.idqra_owner w" +
                        "here qsos.idqsos=? and qras.idcognito=?",
                [
                    idqso, sub
                ], function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    if (info.length > 0) {
                        resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                    } else {
                        resolve();
                    }
                });
        });
    }
    // async function delQSOlinks(qso, qsos_rel) {
    //     let info;
    //     for (let i = 0; i < qsos_rel.length; i++) {
    //         info = await delQSOlink(qso, qsos_rel[i].qso);
    //     }
    //     return info;
    // }
    function confirmQSOlink(qso, idqso_rel) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("confirmQSOlink" + idqso_rel);


            //***********************************************************
            conn.query('UPDATE  qsos_links SET confirmed=1, confirmed_datetime=NOW() WHERE idqso=? and  idqso_rel=? and confirmed is null', [qso, idqso_rel], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                   return reject(err);
                } else {
                resolve(JSON.parse(JSON.stringify(info)));
                }
                // console.log(info);
            });
        });
    }

    function UpdateLinksInQso(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateLinksInQso" +qso);
            conn.query('UPDATE sqso.qsos SET links_conf_counter = links_conf_counter+1 WHERE idqsos=?', [
                qso 
            ], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
               
                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function UpdateLinksInQraOwner(idqras) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateLinksInQraOwner" +idqras);
            conn.query('UPDATE sqso.qras SET links_confirmed = links_confirmed+1 WHERE idqras=?', [
                idqras
            ], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                
                resolve(JSON.parse(JSON.stringify(info)));

            });
        });
    }

};
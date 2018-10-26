var mysql = require('mysql');

exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var sub;
    var qsos_rel = [];
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
    }
    else {
        qso = event.body.qso;
        qsos_rel = event.body.qsos_rel;
        sub = event.context.sub;
    }

    // ***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {
        let idqras_owner = await checkOwnerInQso(qso, sub);
        if (!idqras_owner) {
            console.log("Caller is not QSO Owner");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "You are not the Owner of the main QSO";

            return callback(null, response);
        }

        await UpdateLinksInQso(qso, qsos_rel.length);
        await UpdateLinksInQraOwner(idqras_owner, qsos_rel.length);
        let info = await addQSOlinks(qso, qsos_rel);
        if (info.affectedRows) {
            console.log("QSOLink Added");
            response.body.error = 0;
            response.body.message = info.message;
            console.log("QSOLink Added ");
            return callback(null, response);
        } //ENDIF

    }
    catch (e) {
        console.log("Error executing Qso link add");
        console.log(e);
        conn.destroy();

        response.body.error = 1;
        response.body.message = e;

        return callback(null, response);
    }

    function checkOwnerInQso(idqso, sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.

            conn
                .query("SELECT qras.idqras from qras inner join qsos on qras.idqras = qsos.idqra_owner w" +
                    "here qsos.idqsos=? and qras.idcognito=?", [
                        idqso, sub
                    ],
                    function(err, info) {
                        // Call reject on error states, call resolve with results
                        if (err) {
                            return reject(err);
                        }

                        if (info.length > 0) {
                            resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                        }
                        else {
                            resolve();
                        }
                    });
        });
    }
    async function addQSOlinks(qso, qsos_rel) {
        let info;
        for (let i = 0; i < qsos_rel.length; i++) {
            info = await addQSOlink(qso, qsos_rel[i].qso);
        }
        return info;
    }

    function addQSOlink(qso, idqso_rel) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("addQSOlink" + idqso_rel);


            //***********************************************************
            conn.query('INSERT INTO qsos_links SET idqso=?, idqso_rel=?, datetime=NOW()', [qso, idqso_rel], function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                else {
                    resolve(JSON.parse(JSON.stringify(info)));
                }
                // console.log(info);
            });
        });
    }

    function UpdateLinksInQso(qso, counter) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateLinksInQso" + qso + counter);
            conn.query('UPDATE sqso.qsos SET links_counter = links_counter+? WHERE idqsos=?', [
                counter, qso
            ], function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }

    function UpdateLinksInQraOwner(idqras, counter) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateLinksInQraOwner" + idqras + counter);
            conn.query('UPDATE sqso.qras SET links_created = qsos_counter+? WHERE idqras=?', [
                counter, idqras
            ], function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));

            });
        });
    }

};


var mysql = require('mysql');


exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var sub;
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

    // var count;
    if (event.qso) {
        qso = event.qso;        
        sub = event.sub;
    } else {
        qso = event.qso;        
        sub = event.context.sub;
    }

    //***********************************************************
    var conn = await mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });
    try {
        
        let idqras_owner = await checkQraCognito(sub);
        if (!idqras_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            callback("User does not exist");
            return context.fail(response);
        }
               
        let likes = await getLikes(qso);
        let found = likes.find(o => o.idqra === idqras_owner)
        if (!found) {       
            console.log("no like found");
            //like already exist => do not insert again
            response.body.error = 400;
            response.body.message = likes.length;
            return callback(null, response);
        }
        
        info = await deleteLike(idqras_owner, qso);
        if (info) {            
            await UpdateLikesCounterInQso(qso);            
                conn.destroy();
                response.body.error = 0;
                response.body.message = likes.length - 1;
                console.log("likes deleted ");
                return callback(null, response);
            
        }

    } catch (e) {
        console.log("Error executing QSO Likes Delete");
        console.log(e);
        conn.destroy();
        callback(e.message);
        response.body.error = 1;
        response.body.message = e.message;       
        callback(null,response);
        return context.fail(response);
    }
    function UpdateLikesCounterInQso(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateLikesCounterInQso");
            conn
                .query('UPDATE sqso.qsos SET likes_counter = likes_counter-1  WHERE idqsos=?', qso, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    // console.log(info);
                });
        });
    }
    function checkQraCognito(sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito");
            conn
                .query("SELECT idqras FROM qras where idcognito=? LIMIT 1", sub, function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info))[0].idqras);
                });
        });
    }   
    function getLikes(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQsoAlreadyLiked");
            conn
                .query("SELECT * from qsos_likes WHERE idqso = ?", [
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
    function deleteLike(idqra_owner, qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("insertLike");
            conn
                .query('DELETE FROM qsos_likes where idqso=? and idqra=?', [
                    qso, idqra_owner
                ], function (err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)).affectedRows);
                });
        });
    }
   

};

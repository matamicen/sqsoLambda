
var mysql = require('mysql');



exports.handler = async(event, context, callback) =>
{
    context.callbackWaitsForEmptyEventLoop = false;

 
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
    }
    else {
        qso = event.body.qso;
    }

    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com',  // give your RDS endpoint  here
        user: 'sqso',  // Enter your  MySQL username
        password: 'parquepatricios',  // Enter your  MySQL password
        database: 'sqso'    // Enter your  MySQL database name.
    });
    try {
        var qso = await getQso(qso);
        if (!qso){
            console.log("QSO does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "QSO does not exist";
            
            
            return callback(null, response);
        }
        var qra = await getQsoOwnerData(qso);
        qso.qra = qra.qra;
        qso.profilepic = qra.profilepic;
        qso.avatarpic = qra.avatarpic;
        qso.qras = await getQsoQras(qso);
        qso.likes = await getQsoLikes(qso);
        qso.comments = await getQsoComments(qso);
        qso.media = await getQsoMedia(qso);
        conn.destroy();
        response.body.error = 0;
        response.body.message = qso;
        console.log("new follower ");
        return callback(null, response);
        
    } catch (e) {
        console.log("Error executing QSO Get Detail");
        console.log(e);
        conn.destroy();
      
                  response.body.error = 1;
            response.body.message = e.message;
            
            
            return callback(null, response);
    }

    function getQso(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QRA info from Congito ID");            
            //***********************************************************
            conn.query('SELECT * from qsos WHERE GUID_URL = ?',qso, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info))[0]);
                // console.log(info);
            });
        });
    }
    function getQsoOwnerData(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QRA info from Congito ID");            
            //***********************************************************
            conn.query('SELECT qra, profilepic, avatarpic from qras WHERE idqras = ?',qso.idqra_owner, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info))[0]);
                // console.log(info);
            });
        });
    }
    function getQsoQras(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.             
            //***********************************************************
            conn.query("SELECT qra, profilepic, avatarpic FROM sqso.qras where  idqras in ( SELECT idqra FROM sqso.qsos_qras where isOwner <> true and idqso = ? ) ", qso.idqsos, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }
    function getQsoMedia(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.             
            //***********************************************************
            conn.query("SELECT * from qsos_media WHERE idqso =? ", qso.idqsos, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }
    function getQsoLikes(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.             
            //***********************************************************
            conn.query("SELECT qra, profilepic, avatarpic FROM sqso.qras where  idqras in (SELECT idqra from qsos_likes WHERE idqso =? )", qso.idqsos, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }
    function getQsoComments(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.             
            //***********************************************************
            conn.query("SELECT qsos_comments.*, qras.qra FROM qsos_comments inner join qras on qsos_comments.idqra = qras.idqras where  idqso=?", qso.idqsos, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    };
 
};
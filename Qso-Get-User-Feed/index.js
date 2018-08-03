var mysql = require('mysql');



exports.handler = async(event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;



    var sub;

    var msg;
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });

    if (event.sub) {
        sub = event.sub;
    }
    else if (event.context.sub) {
        sub = event.context.sub;
    }



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
        let qsos_output = await getQsos(idqras_owner);
        console.log(qsos_output);
        conn.destroy();
        context.succeed(qsos_output);

    }
    catch (e) {
        console.log("Error when select QRA to get ID of Owner");
        console.log(e);
        conn.destroy();
        callback(e.message);
        msg = {
            "error": "1",
            "message": "Error when select QRA to get ID of Owner"
        };
        return context.fail(msg);
    }

    function getQRA(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QRA info from Congito ID");
            conn.query("SELECT idqras FROM qras where idcognito=? LIMIT 1", sub, function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info))[0].idqras);
            });
        });
    }

    async function getQsos(idqra) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QRA info from Congito ID");
            conn.query("CALL qsouserlistget2(?)", idqra, function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                
                let qsos = JSON.parse(JSON.stringify(info))[0];
                let qso_qras = JSON.parse(JSON.stringify(info))[1];
                let qso_comments = JSON.parse(JSON.stringify(info))[2];
                let qso_likes = JSON.parse(JSON.stringify(info))[3];
                let qso_media = JSON.parse(JSON.stringify(info))[4];
                let qso_orig = JSON.parse(JSON.stringify(info))[5];
                let qso_links = JSON.parse(JSON.stringify(info))[6];
                
                qsos.map(qso => {
                    qso.qras = qso_qras.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
                    qso.comments = qso_comments.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
                    qso.likes = qso_likes.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
                    qso.media = qso_media.filter(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
                    qso.original = qso_orig.find(obj => obj.idqsos === qso.idqso_shared);
                    qso.links = qso_links.find(obj => obj.idqso === qso.idqsos || obj.idqso === qso.idqso_shared);
                });
                
                resolve(qsos);
                
            });
        });

    }
};

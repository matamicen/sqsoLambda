
var mysql = require('mysql');


exports.handler = async(event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var qra;

    
    
    var msg;
    var sub;
    var qras= [];
    // {     "sub": "ccd403e3-06ae-4996-bb70-3aacf32a86df",     "qra": "LU8AJ1"   }
    if (event.qra) {
        qra = event.qra;
        sub = event.sub;
    } else {
        qra = event.body.qra;
        sub = event.context.sub;
    }

    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });

    try {
        let idqras_owner = await getQRA(sub);
        if (!idqras_owner) {
            console.log("User does not exist");
            conn.destroy();
            
            msg = {
                "error": 1,
                "message": "User does not exist"
            };
            callback(msg);
            return context.fail(msg);
        }
        var followings = await getFollowings(idqras_owner);
        
        qras = await getQRAs(qra.toUpperCase());
        
        if (qras.length == 0) {
            conn.destroy();
            msg = {
                "error": 1,
                "message": {
                    "qra": qra,
                    "url": "null",
                    "following": "NOT_EXIST"
                }
            };
            return callback(null, msg);
        }
        qras = await verifyFollowings(qras, followings);
        
        msg = {
            "error": 0,
            "message": qras
        };
        conn.destroy();
        return context.succeed(msg);

    } catch (e) {
        console.log("Error in QRAlistGetWithAuth");
        console.log(e);
        conn.destroy();
        callback(e.message);
        msg = {
            "error": 1,
            "message": e.message
        };
        return context.fail(msg);
    }

    function verifyFollowings(qras, following) {
        console.log("verifyFollowings");
        for (let i = 0; i < qras.length; i++) {

            // if (following.filter( (f) => { f.idqra_followed=== qras.idqras; }).length >
            // 0){
          
            if (following.some(f => f.idqra_followed === qras[i].idqras)) {
                qras[i].following = 'TRUE';
                console.log("true")
            }
            else {
                qras[i].following = 'FALSE';
                console.log("false")
            }
             
        }
        
        return qras;
    }
    function getFollowings(idqras_owner) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getFollowings");
            conn.query('SELECT * FROM qra_followers where idqra=?', idqras_owner, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function getQRAs(qra) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQRAs");
            conn.query("SELECT qra, CONCAT(COALESCE(qra,''), ' ', COALESCE(firstname,''),' ', COALESCE(l" +
                    "astname,'')) AS name, profilepic, idqras  FROM qras where qra LIKE ?",
            qra + '%', function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function getQRA(sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getQRA");
            conn.query("SELECT idqras FROM qras where idcognito=? LIMIT 1", sub, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info))[0].idqras);
            });
        });
    }
};
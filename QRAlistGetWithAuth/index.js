var fs = require('fs');
var mysql = require('mysql');
var async = require('async');

exports.handler = (event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;
    console.log('Received event:', JSON.stringify(event, null, 2));
    // console.log('Received context:', JSON.stringify(context, null, 2));

    var qra;
    
    var qra_updated;
    var qras_output = [];
    var msg;
    var sub;
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
    // GET QRA ID of OWNER
    console.log("select QRA to get ID of Owner");
    conn.query("SELECT qras.idcognito, qras.idqras from qras where qras.idcognito=?", [sub], function (error, info) {
        
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();
            callback(error.message);
            msg = {
                "error": "1",
                "message": "Error when select QRA to get ID of Owner"
            };
            return context.fail(msg);

        } else if (info.length === 0) {
            console.log("User does not exist");
            conn.destroy();
            callback(error.message);
            msg = {
                "error": "1",
                "message": "User does not exist"
            };
            return context.fail(msg);
        } else if (info.length > 0) {
            var idqras_owner = JSON.parse(JSON.stringify(info))[0].idqras;
            console.log(idqras_owner);
            //QRA FOUND => Update QRA with ID Cognito

            conn.query("SELECT qra, CONCAT(COALESCE(qra,''), ' ', COALESCE(firstname,''),' ', COALESCE(l" +
                    "astname,'')) AS name, profilepic, idqras  FROM qras where qra LIKE ?",
            qra.toUpperCase() + '%', function (error, info) { // querying the database
                if (error) {
                    console.log(error.message);
                    // context.done(null,event);
                    conn.destroy();
                    msg = {
                        "error": "1",
                        "message": "Could not get profile picture"
                    };
                    return context.fail(msg);
                } else if (info.length > 0) {
                    console.log("QRAs Found");
                 
                    var qras = JSON.parse(JSON.stringify(info));
                    // 1st para in async.each() is the array of items
                    // ***********************************************************
                    async.mapSeries(qras,
                    // 2nd param is the function that each item is passed to
                    function (qra, callback) {
                        
                        conn
                            .query('SELECT * FROM qra_followers where idqra=? and idqra_followed=?', [
                                idqras_owner, qra.idqras
                            ], function (error, info) {
                                if (error) {
                                    console.log("Error when select qra_followers");
                                    console.log(error.message);
                                    conn.destroy();
                                    callback(error.message);
                                    return callback.fail(error);
                                } //End If
                                if (info.length) {
                                    qra_updated = qra;
                                    qra_updated.following = 'TRUE';
                                    console.log(qra_updated);
                                    qras_output.push(qra_updated);
                                   

                                    callback();
                                } else {
                                    qra_updated = qra;
                                    qra_updated.following = 'FALSE';
                                    console.log(qra_updated);
                                    qras_output.push(qra_updated);
                                    

                                    callback();
                                }
                            }); //End Insert

                    },
                    // *********************************************************** 3rd param is the
                    // function to call when everything's done
                    function (err) {
                        console.log("All tasks are done now");
                        // doSomethingOnceAllAreDone();
                        var msg = {
                            "error": "0",
                            "message": qras_output
                        };
                        conn.destroy();
                        context.succeed(msg);
                    }); //end async
                    // conn.destroy(); qra_res = JSON.parse(JSON.stringify(info)); msg = { "error":
                    // "0",     "message": qra_res }; context.succeed(msg);
                } else {
                    //context.done(null,event);
                    conn.destroy();
                    msg = {
                        "error": "0",
                        "message": {
                            "qra": qra,
                            "url": "empty",
                            "following": "NOT_EXIST"
                        }
                    };
                    return context.succeed(msg);
                }
            
            });
        }
    });
};
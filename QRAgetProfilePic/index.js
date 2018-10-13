var mysql = require('mysql');

exports.handler = (event, context, callback) => {

    context.callbackWaitsForEmptyEventLoop = false;

    var qra;
    var qra_res;
    var msg;
    var sub;
    if (event.qra) {
        qra = event.qra;
        sub = event.sub;
    }
    else {
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

    conn.query("SELECT qras.idcognito, qras.idqras from qras where qras.idcognito=?", [sub], function(error, info) {
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

        }

        var idqras_owner = JSON.parse(JSON.stringify(info))[0].idqras;
        console.log(idqras_owner);
        //QRA FOUND => Update QRA with ID Cognito

        conn.query("SELECT * FROM qras where qra=? LIMIT 1", qra.toUpperCase(), function(error, info) { // querying the database
            if (error) {
                console.log(error.message);
                // context.done(null,event);
                conn.destroy();
                msg = {
                    "error": "1",
                    "message": "Could not get profile picture"
                };
                return context.fail(msg);
            }
            else if (info.length > 0) {
                console.log("QRA FOUND");

                qra_res = JSON.parse(JSON.stringify(info));
                console.log("FIND FOLLOWERS");

                conn.query('SELECT * FROM qra_followers where idqra=? and idqra_followed=?', [
                    idqras_owner, qra_res[0].idqras
                ], function(error, info) {
                    if (error) {
                        console.log("Error when select qra_followers");
                        console.log(error.message);
                        conn.destroy();
                        callback(error.message);
                        return callback.fail(error);
                    } //End If
                    console.log(info);
                    if (info.length) {

                        msg = {
                            "error": "0",
                            "message": {
                                "qra": qra,
                                "url": qra_res[0].profilepic,
                                "url_avatar": qra_res[0].avatarpic,
                                "following": 'TRUE'
                            }
                        };

                    }
                    else {

                        msg = {
                            "error": "0",
                            "message": {
                                "qra": qra,
                                "url": qra_res[0].profilepic,
                                "url_avatar": qra_res[0].avatarpic,
                                "following": 'FALSE'
                            }
                        };
                    }
                    conn.destroy();
                    context.succeed(msg);
                }); //End Insert

            }
            else {
                //context.done(null,event);
                conn.destroy();
                msg = {
                    "error": "0",
                    "message": {
                        "qra": qra,
                        "url": null,
                        "url_avatar": null,
                        "following": 'NOT_EXIST'
                    }
                };
                return context.succeed(msg);
            }
        });
    }); //end validation of qso owner and cognito sub

};

var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');

exports.handler = (event, context, callback) =>
{


    context.callbackWaitsForEmptyEventLoop = false;

    var Sub;
    var idqra_owner;
    var idqra_follower;
    var qra;

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
    if (process.env.TEST) {
        var test = {
            "qra": "LU2ACH"

        };
        qra = test.qra;


    }
    else {
        qra = event.body.qra;


    }

    if (process.env.TEST) {
        Sub = "5c43aa68-4979-4730-9c5f-cc4ec4d78b4b";
    } else if (event.context.sub) {
        Sub = event.context.sub;
    }
    console.log("sub =", Sub);


    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com',  // give your RDS endpoint  here
        user: 'sqso',  // Enter your  MySQL username
        password: 'parquepatricios',  // Enter your  MySQL password
        database: 'sqso'    // Enter your  MySQL database name.
    });

    // GET QRA ID of OWNER
    console.log("select QRA to get ID of Owner");

    conn.query("SELECT qras.idqras from qras where qras.idcognito=?", Sub, function (error, info) {
        if (error) {
            console.log("Error when selecting QRA");
            console.log(error);
            conn.destroy();
            response.body.error = 400;
            response.body.message = "Error: Error when selecting QRA";
            // return context.fail( "Error: Error when selecting QRA");
            return callback(null, response);
        }
        else if (info.length === 0) {
            console.log("User does not exist");
            response.body.error = 400;
            response.body.message = "Error: User does not exist";
            conn.destroy();
            //return context.fail( "Error: User does not exist");
            return callback(null, response);
        }
        else if (info.length > 0) {
            //get qra of following
            idqra_owner = JSON.parse(JSON.stringify(info))[0].idqras;
            conn.query("SELECT qras.idqras from qras where qras.qra=?", qra, function (error, info) {
                if (error) {
                    console.log("Error when selecting FOLLOWERQRA");
                    console.log(error);
                    conn.destroy();
                    response.body.error = 400;
                    response.body.message = "Error: Error when selecting FOLLOWERQRA";
                    // return context.fail( "Error: Error when selecting QRA");
                    return callback(null, response);
                }
                else if (info.length === 0) {
                    console.log("User does not exist");
                    response.body.error = 400;
                    response.body.message = "Error: FOLLOWER User does not exist";
                    conn.destroy();
                    //return context.fail( "Error: User does not exist");
                    return callback(null, response);
                }
                else if (info.length > 0) {
                    idqra_follower = JSON.parse(JSON.stringify(info))[0].idqras;
                    //get existing relation
                    conn.query("SELECT * from qra_followers WHERE idqra = ? and idqra_followed=?", [idqra_owner, idqra_follower], function (error, info) {
                        if (error) {
                            console.log("Error when selecting FOLLOWERQRA");
                            console.log(error);
                            conn.destroy();
                            response.body.error = 400;
                            response.body.message = "Error: Error when selecting FOLLOWERQRA";
                            // return context.fail( "Error: Error when selecting QRA");
                            return callback(null, response);
                        }
                        else if (info.length === 0) {
                            console.log("QRA not followed");
                            response.body.error = 0;
                            response.body.message = info;
                            return callback(null, response);
                        }
                        else if (info.length > 0) {

                            console.log("idqra " + idqra_owner +  "idqrafollower" + idqra_follower);
                            conn.query('DELETE FROM qra_followers where idqra=? and idqra_followed=?', [idqra_owner, idqra_follower], function (error, info) {
                                if (error) {
                                    console.log("Error when Delete QSO FOLLOWED");
                                    console.log(error.message);
                                    conn.destroy();
                                    response.body.error = 400;
                                    response.body.message = "Error when Delete QSO FOLLOWED";
                                    return callback(null, response);
                                } //End If
                                if (info.affectedRows > 0) {
                                    console.log("QSOFollow Delete", info.affectedRows);

                                    conn.query("SELECT qra_followers.*,  qras.qra, qras.profilepic  from qra_followers inner join qras on qra_followers.idqra_followed = qras.idqras WHERE qra_followers.idqra = ?", idqra_owner, function (error, info) {
                                            console.log(info);
                                            if (error) {
                                                console.log("Error when selecting FOLLOWING QRA");
                                                console.log(error);
                                                //    conn.destroy();
                                                response.body.error = 400;
                                                response.body.message = "Error: Error when selecting FOLLOWERQRA";
                                                // return context.fail( "Error: Error when selecting QRA");
                                                return callback(null, response);
                                            }
                                            else {
                                                conn.destroy();
                                                response.body.error = 0;
                                                response.body.message = JSON.parse(JSON.stringify(info));
                                                console.log("new follower " + response.body.message);
                                                return callback(null, response);
                                            }

                                        }
                                    );


                                }
                            }); //End Insert
                        }
                    }); //end select qra_follower
                }
            }); //end select qra

        } //ENDIF
    }); //SELECT QSO TABLE WITH QSO and QRA

}

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
    var datetime;

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
            "qra": "LU2ACH",
            "datetime": "2016-04-28 14:12:00"

        };
        qra = test.qra;
        datetime = test.datetime;

    }
    else {
        qra = event.body.qra;
        datetime = event.body.datetime;

    }

    if (process.env.TEST) {
        Sub = "99a3c963-3f7d-4604-a870-3c675b012f63";
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
                    //insert new comment
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
                        else if (info.length > 0) {
                            console.log("already followed" );
                            //like already exist => do not insert again
                            response.body.error = 0;
                            response.body.message = info;
                            return callback(null, response);
                        }
                        else if (info.length === 0) {

                            console.log("idqra " + idqra_owner + "datetime" + datetime + "idqrafollower" + idqra_follower);
                            conn.query('INSERT INTO qra_followers SET idqra = ?, idqra_followed=?, datetime=?', [idqra_owner, idqra_follower, datetime], function (error, info) {
                                if (error) {
                                    console.log("Error when Insert QSO FOLLOWED");
                                    console.log(error.message);
                                    conn.destroy();
                                    response.body.error = 400;
                                    response.body.message = "Error when Insert QSO FOLLOWED";
                                    //return context.fail( "Error when Insert QSO LIKES");
                                    return callback(null, response);
                                } //End If
                                if (info.insertId) {
                                    console.log("QSOCOMMENT inserted", info.insertId);

                                    //qsos.push(JSON.parse(JSON.stringify(qso)));
                                    //     console.log(qso);
                                    conn.destroy();
                                    response.body.error = 0;
                                    response.body.message = info;
                                    console.log("new follower " + response.body.message);
                                    return callback(null, response);


                                }
                            }); //End Insert
                        }
                    }); //end select qra_follower
                }
            }); //end select qra

        } //ENDIF
    }); //SELECT QSO TABLE WITH QSO and QRA

}

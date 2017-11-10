var fs = require('fs');
var mysql = require('mysql');
var async = require('async');

exports.handler = (event, context, callback) =
>
{


    context.callbackWaitsForEmptyEventLoop = false;

    var Sub;
    var idqra_owner;
    var idqra_follower;
    var qra;
    var output = {};


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
        qra = "LU2ACH";
    } else if (event.body.qra) {
        qra = event.body.qra;
    }
    console.log("qra =", qra);


    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com',  // give your RDS endpoint  here
        user: 'sqso',  // Enter your  MySQL username
        password: 'parquepatricios',  // Enter your  MySQL password
        database: 'sqso'    // Enter your  MySQL database name.
    });

    // GET QRA ID of OWNER
    console.log("select IDQRA ");

    conn.query("SELECT qras.idqras from qras where qras.qra=?", qra, function (error, info) {
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
            console.log("QRA does not exist");
            response.body.error = 400;
            response.body.message = "Error: QRA does not exist";

            return callback(null, response);
        }
        else if (info.length > 0) {
            //get qra of following
            idqra_owner = JSON.parse(JSON.stringify(info))[0].idqras;

            async.series([
                    //Load QRA Info
                    function (callback) {
                        console.log("Get QRA Data" + idqra_owner);
                        conn.query("SELECT * from qras where qras.idqras=?", idqra_owner, function (error, info) {

                                if (error) {
                                    console.log("Error when selecting FOLLOWERQRA");
                                    console.log(error);
                                    //conn.destroy();
                                    response.body.error = 400;
                                    response.body.message = "Error: Error when selecting QRA";
                                    // return context.fail( "Error: Error when selecting QRA");
                                    callback(error);
                                }
                                else if (info.length === 0) {
                                    console.log("User does not exist");
                                    response.body.error = 400;
                                    response.body.message = "Error:  Error when selecting QRA";
                                    //    conn.destroy();
                                    //return context.fail( "Error: User does not exist");
                                    callback(response);
                                }
                                else if (info.length > 0) {
                                    output.qra = JSON.parse(JSON.stringify(info))[0];
                                    callback();
                                }
                            }
                        );
                    },
                    //Load Following
                    function (callback) {
                        console.log("Getting Following of " + idqra_owner);
                        conn.query("SELECT qra_followers.*,  qras.qra, qras.profilepic  from qra_followers inner join qras on qra_followers.idqra_followed = qras.idqras WHERE qra_followers.idqra = ?", idqra_owner, function (error, info) {
                                console.log(info);
                                if (error) {
                                    console.log("Error when selecting FOLLOWING QRA");
                                    console.log(error);
                                    //    conn.destroy();
                                    response.body.error = 400;
                                    response.body.message = "Error: Error when selecting FOLLOWERQRA";
                                    // return context.fail( "Error: Error when selecting QRA");
                                    callback(error);
                                }
                                else {

                                    output.following = JSON.parse(JSON.stringify(info));
                                    callback();
                                }

                            }
                        );
                    },
                    //Load Followers
                    function (callback) {
                        conn.query("SELECT qra_followers.*,  qras.qra, qras.profilepic  from qra_followers inner join qras on qra_followers.idqra = qras.idqras WHERE qra_followers.idqra_followed = ?", idqra_owner, function (error, info) {
                                if (error) {
                                    console.log("Error when selecting FOLLOWED BY QRA");
                                    console.log(error);
                                    //    conn.destroy();
                                    response.body.error = 400;
                                    response.body.message = "Error: Error when selecting FOLLOWED BY QRA";
                                    // return context.fail( "Error: Error when selecting QRA");
                                    callback(error);
                                }
                                else {
                                    output.followers = JSON.parse(JSON.stringify(info));
                                    callback();
                                }

                            }
                        );
                    }, //END Function
                    //Load QSOS
                    function (callback) {
                        conn.query("CALL qraqsofeedget(?)", qra, function (error, info) {
                            console.log(error);
                            // console.log(info.length);
                            if (error) {
                                console.log("Error when selecting QRA");

                                conn.destroy();
                                response.body.error = 400;
                                response.body.message = "Error: Error when selecting QRA";
                                // return context.fail( "Error: Error when selecting QRA");
                                return callback(null, response);
                            }
                            else if (info.length > 0) {
                                response.body.error = 0;


                                qsos = JSON.parse(JSON.stringify(info))[0];
                                qso_qras = JSON.parse(JSON.stringify(info))[2];
                                qso_comments = JSON.parse(JSON.stringify(info))[3];
                                qso_likes = JSON.parse(JSON.stringify(info))[4];
                                qso_media = JSON.parse(JSON.stringify(info))[5];


                                qsos_output = qsos.map(qso = > {
                                    qso.qso_qras = qso_qras.filter(obj = > obj.idqsos === qso.idqsos
                            )
                                ;
                                qso.qso_comments = qso_comments.filter(obj = > obj.idqsos === qso.idqsos
                            )
                                ;
                                qso.qso_likes = qso_likes.filter(obj = > obj.idqsos === qso.idqsos
                            )
                                ;
                                qso.qso_media = qso_media.filter(obj = > obj.idqsos === qso.idqsos
                            )
                                ;
                                return qso;
                            })
                                ;

                                output.qsos = qsos_output;
                                callback();
                            }
                        });

                    } //END Function
                ],
                //LAST FUNCTION
                function (err) {

                    if (err) {
                        response.body.error = 220;
                        response.body.message = output;
                        console.log(response.body.message);
                        conn.destroy();
                        return callback(null, response);
                    }
                    conn.destroy();
                    response.body.error = 0;
                    response.body.message = output;
                    console.log("new follower " + response.body.message);
                    return callback(null, response);
                }
            ); //End Async

        }
    });
    //End Query to get QRA ID
}
;

var fs = require('fs');
var mysql = require('mysql');
var async = require('async');

exports.handler = (event, context, callback) =>
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

            return callback(null, response);
        }
        else if (info.length > 0) {
            //get qra of following
            idqra_owner = JSON.parse(JSON.stringify(info))[0].idqras;


            async.series([
                    //Load QRA Info
                    function (callback) {
                        console.log("Get User Data" + idqra_owner);
                        conn.query("SELECT qras.QRA, qras.profilepic from qras where qras.idqras=?", idqra_owner, function (error, info) {

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
                        conn.query("SELECT qra_followers.*,  qras.qra, qras.profilepic  from qra_followers inner join qras on qra_followers.idqra = qras.idqras WHERE qra_followers.idqra = ?", idqra_owner, function (error, info) {
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
                                else{

                                    output.following = JSON.parse(JSON.stringify(info));
                                    callback();
                                }

                            }
                        );
                    },

                    //Load Followers
                    function (callback) {
                        conn.query("SELECT qra_followers.*,  qras.qra, qras.profilepic  from qra_followers inner join qras on qra_followers.idqra_followed = qras.idqras WHERE qra_followers.idqra_followed = ?", idqra_owner, function (error, info) {
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
                    } //END Function
                ],
                //LAST FUNCTION
                function(err)
                {

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
};

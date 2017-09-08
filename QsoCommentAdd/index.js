var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');
var AWS = require('aws-sdk');
AWS.config.region = 'eu-east-1';
var lambda = new AWS.Lambda();

exports.handler = (event, context, callback) =
>
{


    context.callbackWaitsForEmptyEventLoop = false;

    var Sub;
    var idqra_owner;
    var qso;
    var datetime;
    var comment;
    var payload;
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
            "qso": "473",
            "comment": "test comment",
            "datetime": "2016-04-28 14:12:00"

        };
        qso = test.qso;
        comment = test.comment;
        datetime = test.datetime;

    }
    else {
        qso = event.body.qso;
        comment = event.body.comment;
        datetime = event.body.datetime;

    }

    if (process.env.TEST) {
        Sub = "7bec5f23-6661-4ba2-baae-d1d4f0440038";
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
    console.log(qso);
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
            //insert new comment
            idqra_owner = JSON.parse(JSON.stringify(info))[0].idqras;
            console.log("idqso " + qso + "idqra " + idqra_owner + "datetime" + datetime + "comment" + comment);
            conn.query('INSERT INTO qsos_comments SET idqso = ?, idqra=?, datetime=?, comment=?', [qso, idqra_owner, datetime, comment], function (error, info) {
                if (error) {
                    console.log("Error when Insert QSO COMMENT");
                    console.log(error.message);
                    conn.destroy();
                    response.body.error = 400;
                    response.body.message = "Error when Insert QSO COMMENT";
                    //return context.fail( "Error when Insert QSO LIKES");
                    return callback(null, response);
                } //End If
                if (info.insertId) {
                    console.log("QSOCOMMENT inserted", info.insertId);
                    conn.query("SELECT qsos_comments.*, qras.qra FROM qsos_comments inner join qras on qsos_comments.idqra = qras.idqras where  idqso=?", qso, function (error, comments) {
                        if (!error) {
                            //PUSH Notification
                            payload = {
                                "commentID": info.insertID,
                                "qso": qso
                            };
                            var params = {
                                FunctionName: 'snsPushUser', // the lambda function we are going to invoke
                                InvocationType: 'RequestResponse',
                                LogType: 'Tail',
                                Payload: JSON.stringify(payload)
                            };

                            lambda.invoke(params, function (err, data) {
                                if (err) {
                                    // context.fail(err);
                                    console.log("push error");
                                } else {
                                    console.log("push OK");
                                    // context.succeed('Lambda_B said ' + data.Payload);
                                }
                            })

                            console.log(comments);


                            conn.destroy();
                            response.body.error = 0;
                            response.body.message = JSON.parse(JSON.stringify(comments));
                            console.log("new comments" + response.body.message);
                            return callback(null, response);
                        }
                        else {
                            console.log("Error when Select QSO COMMENT");
                            console.log(error.message);
                            conn.destroy();
                            response.body.error = 400;
                            response.body.message = "Error when Select QSO COMMENT";
                            //return context.fail( "Error when Insert QSO LIKES");
                            return callback(null, response);
                        }

                    });

                }
            }); //End Insert


        } //ENDIF
    }); //SELECT QSO TABLE WITH QSO and QRA

}
;
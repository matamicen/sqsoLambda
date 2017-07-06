var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');

exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;

    var Sub;
    var idqra_owner;
    var qsoLikes;
    var qso;
    var picked;
    var response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin" : "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials" : true // Required for cookies, authorization headers with HTTPS
        },
        body: {"error": null,
            "message": null
        }
    };

    // var count;
    if (process.env.TEST) {
        var test = {     "qso": "473"
        };
        qso = test.qso;

    }
    else {
        qso = event.body.qso;

    }

    if (process.env.TEST){
        Sub = "7bec5f23-6661-4ba2-baae-d1d4f0440038";
    }else if (event.context.sub){
        Sub = event.context.sub;
    }
    console.log("sub =", Sub);


    //***********************************************************
    var conn = mysql.createConnection({
        host      :  'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com' ,  // give your RDS endpoint  here
        user      :  'sqso' ,  // Enter your  MySQL username
        password  :  'parquepatricios' ,  // Enter your  MySQL password
        database  :  'sqso'    // Enter your  MySQL database name.
    });

    // GET QRA ID of OWNER
    console.log("select QRA to get ID of Owner");
    console.log(qso);
    conn.query ( "SELECT qras.idqras from qras where qras.idcognito=?", Sub,   function(error,info) {
        if (error) {
            console.log("Error when selecting QRA");
            console.log(error);
            conn.destroy();
            response.body.error = 400;
            response.body.message = "Error: Error when selecting QRA";
            // return context.fail( "Error: Error when selecting QRA");
            return callback(null, response);
        }
        else if (info.length === 0){
            console.log("User does not exist");
            response.body.error = 400;
            response.body.message = "Error: User does not exist";
            conn.destroy();
            //return context.fail( "Error: User does not exist");
            return callback(null, response);
        }
        else if (info.length > 0) {

            idqra_owner = JSON.parse(JSON.stringify(info))[0].idqras;
            console.log("qraowner " + idqra_owner);

            conn.query('SELECT * from qsos_likes WHERE idqso = ?', qso, function (error, qsoLikes) {
                console.log("error");
                console.log(error);
                console.log(qsoLikes);
                if (error) {
                    console.log("Error when SELECTING QSO LIKES");
                    console.log(error.message);
                    conn.destroy();
                    response.body.error = 400;
                    response.body.message = "Error when SELECTING QSO LIKES";
                    //return context.fail( "Error when Insert QSO LIKES");
                    return callback(null, response);
                } else {
                    picked = qsoLikes.find(o => o.idqra === idqra_owner);
                    console.log("picked");
                    console.log(picked);
                    if (picked) {
                        console.log("already liked" + qsoLikes.length);
                        //like already exist => do not insert again
                        response.body.error = 0;
                        response.body.message = qsoLikes.length;
                        return callback(null, response);
                    } else {
                        //insert new like
                        console.log("idqso " + qso + "idqra " + idqra_owner );
                        conn.query('INSERT INTO qsos_likes SET idqso = ?, idqra=?', [qso, idqra_owner], function (error, info) {
                            if (error) {
                                console.log("Error when Insert QSO LIKES");
                                console.log(error.message);
                                conn.destroy();
                                response.body.error = 400;
                                response.body.message = "Error when Insert QSO LIKES";
                                //return context.fail( "Error when Insert QSO LIKES");
                                return callback(null, response);
                            } //End If
                            if (info.insertId) {
                                console.log("QSOLIKES inserted", info.insertId);
                                conn.destroy();
                                response.body.error = 0;
                                response.body.message = qsoLikes.length + 1;
                                console.log("new Like" + response.message);
                                return callback(null, response);
                            }
                        }); //End Insert
                    }
                }//End If
            }); //End Select qsos_likes
        } //ENDIF
    }); //SELECT QSO TABLE WITH QSO and QRA

};
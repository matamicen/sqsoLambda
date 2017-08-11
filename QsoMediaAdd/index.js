var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');

exports.handler = (event, context, callback) =>
{


    context.callbackWaitsForEmptyEventLoop = false;

    var Sub;
    var idqra_owner;
    var qsoLikes;
    var qso;
    var picked;
    var response = {
        "message": "",
        "error": ""
    };

    // var count;
    if (process.env.TEST) {
        var test = {
            "qso": "473"
        };
        qso = test.qso;

    }
    else {
        qso = event.body.qso;

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
    conn.query("SELECT qras.idqras from qras inner join qsos on qras.idqras = qsos.idqra_owner where qsos.idqsos =? and qras.idcognito=?", [qso, Sub], function (error, info) {
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();
            response.error = 400;
            response.message = "Error: select QRA to get ID of Owner";
            // return context.fail( "Error: select QRA to get ID of Owner");
            return context.succeed(response);
        }
        else if (info.length === 0) {
            console.log("Caller user is not the QSO Owner");
            response.error = 400;
            response.message = "Error: Caller user is not the QSO Owner";
            conn.destroy();
            //return context.fail( "Error: Caller user is not the QSO Owner");
            return context.succeed(response);
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
                    response.error = 400;
                    response.message = "Error when SELECTING QSO LIKES";
                    //return context.fail( "Error when Insert QSO LIKES");
                    return context.succeed(response);
                } else {
                    picked = qsoLikes.find(o = > o.idqra === idqra_owner
                )
                    ;
                    console.log("picked");
                    console.log(picked);
                    if (picked) {
                        console.log("already liked" + qsoLikes.length);
                        //like already exist => do not insert again
                        response.error = 0;
                        response.message = qsoLikes.length;
                        return context.succeed(response);
                    } else {
                        //insert new like
                        console.log("idqso " + qso + "idqra " + idqra_owner);
                        conn.query('INSERT INTO qsos_likes SET idqso = ?, idqra=?', [qso, idqra_owner], function (error, info) {
                            if (error) {
                                console.log("Error when Insert QSO LIKES");
                                console.log(error.message);
                                conn.destroy();
                                response.error = 400;
                                response.message = "Error when Insert QSO LIKES";
                                //return context.fail( "Error when Insert QSO LIKES");
                                return context.succeed(response);
                            } //End If
                            if (info.insertId) {
                                console.log("QSOLIKES inserted", info.insertId);
                                conn.destroy();
                                response.error = 0;
                                response.message = qsoLikes.length + 1;
                                console.log("new Like" + response.message);
                                return context.succeed(response);
                            }
                        }); //End Insert
                    }
                }//End If
            }); //End Select qsos_likes
        } //ENDIF
    }); //SELECT QSO TABLE WITH QSO and QRA

}
;
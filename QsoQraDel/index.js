var fs = require('fs');
var mysql = require('mysql');
var async = require('async');

exports.handler = (event, context, callback) => {

    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Received context:', JSON.stringify(context, null, 2));
    context.callbackWaitsForEmptyEventLoop = false;

    var Sub;
    var post;
    var json;
    var qso;
    var qras;
    var qras_output = [];
    var qra;
    var msg;
    // var count;
    if (process.env.TEST) {
        var test = {
            "qso": "333",
            "qras": [
                "LU4fss",
                "LU9do"
            ]
        };
        qso = test.qso;
        qras = test.qras;
        Sub = '9970517e-ed39-4f0e-939e-930924dd7f73';
    }
    else {
        qso = event.body.qso;
        qras = event.body.qras;
        Sub = event.context.sub;
    }


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
    conn.query ( "SELECT qras.idcognito from qras inner join qsos on qras.idqras = qsos.idqra_owner where qsos.idqsos =? and qras.idcognito=?", [qso , Sub],   function(error,info) {
        console.log("info" + JSON.stringify(info));
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();
            callback(error.message);
            msg = { "error": "1",
                "message": "Error when select QRA to get ID of Owner" };
            return context.fail(msg);
        } else if (info.lenght === 0){
            console.log("Caller user is not the QSO Owner");
            console.log('error select: ' + error);
            callback(error);
            msg = { "error": "1",
                "message": "Error when select QRA to get ID of Owner" };
            return context.fail(msg);
        } else {

            // 1st para in async.each() is the array of items
            //***********************************************************
            async.each(qras,
                // 2nd param is the function that each item is passed to
                function(qra, callback){
                    console.log("GET QRA", qra.toUpperCase());
                    //***********************************************************
                    conn.query ( "SELECT * FROM qras where qra=? ", qra.toUpperCase(),   function(error,info) {  // querying the database
                        console.log("info=",info);
                        console.log(info.length);
                        if (error) {
                            console.log("Error When GET QRA");
                            console.log('error select: ' + error);
                            callback(error);
                            return context.fail(error);
                        }
                        else if (info.length > 0) {
                            console.log("found");
                            json =  JSON.parse(JSON.stringify(info));
                            idqras = json[0].idqras;
                            post  = {"idqso": qso,
                                "idqra": idqras};
                            console.log("post" +  idqras + qso);
                            //***********************************************************
                            conn.query('DELETE FROM qsos_qras where idqso=? and idqra=?', [ qso, idqras ], function(error, info) {
                                console.log("info" + JSON.stringify(info));
                                if (error) {
                                    console.log("Error when Delete QSO QRA");
                                    console.log(error.message);
                                    conn.destroy();
                                    callback(error.message);
                                    return context.fail(error);
                                } else if (info.affectedRows > 0){
                                    console.log("QSOQRA deleted", info.affectedRows);
                                    // count++;
                                    qras_output.push({"qra": qra});
                                    callback();
                                } else {
                                    console.log("Error when Delete QSO QRA");
                                    // count++;
                                    qras_output.push({"qra": "Error when Delete QSO QRA"});
                                    msg = { "error": "1",
                                        "message": qras_output };
                                    return context.succeed(msg);
                                }
                            }); //End Insert
                        } else {
                            console.log("not found");
                            qras_output.push({"qra": "QRA not found"});
                            msg = { "error": "1",
                                "message": qras_output };
                            return context.succeed(msg);
                        }//end if
                    }); //End Select
                },
                //***********************************************************
                // 3rd param is the function to call when everything's done
                function(err){
                    console.log("All tasks are done now");
                    // doSomethingOnceAllAreDone();
                    var msg = { "error": "0",
                        "message": qras_output  };
                    context.succeed(msg);
                }
            ); //end async
        }});

};
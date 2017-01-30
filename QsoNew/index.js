var fs = require('fs');
var mysql = require('mysql');


exports.handler = (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = true;
    // console.log('Received event:', JSON.stringify(event, null, 2));
    // console.log('Received context:', JSON.stringify(context, null, 2));

    var Sub;
    var Name;
    var post;
    var qra;
    var qras;
    var json;
    var idqras;
    var newqso;
    var mode;
    var band;
    var gps;
    if (process.env.TEST) {
        var test = {     "mode": "modetest1",
            "band": "bandtest1",
            "gps": "gpstest1",
            "state": "statetest1",
            "qras":  [ "test_qra2",
                "test_qra",
                "test_qra3"]
        };
        mode = test.mode;
        band = test.band;
        gps = test.gps;
        qras = test.qras;
    }
    else {
        mode = event.body.mode;
        band = event.body.band;
        gps = event.body.gps;
        qras = event.body.qras;
        console.log("QRAS",qras);
    }

    if (process.env.TEST){
        Sub = "ac73c8e5-77d1-4ec4-9384-b49076c9d580";
    }else if (event.context.sub){
        Sub = event.context.sub;
    }
    console.log("sub =", Sub);


    if (process.env.TEST){
        Name = "test";
    }else if (event.context.nickname){
        Name = event.context.nickname;
    }

    console.log('userName =', Name);

    //***********************************************************
    var conn = mysql.createConnection({
        host      :  'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com' ,  // give your RDS endpoint  here
        user      :  'sqso' ,  // Enter your  MySQL username
        password  :  'parquepatricios' ,  // Enter your  MySQL password
        database  :  'sqso'    // Enter your  MySQL database name.
    });

    // conn.connect(function(err) {    // connecting to database
    //     if (err) {
    //         console.log('error connecting: ' + err.stack);
    //         callback(err.stack);
    //         context.fail();

    //     } //END IF
    //     console.log('connected as id ' + conn.threadId);	 //console.log(conn);

    // conn.beginTransaction(function(error) {
    // if (error) {
    //         console.log("Error when Opening Transaction");
    //         console.log(error.message);
    //         conn.destroy();
    //         callback(error.message);
    //         return context.fail(error);
    //     } //END IF
    // GET QRA ID of OWNER
    console.log("select QRA to get ID of Owner");
    conn.query ( "SELECT * FROM qras where idcognito=? LIMIT 1", Sub,   function(error,info) {
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();
            callback(error.message);
            return context.fail(error);
        }
        // console.log(info);
        qra = JSON.stringify(info);
        json =  JSON.parse(qra);
        idqras = json[0].idqras;


        post  = {"idqra_owner": idqras,
            "mode": mode,
            "band": band,
            "gps": gps };


        //INSERT INTO QSO TABLE

        // console.log(post);
        conn.query ( 'INSERT INTO qsos SET ?', post,   function(error,info) {
            console.log("insert QSO");
            if (error) {
                console.log("Error when insert QSO");
                console.log(error.message);
                conn.destroy();
                callback(error.message);
                return context.fail(error);
            }

            console.log("QSO inserted", info.insertId);
            qso = JSON.stringify(info);
            //  console.log(qso);
            json =  JSON.parse(qso);
            //  console.log(json);
            newqso = json.insertId;
            var msg = { "error": "0",
                "message": newqso };
            context.succeed(msg);
            //INSERT INTO QRA TABLE

            // console.log("Starting FOR");
            // for(var i = 0; i < qras.length; i++){
            //     Name = qras[i];
            //         console.log("GET QRA");
            //         conn.query ( "SELECT * FROM qras where qra=? LIMIT 1", Name,   function(error,info) {  // querying the database
            //           console.log("info=",info);
            //             if (error) {
            //                 console.log("Error When GET QRA");
            //                 console.log('error select: ' + error);
            //                 callback(error);
            //                 return context.fail(error);
            //             }
            //             if (info.length === 0) {
            //                 //QRA Not Found => INSERT
            //                     console.log("QRA not found");
            //                     post  = {"qra" : Name, "idcognito" : Sub};
            //                     console.log('POST' + post);
            //                     console.log("Insert new QRA");
            //                     conn.query ( 'INSERT INTO qras SET ?', post,   function(error,info) {  // querying the database
            //                         if (error) {
            //                             console.log(error.message);
            //                             conn.destroy();
            //                             callback(error.message);
            //                             return context.fail(error);
            //                         }

            //                         console.log("qra inserted");
            //                         console.log(info);
            //                         qra = JSON.stringify(info);
            //                          json =  JSON.parse(qra);
            //                          idqras = json.insertId;
            //                          post  = {"idqso": newqso,
            //                                   "idqra": idqras};


            //                         console.log(post);
            //                         console.log("Insert QSO QRA");
            //                         conn.query('INSERT INTO qsos_qras SET ?', post, function(error, info) {
            //                              if (error) {
            //                                 console.log("Error when Insert QSO QRA");
            //                                 console.log(error.message);
            //                                 conn.destroy();
            //                                 callback(error.message);
            //                                 return callback.fail(error);
            //                              } //End If

            //                               console.log("QSOQRA inserted", info.insertId);
            //                         }); //End Insert QSOQRA
            //                     }); //end Insert QRA
            //             } //end if
            //             else {
            //              qra = JSON.stringify(info);
            //              json =  JSON.parse(qra);
            //              idqras = json[0].idqras;
            //              post  = {"idqso": newqso,
            //                       "idqra": idqras};


            //             console.log(post);
            //             console.log("Insert QSO QRA");
            //             conn.query('INSERT INTO qsos_qras SET ?', post, function(error, info) {
            //                  if (error) {
            //                     console.log("Error when Insert QSO QRA");
            //                     console.log(error.message);
            //                     conn.destroy();
            //                     callback(error.message);
            //                     return callback.fail(error);
            //                  } //End If

            //                   console.log("QSOQRA inserted", info.insertId);
            //             }); //End Insert
            //             }
            //     }); //End Select
            // } // End For



        });


    }); //END SELECT QRA
    // conn.commit(function(error) {
    // if (error) {
    //   conn.rollback(function() {
    //      console.log("Error when Commiting Transaction");
    //     console.log(error.message);
    //     conn.destroy();
    //     callback(error.message);
    //     return context.succeed(context);
    //   }); //END Rollback
    // }
    // console.log('Transaction Complete.');
    //             // callback(null, event);
    // context.succeed();
    // context.done();
    // console.log(newqso);
    // context.succeed(newqso);
    // return context.done();
    // }); //END COMMIT
    // }); //End Transaction

    // });


};
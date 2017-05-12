var fs = require('fs');
var mysql = require('mysql');
var async = require('async');

exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;
    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Received context:', JSON.stringify(context, null, 2));

    var sub;
    var Name;
    var post;
    var qra;
    var qras;
    var json;
    var idqras;
    var qso;
    var msg;
    var count;
    if (process.env.TEST) {
        var test = {
            "qso": "333",
            "qras": [
                "lu1bjw",
                "lu7aaa",
                "lu9sde"
            ]
        };
        qso = test.qso;
        qras = test.qras;
    }
    else {
        qso = event.body.qso;
        qras = event.body.qras;
        console.log("QRAS",qras);
    }

    if (process.env.TEST){
        sub = "57d6d760-c5ff-40e5-8fc8-943fa37d6987";
    }else if (event.context.sub){
        sub = event.context.sub;
    }
    console.log("sub =", sub);

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

    // conn.connect();


    // GET QRA ID of OWNER
    console.log("select QRA to get ID of Owner");
    console.log(qso);
    conn.query ( "SELECT qras.idcognito from qras inner join qsos on qras.idqras = qsos.idqra_owner where qsos.idqsos =? and qras.idcognito=?", [qso , sub],   function(error,info) {
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();
            callback(error.message);
            msg = { "error": "1",
                "message": "Error when select QRA to get ID of Owner" };
            return context.fail(msg);

        }

        console.log("info" + info);

        if (info.length === 0){
            console.log("Caller user is not the QSO Owner");
            console.log('error select: ' + error);
            callback(error);

            msg = { "error": "1",
                "message": "Caller user is not the QSO Owner" };
            return context.fail(msg);
        }else{

            // 1st para in async.each() is the array of items
            //***********************************************************
            async.each(qras,
                // 2nd param is the function that each item is passed to
                function(Name, callback){
                    // Call an asynchronous function, often a save() to DB
                    // item.someAsyncCall(function (){
                    //   // Async call is done, alert via callback
                    //   callback();
                    // });
                    //  Name = qras[i];
                    console.log("GET QRA", Name.toUpperCase());
                    //***********************************************************
                    conn.query ( "SELECT * FROM qras where qra=? LIMIT 1", Name.toUpperCase(),   function(error,info) {  // querying the database
                        console.log("info=",info);
                        if (error) {
                            console.log("Error When GET QRA");
                            console.log('error select: ' + error);
                            callback(error);
                            return context.fail(error);
                        }else if (!info.length) {
                            // qra = JSON.stringify(info);
                            // json =  JSON.parse(qra);
                            // idqras = json[0].idqras;
                            //QRA Not Found => INSERT
                            console.log("QRA not found, Insert new QRA");
                            post  = {"qra" : Name.toUpperCase()};
                            // console.log('POST' + post);
                            //***********************************************************
                            conn.query ( 'INSERT INTO qras SET ?', post,   function(error,info) {  // querying the database
                                if (error) {
                                    console.log("Error When INSERT QRA");
                                    console.log(error.message);
                                    conn.destroy();
                                    callback(error.message);
                                    //  return context.fail(error);
                                } else {

                                    console.log("qra inserted");
                                    // console.log(info);
                                    qra = JSON.stringify(info);
                                    json =  JSON.parse(qra);
                                    idqras = json.insertId;
                                    post  = {"idqso": qso,
                                        "idqra": idqras};

                                    // console.log(post);
                                    // console.log("Insert QSO QRA");
                                    //***********************************************************
                                    conn.query('INSERT INTO qsos_qras SET ?', post, function(error, info) {
                                        if (error) {
                                            console.log("Error when Insert QSO QRA");
                                            console.log(error.message);
                                            conn.destroy();
                                            callback(error.message);
                                            return callback.fail(error);
                                        } //End If
                                        console.log(info);
                                        if (info.insertId){
                                            console.log("QSOQRA inserted", info.insertId);
                                            count++;
                                            callback();
                                        }
                                    }); //End Insert QSOQRA
                                } //end Else
                            }); //end Insert QRA
                        } //end if
                        else {
                            qra = JSON.stringify(info);
                            json =  JSON.parse(qra);
                            idqras = json[0].idqras;
                            post  = {"idqso": qso,
                                "idqra": idqras};
                            //***********************************************************
                            conn.query('INSERT INTO qsos_qras SET ?', post, function(error, info) {
                                if (error) {
                                    console.log("Error when Insert QSO QRA");
                                    console.log(error.message);
                                    conn.destroy();
                                    callback(error.message);
                                    return callback.fail(error);
                                } //End If
                                if (info.insertId){
                                    console.log("QSOQRA inserted", info.insertId);
                                    count++;
                                    callback();
                                }
                            }); //End Insert
                        } //endelse
                    }); //End Select
                },
                //***********************************************************
                // 3rd param is the function to call when everything's done
                function(err){
                    console.log("All tasks are done now");
                    // doSomethingOnceAllAreDone();
                    var msg = { "error": "0",
                        "message": qso  };
                    context.succeed(msg);
                }
            ); //end async
        }}); //end validation of qso owner and cognito sub
};
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

    var qra_output = {};
    var qras_output = [];
    var json;
    var idqras;
    var idqras_owner;
    var qso;
    var msg;
    var count;
    if (process.env.TEST) {
        var test = {
            "qso": "1400",
            "qras": ["lu7ach", "lu7aaa", "lu999aaes"]
        };
        qso = test.qso;
        qras = test.qras;
    } else {
        qso = event.body.qso;
        qras = event.body.qras;
        console.log("QRAS", qras);
    }

    if (process.env.TEST) {
        sub = "ccd403e3-06ae-4996-bb70-3aacf32a86df";
    } else if (event.context.sub) {
        sub = event.context.sub;
    }
    console.log("sub =", sub);

    if (process.env.TEST) {
        Name = "test";
    } else if (event.context.nickname) {
        Name = event.context.nickname;
    }

    console.log('userName =', Name);

    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });

    // GET QRA ID of OWNER
    console.log("select QRA to get ID of Owner");
    console.log(qso);
    conn.query("SELECT qras.idcognito, qras.idqras from qras inner join qsos on qras.idqras = qs" +
            "os.idqra_owner where qsos.idqsos =? and qras.idcognito=?",
    [
        qso, sub
    ], function (error, info) {
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();
            callback(error.message);
            msg = {
                "error": "1",
                "message": "Error when select QRA to get ID of Owner"
            };
            return context.fail(msg);

        }

        idqras_owner = JSON.parse(JSON.stringify(info))[0].idqras;

        if (info.length === 0) {
            console.log("Caller user is not the QSO Owner");
            console.log('error select: ' + error);
            callback(error);

            msg = {
                "error": 1,
                "message": "Caller user is not the QSO Owner"
            };
            return context.fail(msg);
        } else {

            // 1st para in async.each() is the array of items
            // ***********************************************************
            async
                .mapSeries(qras,
                // 2nd param is the function that each item is passed to
                function (Name, callback) {

                    console.log("GET QRA", Name.toUpperCase());
                    //***********************************************************
                    conn.query("SELECT * FROM qras where qra=? LIMIT 1", Name.toUpperCase(), function (error, info) { // querying the database
                        console.log("info=", info);
                        if (error) {
                            console.log("Error When GET QRA");
                            console.log('error select: ' + error);
                            callback(error);
                            return context.fail(error);
                        } else if (!info.length) {

                            qras_output.push({qra: Name, url: null});
                            console.log("qras" + qras_output);

                            //QRA Not Found => INSERT
                            console.log("QRA not found, Insert new QRA");
                            post = {
                                "qra": Name.toUpperCase()
                              
                            };
                            // console.log('POST' + post);
                            // ***********************************************************
                            conn.query('INSERT INTO qras SET ?', post, function (error, info) { // querying the database
                                if (error) {
                                    console.log("Error When INSERT QRA");
                                    console.log(error.message);
                                    conn.destroy();
                                    callback(error.message);
                                    //  return context.fail(error);
                                } else {

                                    console.log("qra inserted");
                                    // console.log(info);  qra = JSON.stringify(info);
                                    json = JSON.parse(JSON.stringify(info));
                                    idqras = json.insertId;
                                    post = {
                                        "idqso": qso,
                                        "idqra": idqras,
                                        "isOwner": false
                                    };

                                    //***********************************************************
                                    conn.query('INSERT INTO qsos_qras SET ?', post, function (error, info) {
                                        if (error) {
                                            console.log("Error when Insert QSO QRA");
                                            console.log(error.message);
                                            conn.destroy();
                                            callback(error.message);
                                            return callback.fail(error);
                                        } //End If
                                        console.log(info);
                                        if (info.insertId) {
                                            console.log("QSOQRA inserted", info.insertId);
                                            count++;
                                            callback();
                                        }
                                    }); //End Insert QSOQRA
                                } //end Else
                            }) //end if; //end Insert QRA
                        } else {

                            qra = JSON.stringify(info);
                            json = JSON.parse(qra);
                            idqras = json[0].idqras;
                            post = {
                                "idqso": qso,
                                "idqra": idqras,
                                "isOwner": false
                            };

                            //***********************************************************
                            conn.query('INSERT INTO qsos_qras SET ?', post, function (error, info) {
                                if (error) {
                                    console.log("Error when Insert QSO QRA");
                                    console.log(error.message);
                                    conn.destroy();
                                    callback(error.message);
                                    return callback.fail(error);
                                } //End If
                                if (info.insertId) {
                                    console.log("QSOQRA inserted", info.insertId);
                                    qras_output.push({qra: json[0].qra, url: json[0].profilepic});
                                    console.log("qras" + qras_output);

                                    count++;
                                    callback();

                                    // conn.query('SELECT * FROM qra_followers where idqra=? and idqra_followed=?', [
                                    //     idqras_owner, idqras
                                    // ], function (error, info) {
                                    //     if (error) {
                                    //         console.log("Error when select qra_followers");
                                    //         console.log(error.message);
                                    //         conn.destroy();
                                    //         callback(error.message);
                                    //         return callback.fail(error);
                                    //     } //End If
                                    //     if (info.length) {
                                    //         qras_output.push({qra: json[0].qra, url: json[0].profilepic, following: 'TRUE'});
                                    //         console.log("qras" + qras_output);

                                    //         count++;
                                    //         callback();
                                    //     } else {
                                    //         qras_output.push({qra: json[0].qra, url: json[0].profilepic, following: 'FALSE'});
                                    //         console.log("qras" + qras_output);

                                    //         count++;
                                    //         callback();
                                    //     }
                                    // }); //End Insert

                                }
                            }); //End Insert
                        } //endelse
                    }); //End Select
                },
                // *********************************************************** 3rd param is the
                // function to call when everything's done
                function (err) {
                    console.log("All tasks are done now");
                    // doSomethingOnceAllAreDone();
                    var msg = {
                        "error": 0,
                        "message": qras_output
                    };
                    conn.destroy();
                    context.succeed(msg);
                }); //end async
        }
    }); //end validation of qso owner and cognito sub
};
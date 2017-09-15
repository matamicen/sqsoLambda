var fs = require('fs');
var mysql = require('mysql');
var async = require('async');
var AWS = require("aws-sdk");

exports.handler = (event, context, callback) =>
{
    console.log(event);
    console.log(context);

    context.callbackWaitsForEmptyEventLoop = false;


    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com',  // give your RDS endpoint  here
        user: 'sqso',  // Enter your  MySQL username
        password: 'parquepatricios',  // Enter your  MySQL password
        database: 'sqso'    // Enter your  MySQL database name.
    });


    var table = [];

    var msg;
    var owner;
    var qso;
    var owner_qra;
    var endpoints = [];
    var comment;
    var payload;
    var sns;
    var params;
    var url;

    if (process.env.TEST) {
        qso = 613;
        owner = 142;
        owner_qra = 'LU2ACH';
    } else if (event.qso) {
        qso = event.qso;
        owner = event.owner;
        owner_qra = event.owner_qra;
    }
    console.log(qso);


    async.series([
            //send to QRA's of QSO
            function (callback) {
                console.log("send to QRA's of QSO");
                conn.query("SELECT qsos_qras.idqra, endpoint_arn FROM qra_endpoints inner join qsos_qras on qra_endpoints.idqra = qsos_qras.idqra where idqso = ? and qsos_qras.idqra <> ? ", [qso, owner], function (error, rows) {
                    // console.log(rows);
                    if (error) {
                        console.log("ERROR In Get EndPoint" + qso);
                        console.log(error);
                        conn.destroy();
                        callback(error.message);
                        msg = {
                            "error": "1",
                            "message": "ERROR In Get EndPoint" + qso
                        };
                        return context.fail(msg);
                    } else {
                        table = JSON.parse(JSON.stringify(rows));
                        // console.log(table);
                        async.mapSeries(table,
                            function (line, callback1) {
                                //  console.log("each item" + JSON.stringify(line));
                                if (!endpoints.find(o => o.idqra === line.idqras))
                                {
                                    endpoints.push({idqra: line.idqra});

                                    sns = new AWS.SNS();
                                    //     console.log(line.endpoint_arn);
                                    comment = owner_qra + " started a QSO with you";
                                    url = "http://d3cevjpdxmn966.cloudfront.net/qso/" + qso;
                                    payload = {
                                        default: "HEADER",
                                        GCM: {
                                            data:
                                                {
                                                    "header": comment,
                                                    "body": "Los papeles de Telecom Argentina caen 3,14 por ciento, a 105 pesos cada uno y lideran las bajas dentro del Merval, que acentúa su incursión en terreno negativo por una toma de ganancias que realizan los inversores tras siete alzas consecutivas.A media rueda, el principal indicador de la Bolsa porteña cae 1,30%, hasta situarse en las 23.934,62 unidades.",
                                                    "url": url
                                                }

                                        }
                                    };
                                    payload.GCM = JSON.stringify(payload.GCM);
                                    payload = JSON.stringify(payload);
                                    params = {
                                        Message: payload,
                                        MessageStructure: 'json',
                                        Subject: comment,
                                        //   TopicArn: "arn:aws:sns:us-east-1:116775337022:test"
                                        TargetArn: line.endpoint_arn
                                    };
                                    sns.publish(params, function (err, data) {
                                        if (err) {
                                            console.log("error with " + line.idqra + " " + line.endpoint_arn);
                                            //console.log(err);
                                            //return;
                                            //  callback1();
                                        } else {
                                            console.log('push sent to ' + line.idqra + " " + line.endpoint_arn);
                                            // console.log(data);
                                        }
                                        callback1();
                                    });
                                }
                            else
                                callback1();
                            },

                            // 3rd param is the function to call when everything's done
                            function (err) {
                                console.log("All sent to QRA of QSO");
                                // doSomethingOnceAllAreDone();
                                //console.log(qsos_output);
                                //context.succeed(table);
                                callback();
                            }
                        );
                    }
                });
            },
            //send to Followers of QSO Owner
            function (callback4) {
                console.log("send to Followers of QSO Owner and Followers of QRAs of QSO");
                conn.query("SELECT DISTINCT qras.qra, qra_endpoints.endpoint_arn FROM qra_endpoints inner join  qra_followers on qra_endpoints.idqra = qra_followers.idqra inner join qras on qra_followers.idqra = qras.idqras inner join qsos_qras on qra_followers.idqra_followed = qsos_qras.idqra WHERE qsos_qras.idqso = ?", qso, function (error, rows) {
                    //console.log(rows);
                    if (error) {
                        console.log("ERROR In Get Followers EndPoint" + owner);
                        console.log(error);
                        conn.destroy();
                        callback(error.message);
                        msg = {
                            "error": "1",
                            "message": "ERROR In Get EndPoint" + qso
                        };
                        return context.fail(msg);
                    } else {
                        table = JSON.parse(JSON.stringify(rows));
                        // console.log(table);
                        async.mapSeries(table,
                            function (line, callback3) {
                                if (!endpoints.find(o => o.idqra === line.idqras))
                                {

                                    endpoints.push({idqra: line.idqras});
                                    //  console.log("each item" + JSON.stringify(line));
                                    sns = new AWS.SNS();
                                    //console.log(line);
                                    comment = owner_qra + " started a QSO with " + line.qra;
                                    url = "http://d3cevjpdxmn966.cloudfront.net/qso/" + qso;
                                    payload = {
                                        default: "HEADER",
                                        GCM: {
                                            data:
                                                {
                                                    "header": comment,
                                                    "body": "Los papeles de Telecom Argentina caen 3,14 por ciento, a 105 pesos cada uno y lideran las bajas dentro del Merval, que acentúa su incursión en terreno negativo por una toma de ganancias que realizan los inversores tras siete alzas consecutivas.A media rueda, el principal indicador de la Bolsa porteña cae 1,30%, hasta situarse en las 23.934,62 unidades.",
                                                    "url": url
                                                }

                                        }
                                    };
                                    payload.GCM = JSON.stringify(payload.GCM);
                                    payload = JSON.stringify(payload);
                                    params = {
                                        Message: payload,
                                        MessageStructure: 'json',
                                        Subject: comment,
                                        //   TopicArn: "arn:aws:sns:us-east-1:116775337022:test"
                                        TargetArn: line.endpoint_arn
                                    };
                                    sns.publish(params, function (err, data) {
                                        if (err) {
                                            console.log('SNS error with ' + line.idqras + " " + line.endpoint_arn);
                                            //   console.log(err.stack);
                                            //return;
                                            //  callback1();
                                        } else {
                                            console.log('push sent to ' + line.idqras + " " + line.endpoint_arn);
                                            //console.log(data);
                                        }
                                        callback3();
                                    });
                                }
                            else
                                callback3();
                            },

                            // 3rd param is the function to call when everything's done
                            function (err) {
                                console.log("All sent to Followers of QSO OWNER");
                                // doSomethingOnceAllAreDone();
                                //console.log(qsos_output);
                                //context.succeed(table);
                                callback4();
                            }
                        );
                    }
                });
            }],
        //LAST FUNCTION
        function (err) {

            if (err) {
                //    response.body.error = 220;
                //    response.body.message = output;
                //    console.log(response.body.message);
                //    conn.destroy();
                //    return callback(null, response);
            }
            conn.destroy();
            //response.body.error = 0;
            //response.body.message = "SNS sent after new Media Added";
            console.log("SNS New Media ended; qso = " + qso);
            //return callback(null, response);
            context.succeed(endpoints);
        }
    );


}
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
    var comment_owner;
    var qso;
    var comment;
    var payload;
    var sns;
    var url;
    var params;
    if (process.env.TEST) {
        qso = 572;
        qso_owner = 142;
    } else if (event.qso) {
        qso = event.qso;
        comment_owner = event.comment_owner;
    }
    console.log(qso);


    conn.query("SELECT endpoint_arn, qsos_qras.idqra FROM qra_endpoints inner join qsos_qras on qra_endpoints.idqra = qsos_qras.idqra where idqso = ? and qsos_qras.idqra <> ? ", [qso, comment_owner], function (error, rows) {

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

            async.mapSeries(table,
                function (line, callback1) {

                    sns = new AWS.SNS();
                    comment = "new comment " + qso;
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
                            console.log('SNS error with ' + line.idqra + " " + line.endpoint_arn);
                            //   console.log(err.stack);
                            //return;
                            //  callback1();
                        } else {
                            console.log('push sent to ' + line.idqra + " " + line.endpoint_arn);
                            //console.log(data);
                        }
                        callback1();
                    });
                },

                // 3rd param is the function to call when everything's done
                function (err) {
                    console.log("All tasks are done now");
                    // doSomethingOnceAllAreDone();
                    //console.log(qsos_output);
                    conn.destroy();
                    context.succeed(table);
                }
            );
        }
    });


}

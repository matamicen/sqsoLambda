var mysql = require('mysql');
// var async = require('async');
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';


exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;

    var Sub;

    var qso;



    var idmedia;


    var response = {
        "message": "",
        "error": ""
    };

    // var count;

    qso = event.body.qso;
    idmedia = event.body.idmedia;



    Sub = event.context.sub;




    //***********************************************************
    if (!event['stage-variables']) {
        console.log("Stage Variables Missing");

        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }
    var url = event['stage-variables'].url;
    var conn = mysql.createConnection({
        host: event['stage-variables'].db_host, // give your RDS endpoint  here
        user: event['stage-variables'].db_user, // Enter your  MySQL username
        password: event['stage-variables'].db_password, // Enter your  MySQL password
        database: event['stage-variables'].db_database // Enter your  MySQL database name.
    });


    // GET QRA ID of OWNER
    console.log("select QRA to get ID of Owner");
    console.log(qso);
    conn.query("SELECT qras.idqras, qras.qra from qras inner join qsos on qras.idqras = qsos.idqra_owner where qsos.idqsos =? and qras.idcognito=?", [qso, Sub], function(error, info) {
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();
            response.error = 400;
            response.message = "Error: select QRA to get ID of Owner";
            // return context.fail( "Error: select QRA to get ID of Owner");
            return context.succeed(response);
        }



        if (info.length === 0) {
            console.log("Caller user is not the QSO Owner");
            response.error = 400;
            response.message = "Error: Caller user is not the QSO Owner";
            conn.destroy();
            //return context.fail( "Error: Caller user is not the QSO Owner");
            return context.succeed(response);
        }

        //***********************************************************

        conn.query('UPDATE qsos_media SET deleted=1 WHERE idqsos_media=?', [idmedia], function(error, info) {
            if (error) {
                console.log("Error when Insert QSO MEDIA");
                console.log(error.message);
                conn.destroy();
                response.error = 400;
                response.message = "Error when Insert QSO MEDIA";
                //return context.fail( "Error when Insert QSO MEDIA");
                return context.succeed(response);
            } //End If
            console.log(info);
            if (info.affectedRows) {
                console.log("Media Deleted");


                var msg = {
                    "error": "0",
                    "message": info.message
                };
                console.log(info.message);



                //***********************************************************

                context.succeed(msg);
            } //ENDIF 

        }); //End Insert
    });
};

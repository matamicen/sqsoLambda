var fs = require('fs');
var mysql = require('mysql');
// var async = require('async');

exports.handler = (event, context, callback) =>
{


    context.callbackWaitsForEmptyEventLoop = false;

    var Sub;
    var idqra_owner;
    var endpoint;

    var response = {

        "error": null,
        "message": null

    };

    // var count;
    if (process.env.TEST) {
        var test = {
            "endpoint": "arn:aws:sns:us-east-1:116775337022:endpoint/GCM/AndroidSqso/49801a6d-b6b5-32c2-9533-8330b7f588a4"

        };
        endpoint = test.endpoint;

    }
    else {
        endpoint = event.body.endpoint;
    }

    if (process.env.TEST) {
        Sub = "99a3c963-3f7d-4604-a870-3c675b012f63";
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

    conn.query("SELECT qras.idqras from qras where qras.idcognito=?", Sub, function (error, info) {
        if (error) {
            console.log("Error when selecting QRA");
            console.log(error);
            conn.destroy();
            response.error = 400;
            response.message = "Error: Error when selecting QRA";
            // return context.fail( "Error: Error when selecting QRA");
            return callback(null, response);
        }
        else if (info.length === 0) {
            console.log("User does not exist");
            response.error = 400;
            response.message = "Error: User does not exist";
            conn.destroy();
            //return context.fail( "Error: User does not exist");
            return callback(null, response);
        }
        else if (info.length > 0) {
            //get qra of following
            idqra_owner = JSON.parse(JSON.stringify(info))[0].idqras;
            console.log("idqra " + idqra_owner + "endpoint " + endpoint);
            conn.query('INSERT INTO qra_endpoints SET idqra = ?,endpoint_arn=?', [idqra_owner, endpoint], function (error, info) {
                if (error) {
                    console.log("Error when Insert qra_endpoints");
                    console.log(error.message);
                    conn.destroy();
                    response.error = 400;
                    response.message = "Error when Insert qra_endpoints";
                    //return context.fail( "Error when Insert QSO LIKES");
                    return callback(null, response);
                } //End If
                if (info.insertId) {
                    console.log("qra_endpoints inserted", info.insertId);
                    conn.destroy();
                    response.error = 0;
                    response.message = event.body;
                    console.log("new endpoint " + response.message);
                    return callback(null, response);

                }
            }); //End Insert
        }
    }); //end select qra_owner
}

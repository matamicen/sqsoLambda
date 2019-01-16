var mysql = require('mysql');

const warmer = require('lambda-warmer');

exports.handler = async(event, context, callback) => {
    // if a warming event
    if (await warmer(event))
        return 'warmed';

    context.callbackWaitsForEmptyEventLoop = false;

    var response = {
        statusCode: 200,
        headers: {
            "Access-Control-Allow-Origin": "*", // Required for CORS support to work
            "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
        },
        body: {
            "error": null,
            "message": null
        }
    };

    var qra = event.body.qra;

    if (!event['stage-variables']) {
        console.log("Stage Variables Missing");
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }
    var url = event['stage-variables'].url;
    var conn = await mysql.createConnection({
        host: event['stage-variables'].db_host, // give your RDS endpoint  here
        user: event['stage-variables'].db_user, // Enter your  MySQL username
        password: event['stage-variables'].db_password, // Enter your  MySQL password
        database: event['stage-variables'].db_database // Enter your  MySQL database name.
    });
    try {

        let qra_owner = await checkQraCognito(event.context.sub);
        if (!qra_owner) {
            console.log("User does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }
        qra.firstname ?
            qra_owner.firstname = qra.firstname :
            null;
        qra.lastname ?
            qra_owner.lastname = qra.lastname :
            null;
        qra.email ?
            qra_owner.email = qra.email :
            null;
        qra.phone ?
            qra_owner.phone = qra.phone :
            null;
        qra.birthday ?
            qra_owner.birthday = qra.birthday :
            null;
        qra.address ?
            qra_owner.address = qra.address :
            null;
        qra.city ?
            qra_owner.city = qra.city :
            null;
        qra.state ?
            qra_owner.state = qra.state :
            null;
        qra.zipcode ?
            qra_owner.zipcode = qra.zipcode :
            null;
        qra.country ?
            qra_owner.country = qra.country :
            null;
        qra.cqzone ?
            qra_owner.cqzone = qra.cqzone :
            null;
        qra.iotadesignator ?
            qra_owner.iotadesignator = qra.iotadesignator :
            null;
        qra.licenseclass ?
            qra_owner.licenseclass = qra.licenseclass :
            null;
        qra.qslinfo ?
            qra_owner.qslinfo = qra.qslinfo :
            null;
        let info = await updateInfo(qra, qra_owner);
        if (info.affectedRows) {

            response.body.message = qra_owner;
            response.body.error = 0;
        }
        else {
            response.body.message = info;
            response.body.error = 1;
        }
        conn.destroy();

        return callback(null, response);

    }
    catch (e) {
        console.log("Error executing QRA Bio Update");
        console.log(e);
        conn.destroy();
        callback(e.message);
        response.body.error = 1;
        response.body.message = e.message;
        callback(null, response);
        return context.fail(response);
    }

    function updateInfo(qra, qra_owner) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("UpdateBIO");
            //***********************************************************
            conn.query('UPDATE qras SET ?  WHERE idqras=?', [
                qra, qra_owner.idqras
            ], function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
                // console.log(info);
            });
        });
    }

    function checkQraCognito(sub) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("checkQraCognito");
            conn.query("SELECT * FROM qras where idcognito=? LIMIT 1", sub, function(err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }

                resolve(JSON.parse(JSON.stringify(info))[0]);
            });
        });
    }

};

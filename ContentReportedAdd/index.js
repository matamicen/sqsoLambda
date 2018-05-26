var fs = require('fs');
var mysql = require('mysql');


exports.handler = (event, context, callback) =>
{
    context.callbackWaitsForEmptyEventLoop = false;
    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Received context:', JSON.stringify(context, null, 2));

    var post;    
    var idqra;
    var newid;
    var datetime;
    var sub;
    var msg;
    var detail;
    var idcomment;
    var idmedia;
    var idqso;

    if (process.env.TEST) {
        var test = {           
            "datetime": "2016-04-28 14:12:00",
            "idqso": '1265',
            "idcomment": '296',
            "idmedia": '1880',
            "detail" : "content is offensive",       

        };
        datetime = test.datetime;    
        idqso = test.idqso;
        idcomment = test.idcomment;
        idmedia = test.idmedia;
        detail = test.detail;

        sub = 'ccd403e3-06ae-4996-bb70-3aacf32a86df';
    }
    else {
        datetime = event.body.datetime;
        idqso = event.body.idqso;
        idcomment = event.body.idcomment;
        idmedia = event.body.idmedia;
        detail = event.body.detail;
        sub = event.context.sub;
    }
    console.log(sub);

    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com',  // give your RDS endpoint  here
        user: 'sqso',  // Enter your  MySQL username
        password: 'parquepatricios',  // Enter your  MySQL password
        database: 'sqso'    // Enter your  MySQL database name.
    });


    // GET QRA ID of OWNER
    console.log("select QRA to get ID of Owner");

    conn.query("SELECT * FROM qras where idcognito=? LIMIT 1", sub, function (error, info) {
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();

            msg = {
                "error": "1",
                "message": "Error when select QRA to get ID of Owner"
            };
            error = new Error("Error when select QRA to get ID of Owner");
            callback(error);
            return context.fail(msg);
        }
        else if (info.length === 0) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();

            msg = {
                "error": "1",
                "message": "Error when select QRA to get ID of Owner"
            };
            error = new Error("Error when select QRA to get ID of Owner");
            callback(error);
            return context.fail(msg);
        }
     
        idqra = JSON.parse(JSON.stringify(info))[0].idqras;

        
        
        post = {
            "idqra": idqra,
            "idqso": idqso,
            "idcomment": idcomment,
            "idmedia": idmedia,
            "detail": detail,
            "datetime": datetime,            
        };
        console.log(post);

        //INSERT INTO CONTENT_REPORTED TABLE
           conn.query ( 'INSERT INTO sqso.content_reported SET ?', post,   function(error,info) {
       // conn.query('INSERT INTO content_reported  SET idqra = ?, idqso = ?, idcomment = ?, idmedia = ?, detail = ?, datetime = ?', [ idqra, idqso, idcomment, idmedia, detail, datetime], function (error, info) {
            console.log("insert Content Reported");
            if (error) {
                console.log("Error when insert Content Reported");
                console.log(error.message);
                conn.destroy();
                callback(error.message);
                return context.fail(error);
            }
            if (info.insertId) {
                console.log("Content Reported inserted", info.insertId);

                newid = JSON.parse(JSON.stringify(info)).insertId;
                msg = {
                    "error": "0",
                    "message": newid
                };
                console.log("content reported" + newid);
               


                //***********************************************************
                
                context.succeed(msg);
            } //ENDIF CONTENT_REPORTED Inserted
        }); //Insert CONTENT_REPORTED
    }); //END SELECT QRA
};
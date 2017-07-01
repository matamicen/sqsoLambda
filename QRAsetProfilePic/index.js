var fs = require('fs');
var mysql = require('mysql');
var async = require('async');

exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;
    console.log('Received event:', JSON.stringify(event, null, 2));
    console.log('Received context:', JSON.stringify(context, null, 2));

    var sub;

    var msg;
    if (process.env.TEST) {
        var test = {
            "url": "www.pic2.com"
        };
        url = test.url;
    }
    else {
        url = event.body.url;
    }

    if (process.env.TEST){
        sub = "57d6d760-c5ff-40e5-8fc8-943fa37d6987";
    }else if (event.context.sub){
        sub = event.context.sub;
    }
    console.log("sub =", sub);



    //***********************************************************
    var conn = mysql.createConnection({
        host      :  'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com' ,  // give your RDS endpoint  here
        user      :  'sqso' ,  // Enter your  MySQL username
        password  :  'parquepatricios' ,  // Enter your  MySQL password
        database  :  'sqso'    // Enter your  MySQL database name.
    });



    //QRA FOUND => Update QRA with ID Cognito



    conn.query ( 'UPDATE qras SET profilepic=? WHERE idcognito=?', [ url, sub ],   function(error,info) {  // querying the database
        if (error) {
            console.log(error.message);
            context.done(null,event);
            conn.destroy();
            msg = { "error": "1",
                "message": "Could not update profile picture" };
            return context.fail(msg);
        }
        else {

            console.log("data updated");
            console.log(info);
            conn.destroy();
            var msg = { "error": "0",
                "message": "rows updated: " + info.changedRows  };
            context.succeed(msg);
        }
    });


};
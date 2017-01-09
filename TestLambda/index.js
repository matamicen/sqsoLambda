var fs = require('fs');
var mysql = require('mysql');

/**
 * Pass the data to send as `event.data`, and the request options as
 * `event.options`. For more information see the HTTPS module documentation
 * at https://nodejs.org/api/https.html.
 *
 * Will succeed with the response body.
 */

exports.handler = (event, context, callback) => {
    console.log('Received event:', JSON.stringify(event, null, 2));

    var conn = mysql.createConnection({
        host      :  'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com' ,  // give your RDS endpoint  here
        user      :  'sqso' ,  // Enter your  MySQL username
        //ssl		  :  'Amazon RDS',
        password  :  'parquepatricios' ,  // Enter your  MySQL password
        database  :  'sQSO'    // Enter your  MySQL database name.
    });

    conn.connect(function(err) {    // connecting to database
        if (err) {
            console.log('error connecting: ' + err.stack);
            return;
        }
        console.log('connected as id ' + conn.threadId);	 //console.log(conn);
    });
    var Sub;

    if (event.key1){
        Sub = event.key1;
    }else{
        Sub = event.request.userAttributes.sub;
    }

    var Name;

    if (event.key2){
        Name = event.key2;
    }else{
        Name = event.request.userAttributes.name;
    }
    console.log('userName =', Name);
    var post  = { qra: Name, idcognito: Sub};
    // console.log(post);
//     conn.query("INSERT INTO `QRAS` SET qra=?, idcognito=?",
// 		[ 1234, 4456],
// 		function(err, info){
// 			console.log("insert: "+info+" /err: "+err);
// 			            context.succeed(info);
// 		});
//
    conn.query ( 'INSERT INTO QRAS SET ?', post,   function(error,info) {  // querying the database
        if (error) {
            console.log(error.message);
            if(error.errno==1062)
                console.log("already exists");
        }
        else {
            console.log("data inserted");
            console.log(info);
            context.succeed(info);
        }
    });
    // console.log("post query");
    // context.done(null,event);
    conn.end();
};
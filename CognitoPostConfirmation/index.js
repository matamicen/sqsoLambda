

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
        host      :  'sqso.cdsjgca0uqsh.us-west-2.rds.amazonaws.com' ,  // give your RDS endpoint  here
        user      :  'parque' ,  // Enter your  MySQL username
        //ssl		  :  'Amazon RDS',
        password  :  'patricios' ,  // Enter your  MySQL password
        database  :  'sQSO'    // Enter your  MySQL database name.
    });
    conn.connect(function(err) {    // connecting to database
        if (err) {
            console.error('error connecting: ' + err.stack);
            return;
        }
        console.log('connected as id ' + conn.threadId);	 //console.log(conn);
    });
    var user = event.key1;
    console.log('userName =', event.username);
    console.log(event);
    // conn.query ( "INSERT INTO `sQSO`.`QRAS` (`QRA`, `idCognito`) VALUES ('LU2ACH', 'TEST');", user,   function(error,info) {  // querying the database
    //     if (error) {
    //         console.log(error.message);
    //         if(error.errno==1062)
    //             console.log("already exists");
    //     }
    //     else {
    //         console.log(info);
    //         context.succeed(info);
    //     }
    // });
};

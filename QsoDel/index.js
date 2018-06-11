
var mysql = require('mysql');
// var async = require('async');
var AWS = require('aws-sdk');
AWS.config.region = 'us-east-1';


exports.handler = (event, context, callback) => {


    context.callbackWaitsForEmptyEventLoop = false;

    var Sub;

var qso;

    

 
 

    var response = {
        "message": "",
        "error": ""
    };

    // var count;
    if (process.env.TEST) {
        var test = {  
       
          "qso":  1307
        };
      
         qso = test.qso;
    }
    else {
        qso = event.body.qso;
     
    }

    if (process.env.TEST){
        Sub = "ccd403e3-06ae-4996-bb70-3aacf32a86df";
    }else if (event.context.sub){
        Sub = event.context.sub;
    }
    console.log("sub =", Sub);


    //***********************************************************
    var conn = mysql.createConnection({
        host      :  'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com' ,  // give your RDS endpoint  here
        user      :  'sqso' ,  // Enter your  MySQL username
        password  :  'parquepatricios' ,  // Enter your  MySQL password
        database  :  'sqso'    // Enter your  MySQL database name.
    });

    // GET QRA ID of OWNER
    console.log("select QRA to get ID of Owner");
    console.log(qso);
    conn.query ( "SELECT qras.idqras, qras.qra from qras inner join qsos on qras.idqras = qsos.idqra_owner where qsos.idqsos =? and qras.idcognito=?", [qso , Sub],   function(error,info) {
        if (error) {
            console.log("Error when select QRA to get ID of Owner");
            console.log(error);
            conn.destroy();
            response.error = 400;
            response.message = "Error: select QRA to get ID of Owner";
            // return context.fail( "Error: select QRA to get ID of Owner");
            return context.succeed(response);
        }



        if (info.length === 0){
            console.log("Caller user is not the QSO Owner");
            response.error = 400;
            response.message = "Error: Caller user is not the QSO Owner";
            conn.destroy();
            //return context.fail( "Error: Caller user is not the QSO Owner");
            return context.succeed(response);
        }

        //***********************************************************

        conn.query('UPDATE qsos SET deleted=1 WHERE idqsos=?', [qso], function(error, info) {
            if (error) {
                console.log("Error when Insert QSO");
                console.log(error.message);
                conn.destroy();
                response.error = 400;
                response.message = "Error when Insert QSO";
                //return context.fail( "Error when Insert QSO");
                return context.succeed(response);
            } //End If
            console.log(info);
              if (info.affectedRows) {
                console.log("QSO Deleted");                
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
var fs = require('fs');
var mysql = require('mysql');

exports.handler = async(event, context, callback) => {
    // console.log('Received event:', JSON.stringify(event, null, 2));
    // console.log('Received context:', JSON.stringify(context, null, 2));

    context.callbackWaitsForEmptyEventLoop = false;
    var date = new Date();
    var qsos_output = [];
    var msg;
    var sub;
    var idqra_owner;

    if (event.sub) {
        sub = event.sub;
    } else if (event.context.sub) {
        sub = event.context.sub;
    }
    //***********************************************************
    var conn = mysql.createConnection({
        host: 'sqso.clqrfqgg8s70.us-east-1.rds.amazonaws.com', // give your RDS endpoint  here
        user: 'sqso', // Enter your  MySQL username
        password: 'parquepatricios', // Enter your  MySQL password
        database: 'sqso' // Enter your  MySQL database name.
    });

    try {
        let idqras_owner = await getQRA(sub);
        if (!idqras_owner) {
            console.log("User does not exist");
            conn.destroy();
            msg = {
                "error": "1",
                "message": "User does not exist"
            };
            callback("User does not exist");
            return context.fail(msg);
        }
        let qsos = await getQSOSall(idqras_owner, date);
        qsos_output = await getQSOSinfo(qsos);

        console.log("All tasks are done now");
        // doSomethingOnceAllAreDone();
        console.log(qsos_output);
        conn.destroy();
        context.succeed(qsos_output);

    } catch (e) {
        console.log("Error when select QRA to get ID of Owner");
        console.log(e);
        conn.destroy();
        callback(e.message);
        msg = {
            "error": "1",
            "message": "Error when select QRA to get ID of Owner"
        };
        return context.fail(msg);
    }

    async function getQSOSinfo(qsos) {
        
        for (let i = 0; i < qsos.length; i++) {
            let qso = qsos[i];
            //Get Info of QSO Owner
            let qra = await getOwnerInfo(qso);
            qso.qra = qra.qra;
            qso.profilepic = qra.profilepic;

            //Get Info of QRAS of the QSO
            qso.qras = await getQRAInfo(qso);

            //Get Comments of QSO
            qso.comments = await getCommentInfo(qso);

            //Get Media of QSO
            qso.media = await getMediaInfo(qso);

            //Get Likes of QSO
            qso.likes = await getLikeInfo(qso);
            // console.log(qso);
            qsos_output.push(qso);
        }
        return qsos_output;
    }
    function getQRA(sub) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QRA info from Congito ID");
            conn.query("SELECT idqras FROM qras where idcognito=? LIMIT 1", sub, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info))[0].idqras);
            });
        });
    }
    async function getQSOSall(idqras, date) {
        // console.log("getQSOS ALL");
        // console.log(idqras);
        const arr1 = await getQSOS(idqras, date);
        // console.log(arr1);
        const arr2 = await getQSOSofFollowing(idqras, date);
        // console.log(arr2);
        const arr3 = [
            ...arr1,
            ...arr2
        ];

        let  arr4 = arr3.sort(function (a, b) {
            // Turn your strings into dates, and then subtract them to get a value that is
            // either negative, positive, or zero.
    
            return (new Date(b.datetime) - new Date(a.datetime));
        });
        
        console.log(arr4);
        return arr4;
    }
    function getQSOS(idqras, date) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QSOS");
            
            conn.query("SELECT qsos.* from qsos INNER JOIN qsos_qras on qsos.idqsos = qsos_qras.idqso WH" +
                    "ERE qsos.datetime <=? and qsos_qras.idqra = ? and deleted IS NULL  order by datet" +
                    "ime desc LIMIT 50",
            [
                date, idqras
            ], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                // console.log(info);
                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function getQSOSofFollowing(idqras, date) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QSOS of Followings");
            // console.log(idqras);
            conn.query("SELECT qsos.* from qsos INNER JOIN qra_followers on qra_followers.idqra_followed = qsos.idqra_owner WHERE q" +
                    "sos.datetime <=? and qra_followers.idqra = ? and deleted IS NULL order by dateti" +
                    "me desc LIMIT 50",
            [
                date, idqras
            ], function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function getOwnerInfo(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get QRA info of each QSO");
            // idqsos = JSON.stringify(qso.idqsos);
            conn.query("SELECT qra, profilepic from qras WHERE idqras = ? LIMIT 1", qso.idqra_owner, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                // console.log(info);
                resolve(JSON.parse(JSON.stringify(info))[0]);
            });
        });
    }
    function getQRAInfo(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get info of each QRA of QSO");
            conn.query("SELECT qra, profilepic FROM sqso.qras where idqras in ( SELECT idqra FROM sqso.q" +
                    "sos_qras where isOwner = false and idqso = ? ) ",
            qso.idqsos, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                // console.log(info);
                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function getMediaInfo(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get Media of QSO");
            conn.query("SELECT * from qsos_media WHERE idqso =? ", qso.idqsos, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                // console.log(info);
                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function getCommentInfo(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get comment of QSO");
            conn.query("SELECT qsos_comments.*, qras.qra FROM qsos_comments inner join qras on qsos_comm" +
                    "ents.idqra = qras.idqras where  idqso=? and deleted is NULL",
            qso.idqsos, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                // console.log(info);
                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
    function getLikeInfo(qso) {
        return new Promise(function (resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            // console.log("get likes of QSO");
            conn.query("SELECT qra, profilepic FROM sqso.qras where  idqras in (SELECT idqra from qsos_l" +
                    "ikes WHERE idqso =? ) ",
            qso.idqsos, function (err, info) {
                // Call reject on error states, call resolve with results
                if (err) {
                    return reject(err);
                }
                // console.log(info);
                resolve(JSON.parse(JSON.stringify(info)));
            });
        });
    }
};

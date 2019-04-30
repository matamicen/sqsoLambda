var mysql = require("mysql");
var AWS = require("aws-sdk");
AWS.config.region = "us-east-1";
var lambda = new AWS.Lambda();
const warmer = require("lambda-warmer");

exports.handler = async (event, context, callback) => {
  // if a warming event
  console.log(event);
  if (await warmer(event)) return "warmed";

  context.callbackWaitsForEmptyEventLoop = false;

  var response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*", // Required for CORS support to work
      "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
    },
    body: {
      error: null,
      message: null
    }
  };
  if (
    !event.body ||
    !event.body.qso ||
    !event.body.comment ||
    !event.body.datetime ||
    !event.context.sub
  ) {
    console.log("Params Missing");
    response.body.error = 1;
    response.body.message = "Params Missing";
    return callback(null, response);
  }
  var idqso = event.body.qso;
  var comment = event.body.comment;

  var datetime = event.body.datetime;
  var sub = event.context.sub;

  let addresses = {};
  if (!event["stage-variables"]) {
    console.log("Stage Variables Missing");
    conn.destroy();
    response.body.error = 1;
    response.body.message = "Stage Variables Missing";
    return callback(null, response);
  }
  var url = event["stage-variables"].url;
  var conn = await mysql.createConnection({
    host: event["stage-variables"].db_host, // give your RDS endpoint  here
    user: event["stage-variables"].db_user, // Enter your  MySQL username
    password: event["stage-variables"].db_password, // Enter your  MySQL password
    database: event["stage-variables"].db_database // Enter your  MySQL database name.
  });
  try {
    let qra_owner = await checkQraCognito(sub);
    if (!qra_owner) {
      console.log("User does not exist");
      conn.destroy();
      response.body.error = 1;
      response.body.message = "User does not exist";
      return callback(null, response);
    }
    let insertId = await insertComment(
      idqso,
      qra_owner.idqras,
      datetime,
      comment
    );
    if (insertId) {
      let qso = await getQsoInfo(idqso);
      console.log("saveActivity");
      let idActivity = await saveActivity(
        qra_owner.idqras,
        qso,
        insertId,
        datetime
      );
      if (idActivity) {
        console.log("getFollowing Me" + qra_owner.idqras);
        let followers = await getFollowingMe(qra_owner.idqras);
        console.log(followers);
        console.log("Get Stakeholders of QSO" + idqso);
        let stakeholders = await getQsoStakeholders(idqso, qra_owner.idqras);
        console.log(stakeholders);
        console.log("get Other Comment Writters");
        let commentWriters = await getQsoCommentWriters(
          idqso,
          qra_owner.idqras
        );
        console.log(commentWriters);
        console.log("createNotifications");
        await createNotifications(
          idActivity,
          followers,
          stakeholders,
          commentWriters,
          qra_owner,
          qso,
          datetime,
          comment
        );
      }
      await UpdateCommentCounterInQso(idqso);

      let info = await getComments(idqso);
      if (info) {
        conn.destroy();
        response.body.error = 0;
        response.body.message = info;
        console.log("new comment ");
        return callback(null, response);
      }
    }
  } catch (e) {
    console.log("Error executing QRA Comment Add");
    console.log(e);
    conn.destroy();
    callback(e.message);
    var msg = {
      error: 1,
      message: e.message
    };
    return context.fail(msg);
  }

  function UpdateCommentCounterInQso(qso) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("UpdateCommentCounterInQso" + qso);
      //***********************************************************
      conn.query(
        "UPDATE sqso.qsos SET comments_counter = comments_counter+1  WHERE idqsos=?",
        qso,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }
          resolve(JSON.parse(JSON.stringify(info)));
          // console.log(info);
        }
      );
    });
  }

  function insertComment(idqsos, idqras, datetime, comment) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("insertComment");
      conn.query(
        "INSERT INTO qsos_comments SET idqso = ?, idqra=?, datetime=?, comment=?",
        [idqsos, idqras, datetime, comment],
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }

          resolve(JSON.parse(JSON.stringify(info)).insertId);
        }
      );
    });
  }

  function checkQraCognito(sub) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("checkQraCognito" + sub);
      conn.query(
        "SELECT qras.idqras, qras.qra, qras.avatarpic FROM qras where idcognito=? LIMIT 1",
        sub,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }
          if (info.length > 0) {
            resolve(JSON.parse(JSON.stringify(info))[0]);
          } else {
            resolve();
          }
        }
      );
    });
  }

  function getQsoInfo(idqsos) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("checkQraCognito" + idqsos);
      conn.query(
        "SELECT qsos.idqsos, qsos.guid_URL, qras.qra FROM qsos inner join qras on qras.id" +
          "qras = qsos.idqra_owner where idqsos=? ",
        idqsos,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }
          if (info.length > 0) {
            resolve(JSON.parse(JSON.stringify(info))[0]);
          } else {
            resolve();
          }
        }
      );
    });
  }

  function getComments(qso) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("getComments" + qso);
      conn.query(
        "SELECT qsos_comments.*, qras.qra FROM qsos_comments inner join qras on qsos_comm" +
          "ents.idqra = qras.idqras where  idqso=?",
        qso,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }
          resolve(JSON.parse(JSON.stringify(info)));
        }
      );
    });
  }

  function saveActivity(idqras, idqsos, idcomment, datetime) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      // ***********************************************************
      conn.query(
        "INSERT INTO qra_activities SET idqra = ?, activity_type='18', ref_idqso=?, ref_i" +
          "dqso_comment=?, datetime=?",
        [idqras, idqsos.idqsos, idcomment, datetime],
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }

          resolve(JSON.parse(JSON.stringify(info)).insertId);
        }
      );
    });
  }
  async function createNotifications(
    idActivity,
    followers,
    stakeholders,
    commentWriters,
    qra_owner,
    qso,
    datetime,
    comment
  ) {
    console.log("createNotifications");
    let idnotif;
    let message;
    console.log("stakeholders");
    console.log(stakeholders);
    for (let i = 0; i < stakeholders.length; i++) {
      message = qra_owner.qra + " commented a QSO you are participating";
      idnotif = await insertNotification(
        idActivity,
        stakeholders[i].idqra,
        qra_owner,
        qso,
        datetime,
        stakeholders[i].qra,
        message
      );
      let qra_devices = await getDeviceInfo(stakeholders[i].idqra);
      console.log(qra_devices);
      if (qra_devices)
        await sendPushNotification(
          qra_devices,
          qra_owner,
          idnotif,
          comment,
          qso,
          idActivity
        );
    }

    console.log("commentWriters");
    console.log(commentWriters);

    for (let i = 0; i < commentWriters.length; i++) {
      if (!stakeholders.some(elem => elem.idqra === commentWriters[i].idqra)) {
        message = qra_owner.qra + " commented a QSO you are participating";
        idnotif = await insertNotification(
          idActivity,
          commentWriters[i].idqra,
          qra_owner,
          qso,
          datetime,
          commentWriters[i].qra,
          message
        );
        let qra_devices = await getDeviceInfo(commentWriters[i].idqra);
        console.log(qra_devices);
        if (qra_devices)
          await sendPushNotification(
            qra_devices,
            qra_owner,
            idnotif,
            comment,
            qso,
            idActivity
          );
      }
    }
    console.log(followers);
    for (let i = 0; i < followers.length; i++) {
      if (
        !commentWriters.some(elem => elem.idqra === followers[i].idqra) &&
        !stakeholders.some(elem => elem.idqra === followers[i].idqra)
      ) {
        message = qra_owner.qra + " commented a QSO created by " + qso.qra;
        await insertNotification(
          idActivity,
          followers[i].idqra,
          qra_owner,
          qso,
          datetime,
          "",
          message
        );
      }
    }
    console.log(Object.keys(addresses).length);
    if (Object.keys(addresses).length > 0) {
      await sendMessages(qra_owner, idActivity, qso, comment);
      addresses = {};
    }
  }

  function insertNotification(
    idActivity,
    idqra,
    qra_owner,
    qso,
    datetime,
    qra_dest,
    message
  ) {
    console.log("insertNotification" + idqra + qra_owner.idqras);

    let final_url = url + "qso/" + qso.guid_URL;
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.

      conn.query(
        "INSERT INTO qra_notifications SET idqra = ?, idqra_activity=? , datetime=?, acti" +
          "vity_type='18', qra=?,  qra_avatarpic=?, QSO_GUID=?, REF_QRA=?, message=?, url=?" +
          ", idqsos=? ",
        [
          idqra,
          idActivity,
          datetime,
          qra_owner.qra,
          qra_owner.avatarpic,
          qso.guid_URL,
          qso.qra,
          message,
          final_url,
          idqso
        ],
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }

          resolve(JSON.parse(JSON.stringify(info)).insertId);
        }
      );
    });
  }

  function getFollowingMe(idqra_owner) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.

      conn.query(
        "SELECT qra_followers.* from qra_followers WHERE qra_followers.idqra_followed = ?",
        idqra_owner,
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }

          resolve(JSON.parse(JSON.stringify(info)));
        }
      );
    });
  }

  function getQsoStakeholders(idqso, idqraCommentOwner) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.

      conn.query(
        "Select distinct idqra, qra from qsos_qras as q inner join qras on q.idqra = qras" +
          ".idqras where idqso=? and idqra!=?",
        [idqso, idqraCommentOwner],
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }

          resolve(JSON.parse(JSON.stringify(info)));
        }
      );
    });
  }

  function getQsoCommentWriters(idqso, idqraCommentOwner) {
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      conn.query(
        "Select distinct idqra, qra from qsos_comments  as c inner join qras on c.idqra =" +
          " qras.idqras where idqso=? and idqra!=?",
        [idqso, idqraCommentOwner],
        function(err, info) {
          // Call reject on error states, call resolve with results
          if (err) {
            return reject(err);
          }

          resolve(JSON.parse(JSON.stringify(info)));
        }
      );
    });
  }

  function getDeviceInfo(idqra) {
    console.log("getDeviceInfo" + idqra);
    return new Promise(function(resolve, reject) {
      // The Promise constructor should catch any errors thrown on this tick.
      // Alternately, try/catch and reject(err) on catch.
      console.log("getDeviceInfo");
      conn.query("SELECT * FROM push_devices where qra=?", idqra, function(
        err,
        info
      ) {
        // Call reject on error states, call resolve with results
        if (err) {
          return reject(err);
        }

        if (info.length > 0) {
          resolve(JSON.parse(JSON.stringify(info)));
        } else {
          resolve();
        }
      });
    });
  }

  async function sendPushNotification(
    qra_devices,
    qra_owner,
    idnotif,
    comment,
    qso,
    idActivity
  ) {
    console.log("sendPushNotification");

    let channel;

    // console.log(qra_devices);
    for (let i = 0; i < qra_devices.length; i++) {
      qra_devices[i].device_type === "android"
        ? (channel = "GCM")
        : (channel = "APNS");

      addresses[qra_devices[i].token] = {
        ChannelType: channel
      };
      console.log(Object.keys(addresses).length);
      if (Object.keys(addresses).length == 100) {
        await sendMessages(qra_owner, idActivity, qso, comment);
        addresses = {};
      }
    }
  }

  async function sendMessages(qra_owner, idActivity, qso, comment) {
    console.log("sendMessages");
    context.callbackWaitsForEmptyEventLoop = true;

    let title = qra_owner.qra + " commented a QSO you are participating";
    let body = comment;
    let final_url = url + "qso/" + qso.guid_URL;
    let activ = JSON.stringify(idActivity);
    console.log(addresses);
    console.log("body");
    console.log(body);
    var params = {
      ApplicationId: "b5a50c31fd004a20a1a2fe4f357c8e89",
      /* required */
      MessageRequest: {
        /* required */
        Addresses: addresses,

        MessageConfiguration: {
          APNSMessage: {
            Body: body,
            Title: title,
            Action: "OPEN_APP",
            Url: final_url,

            Data: {
              QRA: qra_owner.qra,
              AVATAR: qra_owner.avatarpic,
              IDACTIVITY: activ
            }
          },
          GCMMessage: {
            Action: "OPEN_APP",
            Body: body,
            Data: {
              QRA: qra_owner.qra,
              AVATAR: qra_owner.avatarpic,
              IDACTIVITY: activ,
              URL: final_url
            },

            Title: title,
            Url: final_url
          }
        }
      }
    };
    //PUSH Notification

    let payload = {
      body: {
        source: "QsoCommentAdd" + qra_owner.qra + " " + comment,
        params: params
      },
      "stage-variables": {
        db_host: event["stage-variables"].db_host,
        db_user: event["stage-variables"].db_user,
        db_password: event["stage-variables"].db_password,
        db_database: event["stage-variables"].db_database
      }
    };

    let paramslambda = {
      FunctionName: "PinpointSendMessages", // the lambda function we are going to invoke
      InvocationType: "Event",
      LogType: "None",
      Payload: JSON.stringify(payload)
    };
    console.log("invoke Lambda");
    lambda.invoke(paramslambda, function(err, data) {
      console.log(data);
      console.log(err);
      if (err) {
        console.log("lambda error");
        console.log(err);
      }
    });
  }
};

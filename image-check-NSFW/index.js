const request = require("request");
const AWS = require("aws-sdk");
const rekognition = new AWS.Rekognition();
const warmer = require("lambda-warmer");

exports.handler = async (event, context, callback) => {
  console.log(event);
  // if a warming event
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
  if (!event.body || !event.body.url) {
    console.log("Params Missing");
    response.body.error = 1;
    response.body.message = "Params Missing";
    return callback(null, response);
  }

  if (!event.body.url) return callback(null, "URL is mandatory");
  let result = await isNSFW(event.body.url);
  console.log(result);
  var isNotOk = result.length > 0;
  console.log(isNotOk);
  return callback(null, isNotOk);

  function isNSFW(url) {
    console.log(url);
    return new Promise(function(resolve, reject) {
      request(
        {
          method: "GET",
          url: url,
          encoding: null
        },
        (err, response, body) => {
          if (err) {
            reject(err);
          }

          rekognition.detectModerationLabels(
            {
              Image: {
                Bytes: body
              },
              MinConfidence: 50.0
            },
            (err, data) => {
              if (err) {
                reject(err);
              }
              resolve(data.ModerationLabels);
            }
          );
        }
      );
    });
  }
};

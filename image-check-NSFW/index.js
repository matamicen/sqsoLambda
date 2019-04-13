const request = require('request');
const AWS = require('aws-sdk');
const rekognition = new AWS.Rekognition();
const warmer = require('lambda-warmer');

exports.handler = async(event, context, callback) => {
    // if a warming event
    if (await warmer(event)) 
        return 'warmed';
    context.callbackWaitsForEmptyEventLoop = false;

    let result = await isNSFW(event.body.url);
    console.log(result);
    var isNotOk = result.length > 0;
    console.log(isNotOk);
    return callback(null, isNotOk);

    function isNSFW(url) {
        console.log(url);
        return new Promise(function (resolve, reject) {
            request({
                method: "GET",
                url: url,
                encoding: null
            }, (err, response, body) => {
                if (err) {
                    reject(err);
                }

                rekognition.detectModerationLabels({
                    Image: {
                        Bytes: body
                    },
                    MinConfidence: 50.0
                }, (err, data) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(data.ModerationLabels);
                });
            });
        });
    }
};

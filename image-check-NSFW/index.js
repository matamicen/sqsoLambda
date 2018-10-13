const request = require('request');
const AWS = require('aws-sdk');

exports.handler = (event, context, callback) => {
    context.callbackWaitsForEmptyEventLoop = false;

    const rekognition = new AWS.Rekognition();


    request({
        method: "GET",
        url: event.body.url,
        encoding: null
    }, (err, response, body) => {
        if (err) {
            console.log(err);
            return context.fail(err);
        }

        rekognition.detectModerationLabels({
            Image: {
                Bytes: body
            },
            MinConfidence: 50.0
        }, (err, data) => {
            if (err) {
                return context.fail(err);
            }
            console.log(data.ModerationLabels);

            var isNotOk = data.ModerationLabels.length > 0;
            console.log(isNotOk)
            return callback(null, isNotOk);
        });
    });
};

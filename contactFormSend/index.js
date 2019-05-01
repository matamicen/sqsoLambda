var AWS = require('aws-sdk')
var ses = new AWS.SES()

var RECEIVERS = ['lisandrolan@gmail.com'];
var SENDER = 'lisandrolan@gmail.com'; // make sure that the sender email is properly set up in your Amazon SES
var response = {
    statusCode: 200,
    headers: {
        "Access-Control-Allow-Origin": "*", // Required for CORS support to work
        "Access-Control-Allow-Credentials": true // Required for cookies, authorization headers with HTTPS
    },
    body: {
        "error": null,
        "message": null
    }
};
exports.handler = (event, context, callback) => {
    console.log('Received event:', event);
    sendEmail(event, function (err, data) {
        response.body.error = 0;
        response.body.message = err;
        callback(null, response);

    });
};

function sendEmail(event, done) {

    var params = {
        Destination: {
            ToAddresses: RECEIVERS
        },
        Message: {
            Body: {
                Text: {
                    Data: '\nEmail: ' + event.body.email + '\nMessage: ' + event.body.message,
                    Charset: 'UTF-8'
                }
            },
            Subject: {
                Data: 'Contact Form inquiry: ' + event.body.email,
                Charset: 'UTF-8'
            }
        },
        Source: SENDER
    }
    ses.sendEmail(params, done);
}

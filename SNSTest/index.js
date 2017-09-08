console.log("Loading function");
var AWS = require("aws-sdk");

exports.handler = function(event, context) {
    var eventText = JSON.stringify(event, null, 2);
    console.log("Received event:", eventText);
    console.log(event);
    console.log(context);
    var sns = new AWS.SNS();
    var params = {
        Message: eventText,
        Subject: event.qso,
        //   TopicArn: "arn:aws:sns:us-east-1:116775337022:test"
        TargetArn: "arn:aws:sns:us-east-1:116775337022:endpoint/GCM/AndroidSqso/a9c03b1d-62ad-386c-ae08-14b9a3113ccd"
    };
    sns.publish(params, context.done);
};
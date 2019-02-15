var mysql = require('mysql');

var warmer = require('lambda-warmer');

exports.handler = async(event, context, callback) => {
    // if a warming event
    if (await warmer(event))
        return 'warmed';

    context.callbackWaitsForEmptyEventLoop = false;

    let response = {
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


    if (!event['stage-variables']) {
        console.log("Stage Variables Missing");
        conn.destroy();
        response.body.error = 1;
        response.body.message = "Stage Variables Missing";
        return callback(null, response);
    }
    let url = event['stage-variables'].url;
    let conn = await mysql.createConnection({
        host: event['stage-variables'].db_host, // give your RDS endpoint  here
        user: event['stage-variables'].db_user, // Enter your  MySQL username
        password: event['stage-variables'].db_password, // Enter your  MySQL password
        database: event['stage-variables'].db_database // Enter your  MySQL database name.
    });
    try {

        let banners = await getBannersInfo(event.body.spot);
        if (!banners) {
            console.log("Banner does not exist");
            conn.destroy();
            response.body.error = 1;
            response.body.message = "User does not exist";
            return callback(null, response);
        }
        let selBanner = await determineBanner(banners);
        await updateImpressionCounter(selBanner.idad_banners);
        response.body.message = selBanner;
        response.body.error = 0;

        conn.destroy();

        return callback(null, response);

    }
    catch (e) {
        console.log("Error executing AD Banner Get");
        console.log(e);
        conn.destroy();
        callback(e.message);
        response.body.error = 1;
        response.body.message = e.message;
        callback(null, response);
        return context.fail(response);
    }

    function getBannersInfo(spot) {
        return new Promise(function(resolve, reject) {
            // The Promise constructor should catch any errors thrown on this tick.
            // Alternately, try/catch and reject(err) on catch.
            console.log("getBannerInfo");
            conn.query('SELECT *' +
                ' FROM ad_banners as b ' +
                ' inner join ad_spots as s on b.idad_spots = s.idad_spots' +
                ' inner join ad_customers as c on b.idad_customers = c.idad_customers ' +
                ' where b.idad_spots=? ' +
                ' order by percentage ASC', spot,
                function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }

                    resolve(JSON.parse(JSON.stringify(info)));
                });
        });
    }

    function determineBanner(banners) {
        let max = 100;
        let min = 1;
        let random = Math.floor(Math.random() * (max - min)) + min;

        for (let i = 0; i < banners.length; i++) {
            if (random <= banners[i].percentage)
                return banners[i];
            random -= banners[i].percentage;
        }
    }

    function updateImpressionCounter(idad_banner) {

        return new Promise(function(resolve, reject) {
            conn
                .query('UPDATE ad_banners SET impressions = impressions+1 WHERE idad_banners=?', idad_banner, function(err, info) {
                    // Call reject on error states, call resolve with results
                    if (err) {
                        return reject(err);
                    }
                    resolve(JSON.parse(JSON.stringify(info)));
                    // console.log(info);
                });
        });
    }
};

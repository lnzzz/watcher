require('dotenv').config();
const { TwitterApi } = require('twitter-api-v2');

const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const postTweet = async (message) => {
    try {
        await twitterClient.v2.tweet(message);
        console.log('Tweet posted:', message);
    } catch (error) {
        console.error('Error posting tweet:', error);
    }
};

const calculateInfoAndTweet = async (db) => {
    try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const recentStats = await db.collection('channel-stats').aggregate([
            {
                $match: {
                    date: { $gte: oneHourAgo, $lte: now }
                }
            },
            {
                $sort: { viewCount: -1 }
            },
            {
                $group: {
                    _id: "$channel",
                    viewCount: { $first: "$viewCount" },
                    platform: { $first: "$platform" }
                }
            },
            {
                $sort: { viewCount: -1 }
            },
            {
                $limit: 5
            }
        ]).toArray();

        if (recentStats.length === 0) {
            console.log('No data found for the last hour');
            return;
        }

        // Crear el mensaje
        const tweetTimeRange = `${now.getHours() - 1}hs y ${now.getHours()}hs`;
        let message = `Pico de views entre ${tweetTimeRange}\n\n`;

        recentStats.forEach((stat, index) => {
            message += `${index + 1}) ${stat._id} - ${stat.viewCount} viewers\n`;
        });

        // Postear el tweet
        await postTweet(message);

    } catch (error) {
        console.error('Error calculating or posting tweet:', error);
    }
};

module.exports = {
    calculateInfoAndTweet
}






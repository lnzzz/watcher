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

// Función para buscar el twitter_id en la colección channels
const getTwitterHandle = async (db, channelName) => {
    const channel = await db.collection('channels').findOne({
        name: channelName,
        platform: 'youtube'
    });

    return channel ? channel.twitter_id : channelName; // Si no tiene twitter_id, usamos el nombre del canal
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

        const tweetTimeRange = `${now.getHours() - 4}hs y ${now.getHours()-3}hs`;
        let message = `Pico de views entre ${tweetTimeRange}\n\n`;

        for (let i = 0; i < recentStats.length; i++) {
            const stat = recentStats[i];
            const twitterHandle = await getTwitterHandle(db, stat._id); // Buscar el twitter_id
            message += `${i + 1}) @${twitterHandle} - ${stat.viewCount}\n`;
        }

        // Agregar la fuente al final del mensaje
        message += '\nFuente: Youtube DATA API y EDS';

        // Postear el tweet
        await postTweet(message);

    } catch (error) {
        console.error('Error calculating or posting tweet:', error);
    }
};

module.exports = {
    calculateInfoAndTweet
}






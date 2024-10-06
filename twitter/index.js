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

    return channel.twitter_id ? `@${channel.twitter_id}` : channelName; // Si no tiene twitter_id, usamos el nombre del canal
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

        // Obtener las horas en el rango que se publicará
        const currentHour = (now.getHours() - 3 + 24) % 24; // Ajustar la hora de Argentina (-3) y usar % 24 para evitar negativos
        const previousHour = (currentHour - 1 + 24) % 24; // Asegurar que previousHour también sea positivo

        const tweetTimeRange = `${previousHour}:00hs a ${previousHour}:59hs`;
        let message = `Máx views entre ${tweetTimeRange}\n\n`;

        for (let i = 0; i < recentStats.length; i++) {
            const stat = recentStats[i];
            if (stat.viewCount>0) {
                const twitterHandle = await getTwitterHandle(db, stat._id); // Buscar el twitter_id
                if (stat.viewCount > 0) message += `${i + 1}) ${twitterHandle} - ${stat.viewCount}\n`;
            }
        }

        // Agregar la fuente al final del mensaje
        message += '\nFuente: Youtube DATA API + EDS';

        // Postear el tweet
        await postTweet(message);

    } catch (error) {
        console.error('Error calculating or posting tweet:', error);
    }
};

module.exports = {
    calculateInfoAndTweet
}






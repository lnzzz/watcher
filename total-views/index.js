const {google} = require('googleapis');
const {TwitterApi} = require('twitter-api-v2');

function getApiKey() {
  return process.env.YOUTUBE_API_KEY_TOTALVIEWS
}
/*
async function getTwitterFollowers(twitterHandle) {
    const client = new TwitterApi({
        appKey: process.env.TWITTER_API_KEY,
        appSecret: process.env.TWITTER_API_SECRET,
        accessToken: process.env.TWITTER_ACCESS_TOKEN,
        accessSecret: process.env.TWITTER_ACCESS_SECRET,
    });

    try {
        // Solicita el campo public_metrics
        const user = await client.v2.userByUsername(twitterHandle, {
            'user.fields': 'public_metrics' // Añadimos el campo public_metrics aquí
        });

        // Mostrar la respuesta completa en la consola
        console.log(`*+*+*+*+*+*+*+*+*+* user: `, user);

        if (user && user.data && user.data.public_metrics) {
            const followersCount = user.data.public_metrics.followers_count;
            return followersCount;
        } else {
            console.error(`Error: No se encontró información de followers para ${twitterHandle}`);
            return null;
        }
    } catch (error) {
        console.error(`Error al obtener Twitter followers para ${twitterHandle}:`, error.message);
        return null;
    }
}
*/
const getTotalviews = async (db) => {

    const youtube = google.youtube({
        version: 'v3',
        auth: getApiKey()
    });

    const channelsCol = db.collection('channels');
    const totalViewsCol = db.collection('total-views');

    const youtubeChannels = await channelsCol.find({platform: 'youtube'}).toArray();

    if (youtubeChannels.length > 0) {
        const channelIds = youtubeChannels.map(channel => channel.id);
        const response = await youtube.channels.list({
            part: 'statistics',
            id: channelIds.join(','),
        });

        if (response.data.items.length > 0) {
            const nowDate = new Date();

            const insertPromises = response.data.items.map(async (channel) => {
                const channelStats = channel.statistics;
                const totalViews = channelStats.viewCount;
                const subscriberCount = channelStats.subscriberCount;
                const videoCount = channelStats.videoCount;
                const channelId = channel.id;
                const channelName = youtubeChannels.find(ytChannel => ytChannel.id === channel.id).name;
                //const twitterHandle = youtubeChannels.find((ytChannel) => ytChannel.id === channel.id).twitter_handle;

                /*
                let twitterFollowers = null;
                if (twitterHandle) {
                    twitterFollowers = await getTwitterFollowers(twitterHandle);
                } else {
                    console.log(`No Twitter handle for channel ${channelName}. Skipping Twitter followers fetch.`);
                }
*/

                //console.log(`Canal: ${channelId}, Total Views: ${totalViews}, Subscribers: ${subscriberCount}, Total Videos: ${videoCount}, Twitter Followers: ${twitterFollowers || 'N/A'}`);
                console.log(`Canal: ${channelId}, Total Views: ${totalViews}, Subscribers: ${subscriberCount}, Total Videos: ${videoCount}`);


                const insertObj = {
                    date: new Date(),
                    channelName: channelName,
                    channelId: channelId,
                    platform: 'youtube',
                    totalViews: totalViews,
                    subscriberCount: subscriberCount,
                    videoCount: videoCount,
                    //twitterFollowers: twitterFollowers,
                };

                try {
                    await totalViewsCol.insertOne(insertObj);
                    console.log(`Inserted total views data for channel ${channelId} successfully.`);
                } catch (error) {
                    console.error(`Error inserting data for channel ${channelId}:`, error.message);
                }
            });
            await Promise.all(insertPromises);
        }
    } else {
        console.error('No channels found');
    }


}


module.exports = {
    getTotalviews
}
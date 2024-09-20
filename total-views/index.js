const {google} = require('googleapis');

function getApiKey() {
    const hour = new Date().getHours();

    if (hour >= 0 && hour < 4) {
        return process.env.YOUTUBE_API_KEY_1; // Primera API Key
    } else if (hour >= 4 && hour < 8) {
        return process.env.YOUTUBE_API_KEY_2; // Segunda API Key
    } else if (hour >= 8 && hour < 12) {
        return process.env.YOUTUBE_API_KEY_3; // Tercera API Key
    } else if (hour >= 12 && hour < 16) {
        return process.env.YOUTUBE_API_KEY_4; // cuarta API Key
    } else if (hour >= 16 && hour < 20) {
        return process.env.YOUTUBE_API_KEY_5; // Quinta API Key
    } else {
        return process.env.YOUTUBE_API_KEY_6; // Sexta API Key
    }
}

export const getTotalviews = async (db) => {

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


                console.log(`Canal: ${channelId}, Total Views: ${totalViews}, Subscribers: ${subscriberCount}, Total Videos: ${videoCount}`);

                const insertObj = {
                    date: nowDate,
                    channelName: channelName,
                    channelId: channelId,
                    platform: 'youtube',
                    totalViews: totalViews,
                    subscriberCount: subscriberCount,
                    videoCount: videoCount,
                };

                try {
                    await totalViewsCol.insertOne(insertObj); // Intentar la inserción
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
//require('dotenv').config();
const {google} = require('googleapis');
//const config = require('config');

/*
function getApiKey() {
    const hour = new Date().getHours();

    if (hour >= 0 && hour < 8) {
        return config.youtube[0].apiKey; // Primera API Key
    } else if (hour >= 8 && hour < 16) {
        return config.youtube[1].apiKey; // Segunda API Key
    } else {
        return config.youtube[2].apiKey; // Tercera API Key
    }
}
*/
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
    } else  {
        return process.env.YOUTUBE_API_KEY_6; // Sexta API Key
    }
}


async function getVideoData(statsCollection, channelsCollection, ch, puppeteerCluster,totalviewsCol) {
    const youtube = google.youtube({
        version: 'v3',
        auth: getApiKey()
    });

    const channel = await channelsCollection.findOne({ platform: 'youtube', name: ch.name });
    const nowDate = new Date();
    if (channel) {
        const channelId = channel.id;
        const channelName = channel.name;

        console.log(`[${nowDate}}] YOUTUBE: collecting data for '${channelName}'`);

        try {
            let subscriberCount=0;
            const subscriberResponse = await youtube.channels.list({
                part: 'statistics',
                id: channelId
            });

            if (subscriberResponse.data.items.length > 0) {
                const channelStats = subscriberResponse.data.items[0].statistics;
                subscriberCount = channelStats.subscriberCount;

            }

            const channelsToScreen = [];
            if (channel.videoId) {

                const videoResponse = await youtube.videos.list({
                    part: 'liveStreamingDetails,statistics,snippet',
                    id: channel.videoId
                });


                if (videoResponse.data.items.length > 0) {
                    let concurrentViewers = videoResponse.data.items[0].liveStreamingDetails.concurrentViewers;
                    let statistics = videoResponse.data.items[0].statistics;
                    const title = videoResponse.data.items[0].snippet.title;


                    const likeCount = statistics.likeCount || 0;
                    let liveChatId = videoResponse.data.items[0].liveStreamingDetails.activeLiveChatId || null;
                    let liveMessageCount = null;

                    if (liveChatId) {
                        const liveMessages = await youtube.liveChatMessages.list({
                            liveChatId,
                            part: 'snippet',
                            maxResults: 200
                        });
                        if (liveMessages && liveMessages.data && liveMessages.data.pageInfo && liveMessages.data.pageInfo.totalResults) {
                            liveMessageCount = liveMessages.data.pageInfo.totalResults;
                        } else {
                            liveMessageCount = 0;
                        }
                    }

                    if (!isNaN(parseInt(concurrentViewers))) {
                        const imageName = `${channelName}_${nowDate.getFullYear()}${nowDate.getMonth() + 1}${nowDate.getDate()}_${nowDate.getHours()}_${String(nowDate.getMinutes()).padStart(2, "0")}.jpg`;
                        channelsToScreen.push({videoId: channel.videoId, imageName, channelName: channelName});
                    }
                    if (isNaN(parseInt(concurrentViewers))) {
                        concurrentViewers = 0;
                    }
                    console.log(`YOUTUBE: ${channelName} current viewers: ${concurrentViewers} // current likes: ${likeCount} // current subscribers: ${subscriberCount} // current title: ${title}`);

                    const insertObject = {
                        date: nowDate,
                        channel: channelName,
                        platform: 'youtube',
                        viewCount: parseInt(concurrentViewers),
                        likeCount: parseInt(likeCount),
                        subscriberCount: parseInt(subscriberCount),
                        title: title
                    };

                    if (liveMessageCount && !isNaN(parseInt(liveMessageCount))) {
                        insertObject.liveMessageCount = liveMessageCount;
                    } else {
                        insertObject.liveMessageCount = 0;
                    }

                    await statsCollection.insertOne(insertObject);

                    console.log(`YOUTUBE: '${channelName}' inserted tracking document.`);
                } else {
                    await statsCollection.insertOne({
                        date: nowDate,
                        channel: channelName,
                        platform: 'youtube',
                        viewCount: 0
                    });
                }
            } else {
                await statsCollection.insertOne({
                    date: nowDate,
                    channel: channelName,
                    platform: 'youtube',
                    viewCount: 0
                });
            }
        } catch (error) {
            console.error(`YOUTUBE: Error fetching video data for channel ID ${channelId} / name ${channelName}:`, error.message);
            await statsCollection.insertOne({
                date: nowDate,
                channel: channelName,
                platform: 'youtube',
                viewCount: 0
            });
        }
    } else {
        console.log(`channel_not_found '${ch.name}'`);
    }
}


async function watchVideos(statsCollection, channelsCol, channels, puppeteerCluster,totalViewsCol) {
    for (const channel of channels) {
        getVideoData(statsCollection, channelsCol, channel, puppeteerCluster,totalViewsCol);
    }
}


module.exports = {
    watchVideos,
}

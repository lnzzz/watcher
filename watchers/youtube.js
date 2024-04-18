const { google } = require('googleapis');

const config = require('config');

// YouTube API configuration
const apiKey = config.youtube.apiKey;

const youtube = google.youtube({
    version: 'v3',
    auth: apiKey
});



async function getVideoData(statsCollection, channelsCollection, ch) {
    //console.log(ch);
    const channel = await channelsCollection.findOne({ platform: 'youtube', name: ch.name });
    if (channel) {
        const channelId = channel.id;
        const channelName = channel.name;

        console.log(`[${new Date()}] YOUTUBE: collecting viewers for '${channelName}'`);

        try {
            if (channel.videoId) {
                const videoResponse = await youtube.videos.list({
                    part: 'liveStreamingDetails',
                    id: channel.videoId
                });

                if (videoResponse.data.items.length > 0) {
                    let concurrentViewers = videoResponse.data.items[0].liveStreamingDetails.concurrentViewers;
                    if (isNaN(parseInt(concurrentViewers))) {
                        console.log(`isNaN ${channelName} => `, concurrentViewers);
                        concurrentViewers = 0;
                    }
                    console.log(`YOUTUBE: Concurrent Viewers for channel ${channelName}: ${concurrentViewers}`);
                    await statsCollection.insertOne({ 
                        date: new Date(), 
                        channel: channelName,
                        platform: 'youtube',
                        viewCount: parseInt(concurrentViewers)
                    });
                    console.log(`YOUTUBE: '${channelName}' inserted tracking document.`);
                } else {
                    await statsCollection.insertOne({ 
                        date: new Date(), 
                        channel: channelName,
                        platform: 'youtube',
                        viewCount: 0
                    });
                }
            } else {
                await statsCollection.insertOne({ 
                    date: new Date(), 
                    channel: channelName,
                    platform: 'youtube',
                    viewCount: 0
                });
            }
        } catch (error) {
            console.error(`YOUTUBE: Error fetching video data for channel ID ${channelId} / name ${channelName}:`, error.message);
            await statsCollection.insertOne({ 
                date: new Date(), 
                channel: channelName,
                platform: 'youtube',
                viewCount: 0
            });
        }
    } else {
        console.log(`channel_not_found '${ch.name}'`);
    }
}

const intervals = [];

async function watchVideos(statsCollection, channelsCol, channels) {
    for (const channel of channels) {
        getVideoData(statsCollection, channelsCol, channel);
        intervals.push(setInterval(function() { 
            getVideoData(statsCollection, channelsCol, channel);
        }, channel.frequency || 120000));
    }
}

function stopWatching() {
    for (const interval of intervals) {
        clearInterval(interval);
    }
}


module.exports = {
    watchVideos,
    stopWatching
}

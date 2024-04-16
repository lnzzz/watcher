const { google } = require('googleapis');

// YouTube API configuration
const apiKey = '-replaceme-';

const youtube = google.youtube({
    version: 'v3',
    auth: apiKey
});

const videoIds = {};


async function getVideoData(statsCollection, channel) {

    const channelId = channel.id;
    const channelName = channel.name;

    console.log(`[${new Date()}] YOUTUBE: collecting viewers for '${channelName}'`);

    try {
        if (!videoIds[channel.id]) {
            const response = await youtube.search.list({
                part: 'snippet',
                channelId: channelId,
                eventType: 'live',
                type: 'video',
                maxResults: 1
            });
            if (response.data.items.length > 0) {
                videoIds[channel.id] = response.data.items[0].id.videoId;
            }
        }
        

        if (videoIds[channel.id]) {
            const videoId = videoIds[channel.id];
            const videoResponse = await youtube.videos.list({
                part: 'liveStreamingDetails',
                id: videoId
            });

            if (videoResponse.data.items.length > 0) {
                const concurrentViewers = videoResponse.data.items[0].liveStreamingDetails.concurrentViewers;
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
        console.error(`YOUTUBE: Error fetching video data for channel ID ${channelId} / name ${channelName}:`, error);
    }
}

const intervals = [];

async function watchVideos(statsCollection, channels) {
    for (const channel of channels) {
        getVideoData(statsCollection, channel);
        intervals.push(setInterval(function() { 
            getVideoData(statsCollection, channel);
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

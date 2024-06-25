const { google } = require('googleapis');
const config = require('config');

// YouTube API configuration
const apiKey = config.youtube.apiKey;

const youtube = google.youtube({
    version: 'v3',
    auth: apiKey
});


async function getVideoData(statsCollection, channelsCollection, ch, puppeteerCluster) {
    const channel = await channelsCollection.findOne({ platform: 'youtube', name: ch.name });
    const nowDate = new Date();
    if (channel) {
        const channelId = channel.id;
        const channelName = channel.name;

        console.log(`[${nowDate}}] YOUTUBE: collecting viewers for '${channelName}'`);

        try {
            const channelsToScreen = [];
            if (channel.videoId) {
                const videoResponse = await youtube.videos.list({
                    part: 'liveStreamingDetails',
                    id: channel.videoId
                });

                if (videoResponse.data.items.length > 0) {
                    let concurrentViewers = videoResponse.data.items[0].liveStreamingDetails.concurrentViewers;
                    if (!isNaN(parseInt(concurrentViewers))) {
                        const imageName = `${channelName}_${nowDate.getFullYear()}${nowDate.getMonth()+1}${nowDate.getDate()}_${nowDate.getHours()}_${String(nowDate.getMinutes()).padStart(2, "0")}.jpg`;
                        channelsToScreen.push({ videoId: channel.videoId, imageName, channelName: channelName });
                    }
                    if (isNaN(parseInt(concurrentViewers))) {
                        concurrentViewers = 0;
                    }
                    console.log(`YOUTUBE: Concurrent Viewers for channel ${channelName}: ${concurrentViewers}`);
                    await statsCollection.insertOne({ 
                        date: nowDate, 
                        channel: channelName,
                        platform: 'youtube',
                        viewCount: parseInt(concurrentViewers)
                    });
                    console.log(`YOUTUBE: '${channelName}' inserted tracking document.`);
/*                    if (channelsToScreen.length > 0) {
                        for (let i=0; i<channelsToScreen.length; i++) {
                            puppeteerCluster.queue({
                                channelName: channelsToScreen[i].channelName,
                                uri: `https://www.youtube.com/watch?v=${channelsToScreen[i].videoId}`,
                                platform: 'youtube',
                                imageName: channelsToScreen[i].imageName,
                                outputPath: `../web/public/images/youtube/${channelsToScreen[i].imageName}`,
                                waitForSelector: '.html5-video-player',
                                waitForFunction: () => {
                                    const video = document.querySelector('.html5-main-video');
                                    if (video.paused) {
                                        document.querySelector('.ytp-play-button').click();
                                    }
                                    return video && !video.paused;
                                },
                                evaluate: () => {
                                    let dom = document.querySelector('.ytp-chrome-bottom')
                                    dom.style.display = 'none'
                                },
                                videoElement: '.html5-video-player video'
                            })
                        }
                    } */
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
                date: today, 
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

async function watchVideos(statsCollection, channelsCol, channels, puppeteerCluster) {
    for (const channel of channels) {
        getVideoData(statsCollection, channelsCol, channel, puppeteerCluster);
        intervals.push(setInterval(function() { 
            getVideoData(statsCollection, channelsCol, channel, puppeteerCluster);
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

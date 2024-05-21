const axios = require('axios');
const config = require('config');

// Twitch API configuration
const clientId = config.twitch.clientId
const clientSecret = config.twitch.clientSecret;
const { setTimeout } = require('timers/promises');

// Function to get OAuth token
async function getOAuthToken() {
    try {
        const response = await axios.post(`https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`);
        return response.data.access_token;
    } catch (error) {
        console.error('TWITCH: Error fetching OAuth token:', error);
    }
}

// Function to get stream data
async function getStreamData(statsCollection, channel, puppeteerCluster) {
    const channelName = channel.id;
    const channelRealName = channel.name;
    const nowDate = new Date();
    try {
        const channelsToScreen = [];
        console.log(`[${nowDate}] TWITCH: collecting viewers for '${channelName}'`);
        const token = await getOAuthToken();
        const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${channelName}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.data.data.length > 0) {
            const imageName = `${channelRealName}_${nowDate.getFullYear()}${nowDate.getMonth()+1}${nowDate.getDate()}_${nowDate.getHours()}_${String(nowDate.getMinutes()).padStart(2, "0")}.jpg`;
            channelsToScreen.push({ channelName, imageName });
            const { viewer_count } = response.data.data[0];
            console.log(`TWITCH: ${channelName} current viewers: ${viewer_count}`);
            await statsCollection.insertOne({ 
                date: nowDate, 
                channel: channel.name,
                platform: 'twitch',
                viewCount: viewer_count
            });
            console.log(`TWITCH: ${channelName} inserted tracking document.`);
            if (channelsToScreen.length > 0) {
                for (let i=0; i<channelsToScreen.length; i++) {
                    puppeteerCluster.queue({ 
                        channelName: channelsToScreen[i].channelName,
                        uri: `https://twitch.tv/${channelsToScreen[i].channelName}`,
                        platform: 'twitch',
                        imageName: channelsToScreen[i].imageName,
                        outputPath: `../web/public/images/twitch/${channelsToScreen[i].imageName}`,
                        waitForSelector: 'video',
                        waitForFunction: async () => {
                            const video = document.querySelector('video');
                            const isGateProvided = document.querySelector('#channel-player-gate') || null;
                            if (isGateProvided) {
                                document.querySelector('button[data-a-target="content-classification-gate-overlay-start-watching-button"]').click();
                                await setTimeout(5000);
                            }
                            
                            if (video.muted) {
                                document.querySelector('button[data-a-target="player-mute-unmute-button"]').click();
                            }
                            console.log({ videoPaused: video.paused });
                            return video && video.currentTime > 0 && !video.paused && !video.ended && video.readyState > 2 && !video.muted;
                        },
                        videoElement: 'video'
                    })
                }
            }
        } else {
            await statsCollection.insertOne({ 
                date: nowDate, 
                channel: channel.name,
                platform: 'twitch',
                viewCount: 0
            });
            console.log(`TWITCH: ${channelName} inserted tracking document with 0 viewers.`);
        }
    } catch (error) {
        console.error(`TWITCH: Error fetching '${channelName}' stream data:`, error);
    }
}

const intervals = [];

// Function to watch stream
function watchStreams(statsCollection, channels, puppeteerCluster) {
    for (const channel of channels) {
        getStreamData(statsCollection, channel, puppeteerCluster);
        intervals.push(setInterval(function() { 
            getStreamData(statsCollection, channel, puppeteerCluster);
        }, channel.frequency || 120000));
    }
}

function stopWatching() {
    for (const interval of intervals) {
        clearInterval(interval);
    }
}

// Start watching the stream
module.exports = {
    stopWatching,
    watchStreams
}

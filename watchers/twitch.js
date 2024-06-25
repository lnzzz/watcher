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
        const headers = {
            'Client-ID': clientId,
            'Authorization': `Bearer ${token}`
        }
        const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${channelName}`, { headers });

        if (response.data.data.length > 0) {
            const userId = response.data.data[0].user_id;
            const followersUrl = `https://api.twitch.tv/helix/channels/followers`;
            const params = {
                broadcaster_id: userId
            };
            const followers = await axios.get(followersUrl, { headers, params });
            const follower_count = followers.data.total;

            const imageName = `${channelRealName}_${nowDate.getFullYear()}${nowDate.getMonth()+1}${nowDate.getDate()}_${nowDate.getHours()}_${String(nowDate.getMinutes()).padStart(2, "0")}.jpg`;
            channelsToScreen.push({ channelName, imageName });
            const { viewer_count } = response.data.data[0];
            console.log(`TWITCH: ${channelName} current viewers: ${viewer_count} // current likes: ${follower_count}`);
            const document = { 
                date: nowDate, 
                channel: channel.name,
                platform: 'twitch',
                viewCount: viewer_count
            }

            if (follower_count) {
                document.likeCount = follower_count;
            }

            await statsCollection.insertOne(document);
            console.log(`TWITCH: ${channelName} inserted tracking document.`);
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

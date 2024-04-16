const axios = require('axios');

// Twitch API configuration
const clientId = '-replaceme-';
const clientSecret = '-replaceme-';


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
async function getStreamData(statsCollection, channel) {
    const channelName = channel.id;
    try {
        const today = new Date();
        console.log(`[${today}] TWITCH: collecting viewers for '${channelName}'`);
        const token = await getOAuthToken();
        const response = await axios.get(`https://api.twitch.tv/helix/streams?user_login=${channelName}`, {
            headers: {
                'Client-ID': clientId,
                'Authorization': `Bearer ${token}`
            }
        });

        if (response.data.data.length > 0) {
            const { viewer_count } = response.data.data[0];
            console.log(`TWITCH: ${channelName} current viewers: ${viewer_count}`);
            await statsCollection.insertOne({ 
                date: today, 
                channel: channel.name,
                platform: 'twitch',
                viewCount: viewer_count
            });
            console.log(`TWITCH: ${channelName} inserted tracking document.`);
        } else {
            await statsCollection.insertOne({ 
                date: today, 
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
function watchStreams(statsCollection, channels) {
    for (const channel of channels) {
        getStreamData(statsCollection, channel);
        intervals.push(setInterval(function() { 
            getStreamData(statsCollection, channel);
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

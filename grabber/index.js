const fetch = require('node-fetch');
const util = require('util');
const { exec } = require('child_process');
const execAsync = util.promisify(exec);
const config = require('config');

const HOST = config.api.host;

async function executeCommand(command) {
    try {
      const { stdout, stderr } = await execAsync(command);
      return {
        stdout,
        stderr
      }
    } catch (error) {
      return { stdout: error.stdout, stderr: error.stderr }
    }
}

const checkLive = async function(channelUri) {
    const result = await executeCommand(`streamlink  --loglevel debug ${channelUri}/live`);
    const isLive = result.stdout.includes('Available streams:');
    const hasVideo = result.stdout.match(/\[plugins\.youtube\]\[debug\] Using video ID: ([\w-]+)/) || null;
    let videoId = null;
    if (hasVideo && hasVideo.length >= 1) {
        videoId = hasVideo[1];
    }
    return { isLive, videoId };
}

const getToken = async function () {
    try {
        const data = {
            username: config.api.credentials.username,
            password: config.api.credentials.password
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data)
        };

        const url = `${HOST}/token`;

        const response = await fetch(url, options);
        const jsonResponse = await response.json();
        if (jsonResponse.token) {
            return jsonResponse.token;
        }
        return null;
    } catch (error) {
        console.error('Token error:', error);
        return null;
    }
}

const getChannels = async function(token) {
    try {
        const options = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        };
        const url = `${HOST}/youtube/channels`;
        const response = await fetch(url, options);
        const jsonResponse = await response.json();
        return jsonResponse;
    } catch (error) {
        console.error('Channels error:', error);
    }
}

const updateChannel = async function(token, channel, videoId) {
    try {
        const data = {
            videoId
        };

        const options = {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(data)
        };

        const url = `${HOST}/youtube/channel/${channel.name}`;
        const response = await fetch(url, options);
        console.log(`[${response.status}] channel '${channel.name}' video id has been updated to value ${videoId}`);
    } catch (error) {
        console.error('Channel update error:', error);
    }
}

const initialize = async() => {
    const token = await getToken();
    if (token) {
        const channels = await getChannels(token);
        if (channels && channels.length > 0) {
            for (let i = 0; i<channels.length; i++) {
                if (channels[i].channelUri) {
                    const channelStatus = await checkLive(channels[i].channelUri);
                    await updateChannel(token, channels[i], channelStatus.videoId);
                }
            }
        }
    }
    return true;
}

module.exports = {
    initialize
}
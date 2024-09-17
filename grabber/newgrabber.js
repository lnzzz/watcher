const fetch = require('node-fetch');
const util = require('util');
const { exec } = require('child_process');
const execAsync = util.promisify(exec);
const config = require('config');
const fs = require('fs');
const https = require('https');
const puppeteer = require('puppeteer');

const HOST = config.api.host;

const pemFileContents = fs.readFileSync('/etc/letsencrypt/live/endirectostream.com/fullchain.pem');
const customAgent = new https.Agent({
  ca: pemFileContents,
  rejectUnauthorized: false
});

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
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    console.log(`Getting videoId --> navigating ${channelUri}/live`)
    await page.goto(channelUri+"/live", { waitUntil: 'domcontentloaded' });
    try {
        await page.waitForFunction(() => { 
            return document.querySelector('meta[property="og:video:url"]') !== null; 
        }, { timeout: 5000 });
    } catch (error) {
        return { isLive: false, videoId: null };
    }

    try {
        await page.waitForFunction(() => {
            return document.querySelector('.html5-main-video') !== null;
        }, { timeout: 5000 });
    } catch (error) {
        return { isLive: false, videoId: null };
    }

    try {
        await page.waitForFunction(() => {
            const videoElement = document.querySelector(".html5-main-video");
            return videoElement.paused === false;
        }, { timeout: 5000 });
    } catch (error) {
        return { isLive: false, videoId: null };
    }

    const videoId = await page.evaluate(() => {
        const metaTag = document.querySelector('meta[property="og:video:url"]');
        return metaTag.getAttribute('content').split("/").pop();
    });

    const isLive = videoId !== null;

    await page.close();
    await browser.close();


    // Return the result
    return { isLive, videoId };
};


const getToken = async function () {
    try {
        const data = {
            username: config.api.credentials.username,
            password: config.api.credentials.password
        };

        const options = {
	        agent: customAgent,
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
  	        agent: customAgent,
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
	        agent: customAgent,
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
                    console.log(channelStatus);
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

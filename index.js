const twitch = require('./watchers/twitch');
const youtube = require('./watchers/youtube');
const grabber = require('./grabber/index');
var cron = require('node-cron');
const { MongoClient } = require('mongodb');
const config = require('config');

const url = config.mongo.url;
const client = new MongoClient(url);
const dbName = 'streamstats';

const initialize = async function() {
    try {
        console.log('Connecting to mongodb');
        await client.connect();
        console.log('Connected.');
        const db = client.db(dbName);
        const channelsCol = db.collection('channels');
        const channelStatsCol = db.collection('channel-stats');
        const youtubeChannels = await channelsCol.find({ platform: 'youtube' }).toArray();
        const twitchChannels = await channelsCol.find({ platform: 'twitch' }).toArray();

        if (!twitchChannels || twitchChannels.length === 0) console.log(`No twitch channels provided for tracking.`);
        if (twitchChannels.length > 0) {
            twitch.watchStreams(channelStatsCol, twitchChannels);
        }

        if (!youtubeChannels || youtubeChannels.length === 0) console.log(`No youtube channels provided for tracking.`);
        if (youtubeChannels.length > 0) {
            youtube.watchVideos(channelStatsCol, channelsCol, youtubeChannels);
        }
    } catch (error) {
        console.error(`There was an error initializing watcher service ${error}`);
    }
}

cron.schedule("0 7 * * *", () => {
    console.log(`initializing watchers`)
    initialize();
    console.log(`watchers initialized.`);
}, {
    scheduled: true,
    timezone: "America/Argentina/Buenos_Aires"
});

// initialize();

cron.schedule("0 23 * * *", () => {
    console.log(`stopping watchers`);
    twitch.stopWatching();
    youtube.stopWatching();
    console.log(`watchers stopped.`);
}, {
    scheduled: true,
    timezone: "America/Argentina/Buenos_Aires"
});

cron.schedule("*/5 6-23 * * *", () => {
    grabber.initialize();
}, {
    scheduled: true,
    timezone: "America/Argentina/Buenos_Aires"
});

console.log(`Application started`);

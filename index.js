const twitch = require('./watchers/twitch');
const youtube = require('./watchers/youtube');
const grabber = require('./grabber/index');
var cron = require('node-cron');
const { MongoClient } = require('mongodb');
const { Cluster } = require('puppeteer-cluster');
const config = require('config');

const url = config.mongo.url;
const client = new MongoClient(url);
const dbName = 'streamstats';

let cluster;
let db

const initialize = async function() {
    try {
        cluster = {}
        console.log('Connecting to mongodb');
        await client.connect();
        console.log('Connected.');
        db = client.db(dbName);
        grabber.initialize2(db);

        cron.schedule("0,5,10,15,20,25,30,35,40,45,50,55 * * * *", async () => {
            const dateNow= new Date();
            console.log(`--------******  Cron del watcher ${dateNow}  *****---------`);
            const channelsCol = db.collection('channels');
            const channelStatsCol = db.collection('channel-stats');
            const youtubeChannels = await channelsCol.find({platform: 'youtube'}).toArray();
            const twitchChannels = await channelsCol.find({platform: 'twitch'}).toArray();

            if (!twitchChannels || twitchChannels.length === 0) console.log(`No twitch channels provided for tracking.`);
            if (!youtubeChannels || youtubeChannels.length === 0) console.log(`No youtube channels provided for tracking.`);

            if (youtubeChannels.length > 0) {
                youtube.watchVideos(channelStatsCol, channelsCol, youtubeChannels, cluster);
            }
            if (twitchChannels.length > 0) {
                twitch.watchStreams(channelStatsCol, twitchChannels, cluster);
            }
        }, {
            scheduled: true,
            timezone: "America/Argentina/Buenos_Aires"
        });
    } catch (error) {
        console.error(`There was an error initializing watcher service ${error}`);
    }
}

//grabber.initialize();
initialize();


cron.schedule("*/5 * * * *", () => {
    const dateNow= new Date();
    console.log(`--------******  Cron del Grabber ${dateNow}  *****---------`);
    if (db) {
        grabber.initialize2(db);
    } else {
        console.error('Database is not initialized');
    }
}, {
    scheduled: true,
    timezone: "America/Argentina/Buenos_Aires"
});

console.log(`Application started`);

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

const initialize = async function() {
    try {
        cluster = await Cluster.launch({
            concurrency: Cluster.CONCURRENCY_CONTEXT,
            maxConcurrency: 1,
            retryLimit: 2
        })

        await cluster.task(async ({ page, data }) => {
            await page.goto(data.uri);              
            await page.waitForSelector(data.waitForSelector);
            /*
            page.on('console', msg => {
                const msgArgs = msg.args();
                for (let i =0; i<msgArgs.length; i++) {
                    msgArgs[i].jsonValue().then(function(val) {
                        console.log(val);
                    })
                } 
            });
            */
            if (data.evaluate) {
                await page.evaluate(data.evaluate);
            }
           
            await page.waitForFunction(data.waitForFunction);
            const videoElement = await page.$(data.videoElement);
            if (videoElement) {
                const boundingBox = await videoElement.boundingBox();
                if (boundingBox) {
                    const outputPath = data.outputPath;
                    await page.screenshot({ path: outputPath, quality: 25, clip: boundingBox });
                    console.log('Screenshot saved:', outputPath);
                }
            }
        });

        cluster.on('taskerror', (err, data, willRetry) => {
            console.log(err);
            console.log(data);
            console.log(willRetry);
        });

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
            twitch.watchStreams(channelStatsCol, twitchChannels, cluster);
        }

        
        if (!youtubeChannels || youtubeChannels.length === 0) console.log(`No youtube channels provided for tracking.`);
        if (youtubeChannels.length > 0) {
            youtube.watchVideos(channelStatsCol, channelsCol, youtubeChannels, cluster);
        }
    } catch (error) {
        console.error(`There was an error initializing watcher service ${error}`);
    }
}

cron.schedule("0 6 * * *", () => {
    console.log(`initializing watchers`)
    initialize();
    console.log(`watchers initialized.`);
}, {
    scheduled: true,
    timezone: "America/Argentina/Buenos_Aires"
});

grabber.initialize();
initialize();

cron.schedule("0 23 * * *", async () => {
    console.log(`stopping watchers`);
    twitch.stopWatching();
    youtube.stopWatching();
    console.log(`watchers stopped.`);
    await cluster.idle();
    await cluster.close();
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

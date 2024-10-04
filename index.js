require('dotenv').config();
const twitch = require('./watchers/twitch');
const youtube = require('./watchers/youtube');
const grabber = require('./grabber/index');
var cron = require('node-cron');
const { MongoClient } = require('mongodb');
const {getTotalviews} = require("./total-views");
const {calculateInfoAndTweet} = require("./twitter");
//const { Cluster } = require('puppeteer-cluster');
//const config = require('config');

//const url = config.mongo.url;
const url = process.env.MONGO_URL_RAILWAY;
const urlDonweb = process.env.MONGO_URL_DONWEB;
const client = new MongoClient(url);
const clientDonweb = new MongoClient(urlDonweb);
const dbName = 'streamstats';

let cluster;
let db,dbDonweb;

const initialize = async function() {
    try {
        cluster = {}
        console.log('Connecting to mongodb (railway y donweb)');
        await client.connect();
        await clientDonweb.connect();
        console.log('Connected.');
        db = client.db(dbName);
        dbDonweb = clientDonweb.db(dbName);
        grabber.initialize(db,dbDonweb);


        cron.schedule("0,5,10,15,20,25,30,35,40,45,50,55 * * * *", async () => {
            const dateNow= new Date();
            console.log(`--------******  Cron del watcher ${dateNow}  *****---------`);
            const channelsCol = db.collection('channels');
            const channelStatsCol = db.collection('channel-stats');
            const totalViewsCol = db.collection('total-views');
            const youtubeChannels = await channelsCol.find({platform: 'youtube'}).toArray();
            const twitchChannels = await channelsCol.find({platform: 'twitch'}).toArray();

            if (!twitchChannels || twitchChannels.length === 0) console.log(`No twitch channels provided for tracking.`);
            if (!youtubeChannels || youtubeChannels.length === 0) console.log(`No youtube channels provided for tracking.`);

            if (youtubeChannels.length > 0) {
                youtube.watchVideos(channelStatsCol, channelsCol, youtubeChannels, cluster,totalViewsCol);
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

cron.schedule("2,7,12,17,22,27,32,37,42,47,52,57 * * * *", () => {
    const dateNow= new Date();
    console.log(`--------******  Cron del Grabber ${dateNow}  *****---------`);
    if (db && dbDonweb) {
        grabber.initialize(db,dbDonweb);
    } else {
        console.error('Database is not initialized');
    }
}, {
    scheduled: true,
    timezone: "America/Argentina/Buenos_Aires"
});

cron.schedule("0 0,6,12,18 * * *",()=>{
    const dateNow= new Date();
    console.log(`--------******  Cron del getTotalViews ${dateNow}  *****---------`);
    if(db){
        getTotalviews(db)
    }else{
        console.error('Database not yet initialized');
    }
},{
    scheduled: true,
    timezone: "America/Argentina/Buenos_Aires"
});

cron.schedule('0 */1 * * *', () => {
    const dateNow= new Date();
    console.log(`--------******  Cron del twitter ${dateNow}  *****---------`);
    calculateInfoAndTweet(db);
}, {
    scheduled: true,
    timezone: "America/Argentina/Buenos_Aires"
});

initialize();

console.log(`Application started`);

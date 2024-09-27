const util = require('util');
const {exec} = require('child_process');
const execAsync = util.promisify(exec);

async function executeCommand(command) {
    try {
        const {stdout, stderr} = await execAsync(command);
        return {
            stdout,
            stderr
        }
    } catch (error) {
        return {stdout: error.stdout, stderr: error.stderr}
    }
}

const checkLive = async function (channelUri) {
    const result = await executeCommand(`streamlink  --loglevel debug ${channelUri}/live`);
    const isLive = result.stdout.includes('Available streams:');
    const hasVideo = result.stdout.match(/\[plugins\.youtube\]\[debug\] Using video ID: ([\w-]+)/) || null;
    let videoId = null;
    if (hasVideo && hasVideo.length >= 1) {
        videoId = hasVideo[1];
    }
    return {isLive, videoId};
}

const initialize = async (db,dbDonweb) => {
    const channelsCol = db.collection('channels');
    const youtubeChannels = await channelsCol.find({platform: 'youtube'}).toArray();
    const channelsColDonweb = dbDonweb.collection('channels');
    const youtubeChannelsDonweb = await channelsColDonweb.find({ platform: 'youtube' }).toArray();

    const uniqueYoutubeChannels = mergeUniqueChannelsWithFlags(youtubeChannels, youtubeChannelsDonweb);


    if (youtubeChannels && youtubeChannels.length > 0) {
        for (let i = 0; i < youtubeChannels.length; i++) {
            if (youtubeChannels[i].channelUri) {
                const channelStatus = await checkLive(youtubeChannels[i].channelUri);
                console.log(`******* Channel: ${youtubeChannels[i].name}, videoId: ${channelStatus.videoId} *******`);

                await updateChannel(db, youtubeChannels[i], channelStatus.videoId);
            }
        }
    }
    if (uniqueYoutubeChannels.length > 0) {
        for (let i = 0; i < uniqueYoutubeChannels.length; i++) {
            if (uniqueYoutubeChannels[i].channelUri) {
                const channelStatus = await checkLive(uniqueYoutubeChannels[i].channelUri);
                console.log(`******* Channel: ${uniqueYoutubeChannels[i].name}, videoId: ${channelStatus.videoId} *******`);

                if (uniqueYoutubeChannels[i].inRailway) {
                    await updateChannel(db, uniqueYoutubeChannels[i], channelStatus.videoId);
                }
                if (uniqueYoutubeChannels[i].inDonweb) {
                    await updateChannel(dbDonweb, uniqueYoutubeChannels[i], channelStatus.videoId);
                }
            }
        }
    }

    return true;
}
const updateChannel = async function (db, channel, videoId) {
    const channelsCol = db.collection('channels');
    const channelInstance = await channelsCol.findOne({platform: 'youtube', name: channel.name});
    if (channelInstance) {
        try {
            const set = {}
            set.videoId = videoId;
            set.channelUri = channel.channelUri;

            const result = await channelsCol.updateOne({_id: channelInstance._id}, {
                $set: set
            });

            if (result.matchedCount > 0 && result.modifiedCount > 0) {
                console.log(`[ok] channel '${channel.name}' video id has been updated to value ${videoId}`);
            } else if (result.matchedCount > 0) {
                console.log(`[info] channel '${channel.name}' already has the video id '${videoId}', no update needed.`);
            } else {
                console.log(`[error] channel '${channel.name}' was not found for update.`);
            }
        } catch (error) {
            console.error('Channel update error:', error);
        }
    } else {
        console.log('Channel not found');
    }
}

const mergeUniqueChannelsWithFlags = (channelsA, channelsB) => {
    const map = new Map();

    channelsA.forEach(channel => {
        const key = `${channel.name}_${channel.platform}`;
        if (!map.has(key)) {
            map.set(key, { ...channel, inRailway: true, inDonweb: false });
        } else {
            map.get(key).inRailway = true;
        }
    });

    channelsB.forEach(channel => {
        const key = `${channel.name}_${channel.platform}`;
        if (!map.has(key)) {
            map.set(key, { ...channel, inRailway: false, inDonweb: true });
        } else {
            map.get(key).inDonweb = true;
        }
    });

    return Array.from(map.values());
}


module.exports = {
    initialize
}

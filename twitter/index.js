require('dotenv').config();
const {TwitterApi} = require('twitter-api-v2');
const puppeteer = require('puppeteer');

const twitterClient = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const postTweet = async (message) => {
    try {
        await twitterClient.v2.tweet(message);
        console.log('Tweet posted:', message);
    } catch (error) {
        console.error('Error posting tweet:', error);
    }
};

// Función para buscar el twitter_id en la colección channels
const getTwitterHandle = async (db, channelName) => {
    try {
        const channel = await db.collection('channels').findOne({
            name: channelName,
            platform: 'youtube'
        });
        if (!channel) {
            console.error(`No channel found for: ${channelName}`);
            return false;
        }
        if (channel.publicarX) {
            return channel.twitter_id ? `@${channel.twitter_id}` : channelName; // Si no tiene twitter_id, usamos el nombre del canal
        } else {
            return false;
        }
    }
    catch (error) {
        console.error(`Error getting twitter handle: ${channelName}`, error);
        return false;
    }
};

const calculateInfoAndTweet = async (db) => {
    try {
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        const recentStats = await db.collection('channel-stats').aggregate([
            {
                $match: {
                    date: {$gte: oneHourAgo, $lte: now}
                }
            },
            {
                $sort: {viewCount: -1}
            },
            {
                $group: {
                    _id: "$channel",
                    viewCount: {$first: "$viewCount"},
                    platform: {$first: "$platform"}
                }
            },
            {
                $sort: {viewCount: -1}
            },
            {
                $limit: 10
            }
        ]).toArray();

        if (recentStats.length === 0) {
            console.log('No data found for the last hour');
            return;
        }

        // Obtener las horas en el rango que se publicará
        const currentHour = (now.getHours() - 3 + 24) % 24; // Ajustar la hora de Argentina (-3) y usar % 24 para evitar negativos
        const previousHour = (currentHour - 1 + 24) % 24; // Asegurar que previousHour también sea positivo

        const tweetTimeRange = `${previousHour}:00hs a ${previousHour}:59hs`;
        let message = `RATING\nMáx views entre ${tweetTimeRange}\n\n`;

        let elementos = 0;

        for (let i = 0; i < recentStats.length && elementos < 5; i++) {
            const stat = recentStats[i];
            if (stat.viewCount > 0) {
                const twitterHandle = await getTwitterHandle(db, stat._id); // Buscar el twitter_id y ver si debe publicar
                if (twitterHandle) {
                    elementos++;
                    message += `${elementos}) ${twitterHandle} - ${stat.viewCount}\n`;
                }
            }
        }

        // Agregar la fuente al final del mensaje
        message += '\nFuente: YoutubeAPI+s3r - EDS y UBA';

        // Postear el tweet
        await postTweet(message);

    } catch (error) {
        console.error('Error calculating or posting tweet:', error);
    }
};

const generateImageFromHTML = async (htmlContent) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    // Configurar el contenido HTML
    await page.setContent(htmlContent);

    // Tomar la captura de pantalla
    const screenshotBuffer = await page.screenshot();

    await browser.close();
    return screenshotBuffer;
};

const postTweetWithImage = async (message, htmlContent) => {
    try {
        // Generar la imagen a partir del HTML
        const imageBuffer = await generateImageFromHTML(htmlContent);

        // Subir la imagen a Twitter
        const mediaId = await twitterClient.v1.uploadMedia(imageBuffer, { mimeType: 'image/png' });

        // Publicar el tweet con el ID de los medios
        await twitterClient.v2.tweet({
            text: message,
            media: { media_ids: [mediaId] }
        });

        console.log('Tweet posted with image:', message);
    } catch (error) {
        console.error('Error posting tweet with image:', error);
    }
};

const htmlContent = `
<body>
    <div class="container">
        <h1>Hola, mundo!</h1>
        <p>Esta es una imagen generada a partir de HTML.</p>
    </div>
</body>
<style>
    .container {
        font-family: Arial, sans-serif;
        text-align: center;
        padding: 20px;
        background-color: #f0f0f0;
    }
`;

const message = 'Este es un tweet con una imagen generada a partir de HTML.';

const postImageCron = async () => {
    await postTweetWithImage(message, htmlContent);
};
//postTweetWithImage(message, htmlContent);

module.exports = {
    calculateInfoAndTweet,postImageCron
}






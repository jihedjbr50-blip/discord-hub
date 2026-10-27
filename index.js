import { Client } from 'discord.js-selfbot-v13';
import express from 'express';
import https from 'https';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// مسار الترحيب والفحص
app.get('/', (req, res) => {
    res.send('Discord Protocol Hub Server is Alive & Running 24/7!');
});

app.listen(port, () => {
    console.log(`🌐 Server is running on port ${port}`);
});

// آلية الحفاظ على استيقاظ السيرفر تلقائياً كل 10 دقائق
const RENDER_URL = 'https://discord-hub-px48.onrender.com'; //[cite: 8] رابط سيرفرك

setInterval(() => {
    https.get(RENDER_URL, (res) => {
        console.log(`Keep-alive ping sent, status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error(`Ping error: ${err.message}`);
    });
}, 10 * 60 * 1000); // 10 دقائق (أقل من الحد الأقصى للنوم وهو 15 دقيقة)

const activeClients = new Map();

// تشغيل الفويس (AFK)
app.post('/api/start-voice', async (req, res) => {
    const { token, guildId, channelId, mute, deaf, video, duration } = req.body;
    if (!token || !guildId || !channelId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        let client = activeClients.get(token);
        if (!client) {
            client = new Client({ checkUpdate: false });
            await client.login(token);
            activeClients.set(token, client);
        }

        const guild = await client.guilds.fetch(guildId);
        const channel = await guild.channels.fetch(channelId);
        
        await channel.join({
            selfMute: mute === 'true',
            selfDeaf: deaf === 'true',
            selfVideo: video === 'true'
        });

        if (duration !== 'infinite') {
            setTimeout(async () => {
                try { await channel.leave(); } catch (e) {}
            }, parseInt(duration) * 60 * 1000);
        }

        res.json({ success: true, message: 'Voice connected successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// إرسال الرسائل النصية
app.post('/api/send-text', async (req, res) => {
    const { token, channelId, content, count, interval } = req.body;
    if (!token || !channelId || !content) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        let client = activeClients.get(token);
        if (!client) {
            client = new Client({ checkUpdate: false });
            await client.login(token);
            activeClients.set(token, client);
        }

        const channel = await client.channels.fetch(channelId);
        let sent = 0;
        
        const loopTimer = setInterval(async () => {
            if (sent >= count) {
                clearInterval(loopTimer);
                return;
            }
            try {
                await channel.send(content);
                sent++;
            } catch (e) {}
        }, interval * 1000);

        res.json({ success: true, message: 'Text protocol started!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

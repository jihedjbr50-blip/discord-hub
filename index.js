import { Client } from 'discord.js-selfbot-v13';
import express from 'express';
import https from 'https';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// تفعيل CORS للسماح لأي واجهة (سواء محلياً أو على Netlify) بالاتصال بالسيرفر
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// مسار الترحيب والفحص للتأكد من عمل السيرفر
app.get('/', (req, res) => {
    res.send('Discord Protocol Hub Server is Alive & Running 24/7!');
});

app.listen(port, () => {
    console.log(`🌐 Server is running on port ${port}`);
});

// آلية الحفاظ على استيقاظ السيرفر تلقائياً كل 10 دقائق لمنع النوم على Render
const RENDER_URL = 'https://discord-hub-px48.onrender.com'; // رابط سيرفرك

setInterval(() => {
    https.get(RENDER_URL, (res) => {
        console.log(`Keep-alive ping sent, status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error(`Ping error: ${err.message}`);
    });
}, 10 * 60 * 1000);

const activeClients = new Map();

// بروتوكول تشغيل الاتصال الصوتي (AFK Voice) بالطريقة المباشرة عبر بوابة ديسكورد
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

        // إرسال طلب الاتصال الصوتي عبر الـ WebSocket Gateway مباشرة
        if (client.ws && client.ws.shards) {
            const shard = client.ws.shards.first();
            if (shard) {
                shard.send({
                    op: 4,
                    d: {
                        guild_id: guildId,
                        channel_id: channelId,
                        self_mute: mute === 'true',
                        self_deaf: deaf === 'true',
                        self_video: video === 'true'
                    }
                });
            }
        }

        if (duration !== 'infinite') {
            setTimeout(async () => {
                try {
                    const shard = client.ws.shards.first();
                    if (shard) {
                        shard.send({
                            op: 4,
                            d: { guild_id: guildId, channel_id: null, self_mute: false, self_deaf: false }
                        });
                    }
                } catch (e) {}
            }, parseInt(duration) * 60 * 1000);
        }

        res.json({ success: true, message: 'Voice connected successfully!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// بروتوكول إرسال الرسائل النصية المتقدمة
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

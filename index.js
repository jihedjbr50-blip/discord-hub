import { Client } from 'discord.js-selfbot-v13';
import express from 'express';
import https from 'https';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// تفعيل CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.get('/', (req, res) => {
    res.send('Discord Protocol Hub Server is Alive & Secure 24/7!');
});

app.listen(port, () => {
    console.log(`🌐 Server running on port ${port}`);
});

// آلية الاستيقاظ لمنع خمول Render
const RENDER_URL = 'https://discord-hub-px48.onrender.com';
setInterval(() => {
    https.get(RENDER_URL, (res) => {}).on('error', () => {});
}, 10 * 60 * 1000);

// تخزين الجلسات النشطة (مفتوحة دائماً دون إعادة تسجيل الدخول)
const sessions = new Map();

// دالة جلب أو إنشاء الجلسة بآلية محاكاة المتصفح الآمنة
async function getClient(token) {
    if (sessions.has(token)) {
        const existingClient = sessions.get(token);
        if (existingClient.readyTimestamp) {
            return existingClient; // إعادة استخدام الجلسة الحالية فوراً
        }
    }

    // إعدادات محاكاة المتصفح لتفادي حظر التوكن من ديسكورد
    const client = new Client({
        checkUpdate: false,
        ws: {
            properties: {
                $os: 'Windows',
                $browser: 'Discord Client',
                $device: ''
            }
        }
    });

    await client.login(token);
    sessions.set(token, client);
    return client;
}

// بروتوكول الصوت
app.post('/api/start-voice', async (req, res) => {
    const { token, guildId, channelId, mute, deaf, video, duration } = req.body;
    if (!token || !guildId || !channelId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        const client = await getClient(token);

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

        res.json({ success: true, message: 'Voice connected securely!' });
    } catch (err) {
        // في حال تم إلغاء التوكن من قبل ديسكورد، قم بنزع الجلسة
        sessions.delete(token);
        res.status(500).json({ success: false, message: err.message });
    }
});

// بروتوكول الرسائل النصية
app.post('/api/send-text', async (req, res) => {
    const { token, channelId, content, count, interval } = req.body;
    if (!token || !channelId || !content) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        const client = await getClient(token);
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

        res.json({ success: true, message: 'Text protocol started safely!' });
    } catch (err) {
        sessions.delete(token);
        res.status(500).json({ success: false, message: err.message });
    }
});

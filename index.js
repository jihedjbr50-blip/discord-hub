import { Client } from 'discord.js-selfbot-v13';
import express from 'express';
import https from 'https';

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// تفعيل CORS لضمان قبول الطلبات من الواجهة (سواء محلياً أو بعد رفعها على Netlify)
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// مسار الفحص والتحقق
app.get('/', (req, res) => {
    res.send('Discord Protocol Hub Server is Alive & Running 24/7!');
});

app.listen(port, () => {
    console.log(`🌐 Server is running on port ${port}`);
});

// آلية الاستيقاظ 24/7 لمنع نوم السيرفر على Render
const RENDER_URL = 'https://discord-hub-px48.onrender.com'; //

setInterval(() => {
    https.get(RENDER_URL, (res) => {
        console.log(`Keep-alive ping sent, status: ${res.statusCode}`);
    }).on('error', (err) => {
        console.error(`Ping error: ${err.message}`);
    });
}, 10 * 60 * 1000);

// خريطة ذكية لتخزين عملاء الديسكورد بحيث يكون لكل توكن جلسة معزولة تماماً عن البقية
const sessions = new Map();

// دالة مساعدة للحصول على أو إنشاء عميل آمن لكل حساب على حدة
async function getOrCreateClient(token) {
    if (sessions.has(token)) {
        const existingClient = sessions.get(token);
        if (existingClient.isReady()) {
            return existingClient;
        }
    }

    const client = new Client({ checkUpdate: false });
    await client.login(token);
    sessions.set(token, client);
    return client;
}

// بروتوكول الفويس (مع عزل التداخل تماماً لكل حساب)
app.post('/api/start-voice', async (req, res) => {
    const { token, guildId, channelId, mute, deaf, video, duration } = req.body;
    if (!token || !guildId || !channelId) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        const client = await getOrCreateClient(token);

        // إرسال أمر الاتصال عبر الشارد الخاص بهذا الحساب فقط دون غيره
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

        res.json({ success: true, message: 'Voice connected securely and isolated!' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// بروتوكول الرسائل النصية (مستقل لكل حساب)
app.post('/api/send-text', async (req, res) => {
    const { token, channelId, content, count, interval } = req.body;
    if (!token || !channelId || !content) {
        return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    try {
        const client = await getOrCreateClient(token);
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
        res.status(500).json({ success: false, message: err.message });
    }
});

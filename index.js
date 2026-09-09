const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// 1. خادم الويب (مطلوب لتشغيل البوت على Render مجاناً بدون مشاكل إغلاق)
const app = express();
const PORT = process.env.PORT || 10000;

app.get('/', (req, res) => {
    res.send('Aednbot is running successfully!');
});

app.listen(PORT, () => {
    console.log(`Web server listening on port ${PORT}`);
});

// 2. كود بوت الديسكورد الأساسي
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

client.once('ready', () => {
    console.log(`Bot logged in as: ${client.user.tag}`);
});

// أمر تجريبي للرد على كلمة ping
client.on('messageCreate', message => {
    if (message.author.bot) return;

    if (message.content === 'ping') {
        message.reply('pong!');
    }
});

// تسجيل الدخول باستخدام التوكن المعرف في متغيرات البيئة بـ Render
client.login(process.env.DISCORD_TOKEN);

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ChannelType
} = require("discord.js");

const fs = require("fs");
const express = require("express");
require("dotenv").config();

// ==================================================
// تشغيل السيرفر
// ==================================================

const app = express();

app.get("/", (req, res) => {
  res.send("✅ AN BOT شغال");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Keep-alive يعمل على البورت ${PORT}`);
});

// ==================================================
// المتغيرات
// ==================================================

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !GUILD_ID || !CLIENT_ID) {
  console.error("❌ تأكد من وجود:");
  console.error("DISCORD_TOKEN");
  console.error("GUILD_ID");
  console.error("CLIENT_ID");
  process.exit(1);
}

// ==================================================
// الآيديات
// ==================================================

const STAFF_ROLE_ID = "1442207394280243324";
const TICKET_STAFF_ROLE_ID = "1441509616151298270";
const FIXED_TICKET_LOG_ID = "1458146908747989042";

// ==================================================
// أسماء البيانات
// ==================================================

const WARN_FILE = "warnings.json";
const COUNTER_FILE = "counters.json";
const AUTOREPLY_FILE = "autoreplies.json";
const LEVELS_FILE = "levels.json";
const LEVELUP_CHANNEL_FILE = "levelupchannel.json";
const APPLICATION_FILE = "applications.json";
const APPLICATION_SESSION_FILE = "application_sessions.json";
const LOG_FILE = "logchannels.json";

// ==================================================
// روم تخزين البيانات
// ==================================================

const DATA_CHANNEL_NAME = "「・بيانات-البوت・」";
const DATA_PREFIX = "AN_DATA|";

// ==================================================
// البوت
// ==================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildVoiceStates
  ]
});

// ==================================================
// ذاكرة البيانات
// ==================================================

const dataCache = new Map();
const saveQueues = new Map();
const dataReady = new Map();

let dataChannelLocks = new Map();

// ==================================================
// أسماء الملفات
// ==================================================

const DATA_FILES = [
  WARN_FILE,
  COUNTER_FILE,
  AUTOREPLY_FILE,
  LEVELS_FILE,
  LEVELUP_CHANNEL_FILE,
  APPLICATION_FILE,
  APPLICATION_SESSION_FILE,
  LOG_FILE
];

// ==================================================
// أدوات البيانات
// ==================================================

function getFileKey(file) {
  return file;
}

function encodeData(data) {
  return Buffer
    .from(JSON.stringify(data), "utf8")
    .toString("base64");
}

function decodeData(data) {
  try {
    return JSON.parse(
      Buffer
        .from(data, "base64")
        .toString("utf8")
    );
  } catch {
    return {};
  }
}

function splitIntoChunks(text, size = 1500) {
  const chunks = [];

  for (let i = 0; i < text.length; i += size) {
    chunks.push(text.slice(i, i + size));
  }

  return chunks.length ? chunks : [""];
}

// ==================================================
// إنشاء روم البيانات
// ==================================================

async function getDataChannel(guild) {
  if (!guild) return null;

  const lockKey = guild.id;

  if (dataChannelLocks.has(lockKey)) {
    return dataChannelLocks.get(lockKey);
  }

  const promise = (async () => {
    try {
      await guild.channels.fetch();

      let channel = guild.channels.cache.find(
        c =>
          c.type === ChannelType.GuildText &&
          c.name === DATA_CHANNEL_NAME
      );

      if (channel) {
        return channel;
      }

      const me = guild.members.me ||
        await guild.members.fetch(client.user.id).catch(() => null);

      if (!me) {
        console.error("❌ ما قدرت أجيب عضو البوت.");
        return null;
      }

      channel = await guild.channels.create({
        name: DATA_CHANNEL_NAME,
        type: ChannelType.GuildText,
        topic: "AN BOT DATA STORAGE - لا تحذف هذا الروم",
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            deny: [
              PermissionFlagsBits.ViewChannel
            ]
          },
          {
            id: client.user.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.ReadMessageHistory,
              PermissionFlagsBits.ManageMessages
            ]
          }
        ]
      }).catch(error => {
        console.error(
          "❌ خطأ إنشاء روم البيانات:",
          error.message
        );
        return null;
      });

      return channel;
    } finally {
      dataChannelLocks.delete(lockKey);
    }
  })();

  dataChannelLocks.set(lockKey, promise);

  return promise;
}

// ==================================================
// قراءة كل رسائل روم البيانات
// ==================================================

async function fetchAllMessages(channel) {
  const messages = new Map();
  let before = undefined;

  while (true) {
    const options = {
      limit: 100
    };

    if (before) {
      options.before = before;
    }

    const batch = await channel.messages.fetch(options)
      .catch(() => null);

    if (!batch || batch.size === 0) {
      break;
    }

    for (const message of batch.values()) {
      messages.set(message.id, message);
    }

    if (batch.size < 100) {
      break;
    }

    before = batch.last().id;
  }

  return [...messages.values()];
}

// ==================================================
// تحميل البيانات من Discord
// ==================================================

async function loadDataFile(guild, file) {
  const channel = await getDataChannel(guild);

  if (!channel) {
    return {};
  }

  const messages = await fetchAllMessages(channel);

  const parts = [];

  for (const message of messages) {
    if (!message.content.startsWith(DATA_PREFIX)) {
      continue;
    }

    const raw = message.content.slice(DATA_PREFIX.length);

    const first = raw.indexOf("|");
    const second = raw.indexOf("|", first + 1);
    const third = raw.indexOf("|", second + 1);

    if (
      first === -1 ||
      second === -1 ||
      third === -1
    ) {
      continue;
    }

    const fileName =
      raw.slice(0, first);

    if (fileName !== file) {
      continue;
    }

    const partNumber =
      Number(
        raw.slice(first + 1, second)
      );

    const total =
      Number(
        raw.slice(second + 1, third)
      );

    const encoded =
      raw.slice(third + 1);

    parts.push({
      message,
      partNumber,
      total,
      encoded
    });
  }

  if (!parts.length) {
    return {};
  }

  parts.sort(
    (a, b) =>
      a.partNumber - b.partNumber
  );

  const encoded =
    parts.map(p => p.encoded).join("");

  return decodeData(encoded);
}

// ==================================================
// حفظ البيانات داخل Discord
// ==================================================

async function saveDataFile(guild, file, data) {
  if (!guild) return;

  const key =
    `${guild.id}:${file}`;

  const previous =
    saveQueues.get(key) || Promise.resolve();

  const next =
    previous.then(async () => {
      const channel =
        await getDataChannel(guild);

      if (!channel) return;

      const encoded =
        encodeData(data);

      const chunks =
        splitIntoChunks(encoded, 1450);

      const messages =
        await fetchAllMessages(channel);

      const oldMessages =
        messages.filter(message =>
          message.content.startsWith(
            `${DATA_PREFIX}${file}|`
          )
        );

      for (const message of oldMessages) {
        await message.delete()
          .catch(() => {});
      }

      const total = chunks.length;

      for (
        let i = 0;
        i < chunks.length;
        i++
      ) {
        const content =
          `${DATA_PREFIX}${file}|${i}|${total}|${chunks[i]}`;

        await channel.send({
          content
        }).catch(error => {
          console.error(
            `❌ خطأ حفظ ${file}:`,
            error.message
          );
        });
      }
    }).catch(error => {
      console.error(
        `❌ خطأ في طابور حفظ ${file}:`,
        error
      );
    });

  saveQueues.set(key, next);

  await next;
}

// ==================================================
// تهيئة البيانات
// ==================================================

async function initializeData(guild) {
  if (!guild) return;

  if (dataReady.has(guild.id)) {
    return dataReady.get(guild.id);
  }

  const promise = (async () => {
    console.log(
      `💾 تحميل بيانات ${guild.name}...`
    );

    await getDataChannel(guild);

    for (const file of DATA_FILES) {
      const data =
        await loadDataFile(
          guild,
          file
        );

      dataCache.set(
        `${guild.id}:${file}`,
        data || {}
      );
    }

    console.log(
      `✅ تم تحميل بيانات ${guild.name}`
    );
  })();

  dataReady.set(
    guild.id,
    promise
  );

  return promise;
}

// ==================================================
// JSON API داخلي
// ==================================================

function getCachedData(guildId, file) {
  const key =
    `${guildId}:${file}`;

  if (!dataCache.has(key)) {
    dataCache.set(key, {});
  }

  return dataCache.get(key);
}

function setCachedData(guildId, file, data) {
  dataCache.set(
    `${guildId}:${file}`,
    data
  );
}

// ==================================================
// JSON القديم - الآن يستخدم Discord
// ==================================================

function loadJSON(file) {
  // يستخدم فقط كـ fallback محلي إذا احتجناه
  if (!fs.existsSync(file)) {
    return {};
  }

  try {
    return JSON.parse(
      fs.readFileSync(file, "utf8")
    );
  } catch {
    return {};
  }
}

// ==================================================
// الحفظ
// ==================================================

function saveJSON(file, data, guildId = GUILD_ID) {
  setCachedData(
    guildId,
    file,
    data
  );

  const guild =
    client.guilds.cache.get(guildId);

  if (guild) {
    saveDataFile(
      guild,
      file,
      data
    ).catch(() => {});
  }
}

// ==================================================
// الصلاحيات
// ==================================================

function isStaff(member) {
  if (!member) return false;

  return (
    member.roles.cache.has(STAFF_ROLE_ID) ||
    member.permissions.has(
      PermissionFlagsBits.Administrator
    )
  );
}

function isTicketStaff(member) {
  if (!member) return false;

  return (
    member.roles.cache.has(TICKET_STAFF_ROLE_ID) ||
    member.permissions.has(
      PermissionFlagsBits.Administrator
    )
  );
}

// ==================================================
// البيانات
// ==================================================

function getWarnings(guildId = GUILD_ID) {
  return getCachedData(
    guildId,
    WARN_FILE
  );
}

function saveWarnings(data, guildId = GUILD_ID) {
  saveJSON(
    WARN_FILE,
    data,
    guildId
  );
}

function getAutoReplies(guildId = GUILD_ID) {
  return getCachedData(
    guildId,
    AUTOREPLY_FILE
  );
}

function saveAutoReplies(data, guildId = GUILD_ID) {
  saveJSON(
    AUTOREPLY_FILE,
    data,
    guildId
  );
}

function getLevels(guildId = GUILD_ID) {
  return getCachedData(
    guildId,
    LEVELS_FILE
  );
}

function saveLevels(data, guildId = GUILD_ID) {
  saveJSON(
    LEVELS_FILE,
    data,
    guildId
  );
}

function getCounters(guildId = GUILD_ID) {
  return getCachedData(
    guildId,
    COUNTER_FILE
  );
}

function saveCounters(data, guildId = GUILD_ID) {
  saveJSON(
    COUNTER_FILE,
    data,
    guildId
  );
}

function getLevelUpChannels(guildId = GUILD_ID) {
  return getCachedData(
    guildId,
    LEVELUP_CHANNEL_FILE
  );
}

function saveLevelUpChannels(data, guildId = GUILD_ID) {
  saveJSON(
    LEVELUP_CHANNEL_FILE,
    data,
    guildId
  );
}

function getApplications(guildId = GUILD_ID) {
  return getCachedData(
    guildId,
    APPLICATION_FILE
  );
}

function saveApplications(data, guildId = GUILD_ID) {
  saveJSON(
    APPLICATION_FILE,
    data,
    guildId
  );
}

function getApplicationSessions(guildId = GUILD_ID) {
  return getCachedData(
    guildId,
    APPLICATION_SESSION_FILE
  );
}

function saveApplicationSessions(data, guildId = GUILD_ID) {
  saveJSON(
    APPLICATION_SESSION_FILE,
    data,
    guildId
  );
}

function getLogs(guildId = GUILD_ID) {
  return getCachedData(
    guildId,
    LOG_FILE
  );
}

function saveLogs(data, guildId = GUILD_ID) {
  saveJSON(
    LOG_FILE,
    data,
    guildId
  );
}

// ==================================================
// دوال عامة
// ==================================================

function truncate(text, max = 1024) {
  text = String(text ?? "");

  if (text.length <= max) {
    return text;
  }

  return text.slice(0, max - 3) + "...";
}

function validColor(color) {
  if (!color) {
    return "#5865F2";
  }

  color = color.trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
    return color;
  }

  if (/^[0-9A-Fa-f]{6}$/.test(color)) {
    return `#${color}`;
  }

  return "#5865F2";
}

// ==================================================
// خيارات الرتب
// ==================================================

function addRoleOptions(command) {
  command.addRoleOption(option =>
    option
      .setName("الرتبة-الأساسية")
      .setDescription("الرتبة الأساسية")
      .setRequired(true)
  );

  for (let i = 1; i <= 19; i++) {
    command.addRoleOption(option =>
      option
        .setName(`رتبة-جانبية-${i}`)
        .setDescription(`رتبة جانبية ${i}`)
        .setRequired(false)
    );
  }

  return command;
}

// ==================================================
// أوامر السلاش
// ==================================================

const commands = [];

// ==================================================
// إعطاء رتبة
// ==================================================

commands.push(
  addRoleOptions(
    new SlashCommandBuilder()
      .setName("اعطاء-رتبة")
      .setDescription("إعطاء عضو رتبة أو عدة رتب")
      .addUserOption(option =>
        option
          .setName("العضو")
          .setDescription("العضو")
          .setRequired(true)
      )
      .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageRoles.toString()
      )
  ).toJSON()
);

// ==================================================
// إزالة رتبة
// ==================================================

commands.push(
  addRoleOptions(
    new SlashCommandBuilder()
      .setName("ازالة-رتبة")
      .setDescription("إزالة رتبة أو عدة رتب")
      .addUserOption(option =>
        option
          .setName("العضو")
          .setDescription("العضو")
          .setRequired(true)
      )
      .setDefaultMemberPermissions(
        PermissionFlagsBits.ManageRoles.toString()
      )
  ).toJSON()
);

// ==================================================
// تحذير
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("تحذير")
    .setDescription("تحذير عضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("السبب")
        .setDescription("سبب التحذير")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers.toString()
    )
    .toJSON()
);

// ==================================================
// مسج الرتبة
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("مسج-الرتبة")
    .setDescription("إرسال رسالة خاصة لجميع أعضاء رتبة")
    .addRoleOption(option =>
      option
        .setName("الرتبة")
        .setDescription("الرتبة")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("الرسالة")
        .setDescription("الرسالة")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageRoles.toString()
    )
    .toJSON()
);

// ==================================================
// إرسال ايمبد
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("ارسال-ايمبد")
    .setDescription("إرسال ايمبد")
    .addChannelOption(option =>
      option
        .setName("الروم")
        .setDescription("الروم")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("النص")
        .setDescription("النص")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("العنوان")
        .setDescription("العنوان")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// إرسال إعلان
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("ارسال-اعلان")
    .setDescription("إرسال إعلان")
    .addChannelOption(option =>
      option
        .setName("الروم")
        .setDescription("الروم")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("الرسالة")
        .setDescription("الإعلان")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// زر عداد
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("زر-عداد")
    .setDescription("إنشاء زر عداد")
    .addChannelOption(option =>
      option
        .setName("الروم")
        .setDescription("الروم")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("الرسالة")
        .setDescription("النص")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// حذف رسائل
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("حذف-رسائل")
    .setDescription("حذف رسائل")
    .addIntegerOption(option =>
      option
        .setName("العدد")
        .setDescription("عدد الرسائل")
        .setMinValue(1)
        .setMaxValue(1000)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// إضافة رد
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("اضافة-رد")
    .setDescription("إضافة رد تلقائي")
    .addStringOption(option =>
      option
        .setName("الكلمة")
        .setDescription("الكلمة")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("الرد")
        .setDescription("الرد")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// تعديل رد
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("تعديل-رد")
    .setDescription("تعديل رد تلقائي")
    .addStringOption(option =>
      option
        .setName("الكلمة")
        .setDescription("الكلمة")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("الرد")
        .setDescription("الرد الجديد")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// حذف رد
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("حذف-رد")
    .setDescription("حذف رد تلقائي")
    .addStringOption(option =>
      option
        .setName("الكلمة")
        .setDescription("الكلمة")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// قائمة الردود
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("قائمة-الردود")
    .setDescription("قائمة الردود")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// مستواي
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("مستواي")
    .setDescription("عرض المستوى")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("عضو آخر")
        .setRequired(false)
    )
    .toJSON()
);

// ==================================================
// المتصدرين
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("المتصدرين")
    .setDescription("عرض المتصدرين")
    .toJSON()
);

// ==================================================
// تعديل مستوى
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("تعديل-مستوى")
    .setDescription("تعديل مستوى عضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("المستوى")
        .setDescription("المستوى")
        .setMinValue(1)
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("xp")
        .setDescription("الخبرة")
        .setMinValue(0)
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// لوحة تذاكر
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("لوحة-تذاكر")
    .setDescription("إرسال لوحة التذاكر")
    .addChannelOption(option =>
      option
        .setName("الروم")
        .setDescription("روم اللوحة")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// تحديد روم الفل
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("تحديد-روم-الفل")
    .setDescription("تحديد روم ترقيات المستوى")
    .addChannelOption(option =>
      option
        .setName("الروم")
        .setDescription("الروم")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// تسطيب تقديم
// ==================================================

const setupApplication =
  new SlashCommandBuilder()
    .setName("تسطيب-تقديم")
    .setDescription("تسطيب نظام التقديم")

    .addChannelOption(option =>
      option
        .setName("مكان-التقديم")
        .setDescription("روم لوحة التقديم")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )

    .addChannelOption(option =>
      option
        .setName("مكان-المراجعة")
        .setDescription("روم مراجعة التقديمات")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )

    .addRoleOption(option =>
      option
        .setName("رتبة-القبول")
        .setDescription("اختياري: الرتبة بعد القبول")
        .setRequired(false)
    )

    .addRoleOption(option =>
      option
        .setName("رتبة-الإزالة")
        .setDescription("اختياري: الرتبة التي تنشال")
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName("لون-الإيمبد")
        .setDescription("اختياري: مثال #5865F2")
        .setRequired(false)
    );

for (let i = 1; i <= 20; i++) {
  setupApplication.addStringOption(option =>
    option
      .setName(`سؤال-${i}`)
      .setDescription(`اختياري: السؤال رقم ${i}`)
      .setRequired(false)
  );
}

setupApplication.setDefaultMemberPermissions(
  PermissionFlagsBits.ManageGuild.toString()
);

commands.push(
  setupApplication.toJSON()
);

// ==================================================
// تعديل تقديم
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("تعديل-تقديم")
    .setDescription("تعديل رسالة إيمبد التقديم")

    .addStringOption(option =>
      option
        .setName("العنوان")
        .setDescription("عنوان الإيمبد")
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName("الوصف")
        .setDescription("وصف الإيمبد")
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName("اللون")
        .setDescription("لون الإيمبد مثال #5865F2")
        .setRequired(false)
    )

    .addStringOption(option =>
      option
        .setName("نص-الزر")
        .setDescription("النص الذي يظهر على زر التقديم")
        .setRequired(false)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString()
    )
    .toJSON()
);

// ==================================================
// لوحة تقديم
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("لوحة-تقديم")
    .setDescription("إرسال لوحة التقديم مرة أخرى")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString()
    )
    .toJSON()
);

// ==================================================
// تسجيل الأوامر
// ==================================================

const rest =
  new REST({
    version: "10"
  }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log(
      "🔄 تسجيل أوامر السلاش..."
    );

    await rest.put(
      Routes.applicationGuildCommands(
        CLIENT_ID,
        GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log(
      `✅ تم تسجيل ${commands.length} أمر`
    );
  } catch (error) {
    console.error(
      "❌ خطأ تسجيل الأوامر:",
      error
    );
  }
}

// ==================================================
// اللوقات
// ==================================================

const LOG_CHANNELS = {
  admin: "لوق-الإدارة",
  members: "لوق-الأعضاء",
  roles: "لوق-الرتب",
  channels: "لوق-الرومات",
  messages: "لوق-الرسائل",
  moderation: "لوق-العقوبات",
  voice: "لوق-الصوت",
  tickets: "لوق-التذاكر",
  applications: "لوق-التقديم",
  commands: "لوق-الأوامر"
};

const logSetupLocks = new Map();

async function getOrCreateLogSystem(guild) {
  if (!guild) return null;

  if (logSetupLocks.has(guild.id)) {
    return logSetupLocks.get(guild.id);
  }

  const promise = (async () => {
    try {
      await guild.channels.fetch();

      const logs =
        getLogs(guild.id);

      if (!logs[guild.id]) {
        logs[guild.id] = {};
      }

      let category =
        guild.channels.cache.find(
          channel =>
            channel.type ===
              ChannelType.GuildCategory &&
            channel.name === "「・لوقات・」"
        );

      if (!category) {
        category =
          await guild.channels.create({
            name: "「・لوقات・」",
            type: ChannelType.GuildCategory
          }).catch(() => null);
      }

      if (!category) {
        return null;
      }

      for (
        const [key, name]
        of Object.entries(LOG_CHANNELS)
      ) {
        let channel = null;

        const savedId =
          logs[guild.id][key];

        if (savedId) {
          channel =
            guild.channels.cache.get(
              savedId
            );

          if (
            !channel ||
            channel.type !==
              ChannelType.GuildText
          ) {
            channel = null;
          }
        }

        if (!channel) {
          channel =
            guild.channels.cache.find(
              c =>
                c.type ===
                  ChannelType.GuildText &&
                c.name === name &&
                c.parentId === category.id
            );
        }

        if (!channel) {
          channel =
            guild.channels.cache.find(
              c =>
                c.type ===
                  ChannelType.GuildText &&
                c.name === name
            );
        }

        if (!channel) {
          channel =
            await guild.channels.create({
              name,
              type: ChannelType.GuildText,
              parent: category.id
            }).catch(() => null);
        }

        if (channel) {
          logs[guild.id][key] =
            channel.id;
        }
      }

      saveLogs(
        logs,
        guild.id
      );

      return logs[guild.id];
    } finally {
      logSetupLocks.delete(
        guild.id
      );
    }
  })();

  logSetupLocks.set(
    guild.id,
    promise
  );

  return promise;
}

async function getLogChannel(
  guild,
  type
) {
  const logs =
    await getOrCreateLogSystem(
      guild
    );

  if (!logs) return null;

  return guild.channels.cache.get(
    logs[type]
  ) || null;
}

async function sendLog(
  guild,
  type,
  embed
) {
  const channel =
    await getLogChannel(
      guild,
      type
    );

  if (!channel) return;

  await channel.send({
    embeds: [embed]
  }).catch(() => {});
}

// ==================================================
// Log Embed
// ==================================================

function logEmbed(
  title,
  color = "#5865F2"
) {
  return new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .setTimestamp();
}

// ==================================================
// أرقام التذاكر
// ==================================================

function getNextTicketNumber(
  guildId
) {
  const counters =
    getCounters(guildId);

  if (!counters.tickets) {
    counters.tickets = {};
  }

  if (!counters.tickets[guildId]) {
    counters.tickets[guildId] = 99;
  }

  counters.tickets[guildId]++;

  saveCounters(
    counters,
    guildId
  );

  return counters.tickets[guildId];
}

// ==================================================
// البحث عن تذكرة
// ==================================================

function findOpenTicket(
  guild,
  userId
) {
  return guild.channels.cache.find(
    channel => {
      if (
        channel.type !==
        ChannelType.GuildText
      ) {
        return false;
      }

      return channel.topic?.includes(
        `ticketOwner:${userId}`
      );
    }
  );
}

// ==================================================
// أزرار التذاكر
// ==================================================

function ticketTypeRow(
  disabled = false
) {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "نوع_تذكرة_شكوى"
        )
        .setLabel("تكت شكوى")
        .setEmoji("📢")
        .setStyle(
          ButtonStyle.Danger
        )
        .setDisabled(disabled),

      new ButtonBuilder()
        .setCustomId(
          "نوع_تذكرة_دعم"
        )
        .setLabel("تكت دعم فني")
        .setEmoji("🛠️")
        .setStyle(
          ButtonStyle.Primary
        )
        .setDisabled(disabled),

      new ButtonBuilder()
        .setCustomId(
          "نوع_تذكرة_شراكة"
        )
        .setLabel("تكت شراكة")
        .setEmoji("🤝")
        .setStyle(
          ButtonStyle.Success
        )
        .setDisabled(disabled)
    );
}

function ticketCloseRow() {
  return new ActionRowBuilder()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(
          "اغلاق_تذكرة"
        )
        .setLabel("إغلاق التذكرة")
        .setEmoji("🔒")
        .setStyle(
          ButtonStyle.Danger
        )
    );
}

// ==================================================
// نماذج التذاكر
// ==================================================

function complaintForm() {
  return `**__
نموذج تكت الشكوى

الأسم الكريم :

هويتك :

• الي مشتكي عليه :

السبب :

دليلك :

يرجى عدم العبث بالنموذج + يرجى ارفاق دليل لمشكلتك

.. <@&${TICKET_STAFF_ROLE_ID}> __**`;
}

function supportForm() {
  return `**__
نموذج تكت الدعم الفني

الأسم الكريم :

هويتك :

مـاهي المشكله التي تواجهها :

دليلك :

يرجى عدم العبث بالنموذج + يرجى ارفاق دليل لمشكلتك

.. <@&${TICKET_STAFF_ROLE_ID}> __**`;
}

function partnershipForm() {
  return `**__
نموذج تكت شراكة

• أسم السيرفر :

• عدد الأعضاء :

• عليه بلاك ليست من سيرفرات معروفه ؟ :

• السيرفر متفاعل ؟ :

ملاحضه السيرفر يكون عدد أعضائه فوق ال 200 ويكون متفاعل وادارتك يخشون عندي ولو احد طلع من الؤنرات تنلغي الشراكه

.. <@&${TICKET_STAFF_ROLE_ID}> __**`;
}

// ==================================================
// التقديم
// ==================================================

function getApplicationConfig(
  guildId
) {
  const data =
    getApplications(guildId);

  return data[guildId]?.config ||
    null;
}

function saveApplicationConfig(
  guildId,
  config
) {
  const data =
    getApplications(guildId);

  if (!data[guildId]) {
    data[guildId] = {};
  }

  data[guildId].config =
    config;

  saveApplications(
    data,
    guildId
  );
}

function getQuestions(config) {
  const questions = [];

  for (let i = 1; i <= 20; i++) {
    const question =
      config[`question${i}`];

    if (
      question &&
      question.trim()
    ) {
      questions.push(
        question.trim()
      );
    }
  }

  return questions;
}

function buildApplicationPanel(
  config
) {
  const botAvatar =
    client.user.displayAvatarURL({
      extension: "png",
      size: 1024
    });

  const embed =
    new EmbedBuilder()
      .setTitle(
        config.title ||
        "📋 التقديم على الإدارة"
      )
      .setDescription(
        config.description ||
        "للتقديم على الإدارة اضغط على الزر بالأسفل.\n\nسيتم إرسال أسئلة التقديم لك في الخاص سؤالًا بعد سؤال."
      )
      .setColor(
        validColor(config.color)
      )
      .setThumbnail(botAvatar)
      .setTimestamp();

  const button =
    new ButtonBuilder()
      .setCustomId(
        "بدء_التقديم"
      )
      .setLabel(
        config.buttonLabel ||
        "بدء التقديم"
      )
      .setEmoji("📝")
      .setStyle(
        ButtonStyle.Primary
      );

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder()
        .addComponents(button)
    ]
  };
}

// ==================================================
// بدء التقديم
// ==================================================

async function startApplication(
  interaction
) {
  const config =
    getApplicationConfig(
      interaction.guild.id
    );

  if (!config) {
    return interaction.reply({
      content:
        "❌ نظام التقديم غير مسطب.\nاستخدم `/تسطيب-تقديم` أولاً.",
      ephemeral: true
    });
  }

  const questions =
    getQuestions(config);

  if (!questions.length) {
    return interaction.reply({
      content:
        "❌ ما فيه أسئلة مضافة للتقديم.",
      ephemeral: true
    });
  }

  const sessions =
    getApplicationSessions(
      interaction.guild.id
    );

  const key =
    `${interaction.guild.id}_${interaction.user.id}`;

  if (sessions[key]) {
    return interaction.reply({
      content:
        "❌ عندك تقديم قيد التنفيذ بالفعل، راجع الخاص.",
      ephemeral: true
    });
  }

  try {
    await interaction.user.send(
      `📋 **بدأ تقديمك في ${interaction.guild.name}**\n\n` +
      `عدد الأسئلة: **${questions.length}**\n` +
      `أجب على كل سؤال برسالة منفصلة.\n` +
      `⏱️ لديك 5 دقائق لكل سؤال.\n\n` +
      `لإلغاء التقديم اكتب: **الغاء**`
    );
  } catch {
    return interaction.reply({
      content:
        "❌ ما قدرت أرسل لك رسالة خاصة.",
      ephemeral: true
    });
  }

  sessions[key] = {
    guildId:
      interaction.guild.id,
    userId:
      interaction.user.id,
    startedAt:
      Date.now(),
    answers: []
  };

  saveApplicationSessions(
    sessions,
    interaction.guild.id
  );

  await interaction.reply({
    content:
      "✅ تم بدء التقديم، راجع الخاص.",
    ephemeral: true
  });

  const dm =
    await interaction.user.createDM();

  const answers = [];

  for (
    let index = 0;
    index < questions.length;
    index++
  ) {
    await dm.send(
      `**السؤال ${index + 1} من ${questions.length}**\n\n${questions[index]}`
    ).catch(() => {});

    const collected =
      await dm.awaitMessages({
        filter:
          message =>
            message.author.id ===
            interaction.user.id,
        max: 1,
        time:
          5 * 60 * 1000
      }).catch(() => null);

    if (
      !collected ||
      collected.size === 0
    ) {
      await dm.send(
        "❌ انتهى وقت الإجابة."
      ).catch(() => {});

      delete sessions[key];

      saveApplicationSessions(
        sessions,
        interaction.guild.id
      );

      return;
    }

    const answer =
      collected.first().content.trim();

    if (
      answer.toLowerCase() ===
      "الغاء"
    ) {
      await dm.send(
        "❌ تم إلغاء التقديم."
      ).catch(() => {});

      delete sessions[key];

      saveApplicationSessions(
        sessions,
        interaction.guild.id
      );

      return;
    }

    answers.push(answer);

    sessions[key].answers =
      answers;

    saveApplicationSessions(
      sessions,
      interaction.guild.id
    );
  }

  const applications =
    getApplications(
      interaction.guild.id
    );

  if (
    !applications[
      interaction.guild.id
    ]
  ) {
    applications[
      interaction.guild.id
    ] = {};
  }

  if (
    !applications[
      interaction.guild.id
    ].counter
  ) {
    applications[
      interaction.guild.id
    ].counter = 0;
  }

  applications[
    interaction.guild.id
  ].counter++;

  const applicationId =
    applications[
      interaction.guild.id
    ].counter;

  if (
    !applications[
      interaction.guild.id
    ].records
  ) {
    applications[
      interaction.guild.id
    ].records = {};
  }

  applications[
    interaction.guild.id
  ].records[
    applicationId
  ] = {
    id: applicationId,
    guildId:
      interaction.guild.id,
    userId:
      interaction.user.id,
    username:
      interaction.user.tag,
    answers,
    status: "pending",
    createdAt:
      Date.now()
  };

  saveApplications(
    applications,
    interaction.guild.id
  );

  delete sessions[key];

  saveApplicationSessions(
    sessions,
    interaction.guild.id
  );

  const reviewChannel =
    interaction.guild.channels.cache.get(
      config.reviewChannelId
    );

  if (!reviewChannel) {
    await dm.send(
      "❌ روم المراجعة غير موجود."
    ).catch(() => {});
    return;
  }

  const embed =
    new EmbedBuilder()
      .setTitle(
        `📋 تقديم جديد #${applicationId}`
      )
      .setDescription(
        `👤 المتقدم: ${interaction.user}\n` +
        `🆔 الآيدي: \`${interaction.user.id}\`\n\n` +
        `⏳ الحالة: **قيد المراجعة**`
      )
      .setColor(
        validColor(config.color)
      )
      .setThumbnail(
        interaction.user.displayAvatarURL({
          dynamic: true
        })
      )
      .setTimestamp();

  for (
    let i = 0;
    i < questions.length;
    i++
  ) {
    embed.addFields({
      name:
        `${i + 1}️⃣ ${truncate(
          questions[i],
          240
        )}`,
      value:
        truncate(
          answers[i] ||
          "لم تتم الإجابة",
          1024
        ),
      inline: false
    });
  }

  const buttons =
    new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setCustomId(
            `قبول_تقديم_${applicationId}`
          )
          .setLabel("قبول")
          .setEmoji("✅")
          .setStyle(
            ButtonStyle.Success
          ),

        new ButtonBuilder()
          .setCustomId(
            `رفض_تقديم_${applicationId}`
          )
          .setLabel("رفض")
          .setEmoji("❌")
          .setStyle(
            ButtonStyle.Danger
          )
      );

  await reviewChannel.send({
    embeds: [embed],
    components: [buttons]
  });

  await dm.send(
    `✅ تم إرسال تقديمك بنجاح.\n\n` +
    `🔢 رقم التقديم: **#${applicationId}**\n` +
    `⏳ الحالة: **قيد المراجعة**`
  ).catch(() => {});

  await sendLog(
    interaction.guild,
    "applications",
    logEmbed(
      "📝 تقديم جديد",
      "#5865F2"
    ).addFields(
      {
        name: "👤 المتقدم",
        value:
          `${interaction.user}`,
        inline: true
      },
      {
        name: "🔢 رقم التقديم",
        value:
          `#${applicationId}`,
        inline: true
      }
    )
  );
}

// ==================================================
// READY
// ==================================================

client.once(
  "ready",
  async () => {
    console.log(
      `✅ تم تسجيل الدخول باسم ${client.user.tag}`
    );

    for (
      const guild
      of client.guilds.cache.values()
    ) {
      await initializeData(
        guild
      );

      await getDataChannel(
        guild
      );

      await getOrCreateLogSystem(
        guild
      );
    }

    await registerCommands();

    console.log(
      "💾 تم تحميل جميع البيانات من Discord"
    );

    console.log(
      "📚 تم تجهيز نظام اللوقات"
    );

    console.log(
      `🔐 روم البيانات: ${DATA_CHANNEL_NAME}`
    );
  }
);

// ==================================================
// INTERACTIONS
// ==================================================

client.on(
  "interactionCreate",
  async interaction => {

    // ==================================================
    // الأزرار
    // ==================================================

    if (interaction.isButton()) {

      // ==================================================
      // فتح تذكرة
      // ==================================================

      if (
        interaction.customId ===
        "فتح_تذكرة"
      ) {
        const existing =
          findOpenTicket(
            interaction.guild,
            interaction.user.id
          );

        if (existing) {
          return interaction.reply({
            content:
              `❌ عندك تذكرة مفتوحة بالفعل: ${existing}`,
            ephemeral: true
          });
        }

        const number =
          getNextTicketNumber(
            interaction.guild.id
          );

        const username =
          interaction.user.username
            .toLowerCase()
            .replace(
              /[^a-z0-9-_]/g,
              ""
            )
            .slice(0, 20) ||
          "عضو";

        const channel =
          await interaction.guild.channels.create({
            name:
              `تذكرة-${number}-${username}`,

            type:
              ChannelType.GuildText,

            topic:
              `ticketOwner:${interaction.user.id}|ticketNumber:${number}|ticketType:none`,

            permissionOverwrites: [
              {
                id:
                  interaction.guild.roles.everyone.id,
                deny: [
                  PermissionFlagsBits.ViewChannel
                ]
              },
              {
                id:
                  interaction.user.id,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              },
              {
                id:
                  TICKET_STAFF_ROLE_ID,
                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              }
            ]
          })
          .catch(() => null);

        if (!channel) {
          return interaction.reply({
            content:
              "❌ ما قدرت أنشئ التذكرة.",
            ephemeral: true
          });
        }

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "🎫 مرحبًا بك في تذكرتك"
              )
              .setDescription(
                `أهلًا ${interaction.user}\n\nاختر نوع التكت المناسب لك.`
              )
              .setColor("Blue")
              .setTimestamp()
          ],
          components: [
            ticketTypeRow()
          ]
        });

        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "🔒 إغلاق التذكرة"
              )
              .setDescription(
                "بعد الانتهاء اضغط على زر إغلاق التذكرة."
              )
              .setColor("Red")
              .setTimestamp()
          ],
          components: [
            ticketCloseRow()
          ]
        });

        await sendLog(
          interaction.guild,
          "tickets",
          logEmbed(
            "🎫 فتح تذكرة",
            "Green"
          ).addFields(
            {
              name: "👤 العضو",
              value:
                `${interaction.user}`,
              inline: true
            },
            {
              name: "🔢 الرقم",
              value:
                `${number}`,
              inline: true
            },
            {
              name: "📁 الروم",
              value:
                `${channel}`,
              inline: true
            }
          )
        );

        const fixedLog =
          interaction.guild.channels.cache.get(
            FIXED_TICKET_LOG_ID
          );

        if (
          fixedLog &&
          fixedLog.isTextBased()
        ) {
          await fixedLog.send({
            embeds: [
              logEmbed(
                "🎫 فتح تذكرة",
                "Green"
              ).addFields(
                {
                  name: "👤 العضو",
                  value:
                    `${interaction.user}`,
                    inline: true
                },
                {
                  name: "📁 الروم",
                  value:
                    `${channel}`,
                    inline: true
                }
              )
            ]
          }).catch(() => {});
        }

        return interaction.reply({
          content:
            `✅ تم إنشاء تذكرتك: ${channel}`,
          ephemeral: true
        });
      }

      // ==================================================
      // أنواع التذاكر
      // ==================================================

      const ticketTypes = {
        "نوع_تذكرة_شكوى": {
          name: "شكوى",
          form: complaintForm()
        },

        "نوع_تذكرة_دعم": {
          name: "دعم فني",
          form: supportForm()
        },

        "نوع_تذكرة_شراكة": {
          name: "شراكة",
          form: partnershipForm()
        }
      };

      if (
        ticketTypes[
          interaction.customId
        ]
      ) {
        const owner =
          interaction.channel.topic?.match(
            /ticketOwner:(\d+)/
          )?.[1];

        if (
          owner !==
          interaction.user.id
        ) {
          return interaction.reply({
            content:
              "❌ فقط صاحب التذكرة يحدد نوعها.",
            ephemeral: true
          });
        }

        const type =
          ticketTypes[
            interaction.customId
          ];

        const topic =
          interaction.channel.topic
            .replace(
              "ticketType:none",
              `ticketType:${type.name}`
            );

        await interaction.channel.setTopic(
          topic
        );

        await interaction.update({
          components: [
            ticketTypeRow(true)
          ]
        });

        await interaction.channel.send({
          content:
            type.form,
          allowedMentions: {
            roles: [
              TICKET_STAFF_ROLE_ID
            ]
          }
        });

        return;
      }

      // ==================================================
      // إغلاق التذكرة
      // ==================================================

      if (
        interaction.customId ===
        "اغلاق_تذكرة"
      ) {
        const owner =
          interaction.channel.topic?.match(
            /ticketOwner:(\d+)/
          )?.[1];

        const number =
          interaction.channel.topic?.match(
            /ticketNumber:(\d+)/
          )?.[1] ||
          "غير معروف";

        const type =
          interaction.channel.topic?.match(
            /ticketType:([^|]+)/
          )?.[1] ||
          "غير محدد";

        if (
          interaction.user.id !== owner &&
          !isTicketStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ ما عندك صلاحية.",
            ephemeral: true
          });
        }

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "🔒 إغلاق التذكرة"
              )
              .setDescription(
                "سيتم حذف التذكرة خلال **5 ثواني**."
              )
              .setColor("Red")
          ]
        });

        await sendLog(
          interaction.guild,
          "tickets",
          logEmbed(
            "🔒 إغلاق تذكرة",
            "Red"
          ).addFields(
            {
              name: "👤 صاحب التذكرة",
              value:
                `<@${owner}>`,
              inline: true
            },
            {
              name: "🔢 الرقم",
              value:
                number,
              inline: true
            },
            {
              name: "📌 النوع",
              value:
                type,
              inline: true
            },
            {
              name: "👮 أغلقها",
              value:
                `${interaction.user}`,
              inline: true
            }
          )
        );

        setTimeout(() => {
          interaction.channel
            .delete()
            .catch(() => {});
        }, 5000);

        return;
      }

      // ==================================================
      // بدء التقديم
      // ==================================================

      if (
        interaction.customId ===
        "بدء_التقديم"
      ) {
        return startApplication(
          interaction
        );
      }

      // ==================================================
      // قبول التقديم
      // ==================================================

      if (
        interaction.customId.startsWith(
          "قبول_تقديم_"
        )
      ) {
        if (
          !isStaff(
            interaction.member
          ) &&
          !isTicketStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ ما عندك صلاحية.",
            ephemeral: true
          });
        }

        const id =
          interaction.customId.replace(
            "قبول_تقديم_",
            ""
          );

        const data =
          getApplications(
            interaction.guild.id
          );

        const record =
          data[
            interaction.guild.id
          ]?.records?.[id];

        if (!record) {
          return interaction.reply({
            content:
              "❌ التقديم غير موجود.",
            ephemeral: true
          });
        }

        if (
          record.status !==
          "pending"
        ) {
          return interaction.reply({
            content:
              "❌ تم اتخاذ قرار مسبقًا.",
            ephemeral: true
          });
        }

        const member =
          await interaction.guild.members
            .fetch(
              record.userId
            )
            .catch(() => null);

        if (!member) {
          return interaction.reply({
            content:
              "❌ العضو غير موجود.",
            ephemeral: true
          });
        }

        const config =
          getApplicationConfig(
            interaction.guild.id
          );

        if (
          config.removeRoleId
        ) {
          await member.roles
            .remove(
              config.removeRoleId
            )
            .catch(() => {});
        }

        if (
          config.acceptRoleId
        ) {
          await member.roles
            .add(
              config.acceptRoleId
            )
            .catch(() => {});
        }

        record.status =
          "accepted";

        record.reviewedBy =
          interaction.user.id;

        record.reviewedAt =
          Date.now();

        saveApplications(
          data,
          interaction.guild.id
        );

        const disabled =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `accepted_${id}`
                )
                .setLabel(
                  "تم القبول"
                )
                .setEmoji("✅")
                .setStyle(
                  ButtonStyle.Success
                )
                .setDisabled(true),

              new ButtonBuilder()
                .setCustomId(
                  `rejected_${id}`
                )
                .setLabel("رفض")
                .setEmoji("❌")
                .setStyle(
                  ButtonStyle.Danger
                )
                .setDisabled(true)
            );

        await interaction.message
          .edit({
            components: [
              disabled
            ]
          })
          .catch(() => {});

        await member.send(
          `🎉 **تم قبول تقديمك في ${interaction.guild.name}!**`
        ).catch(() => {});

        await interaction.reply({
          content:
            `✅ تم قبول التقديم #${id}.`,
          ephemeral: true
        });

        return;
      }

      // ==================================================
      // رفض التقديم
      // ==================================================

      if (
        interaction.customId.startsWith(
          "رفض_تقديم_"
        )
      ) {
        if (
          !isStaff(
            interaction.member
          ) &&
          !isTicketStaff(
            interaction.member
          )
        ) {
          return interaction.reply({
            content:
              "❌ ما عندك صلاحية.",
            ephemeral: true
          });
        }

        const id =
          interaction.customId.replace(
            "رفض_تقديم_",
            ""
          );

        const data =
          getApplications(
            interaction.guild.id
          );

        const record =
          data[
            interaction.guild.id
          ]?.records?.[id];

        if (!record) {
          return interaction.reply({
            content:
              "❌ التقديم غير موجود.",
            ephemeral: true
          });
        }

        if (
          record.status !==
          "pending"
        ) {
          return interaction.reply({
            content:
              "❌ تم اتخاذ قرار مسبقًا.",
            ephemeral: true
          });
        }

        record.status =
          "rejected";

        record.reviewedBy =
          interaction.user.id;

        record.reviewedAt =
          Date.now();

        saveApplications(
          data,
          interaction.guild.id
        );

        const disabled =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `accepted_${id}`
                )
                .setLabel("قبول")
                .setEmoji("✅")
                .setStyle(
                  ButtonStyle.Success
                )
                .setDisabled(true),

              new ButtonBuilder()
                .setCustomId(
                  `rejected_${id}`
                )
                .setLabel(
                  "تم الرفض"
                )
                .setEmoji("❌")
                .setStyle(
                  ButtonStyle.Danger
                )
                .setDisabled(true)
            );

        await interaction.message
          .edit({
            components: [
              disabled
            ]
          })
          .catch(() => {});

        const user =
          await client.users
            .fetch(
              record.userId
            )
            .catch(() => null);

        if (user) {
          await user.send(
            `❌ **تم رفض تقديمك في ${interaction.guild.name}.**`
          ).catch(() => {});
        }

        return interaction.reply({
          content:
            `❌ تم رفض التقديم #${id}.`,
          ephemeral: true
        });
      }

      // ==================================================
      // العداد
      // ==================================================

      if (
        interaction.customId.startsWith(
          "عداد_"
        )
      ) {
        const id =
          interaction.customId.replace(
            "عداد_",
            ""
          );

        const counters =
          getCounters(
            interaction.guild.id
          );

        const counter =
          counters[id];

        if (!counter) {
          return interaction.reply({
            content:
              "❌ العداد غير موجود.",
            ephemeral: true
          });
        }

        if (!counter.users) {
          counter.users = [];
        }

        if (
          counter.users.includes(
            interaction.user.id
          )
        ) {
          return interaction.reply({
            content:
              "❌ سبق وصوت.",
            ephemeral: true
          });
        }

        counter.users.push(
          interaction.user.id
        );

        counter.count++;

        saveCounters(
          counters,
          interaction.guild.id
        );

        await interaction.update({
          components: [
            new ActionRowBuilder()
              .addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    `عداد_${id}`
                  )
                  .setLabel(
                    `${counter.count}`
                  )
                  .setEmoji("🔢")
                  .setStyle(
                    ButtonStyle.Primary
                  )
              )
          ]
        });

        return;
      }
    }

    // ==================================================
    // أوامر السلاش
    // ==================================================

    if (
      !interaction.isChatInputCommand()
    ) {
      return;
    }

    // ==================================================
    // إعطاء رتبة
    // ==================================================

    if (
      interaction.commandName ===
      "اعطاء-رتبة"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const member =
        await interaction.guild.members.fetch(
          interaction.options.getUser(
            "العضو"
          ).id
        );

      const roles = [];

      const main =
        interaction.options.getRole(
          "الرتبة-الأساسية"
        );

      if (main) {
        roles.push(main);
      }

      for (let i = 1; i <= 19; i++) {
        const role =
          interaction.options.getRole(
            `رتبة-جانبية-${i}`
          );

        if (role) {
          roles.push(role);
        }
      }

      let count = 0;

      for (const role of roles) {
        if (
          role.position >=
          interaction.guild.members.me.roles.highest.position
        ) {
          continue;
        }

        await member.roles
          .add(role)
          .then(() => count++)
          .catch(() => {});
      }

      return interaction.reply({
        content:
          `✅ تم إعطاء ${count} رتبة.`,
        ephemeral: true
      });
    }

    // ==================================================
    // إزالة رتبة
    // ==================================================

    if (
      interaction.commandName ===
      "ازالة-رتبة"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const member =
        await interaction.guild.members.fetch(
          interaction.options.getUser(
            "العضو"
          ).id
        );

      const roles = [];

      const main =
        interaction.options.getRole(
          "الرتبة-الأساسية"
        );

      if (main) {
        roles.push(main);
      }

      for (let i = 1; i <= 19; i++) {
        const role =
          interaction.options.getRole(
            `رتبة-جانبية-${i}`
          );

        if (role) {
          roles.push(role);
        }
      }

      let count = 0;

      for (const role of roles) {
        if (
          role.position >=
          interaction.guild.members.me.roles.highest.position
        ) {
          continue;
        }

        if (
          !member.roles.cache.has(
            role.id
          )
        ) {
          continue;
        }

        await member.roles
          .remove(role)
          .then(() => count++)
          .catch(() => {});
      }

      return interaction.reply({
        content:
          `✅ تم إزالة ${count} رتبة.`,
        ephemeral: true
      });
    }

    // ==================================================
    // تحذير
    // ==================================================

    if (
      interaction.commandName ===
      "تحذير"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser(
          "العضو"
        );

      const reason =
        interaction.options.getString(
          "السبب"
        ) ||
        "لم يتم تحديد سبب";

      const warnings =
        getWarnings(
          interaction.guild.id
        );

      if (
        !warnings[
          interaction.guild.id
        ]
      ) {
        warnings[
          interaction.guild.id
        ] = {};
      }

      if (
        !warnings[
          interaction.guild.id
        ][user.id]
      ) {
        warnings[
          interaction.guild.id
        ][user.id] = 0;
      }

      warnings[
        interaction.guild.id
      ][user.id]++;

      const count =
        warnings[
          interaction.guild.id
        ][user.id];

      saveWarnings(
        warnings,
        interaction.guild.id
      );

      await user.send({
        embeds: [
          logEmbed(
            "⚠️ تم تحذيرك",
            "Red"
          )
            .setDescription(
              `تم تحذيرك في **${interaction.guild.name}**`
            )
            .addFields(
              {
                name: "📌 السبب",
                value: reason
              },
              {
                name: "🔢 عدد التحذيرات",
                value: `${count}`
              }
            )
        ]
      }).catch(() => {});

      return interaction.reply({
        content:
          `✅ تم تحذير ${user}.`,
        ephemeral: true
      });
    }

    // ==================================================
    // مسج الرتبة
    // ==================================================

    if (
      interaction.commandName ===
      "مسج-الرتبة"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const role =
        interaction.options.getRole(
          "الرتبة"
        );

      const text =
        interaction.options.getString(
          "الرسالة"
        );

      let sent = 0;

      for (
        const member
        of role.members.values()
      ) {
        await member.send(text)
          .then(() => sent++)
          .catch(() => {});
      }

      return interaction.reply({
        content:
          `✅ تم الإرسال إلى ${sent} عضو.`,
        ephemeral: true
      });
    }

    // ==================================================
    // إرسال ايمبد
    // ==================================================

    if (
      interaction.commandName ===
      "ارسال-ايمبد"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const channel =
        interaction.options.getChannel(
          "الروم"
        );

      const text =
        interaction.options.getString(
          "النص"
        );

      const title =
        interaction.options.getString(
          "العنوان"
        );

      const embed =
        new EmbedBuilder()
          .setDescription(text)
          .setColor("Blue")
          .setTimestamp();

      if (title) {
        embed.setTitle(title);
      }

      await channel.send({
        embeds: [embed]
      });

      return interaction.reply({
        content:
          "✅ تم إرسال الايمبد.",
        ephemeral: true
      });
    }

    // ==================================================
    // إعلان
    // ==================================================

    if (
      interaction.commandName ===
      "ارسال-اعلان"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const channel =
        interaction.options.getChannel(
          "الروم"
        );

      const text =
        interaction.options.getString(
          "الرسالة"
        );

      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle("📢 إعلان")
            .setDescription(text)
            .setColor("Gold")
            .setTimestamp()
        ]
      });

      return interaction.reply({
        content:
          "✅ تم إرسال الإعلان.",
        ephemeral: true
      });
    }

    // ==================================================
    // زر عداد
    // ==================================================

    if (
      interaction.commandName ===
      "زر-عداد"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const channel =
        interaction.options.getChannel(
          "الروم"
        );

      const text =
        interaction.options.getString(
          "الرسالة"
        );

      const id =
        `${interaction.guild.id}_${Date.now()}`;

      const counters =
        getCounters(
          interaction.guild.id
        );

      counters[id] = {
        count: 0,
        users: []
      };

      saveCounters(
        counters,
        interaction.guild.id
      );

      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setDescription(text)
            .setColor("Blue")
        ],
        components: [
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  `عداد_${id}`
                )
                .setLabel("0")
                .setEmoji("🔢")
                .setStyle(
                  ButtonStyle.Primary
                )
            )
        ]
      });

      return interaction.reply({
        content:
          "✅ تم إنشاء العداد.",
        ephemeral: true
      });
    }

    // ==================================================
    // حذف رسائل
    // ==================================================

    if (
      interaction.commandName ===
      "حذف-رسائل"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      let amount =
        interaction.options.getInteger(
          "العدد"
        );

      await interaction.deferReply({
        ephemeral: true
      });

      let deleted = 0;

      while (amount > 0) {
        const batch =
          Math.min(
            amount,
            100
          );

        const messages =
          await interaction.channel.bulkDelete(
            batch,
            true
          ).catch(() => null);

        if (!messages) break;

        deleted +=
          messages.size;

        amount -=
          messages.size;

        if (
          messages.size < batch
        ) {
          break;
        }
      }

      return interaction.editReply(
        `✅ تم حذف **${deleted}** رسالة.`
      );
    }

    // ==================================================
    // إضافة رد
    // ==================================================

    if (
      interaction.commandName ===
      "اضافة-رد"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const word =
        interaction.options
          .getString(
            "الكلمة"
          )
          .toLowerCase();

      const reply =
        interaction.options.getString(
          "الرد"
        );

      const data =
        getAutoReplies(
          interaction.guild.id
        );

      data[word] =
        reply;

      saveAutoReplies(
        data,
        interaction.guild.id
      );

      return interaction.reply({
        content:
          `✅ تم إضافة الرد للكلمة **${word}** وحفظه.`,
        ephemeral: true
      });
    }

    // ==================================================
    // تعديل رد
    // ==================================================

    if (
      interaction.commandName ===
      "تعديل-رد"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const word =
        interaction.options
          .getString(
            "الكلمة"
          )
          .toLowerCase();

      const reply =
        interaction.options.getString(
          "الرد"
        );

      const data =
        getAutoReplies(
          interaction.guild.id
        );

      if (!data[word]) {
        return interaction.reply({
          content:
            "❌ الكلمة غير موجودة.",
          ephemeral: true
        });
      }

      data[word] =
        reply;

      saveAutoReplies(
        data,
        interaction.guild.id
      );

      return interaction.reply({
        content:
          "✅ تم تعديل الرد وحفظه.",
        ephemeral: true
      });
    }

    // ==================================================
    // حذف رد
    // ==================================================

    if (
      interaction.commandName ===
      "حذف-رد"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const word =
        interaction.options
          .getString(
            "الكلمة"
          )
          .toLowerCase();

      const data =
        getAutoReplies(
          interaction.guild.id
        );

      if (!data[word]) {
        return interaction.reply({
          content:
            "❌ الكلمة غير موجودة.",
          ephemeral: true
        });
      }

      delete data[word];

      saveAutoReplies(
        data,
        interaction.guild.id
      );

      return interaction.reply({
        content:
          "✅ تم حذف الرد وحفظ التعديل.",
        ephemeral: true
      });
    }

    // ==================================================
    // قائمة الردود
    // ==================================================

    if (
      interaction.commandName ===
      "قائمة-الردود"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const data =
        getAutoReplies(
          interaction.guild.id
        );

      const keys =
        Object.keys(data);

      if (!keys.length) {
        return interaction.reply({
          content:
            "❌ ما فيه ردود.",
          ephemeral: true
        });
      }

      const text =
        keys.map(
          (key, i) =>
            `**${i + 1}.** ${key} → ${data[key]}`
        ).join("\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "📋 الردود"
            )
            .setDescription(
              truncate(
                text,
                4000
              )
            )
            .setColor(
              "Blue"
            )
        ],
        ephemeral: true
      });
    }

    // ==================================================
    // مستواي
    // ==================================================

    if (
      interaction.commandName ===
      "مستواي"
    ) {
      const user =
        interaction.options.getUser(
          "العضو"
        ) ||
        interaction.user;

      const levels =
        getLevels(
          interaction.guild.id
        );

      const data =
        levels[
          interaction.guild.id
        ]?.[user.id] || {
          level: 1,
          xp: 0
        };

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "📊 مستوى العضو"
            )
            .setDescription(
              `${user}\n\n🏆 المستوى: **${data.level}**\n⭐ XP: **${data.xp}**`
            )
            .setThumbnail(
              user.displayAvatarURL({
                dynamic: true
              })
            )
            .setColor(
              "Gold"
            )
        ]
      });
    }

    // ==================================================
    // المتصدرين
    // ==================================================

    if (
      interaction.commandName ===
      "المتصدرين"
    ) {
      const levels =
        getLevels(
          interaction.guild.id
        );

      const data =
        levels[
          interaction.guild.id
        ] || {};

      const sorted =
        Object.entries(data)
          .sort(
            (a, b) =>
              (
                b[1].level * 100 +
                b[1].xp
              ) -
              (
                a[1].level * 100 +
                a[1].xp
              )
          )
          .slice(0, 10);

      if (!sorted.length) {
        return interaction.reply(
          "❌ لا توجد بيانات."
        );
      }

      const text =
        sorted.map(
          ([id, value], i) =>
            `**${i + 1}.** <@${id}> — مستوى **${value.level}** | XP **${value.xp}**`
        ).join("\n");

      return interaction.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "🏆 المتصدرين"
            )
            .setDescription(
              text
            )
            .setColor(
              "Gold"
            )
        ]
      });
    }

    // ==================================================
    // تعديل مستوى
    // ==================================================

    if (
      interaction.commandName ===
      "تعديل-مستوى"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const user =
        interaction.options.getUser(
          "العضو"
        );

      const level =
        interaction.options.getInteger(
          "المستوى"
        );

      const xp =
        interaction.options.getInteger(
          "xp"
        ) || 0;

      const data =
        getLevels(
          interaction.guild.id
        );

      if (
        !data[
          interaction.guild.id
        ]
      ) {
        data[
          interaction.guild.id
        ] = {};
      }

      data[
        interaction.guild.id
      ][user.id] = {
        level,
        xp
      };

      saveLevels(
        data,
        interaction.guild.id
      );

      return interaction.reply({
        content:
          `✅ تم تعديل مستوى ${user} وحفظه.`,
        ephemeral: true
      });
    }

    // ==================================================
    // تحديد روم الفل
    // ==================================================

    if (
      interaction.commandName ===
      "تحديد-روم-الفل"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const channel =
        interaction.options.getChannel(
          "الروم"
        );

      const data =
        getLevelUpChannels(
          interaction.guild.id
        );

      data[
        interaction.guild.id
      ] =
        channel.id;

      saveLevelUpChannels(
        data,
        interaction.guild.id
      );

      return interaction.reply({
        content:
          `✅ تم تحديد ${channel} وحفظ الإعداد.`,
        ephemeral: true
      });
    }

    // ==================================================
    // لوحة التذاكر
    // ==================================================

    if (
      interaction.commandName ===
      "لوحة-تذاكر"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const channel =
        interaction.options.getChannel(
          "الروم"
        );

      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(
              "🎫 نظام التذاكر"
            )
            .setDescription(
              "اضغط على الزر بالأسفل لفتح تذكرة."
            )
            .setColor(
              "Blue"
            )
        ],
        components: [
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "فتح_تذكرة"
                )
                .setLabel(
                  "فتح تذكرة"
                )
                .setEmoji("🎫")
                .setStyle(
                  ButtonStyle.Primary
                )
            )
        ]
      });

      return interaction.reply({
        content:
          "✅ تم إرسال لوحة التذاكر.",
        ephemeral: true
      });
    }

    // ==================================================
    // تسطيب التقديم
    // ==================================================

    if (
      interaction.commandName ===
      "تسطيب-تقديم"
    ) {
      if (
        !isStaff(
          interaction.member
        ) &&
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content:
            "❌ تحتاج صلاحية إدارة السيرفر.",
          ephemeral: true
        });
      }

      const applicationChannel =
        interaction.options.getChannel(
          "مكان-التقديم"
        );

      const reviewChannel =
        interaction.options.getChannel(
          "مكان-المراجعة"
        );

      const acceptRole =
        interaction.options.getRole(
          "رتبة-القبول"
        );

      const removeRole =
        interaction.options.getRole(
          "رتبة-الإزالة"
        );

      const color =
        interaction.options.getString(
          "لون-الإيمبد"
        );

      const config =
        getApplicationConfig(
          interaction.guild.id
        ) || {};

      config.channelId =
        applicationChannel.id;

      config.reviewChannelId =
        reviewChannel.id;

      config.acceptRoleId =
        acceptRole?.id ||
        null;

      config.removeRoleId =
        removeRole?.id ||
        null;

      if (color) {
        config.color =
          validColor(color);
      }

      for (let i = 1; i <= 20; i++) {
        const question =
          interaction.options.getString(
            `سؤال-${i}`
          );

        if (question !== null) {
          config[
            `question${i}`
          ] =
            question;
        }
      }

      saveApplicationConfig(
        interaction.guild.id,
        config
      );

      await applicationChannel.send(
        buildApplicationPanel(
          config
        )
      );

      return interaction.reply({
        content:
          "✅ تم تسطيب نظام التقديم وحفظ جميع إعداداته.",
        ephemeral: true
      });
    }

    // ==================================================
    // تعديل التقديم
    // ==================================================

    if (
      interaction.commandName ===
      "تعديل-تقديم"
    ) {
      if (
        !isStaff(
          interaction.member
        ) &&
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        )
      ) {
        return interaction.reply({
          content:
            "❌ تحتاج صلاحية إدارة السيرفر.",
          ephemeral: true
        });
      }

      const config =
        getApplicationConfig(
          interaction.guild.id
        );

      if (!config) {
        return interaction.reply({
          content:
            "❌ سطّب نظام التقديم أولًا.",
          ephemeral: true
        });
      }

      const title =
        interaction.options.getString(
          "العنوان"
        );

      const description =
        interaction.options.getString(
          "الوصف"
        );

      const color =
        interaction.options.getString(
          "اللون"
        );

      const buttonLabel =
        interaction.options.getString(
          "نص-الزر"
        );

      if (title !== null) {
        config.title =
          title;
      }

      if (description !== null) {
        config.description =
          description;
      }

      if (color !== null) {
        config.color =
          validColor(color);
      }

      if (buttonLabel !== null) {
        config.buttonLabel =
          buttonLabel;
      }

      saveApplicationConfig(
        interaction.guild.id,
        config
      );

      const channel =
        interaction.guild.channels.cache.get(
          config.channelId
        );

      if (!channel) {
        return interaction.reply({
          content:
            "❌ روم التقديم غير موجود.",
          ephemeral: true
        });
      }

      await channel.send(
        buildApplicationPanel(
          config
        )
      );

      return interaction.reply({
        content:
          "✅ تم تعديل وحفظ إعدادات التقديم.",
        ephemeral: true
      });
    }

    // ==================================================
    // لوحة تقديم
    // ==================================================

    if (
      interaction.commandName ===
      "لوحة-تقديم"
    ) {
      if (
        !isStaff(
          interaction.member
        )
      ) {
        return interaction.reply({
          content:
            "❌ ما عندك صلاحية.",
          ephemeral: true
        });
      }

      const config =
        getApplicationConfig(
          interaction.guild.id
        );

      if (!config) {
        return interaction.reply({
          content:
            "❌ نظام التقديم غير مسطب.",
          ephemeral: true
        });
      }

      const channel =
        interaction.guild.channels.cache.get(
          config.channelId
        );

      if (!channel) {
        return interaction.reply({
          content:
            "❌ روم التقديم غير موجود.",
          ephemeral: true
        });
      }

      await channel.send(
        buildApplicationPanel(
          config
        )
      );

      return interaction.reply({
        content:
          "✅ تم إرسال لوحة التقديم.",
        ephemeral: true
      });
    }
  }
);

// ==================================================
// XP + الردود التلقائية
// ==================================================

const xpCooldown =
  new Map();

client.on(
  "messageCreate",
  async message => {
    if (
      message.author.bot ||
      !message.guild
    ) {
      return;
    }

    // ==================================================
    // الردود التلقائية
    // ==================================================

    const replies =
      getAutoReplies(
        message.guild.id
      );

    const content =
      message.content.toLowerCase();

    for (
      const word
      of Object.keys(replies)
    ) {
      if (
        content.includes(
          word.toLowerCase()
        )
      ) {
        await message.reply({
          content:
            replies[word]
        }).catch(() => {});

        break;
      }
    }

    // ==================================================
    // XP
    // ==================================================

    const key =
      `${message.guild.id}_${message.author.id}`;

    const now =
      Date.now();

    const last =
      xpCooldown.get(key) ||
      0;

    if (
      now - last <
      60 * 1000
    ) {
      return;
    }

    xpCooldown.set(
      key,
      now
    );

    const levels =
      getLevels(
        message.guild.id
      );

    if (
      !levels[
        message.guild.id
      ]
    ) {
      levels[
        message.guild.id
      ] = {};
    }

    if (
      !levels[
        message.guild.id
      ][message.author.id]
    ) {
      levels[
        message.guild.id
      ][message.author.id] = {
        level: 1,
        xp: 0
      };
    }

    const data =
      levels[
        message.guild.id
      ][message.author.id];

    const oldLevel =
      data.level;

    data.xp +=
      Math.floor(
        Math.random() * 11
      ) + 15;

    while (
      data.xp >=
      data.level * 100
    ) {
      data.xp -=
        data.level * 100;

      data.level++;
    }

    saveLevels(
      levels,
      message.guild.id
    );

    if (
      data.level >
      oldLevel
    ) {
      const channels =
        getLevelUpChannels(
          message.guild.id
        );

      const channel =
        message.guild.channels.cache.get(
          channels[
            message.guild.id
          ]
        );

      if (channel) {
        await channel.send({
          embeds: [
            new EmbedBuilder()
              .setTitle(
                "🎉 ترقية مستوى"
              )
              .setDescription(
                `مبروك ${message.author}!\n\n🏆 وصلت إلى المستوى **${data.level}**`
              )
              .setThumbnail(
                message.author.displayAvatarURL({
                  dynamic: true
                })
              )
              .setColor(
                "Gold"
              )
          ]
        }).catch(() => {});
      }
    }
  }
);

// ==================================================
// لوق الأعضاء
// ==================================================

client.on(
  "guildMemberAdd",
  async member => {
    await sendLog(
      member.guild,
      "members",
      logEmbed(
        "📥 دخول عضو",
        "Green"
      ).addFields(
        {
          name: "👤 العضو",
          value:
            `${member}`,
          inline: true
        },
        {
          name: "🆔 الآيدي",
          value:
            member.id,
          inline: true
        },
        {
          name: "👥 الأعضاء",
          value:
            `${member.guild.memberCount}`,
          inline: true
        }
      )
    );
  }
);

client.on(
  "guildMemberRemove",
  async member => {
    await sendLog(
      member.guild,
      "members",
      logEmbed(
        "📤 خروج عضو",
        "Red"
      ).addFields(
        {
          name: "👤 العضو",
          value:
            `${member.user?.tag || member.id}`,
          inline: true
        },
        {
          name: "🆔 الآيدي",
          value:
            member.id,
          inline: true
        }
      )
    );
  }
);

// ==================================================
// لوق الرتب
// ==================================================

client.on(
  "guildMemberUpdate",
  async (
    oldMember,
    newMember
  ) => {
    const oldRoles =
      oldMember.roles.cache;

    const newRoles =
      newMember.roles.cache;

    const added =
      newRoles.filter(
        role =>
          !oldRoles.has(
            role.id
          )
      );

    const removed =
      oldRoles.filter(
        role =>
          !newRoles.has(
            role.id
          )
      );

    if (
      added.size ||
      removed.size
    ) {
      const embed =
        logEmbed(
          "🏷️ تغيير رتب عضو",
          "Blue"
        ).addFields({
          name: "👤 العضو",
          value:
            `${newMember}`,
          inline: true
        });

      if (added.size) {
        embed.addFields({
          name:
            "🟢 تمت الإضافة",
          value:
            added.map(
              r => `${r}`
            ).join(", ")
        });
      }

      if (removed.size) {
        embed.addFields({
          name:
            "🔴 تمت الإزالة",
          value:
            removed.map(
              r => `${r}`
            ).join(", ")
        });
      }

      await sendLog(
        newMember.guild,
        "roles",
        embed
      );
    }
  }
);

// ==================================================
// لوق الرومات
// ==================================================

client.on(
  "channelCreate",
  async channel => {
    if (!channel.guild) {
      return;
    }

    // روم البيانات لا نحتاج نسجل رسائله
    if (
      channel.name ===
      DATA_CHANNEL_NAME
    ) {
      return;
    }

    await sendLog(
      channel.guild,
      "channels",
      logEmbed(
        "📁 إنشاء روم",
        "Green"
      ).addFields(
        {
          name: "📁 الروم",
          value:
            `${channel}`,
          inline: true
        },
        {
          name: "🆔 الآيدي",
          value:
            channel.id,
          inline: true
        }
      )
    );
  }
);

client.on(
  "channelDelete",
  async channel => {
    if (!channel.guild) {
      return;
    }

    await sendLog(
      channel.guild,
      "channels",
      logEmbed(
        "🗑️ حذف روم",
        "Red"
      ).addFields(
        {
          name: "📁 الاسم",
          value:
            channel.name ||
            "غير معروف",
          inline: true
        },
        {
          name: "🆔 الآيدي",
          value:
            channel.id,
          inline: true
        }
      )
    );
  }
);

// ==================================================
// لوق الرسائل
// ==================================================

client.on(
  "messageDelete",
  async message => {
    if (
      !message.guild ||
      message.author?.bot
    ) {
      return;
    }

    await sendLog(
      message.guild,
      "messages",
      logEmbed(
        "🗑️ حذف رسالة",
        "Red"
      ).addFields(
        {
          name: "👤 العضو",
          value:
            `${message.author || "غير معروف"}`,
          inline: true
        },
        {
          name: "📁 الروم",
          value:
            `${message.channel}`,
          inline: true
        },
        {
          name: "💬 الرسالة",
          value:
            truncate(
              message.content ||
              "لا يوجد محتوى",
              1000
            )
        }
      )
    );
  }
);

client.on(
  "messageUpdate",
  async (
    oldMessage,
    newMessage
  ) => {
    if (
      !oldMessage.guild ||
      oldMessage.author?.bot
    ) {
      return;
    }

    if (
      oldMessage.content ===
      newMessage.content
    ) {
      return;
    }

    await sendLog(
      oldMessage.guild,
      "messages",
      logEmbed(
        "✏️ تعديل رسالة",
        "Orange"
      ).addFields(
        {
          name: "👤 العضو",
          value:
            `${oldMessage.author}`,
          inline: true
        },
        {
          name: "📁 الروم",
          value:
            `${oldMessage.channel}`,
          inline: true
        },
        {
          name: "قبل",
          value:
            truncate(
              oldMessage.content ||
              "فارغ"
            )
        },
        {
          name: "بعد",
          value:
            truncate(
              newMessage.content ||
              "فارغ"
            )
        }
      )
    );
  }
);

// ==================================================
// لوق الصوت
// ==================================================

client.on(
  "voiceStateUpdate",
  async (
    oldState,
    newState
  ) => {
    if (
      oldState.channelId ===
      newState.channelId
    ) {
      return;
    }

    let action =
      "🔊 تغيير الصوت";

    if (
      !oldState.channelId &&
      newState.channelId
    ) {
      action =
        "📥 دخول صوتي";
    }

    if (
      oldState.channelId &&
      !newState.channelId
    ) {
      action =
        "📤 خروج صوتي";
    }

    await sendLog(
      newState.guild,
      "voice",
      logEmbed(
        action,
        "Blue"
      ).addFields(
        {
          name: "👤 العضو",
          value:
            `${newState.member}`,
          inline: true
        },
        {
          name: "قبل",
          value:
            oldState.channel
              ? `${oldState.channel}`
              : "لا يوجد",
          inline: true
        },
        {
          name: "بعد",
          value:
            newState.channel
              ? `${newState.channel}`
              : "لا يوجد",
          inline: true
        }
      )
    );
  }
);

// ==================================================
// البان
// ==================================================

client.on(
  "guildBanAdd",
  async ban => {
    await sendLog(
      ban.guild,
      "moderation",
      logEmbed(
        "🔨 حظر عضو",
        "Red"
      ).addFields(
        {
          name: "👤 العضو",
          value:
            `${ban.user}`,
          inline: true
        },
        {
          name: "🆔 الآيدي",
          value:
            ban.user.id,
          inline: true
        }
      )
    );
  }
);

// ==================================================
// فك البان
// ==================================================

client.on(
  "guildBanRemove",
  async ban => {
    await sendLog(
      ban.guild,
      "moderation",
      logEmbed(
        "🔓 فك حظر عضو",
        "Green"
      ).addFields(
        {
          name: "👤 العضو",
          value:
            `${ban.user}`,
          inline: true
        },
        {
          name: "🆔 الآيدي",
          value:
            ban.user.id,
          inline: true
        }
      )
    );
  }
);

// ==================================================
// تشغيل البوت
// ==================================================

client.login(TOKEN);
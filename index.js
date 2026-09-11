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
  res.send("✅ البوت شغال");
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

// ==================================================
// ملفات البيانات
// ==================================================

const WARN_FILE = "warnings.json";
const COUNTER_FILE = "counters.json";
const AUTOREPLY_FILE = "autoreplies.json";
const LEVELS_FILE = "levels.json";
const LEVELUP_CHANNEL_FILE = "levelupchannel.json";

const APPLICATION_FILE = "applications.json";
const APPLICATION_SESSION_FILE = "application_sessions.json";

// ==================================================
// البوت
// ==================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages
  ]
});

// ==================================================
// JSON
// ==================================================

function loadJSON(file) {
  if (!fs.existsSync(file)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function saveJSON(file, data) {
  fs.writeFileSync(
    file,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

// ==================================================
// صلاحيات الإدارة
// ==================================================

function isStaff(member) {
  if (!member) return false;

  return (
    member.roles.cache.has(STAFF_ROLE_ID) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

function isTicketStaff(member) {
  if (!member) return false;

  return (
    member.roles.cache.has(TICKET_STAFF_ROLE_ID) ||
    member.permissions.has(PermissionFlagsBits.Administrator)
  );
}

// ==================================================
// التحذيرات
// ==================================================

function getWarnings() {
  return loadJSON(WARN_FILE);
}

function saveWarnings(data) {
  saveJSON(WARN_FILE, data);
}

// ==================================================
// الردود التلقائية
// ==================================================

function getAutoReplies() {
  return loadJSON(AUTOREPLY_FILE);
}

function saveAutoReplies(data) {
  saveJSON(AUTOREPLY_FILE, data);
}

// ==================================================
// المستويات
// ==================================================

function getLevels() {
  return loadJSON(LEVELS_FILE);
}

function saveLevels(data) {
  saveJSON(LEVELS_FILE, data);
}

function xpNeededForLevel(level) {
  return level * 100;
}

function getLevelUpChannels() {
  return loadJSON(LEVELUP_CHANNEL_FILE);
}

function saveLevelUpChannels(data) {
  saveJSON(LEVELUP_CHANNEL_FILE, data);
}

// ==================================================
// العدادات
// ==================================================

function getCounters() {
  return loadJSON(COUNTER_FILE);
}

function saveCounters(data) {
  saveJSON(COUNTER_FILE, data);
}

// ==================================================
// التقديمات
// ==================================================

function getApplications() {
  return loadJSON(APPLICATION_FILE);
}

function saveApplications(data) {
  saveJSON(APPLICATION_FILE, data);
}

function getApplicationSessions() {
  return loadJSON(APPLICATION_SESSION_FILE);
}

function saveApplicationSessions(data) {
  saveJSON(APPLICATION_SESSION_FILE, data);
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
// 1 - إعطاء رتبة
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
// 2 - إزالة رتبة
// ==================================================

commands.push(
  addRoleOptions(
    new SlashCommandBuilder()
      .setName("ازالة-رتبة")
      .setDescription("إزالة رتبة أو عدة رتب من عضو")
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
// 3 - تحذير
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("تحذير")
    .setDescription("إعطاء عضو تحذير")
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
// 4 - مسج الرتبة
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
// 5 - إرسال ايمبد
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("ارسال-ايمبد")
    .setDescription("إرسال رسالة Embed")
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
        .setDescription("نص الايمبد")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("العنوان")
        .setDescription("عنوان الايمبد")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// 6 - إرسال إعلان
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
// 7 - زر عداد
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
        .setDescription("النص فوق العداد")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// 8 - حذف رسائل
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
// 9 - إضافة رد
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
// 10 - تعديل رد
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
// 11 - حذف رد
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
// 12 - قائمة الردود
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("قائمة-الردود")
    .setDescription("عرض الردود التلقائية")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// 13 - مستواي
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("مستواي")
    .setDescription("عرض مستواك")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("عضو آخر")
        .setRequired(false)
    )
    .toJSON()
);

// ==================================================
// 14 - المتصدرين
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("المتصدرين")
    .setDescription("عرض المتصدرين")
    .toJSON()
);

// ==================================================
// 15 - تعديل مستوى
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
// 16 - لوحة تذاكر
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("لوحة-تذاكر")
    .setDescription("إرسال لوحة التذاكر")
    .addChannelOption(option =>
      option
        .setName("الروم")
        .setDescription("روم التذاكر")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// 17 - تحديد روم الفل
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("تحديد-روم-الفل")
    .setDescription("تحديد روم إرسال ترقيات المستوى")
    .addChannelOption(option =>
      option
        .setName("الروم")
        .setDescription("روم ترقيات المستوى")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages.toString()
    )
    .toJSON()
);

// ==================================================
// 18 - تسطيب نظام التقديم
// ==================================================

const applicationSetupCommand =
  new SlashCommandBuilder()
    .setName("تسطيب-تقديم")
    .setDescription("تسطيب نظام التقديم بالكامل")

    .addChannelOption(option =>
      option
        .setName("مكان-التقديم")
        .setDescription("الروم الذي تظهر فيه لوحة التقديم")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )

    .addChannelOption(option =>
      option
        .setName("مكان-المراجعة")
        .setDescription("الروم الذي تصل إليه التقديمات")
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(true)
    )

    .addRoleOption(option =>
      option
        .setName("رتبة-القبول")
        .setDescription("الرتبة التي يأخذها العضو بعد القبول")
        .setRequired(true)
    )

    .addRoleOption(option =>
      option
        .setName("رتبة-الإزالة")
        .setDescription("الرتبة التي تنشال من العضو بعد القبول")
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName("لون-الإيمبد")
        .setDescription("مثال: #5865F2")
        .setRequired(true)
    )

    .addStringOption(option =>
      option
        .setName("سؤال-1")
        .setDescription("السؤال الأول")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-2")
        .setDescription("السؤال الثاني")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-3")
        .setDescription("السؤال الثالث")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-4")
        .setDescription("السؤال الرابع")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-5")
        .setDescription("السؤال الخامس")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-6")
        .setDescription("السؤال السادس")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-7")
        .setDescription("السؤال السابع")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-8")
        .setDescription("السؤال الثامن")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-9")
        .setDescription("السؤال التاسع")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-10")
        .setDescription("السؤال العاشر")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-11")
        .setDescription("السؤال الحادي عشر")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-12")
        .setDescription("السؤال الثاني عشر")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-13")
        .setDescription("السؤال الثالث عشر")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-14")
        .setDescription("السؤال الرابع عشر")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-15")
        .setDescription("السؤال الخامس عشر")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-16")
        .setDescription("السؤال السادس عشر")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-17")
        .setDescription("السؤال السابع عشر")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-18")
        .setDescription("السؤال الثامن عشر")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-19")
        .setDescription("السؤال التاسع عشر")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("سؤال-20")
        .setDescription("السؤال العشرون")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString()
    );

commands.push(applicationSetupCommand.toJSON());

// ==================================================
// 19 - إعادة إرسال لوحة التقديم
// ==================================================

commands.push(
  new SlashCommandBuilder()
    .setName("لوحة-تقديم")
    .setDescription("إعادة إرسال لوحة التقديم")
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageGuild.toString()
    )
    .toJSON()
);

// ==================================================
// تسجيل الأوامر
// ==================================================

const rest = new REST({ version: "10" }).setToken(TOKEN);

async function registerCommands() {
  try {
    console.log("🔄 جاري تسجيل أوامر السلاش...");

    await rest.put(
      Routes.applicationGuildCommands(
        CLIENT_ID,
        GUILD_ID
      ),
      {
        body: commands
      }
    );

    console.log(`✅ تم تسجيل ${commands.length} أمر سلاش`);
  } catch (error) {
    console.error("❌ خطأ في تسجيل الأوامر:");
    console.error(error);
  }
}

// ==================================================
// أرقام التذاكر
// ==================================================

function getNextTicketNumber(guildId) {
  const counters = getCounters();

  if (!counters.tickets) {
    counters.tickets = {};
  }

  if (!counters.tickets[guildId]) {
    counters.tickets[guildId] = 99;
  }

  counters.tickets[guildId]++;

  saveCounters(counters);

  return counters.tickets[guildId];
}

// ==================================================
// البحث عن تذكرة
// ==================================================

function findOpenTicket(guild, userId) {
  return guild.channels.cache.find(channel => {
    if (channel.type !== ChannelType.GuildText) {
      return false;
    }

    if (!channel.topic) {
      return false;
    }

    return channel.topic.includes(
      `ticketOwner:${userId}`
    );
  });
}

// ==================================================
// أنواع التذاكر
// ==================================================

function ticketTypeRow(disabled = false) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("نوع_تذكرة_شكوى")
      .setLabel("تكت شكوى")
      .setEmoji("📢")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),

    new ButtonBuilder()
      .setCustomId("نوع_تذكرة_دعم")
      .setLabel("تكت دعم فني")
      .setEmoji("🛠️")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled),

    new ButtonBuilder()
      .setCustomId("نوع_تذكرة_شراكة")
      .setLabel("تكت شراكة")
      .setEmoji("🤝")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled)
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

|| @here ||

|| @everyone ||

.. __**`;
}

// ==================================================
// لوق التذاكر
// ==================================================

async function sendTicketLog(guild, embed) {

  let logChannel =
    guild.channels.cache.find(
      c =>
        c.type === ChannelType.GuildText &&
        c.name === "لوق-التذاكر"
    );

  if (!logChannel) {

    let category =
      guild.channels.cache.find(
        c =>
          c.type === ChannelType.GuildCategory &&
          c.name === "「・لوقات・」"
      );

    if (!category) {
      category =
        await guild.channels.create({
          name: "「・لوقات・」",
          type: ChannelType.GuildCategory
        }).catch(() => null);
    }

    if (category) {
      logChannel =
        await guild.channels.create({
          name: "لوق-التذاكر",
          type: ChannelType.GuildText,
          parent: category.id
        }).catch(() => null);
    }
  }

  if (!logChannel) return;

  await logChannel.send({
    embeds: [embed]
  }).catch(() => {});
}

// ==================================================
// لوق التقديم
// ==================================================

async function sendApplicationLog(guild, embed) {

  let logChannel =
    guild.channels.cache.find(
      c =>
        c.type === ChannelType.GuildText &&
        c.name === "لوق-التقديم"
    );

  if (!logChannel) {

    let category =
      guild.channels.cache.find(
        c =>
          c.type === ChannelType.GuildCategory &&
          c.name === "「・لوقات・」"
      );

    if (!category) {
      category =
        await guild.channels.create({
          name: "「・لوقات・」",
          type: ChannelType.GuildCategory
        }).catch(() => null);
    }

    if (category) {
      logChannel =
        await guild.channels.create({
          name: "لوق-التقديم",
          type: ChannelType.GuildText,
          parent: category.id
        }).catch(() => null);
    }
  }

  if (!logChannel) return;

  await logChannel.send({
    embeds: [embed]
  }).catch(() => {});
}

// ==================================================
// إعداد التقديم
// ==================================================

function getApplicationConfig(guildId) {

  const applications =
    getApplications();

  return applications[guildId]?.config || null;
}

function saveApplicationConfig(guildId, config) {

  const applications =
    getApplications();

  if (!applications[guildId]) {
    applications[guildId] = {};
  }

  applications[guildId].config = config;

  saveApplications(applications);
}

// ==================================================
// لون الإيمبد
// ==================================================

function validColor(color) {

  if (!color) {
    return "#5865F2";
  }

  const value =
    color.trim();

  if (
    /^#[0-9A-Fa-f]{6}$/.test(value)
  ) {
    return value;
  }

  if (
    /^#[0-9A-Fa-f]{3}$/.test(value)
  ) {
    return value;
  }

  return "#5865F2";
}

// ==================================================
// لوحة التقديم
// ==================================================

function applicationPanel(config) {

  const embed =
    new EmbedBuilder()
      .setTitle("📋 التقديم على الإدارة")
      .setDescription(
        "للتقديم على الإدارة اضغط على الزر بالأسفل.\n\n" +
        "سيتم إرسال أسئلة التقديم لك في الخاص، " +
        "ويجب الإجابة على جميع الأسئلة بالترتيب."
      )
      .addFields({
        name: "📝 عدد الأسئلة",
        value: "20 سؤال",
        inline: true
      })
      .setColor(validColor(config.color))
      .setTimestamp();

  const button =
    new ButtonBuilder()
      .setCustomId("بدء_التقديم")
      .setLabel("بدء التقديم")
      .setEmoji("📝")
      .setStyle(ButtonStyle.Primary);

  return {
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(button)
    ]
  };
}

// ==================================================
// أسئلة التقديم
// ==================================================

function getQuestions(config) {

  const questions = [];

  for (let i = 1; i <= 20; i++) {
    questions.push(
      config[`question${i}`]
    );
  }

  return questions;
}

// ==================================================
// إرسال التقديم للمراجعة
// ==================================================

async function sendApplicationForReview({
  guild,
  user,
  answers,
  config,
  applicationId
}) {

  const reviewChannel =
    guild.channels.cache.get(
      config.reviewChannelId
    );

  if (!reviewChannel) {
    return false;
  }

  const embed =
    new EmbedBuilder()
      .setTitle(`📋 تقديم جديد #${applicationId}`)
      .setDescription(
        `👤 المتقدم: ${user}\n` +
        `🆔 الآيدي: \`${user.id}\`\n\n` +
        `يرجى مراجعة إجابات المتقدم قبل اتخاذ القرار.`
      )
      .setColor(validColor(config.color))
      .setThumbnail(
        user.displayAvatarURL({
          dynamic: true
        })
      )
      .setTimestamp();

  const questions =
    getQuestions(config);

  for (let i = 0; i < questions.length; i++) {

    let answer =
      answers[i] ||
      "لم تتم الإجابة";

    if (answer.length > 1024) {
      answer =
        answer.slice(0, 1021) + "...";
    }

    embed.addFields({
      name: `${i + 1}️⃣ ${questions[i]}`.slice(0, 256),
      value: answer,
      inline: false
    });
  }

  const buttons =
    new ActionRowBuilder().addComponents(

      new ButtonBuilder()
        .setCustomId(
          `قبول_تقديم_${applicationId}`
        )
        .setLabel("قبول")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),

      new ButtonBuilder()
        .setCustomId(
          `رفض_تقديم_${applicationId}`
        )
        .setLabel("رفض")
        .setEmoji("❌")
        .setStyle(ButtonStyle.Danger)
    );

  await reviewChannel.send({
    embeds: [embed],
    components: [buttons]
  });

  return true;
}

// ==================================================
// نظام التقديم
// ==================================================

async function startApplication(interaction) {

  const config =
    getApplicationConfig(
      interaction.guild.id
    );

  if (!config) {
    return interaction.reply({
      content:
        "❌ نظام التقديم غير مسطب. استخدم `/تسطيب-تقديم` أولاً.",
      ephemeral: true
    });
  }

  const existingSessions =
    getApplicationSessions();

  const sessionKey =
    `${interaction.guild.id}_${interaction.user.id}`;

  if (existingSessions[sessionKey]) {
    return interaction.reply({
      content:
        "❌ عندك تقديم قيد التنفيذ بالفعل. راجع الخاص.",
      ephemeral: true
    });
  }

  const member =
    interaction.member;

  try {
    await interaction.user.send(
      `📋 **بدأ التقديم في ${interaction.guild.name}**\n\n` +
      `سيتم إرسال **20 سؤال** لك.\n` +
      `أجب على كل سؤال برسالة منفصلة.\n\n` +
      `⏱️ لديك **5 دقائق** للإجابة على كل سؤال.`
    );
  } catch {

    return interaction.reply({
      content:
        "❌ ما قدرت أرسل لك في الخاص.\n\n" +
        "افتح الخاص مع أعضاء السيرفر ثم حاول مرة ثانية.",
      ephemeral: true
    });
  }

  existingSessions[sessionKey] = {
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    startedAt: Date.now(),
    answers: []
  };

  saveApplicationSessions(
    existingSessions
  );

  await interaction.reply({
    content:
      "✅ تم بدء التقديم.\n📩 راجع الخاص لإكمال الأسئلة.",
    ephemeral: true
  });

  const dm =
    await interaction.user.createDM();

  const questions =
    getQuestions(config);

  const answers = [];

  for (let i = 0; i < questions.length; i++) {

    const questionMessage =
      await dm.send(
        `**السؤال ${i + 1} من 20**\n\n${questions[i]}`
      ).catch(() => null);

    if (!questionMessage) {
      break;
    }

    const collected =
      await dm.awaitMessages({
        filter: message =>
          message.author.id ===
          interaction.user.id,

        max: 1,

        time: 5 * 60 * 1000
      }).catch(() => null);

    if (
      !collected ||
      collected.size === 0
    ) {

      await dm.send(
        "❌ انتهى وقت الإجابة على السؤال.\n" +
        "يمكنك بدء تقديم جديد من لوحة التقديم."
      ).catch(() => {});

      delete existingSessions[sessionKey];

      saveApplicationSessions(
        existingSessions
      );

      return;
    }

    const answer =
      collected.first().content.trim();

    answers.push(answer);

    existingSessions[sessionKey].answers =
      answers;

    saveApplicationSessions(
      existingSessions
    );
  }

  const applications =
    getApplications();

  if (!applications[interaction.guild.id]) {
    applications[interaction.guild.id] = {};
  }

  if (!applications[interaction.guild.id].counter) {
    applications[interaction.guild.id].counter = 0;
  }

  applications[interaction.guild.id].counter++;

  const applicationId =
    applications[interaction.guild.id].counter;

  if (!applications[interaction.guild.id].records) {
    applications[interaction.guild.id].records = {};
  }

  applications[interaction.guild.id].records[
    applicationId
  ] = {
    id: applicationId,
    guildId: interaction.guild.id,
    userId: interaction.user.id,
    username: interaction.user.tag,
    answers,
    status: "pending",
    createdAt: Date.now()
  };

  saveApplications(applications);

  delete existingSessions[sessionKey];

  saveApplicationSessions(
    existingSessions
  );

  const sent =
    await sendApplicationForReview({
      guild: interaction.guild,
      user: interaction.user,
      answers,
      config,
      applicationId
    });

  if (!sent) {

    await dm.send(
      "❌ حصلت مشكلة في إرسال تقديمك للإدارة."
    ).catch(() => {});

    return;
  }

  await dm.send(
    `✅ تم إرسال تقديمك بنجاح.\n\n` +
    `🔢 رقم التقديم: **#${applicationId}**\n` +
    `⏳ الحالة: **قيد المراجعة**`
  ).catch(() => {});
}

// ==================================================
// جاهزية البوت
// ==================================================

const xpCooldown = new Map();

client.once("ready", async () => {

  console.log(
    `✅ تم تسجيل الدخول باسم ${client.user.tag}`
  );

  console.log("🤖 البوت جاهز");

  console.log(
    `📦 عدد أوامر السلاش: ${commands.length}`
  );

  await registerCommands();
});

// ==================================================
// التفاعلات
// ==================================================

client.on(
  "interactionCreate",
  async interaction => {

    // ==================================================
    // الأزرار
    // ==================================================

    if (interaction.isButton()) {

      // ==================================================
      // فتح التذكرة
      // ==================================================

      if (
        interaction.customId ===
        "فتح_تذكرة"
      ) {

        const existingTicket =
          findOpenTicket(
            interaction.guild,
            interaction.user.id
          );

        if (existingTicket) {
          return interaction.reply({
            content:
              `❌ عندك تذكرة مفتوحة بالفعل: ${existingTicket}`,
            ephemeral: true
          });
        }

        const ticketNumber =
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

        const channelName =
          `تذكرة-${ticketNumber}-${username}`;

        const channel =
          await interaction.guild.channels.create({
            name: channelName,
            type: ChannelType.GuildText,

            topic:
              `ticketOwner:${interaction.user.id}|ticketNumber:${ticketNumber}|ticketType:none`,

            permissionOverwrites: [
              {
                id:
                  interaction.guild.roles.everyone.id,

                deny: [
                  PermissionFlagsBits.ViewChannel
                ]
              },

              {
                id: interaction.user.id,

                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              },

              {
                id: TICKET_STAFF_ROLE_ID,

                allow: [
                  PermissionFlagsBits.ViewChannel,
                  PermissionFlagsBits.SendMessages,
                  PermissionFlagsBits.ReadMessageHistory
                ]
              }
            ]
          })
          .catch(error => {

            console.error(
              "❌ خطأ إنشاء التذكرة:",
              error
            );

            return null;
          });

        if (!channel) {

          return interaction.reply({
            content:
              "❌ ما قدرت أنشئ التذكرة. تأكد أن البوت عنده صلاحية إدارة الرومات وإدارة الصلاحيات.",
            ephemeral: true
          });
        }

        const welcomeEmbed =
          new EmbedBuilder()
            .setTitle(
              "🎫 مرحباً بك في تذكرتك"
            )
            .setDescription(
              `أهلًا وسهلًا ${interaction.user}\n\nاختر نوع التكت المناسب لك من الأزرار بالأسفل.`
            )
            .setColor("Blue")
            .setTimestamp();

        await channel.send({
          embeds: [welcomeEmbed],
          components: [
            ticketTypeRow(false)
          ]
        });

        const closeEmbed =
          new EmbedBuilder()
            .setTitle(
              "🔒 إغلاق التذكرة"
            )
            .setDescription(
              "عند الانتهاء من التذكرة يمكنك الضغط على الزر بالأسفل لإغلاقها."
            )
            .setColor("Red")
            .setTimestamp();

        const closeButton =
          new ActionRowBuilder()
            .addComponents(
              new ButtonBuilder()
                .setCustomId(
                  "اغلاق_تذكرة"
                )
                .setLabel(
                  "إغلاق التذكرة"
                )
                .setEmoji("🔒")
                .setStyle(
                  ButtonStyle.Danger
                )
            );

        await channel.send({
          embeds: [closeEmbed],
          components: [closeButton]
        });

        const logEmbed =
          new EmbedBuilder()
            .setTitle(
              "🎫 فتح تذكرة جديدة"
            )
            .setColor("Blue")
            .addFields(
              {
                name: "👤 صاحب التذكرة",
                value: `${interaction.user}`,
                inline: true
              },
              {
                name: "🔢 رقم التذكرة",
                value: `${ticketNumber}`,
                inline: true
              },
              {
                name: "📁 التذكرة",
                value: `${channel}`,
                inline: true
              },
              {
                name: "📌 النوع",
                value: "لم يتم التحديد",
                inline: true
              }
            )
            .setTimestamp();

        await sendTicketLog(
          interaction.guild,
          logEmbed
        );

        return interaction.reply({
          content:
            `✅ تم إنشاء تذكرتك: ${channel}`,
          ephemeral: true
        });
      }

      // ==================================================
      // شكوى
      // ==================================================

      if (
        interaction.customId ===
        "نوع_تذكرة_شكوى"
      ) {

        const ownerMatch =
          interaction.channel.topic?.match(
            /ticketOwner:(\d+)/
          );

        if (!ownerMatch) {
          return interaction.reply({
            content:
              "❌ هذه ليست تذكرة صحيحة.",
            ephemeral: true
          });
        }

        const ownerId =
          ownerMatch[1];

        if (
          interaction.user.id !==
          ownerId
        ) {
          return interaction.reply({
            content:
              "❌ فقط صاحب التذكرة يقدر يحدد نوعها.",
            ephemeral: true
          });
        }

        const newTopic =
          interaction.channel.topic.replace(
            "ticketType:none",
            "ticketType:شكوى"
          );

        await interaction.channel.setTopic(
          newTopic
        );

        await interaction.update({
          components: [
            ticketTypeRow(true)
          ]
        });

        await interaction.channel.send({
          content: complaintForm(),

          allowedMentions: {
            roles: [
              TICKET_STAFF_ROLE_ID
            ]
          }
        });

        return;
      }

      // ==================================================
      // دعم
      // ==================================================

      if (
        interaction.customId ===
        "نوع_تذكرة_دعم"
      ) {

        const ownerMatch =
          interaction.channel.topic?.match(
            /ticketOwner:(\d+)/
          );

        if (!ownerMatch) {
          return interaction.reply({
            content:
              "❌ هذه ليست تذكرة صحيحة.",
            ephemeral: true
          });
        }

        const ownerId =
          ownerMatch[1];

        if (
          interaction.user.id !==
          ownerId
        ) {
          return interaction.reply({
            content:
              "❌ فقط صاحب التذكرة يقدر يحدد نوعها.",
            ephemeral: true
          });
        }

        const newTopic =
          interaction.channel.topic.replace(
            "ticketType:none",
            "ticketType:دعم فني"
          );

        await interaction.channel.setTopic(
          newTopic
        );

        await interaction.update({
          components: [
            ticketTypeRow(true)
          ]
        });

        await interaction.channel.send({
          content: supportForm(),

          allowedMentions: {
            roles: [
              TICKET_STAFF_ROLE_ID
            ]
          }
        });

        return;
      }

      // ==================================================
      // شراكة
      // ==================================================

      if (
        interaction.customId ===
        "نوع_تذكرة_شراكة"
      ) {

        const ownerMatch =
          interaction.channel.topic?.match(
            /ticketOwner:(\d+)/
          );

        if (!ownerMatch) {
          return interaction.reply({
            content:
              "❌ هذه ليست تذكرة صحيحة.",
            ephemeral: true
          });
        }

        const ownerId =
          ownerMatch[1];

        if (
          interaction.user.id !==
          ownerId
        ) {
          return interaction.reply({
            content:
              "❌ فقط صاحب التذكرة يقدر يحدد نوعها.",
            ephemeral: true
          });
        }

        const newTopic =
          interaction.channel.topic.replace(
            "ticketType:none",
            "ticketType:شراكة"
          );

        await interaction.channel.setTopic(
          newTopic
        );

        await interaction.update({
          components: [
            ticketTypeRow(true)
          ]
        });

        await interaction.channel.send({
          content:
            partnershipForm(),

          allowedMentions: {
            parse: ["everyone"],
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

        const ownerMatch =
          interaction.channel.topic?.match(
            /ticketOwner:(\d+)/
          );

        const numberMatch =
          interaction.channel.topic?.match(
            /ticketNumber:(\d+)/
          );

        const typeMatch =
          interaction.channel.topic?.match(
            /ticketType:([^|]+)/
          );

        const ownerId =
          ownerMatch?.[1] ||
          "غير معروف";

        const ticketNumber =
          numberMatch?.[1] ||
          "غير معروف";

        const ticketType =
          typeMatch?.[1] ||
          "غير محدد";

        const allowed =
          interaction.user.id ===
            ownerId ||
          isTicketStaff(
            interaction.member
          );

        if (!allowed) {
          return interaction.reply({
            content:
              "❌ ما عندك صلاحية لإغلاق التذكرة.",
            ephemeral: true
          });
        }

        const closingEmbed =
          new EmbedBuilder()
            .setTitle(
              "🔒 جاري إغلاق التذكرة"
            )
            .setDescription(
              "سيتم حذف التذكرة خلال **5 ثواني**."
            )
            .setColor("Red")
            .setTimestamp();

        await interaction.reply({
          embeds: [closingEmbed]
        });

        const logEmbed =
          new EmbedBuilder()
            .setTitle(
              "🔒 إغلاق تذكرة"
            )
            .setColor("Red")
            .addFields(
              {
                name:
                  "👤 صاحب التذكرة",
                value:
                  `<@${ownerId}>`,
                inline: true
              },
              {
                name:
                  "🔢 رقم التذكرة",
                value:
                  `${ticketNumber}`,
                inline: true
              },
              {
                name:
                  "📌 النوع",
                value:
                  `${ticketType}`,
                inline: true
              },
              {
                name:
                  "👮 أغلقها",
                value:
                  `${interaction.user}`,
                inline: true
              },
              {
                name:
                  "📁 الروم",
                value:
                  `${interaction.channel.name}`,
                inline: true
              }
            )
            .setTimestamp();

        await sendTicketLog(
          interaction.guild,
          logEmbed
        );

        setTimeout(
          async () => {
            await interaction.channel
              .delete()
              .catch(() => {});
          },
          5000
        );

        return;
      }

      // ==================================================
      // العداد
      // ==================================================

      if (
        interaction.customId.startsWith(
          "عداد_"
        )
      ) {

        const counterId =
          interaction.customId.replace(
            "عداد_",
            ""
          );

        const counters =
          getCounters();

        if (!counters[counterId]) {
          return interaction.reply({
            content:
              "❌ هذا العداد غير موجود.",
            ephemeral: true
          });
        }

        const counter =
          counters[counterId];

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
              "❌ سبق وضغطت على العداد.",
            ephemeral: true
          });
        }

        counter.users.push(
          interaction.user.id
        );

        counter.count++;

        saveCounters(counters);

        const button =
          new ButtonBuilder()
            .setCustomId(
              `عداد_${counterId}`
            )
            .setLabel(
              `${counter.count}`
            )
            .setEmoji("🔢")
            .setStyle(
              ButtonStyle.Primary
            );

        const row =
          new ActionRowBuilder()
            .addComponents(button);

        await interaction.update({
          components: [row]
        });

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
              "❌ ما عندك صلاحية لقبول التقديمات.",
            ephemeral: true
          });
        }

        const applicationId =
          interaction.customId.replace(
            "قبول_تقديم_",
            ""
          );

        const applications =
          getApplications();

        const record =
          applications[
            interaction.guild.id
          ]?.records?.[
            applicationId
          ];

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
              `❌ هذا التقديم حالته بالفعل: **${record.status}**`,
            ephemeral: true
          });
        }

        const member =
          await interaction.guild.members
            .fetch(record.userId)
            .catch(() => null);

        if (!member) {
          return interaction.reply({
            content:
              "❌ العضو غير موجود في السيرفر.",
            ephemeral: true
          });
        }

        const config =
          getApplicationConfig(
            interaction.guild.id
          );

        try {

          if (
            config.removeRoleId &&
            member.roles.cache.has(
              config.removeRoleId
            )
          ) {
            await member.roles.remove(
              config.removeRoleId
            );
          }

          if (
            config.acceptRoleId &&
            !member.roles.cache.has(
              config.acceptRoleId
            )
          ) {
            await member.roles.add(
              config.acceptRoleId
            );
          }

        } catch (error) {

          console.error(
            "❌ خطأ في رتب التقديم:",
            error
          );

          return interaction.reply({
            content:
              "❌ ما قدرت أعدل رتب العضو. تأكد أن رتبة البوت أعلى من الرتب المحددة.",
            ephemeral: true
          });
        }

        record.status =
          "accepted";

        record.reviewedBy =
          interaction.user.id;

        record.reviewedAt =
          Date.now();

        saveApplications(
          applications
        );

        const disabledRow =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  `تم_قبول_${applicationId}`
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
                  `تم_رفض_${applicationId}`
                )
                .setLabel(
                  "رفض"
                )
                .setEmoji("❌")
                .setStyle(
                  ButtonStyle.Danger
                )
                .setDisabled(true)
            );

        await interaction.message.edit({
          components: [
            disabledRow
          ]
        }).catch(() => {});

        await member.send(
          `🎉 **تم قبول تقديمك في ${interaction.guild.name}!**\n\n` +
          `مبروك، تم قبولك في الإدارة.\n` +
          `👮 تمت الموافقة بواسطة: ${interaction.user}`
        ).catch(() => {});

        const logEmbed =
          new EmbedBuilder()
            .setTitle(
              "✅ قبول تقديم"
            )
            .setColor("Green")
            .addFields(
              {
                name:
                  "👤 المتقدم",
                value:
                  `<@${record.userId}>`,
                inline: true
              },
              {
                name:
                  "🔢 رقم التقديم",
                value:
                  `#${applicationId}`,
                inline: true
              },
              {
                name:
                  "👮 الموافق",
                value:
                  `${interaction.user}`,
                inline: true
              }
            )
            .setTimestamp();

        await sendApplicationLog(
          interaction.guild,
          logEmbed
        );

        return interaction.reply({
          content:
            `✅ تم قبول التقديم #${applicationId} وإعطاء الرتبة المطلوبة.`,
          ephemeral: true
        });
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
              "❌ ما عندك صلاحية لرفض التقديمات.",
            ephemeral: true
          });
        }

        const applicationId =
          interaction.customId.replace(
            "رفض_تقديم_",
            ""
          );

        const applications =
          getApplications();

        const record =
          applications[
            interaction.guild.id
          ]?.records?.[
            applicationId
          ];

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
              `❌ هذا التقديم حالته بالفعل: **${record.status}**`,
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
          applications
        );

        const disabledRow =
          new ActionRowBuilder()
            .addComponents(

              new ButtonBuilder()
                .setCustomId(
                  `تم_قبول_${applicationId}`
                )
                .setLabel(
                  "قبول"
                )
                .setEmoji("✅")
                .setStyle(
                  ButtonStyle.Success
                )
                .setDisabled(true),

              new ButtonBuilder()
                .setCustomId(
                  `تم_رفض_${applicationId}`
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

        await interaction.message.edit({
          components: [
            disabledRow
          ]
        }).catch(() => {});

        const user =
          await client.users.fetch(
            record.userId
          ).catch(() => null);

        if (user) {
          await user.send(
            `❌ **تم رفض تقديمك في ${interaction.guild.name}.**\n\n` +
            `يمكنك التقديم مرة أخرى في حال فتح التقديم من جديد.`
          ).catch(() => {});
        }

        const logEmbed =
          new EmbedBuilder()
            .setTitle(
              "❌ رفض تقديم"
            )
            .setColor("Red")
            .addFields(
              {
                name:
                  "👤 المتقدم",
                value:
                  `<@${record.userId}>`,
                inline: true
              },
              {
                name:
                  "🔢 رقم التقديم",
                value:
                  `#${applicationId}`,
                inline: true
              },
              {
                name:
                  "👮 الرافض",
                value:
                  `${interaction.user}`,
                inline: true
              }
            )
            .setTimestamp();

        await sendApplicationLog(
          interaction.guild,
          logEmbed
        );

        return interaction.reply({
          content:
            `❌ تم رفض التقديم #${applicationId}.`,
          ephemeral: true
        });
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
        await interaction.guild.members
          .fetch(
            interaction.options.getUser(
              "العضو"
            ).id
          );

      const roles = [];

      const mainRole =
        interaction.options.getRole(
          "الرتبة-الأساسية"
        );

      if (mainRole) {
        roles.push(mainRole);
      }

      for (
        let i = 1;
        i <= 19;
        i++
      ) {

        const role =
          interaction.options.getRole(
            `رتبة-جانبية-${i}`
          );

        if (role) {
          roles.push(role);
        }
      }

      let added = 0;

      for (
        const role of roles
      ) {

        if (
          role.position >=
          interaction.guild.members.me
            .roles.highest.position
        ) {
          continue;
        }

        try {
          await member.roles.add(
            role
          );

          added++;
        } catch {}
      }

      return interaction.reply({
        content:
          `✅ تم إعطاء **${added}** رتبة لـ ${member}.`,
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
        await interaction.guild.members
          .fetch(
            interaction.options.getUser(
              "العضو"
            ).id
          );

      const roles = [];

      const mainRole =
        interaction.options.getRole(
          "الرتبة-الأساسية"
        );

      if (mainRole) {
        roles.push(mainRole);
      }

      for (
        let i = 1;
        i <= 19;
        i++
      ) {

        const role =
          interaction.options.getRole(
            `رتبة-جانبية-${i}`
          );

        if (role) {
          roles.push(role);
        }
      }

      let removed = 0;

      for (
        const role of roles
      ) {

        if (
          role.position >=
          interaction.guild.members.me
            .roles.highest.position
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

        try {

          await member.roles.remove(
            role
          );

          removed++;

        } catch {}
      }

      return interaction.reply({
        content:
          `✅ تم إزالة **${removed}** رتبة من ${member}.`,
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
        getWarnings();

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
        warnings
      );

      const dmEmbed =
        new EmbedBuilder()
          .setTitle(
            "⚠️ تم تحذيرك"
          )
          .setDescription(
            `تم تحذيرك في سيرفر **${interaction.guild.name}**`
          )
          .addFields(
            {
              name:
                "📌 السبب",
              value:
                reason
            },
            {
              name:
                "🔢 عدد تحذيراتك",
              value:
                `${count}`
            }
          )
          .setColor("Red")
          .setTimestamp();

      await user.send({
        embeds: [dmEmbed]
      }).catch(() => {});

      return interaction.reply({
        content:
          `✅ تم تحذير ${user}\n**السبب:** ${reason}\n**عدد التحذيرات:** ${count}`,
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

      const message =
        interaction.options.getString(
          "الرسالة"
        );

      let sent = 0;
      let failed = 0;

      for (
        const member of
        role.members.values()
      ) {

        try {

          await member.send(
            message
          );

          sent++;

        } catch {
          failed++;
        }
      }

      return interaction.reply({
        content:
          `✅ تم إرسال الرسالة.\n\n📨 تم الإرسال: **${sent}**\n❌ فشل: **${failed}**`,
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

      const message =
        interaction.options.getString(
          "الرسالة"
        );

      const embed =
        new EmbedBuilder()
          .setTitle("📢 إعلان")
          .setDescription(message)
          .setColor("Gold")
          .setTimestamp();

      await channel.send({
        embeds: [embed]
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

      const message =
        interaction.options.getString(
          "الرسالة"
        );

      const counterId =
        `${interaction.guild.id}_${Date.now()}`;

      const counters =
        getCounters();

      counters[counterId] = {
        count: 0,
        users: []
      };

      saveCounters(
        counters
      );

      const embed =
        new EmbedBuilder()
          .setDescription(message)
          .setColor("Blue")
          .setTimestamp();

      const button =
        new ButtonBuilder()
          .setCustomId(
            `عداد_${counterId}`
          )
          .setLabel("0")
          .setEmoji("🔢")
          .setStyle(
            ButtonStyle.Primary
          );

      const row =
        new ActionRowBuilder()
          .addComponents(
            button
          );

      await channel.send({
        embeds: [embed],
        components: [row]
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

      let remaining =
        interaction.options.getInteger(
          "العدد"
        );

      let deletedTotal = 0;

      await interaction.deferReply({
        ephemeral: true
      });

      while (
        remaining > 0
      ) {

        const batch =
          Math.min(
            remaining,
            100
          );

        const deleted =
          await interaction.channel
            .bulkDelete(
              batch,
              true
            )
            .catch(
              () => null
            );

        if (!deleted) {
          break;
        }

        const count =
          deleted.size;

        deletedTotal +=
          count;

        remaining -=
          count;

        if (
          count < batch
        ) {
          break;
        }
      }

      return interaction.editReply(
        `✅ تم حذف **${deletedTotal}** رسالة.`
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

      const replies =
        getAutoReplies();

      replies[word] =
        reply;

      saveAutoReplies(
        replies
      );

      return interaction.reply({
        content:
          `✅ تم إضافة الرد للكلمة: **${word}**`,
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

      const replies =
        getAutoReplies();

      if (!replies[word]) {
        return interaction.reply({
          content:
            "❌ هذه الكلمة غير موجودة.",
          ephemeral: true
        });
      }

      replies[word] =
        reply;

      saveAutoReplies(
        replies
      );

      return interaction.reply({
        content:
          "✅ تم تعديل الرد.",
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

      const replies =
        getAutoReplies();

      if (!replies[word]) {
        return interaction.reply({
          content:
            "❌ هذه الكلمة غير موجودة.",
          ephemeral: true
        });
      }

      delete replies[word];

      saveAutoReplies(
        replies
      );

      return interaction.reply({
        content:
          "✅ تم حذف الرد.",
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

      const replies =
        getAutoReplies();

      const keys =
        Object.keys(
          replies
        );

      if (
        keys.length === 0
      ) {
        return interaction.reply({
          content:
            "❌ ما فيه ردود مضافة.",
          ephemeral: true
        });
      }

      const text =
        keys
          .map(
            (key, index) =>
              `**${index + 1}.** ${key} → ${replies[key]}`
          )
          .join("\n");

      const embed =
        new EmbedBuilder()
          .setTitle(
            "📋 الردود التلقائية"
          )
          .setDescription(
            text
          )
          .setColor("Blue")
          .setTimestamp();

      return interaction.reply({
        embeds: [embed],
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
        getLevels();

      const guildData =
        levels[
          interaction.guild.id
        ] || {};

      const data =
        guildData[user.id] || {
          xp: 0,
          level: 1
        };

      const needed =
        xpNeededForLevel(
          data.level
        );

      const embed =
        new EmbedBuilder()
          .setTitle(
            "📊 مستوى العضو"
          )
          .setDescription(
            `${user}\n\n🏆 المستوى: **${data.level}**\n⭐ الخبرة: **${data.xp} / ${needed}**`
          )
          .setThumbnail(
            user.displayAvatarURL({
              dynamic: true
            })
          )
          .setColor("Gold")
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
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
        getLevels();

      const guildData =
        levels[
          interaction.guild.id
        ] || {};

      const sorted =
        Object.entries(
          guildData
        )
          .sort(
            (a, b) => {

              if (
                b[1].level !==
                a[1].level
              ) {
                return (
                  b[1].level -
                  a[1].level
                );
              }

              return (
                b[1].xp -
                a[1].xp
              );
            }
          )
          .slice(
            0,
            10
          );

      if (
        sorted.length === 0
      ) {
        return interaction.reply({
          content:
            "❌ ما فيه بيانات مستويات حتى الآن."
        });
      }

      let description =
        "";

      sorted.forEach(
        ([userId, data], index) => {

          description +=
            `**${index + 1}.** <@${userId}> — المستوى **${data.level}** | XP **${data.xp}**\n`;
        }
      );

      const embed =
        new EmbedBuilder()
          .setTitle(
            "🏆 المتصدرين"
          )
          .setDescription(
            description
          )
          .setColor("Gold")
          .setTimestamp();

      return interaction.reply({
        embeds: [embed]
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
        );

      const levels =
        getLevels();

      if (
        !levels[
          interaction.guild.id
        ]
      ) {
        levels[
          interaction.guild.id
        ] = {};
      }

      levels[
        interaction.guild.id
      ][user.id] = {
        level,
        xp: xp ?? 0
      };

      saveLevels(
        levels
      );

      return interaction.reply({
        content:
          `✅ تم تعديل مستوى ${user} إلى **${level}**.`,
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

      const embed =
        new EmbedBuilder()
          .setTitle(
            "🎫 نظام التذاكر"
          )
          .setDescription(
            "مرحباً بك في نظام التذاكر.\n\nاضغط على الزر بالأسفل لفتح تذكرة والتواصل مع الإدارة."
          )
          .setColor("Blue")
          .setTimestamp();

      const button =
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
          );

      const row =
        new ActionRowBuilder()
          .addComponents(
            button
          );

      await channel.send({
        embeds: [embed],
        components: [row]
      });

      return interaction.reply({
        content:
          "✅ تم إرسال لوحة التذاكر.",
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

      const channels =
        getLevelUpChannels();

      channels[
        interaction.guild.id
      ] =
        channel.id;

      saveLevelUpChannels(
        channels
      );

      return interaction.reply({
        content:
          `✅ تم تحديد ${channel} كروم لترقيات المستوى.`,
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
        !interaction.member.permissions.has(
          PermissionFlagsBits.ManageGuild
        ) &&
        !isStaff(
          interaction.member
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

      const config = {
        channelId:
          applicationChannel.id,

        reviewChannelId:
          reviewChannel.id,

        acceptRoleId:
          acceptRole.id,

        removeRoleId:
          removeRole.id,

        color:
          validColor(color)
      };

      for (
        let i = 1;
        i <= 20;
        i++
      ) {

        config[
          `question${i}`
        ] =
          interaction.options.getString(
            `سؤال-${i}`
          );
      }

      saveApplicationConfig(
        interaction.guild.id,
        config
      );

      await applicationChannel.send(
        applicationPanel(config)
      );

      return interaction.reply({
        content:
          "✅ تم تسطيب نظام التقديم بنجاح.\n\n" +
          `📍 مكان التقديم: ${applicationChannel}\n` +
          `📥 مكان المراجعة: ${reviewChannel}\n` +
          `✅ رتبة القبول: ${acceptRole}\n` +
          `❌ رتبة الإزالة: ${removeRole}\n` +
          `🎨 اللون: \`${config.color}\`\n` +
          `📝 عدد الأسئلة: **20**`,
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
            "❌ نظام التقديم غير مسطب.\nاستخدم `/تسطيب-تقديم` أولاً.",
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
            "❌ روم التقديم المحفوظ غير موجود.",
          ephemeral: true
        });
      }

      await channel.send(
        applicationPanel(config)
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
// الرسائل
// ==================================================

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
      getAutoReplies();

    const content =
      message.content.toLowerCase();

    for (
      const word of
      Object.keys(replies)
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

    const cooldownKey =
      `${message.guild.id}_${message.author.id}`;

    const now =
      Date.now();

    const last =
      xpCooldown.get(
        cooldownKey
      ) || 0;

    if (
      now - last <
      60 * 1000
    ) {
      return;
    }

    xpCooldown.set(
      cooldownKey,
      now
    );

    const levels =
      getLevels();

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
        xp: 0,
        level: 1
      };
    }

    const userData =
      levels[
        message.guild.id
      ][message.author.id];

    const oldLevel =
      userData.level;

    const randomXP =
      Math.floor(
        Math.random() * 11
      ) + 15;

    userData.xp +=
      randomXP;

    while (
      userData.xp >=
      xpNeededForLevel(
        userData.level
      )
    ) {

      userData.xp -=
        xpNeededForLevel(
          userData.level
        );

      userData.level++;
    }

    saveLevels(
      levels
    );

    // ==================================================
    // ترقية مستوى
    // ==================================================

    if (
      userData.level >
      oldLevel
    ) {

      const levelUpChannels =
        getLevelUpChannels();

      const channelId =
        levelUpChannels[
          message.guild.id
        ];

      if (channelId) {

        const channel =
          message.guild.channels.cache.get(
            channelId
          );

        if (channel) {

          const embed =
            new EmbedBuilder()
              .setTitle(
                "🎉 ترقية مستوى"
              )
              .setDescription(
                `مبروك ${message.author}!\n\n🏆 وصلت إلى المستوى **${userData.level}**`
              )
              .setColor("Gold")
              .setThumbnail(
                message.author.displayAvatarURL({
                  dynamic: true
                })
              )
              .setTimestamp();

          await channel.send({
            embeds: [embed]
          }).catch(() => {});
        }
      }
    }
  }
);

// ==================================================
// تسجيل الدخول
// ==================================================

client.login(TOKEN);
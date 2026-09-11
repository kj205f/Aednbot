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
require("dotenv").config();

console.log("🚀 index.js بدأ التشغيل");

// =========================
// Keep-Alive Server
// =========================

const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("✅ البوت شغال");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🌐 Keep-alive server يعمل على البورت ${PORT}`);
});

// =========================
// Environment Variables
// =========================

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !GUILD_ID || !CLIENT_ID) {
  console.error(
    "❌ تأكد من وجود DISCORD_TOKEN و GUILD_ID و CLIENT_ID في Environment Variables"
  );
  process.exit(1);
}

// =========================
// الرتبة المسؤولة عن أوامر الإدارة
// =========================

const STAFF_ROLE_ID = "1442207394280243324";

// =========================
// رتبة مسؤولي التذاكر
// =========================

const TICKET_STAFF_ROLE_ID = "1441509616151298270";

// =========================
// روم لوق التذاكر
// =========================

const TICKET_LOG_CHANNEL_ID = "1458146908747989042";

// =========================
// التحقق من رتبة الإدارة
// =========================

function isStaff(member) {
  if (!member) return false;
  return member.roles.cache.has(STAFF_ROLE_ID);
}

// =========================
// التحقق من مسؤول التذاكر
// =========================

function isTicketStaff(member) {
  if (!member) return false;
  return member.roles.cache.has(TICKET_STAFF_ROLE_ID);
}

// =========================
// الملفات
// =========================

const WARN_FILE = "warnings.json";
const COUNTER_FILE = "counters.json";
const AUTOREPLY_FILE = "autoreplies.json";
const LEVELS_FILE = "levels.json";

// ملف روم إشعارات الترقية
const XP_LEVELUP_CHANNEL_FILE = "xp-levelup-channel.json";

// =========================
// البوت
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// =========================
// نظام التحذيرات
// =========================

function loadWarnings() {
  if (!fs.existsSync(WARN_FILE)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(WARN_FILE, "utf8"));
  } catch (error) {
    console.error("❌ خطأ في قراءة warnings.json");
    return {};
  }
}

function saveWarnings(data) {
  fs.writeFileSync(
    WARN_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

// =========================
// نظام العدادات
// =========================

function loadCounters() {
  if (!fs.existsSync(COUNTER_FILE)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(COUNTER_FILE, "utf8"));
  } catch (error) {
    console.error("❌ خطأ في قراءة counters.json");
    return {};
  }
}

function saveCounters(data) {
  fs.writeFileSync(
    COUNTER_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

// =========================
// نظام الردود التلقائية
// =========================

function loadAutoReplies() {
  if (!fs.existsSync(AUTOREPLY_FILE)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(AUTOREPLY_FILE, "utf8"));
  } catch (error) {
    console.error("❌ خطأ في قراءة autoreplies.json");
    return {};
  }
}

function saveAutoReplies(data) {
  fs.writeFileSync(
    AUTOREPLY_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

// =========================
// نظام المستويات
// =========================

function loadLevels() {
  if (!fs.existsSync(LEVELS_FILE)) {
    return {};
  }

  try {
    return JSON.parse(fs.readFileSync(LEVELS_FILE, "utf8"));
  } catch (error) {
    console.error("❌ خطأ في قراءة levels.json");
    return {};
  }
}

function saveLevels(data) {
  fs.writeFileSync(
    LEVELS_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

// =========================
// نظام روم إشعارات الفل
// =========================

function loadXPLevelUpChannel() {
  if (!fs.existsSync(XP_LEVELUP_CHANNEL_FILE)) {
    return {};
  }

  try {
    return JSON.parse(
      fs.readFileSync(
        XP_LEVELUP_CHANNEL_FILE,
        "utf8"
      )
    );
  } catch (error) {
    console.error(
      "❌ خطأ في قراءة xp-levelup-channel.json"
    );

    return {};
  }
}

function saveXPLevelUpChannel(data) {
  fs.writeFileSync(
    XP_LEVELUP_CHANNEL_FILE,
    JSON.stringify(data, null, 2),
    "utf8"
  );
}

// =========================
// XP المطلوب لكل مستوى
// =========================

function xpNeededForLevel(level) {
  return level * 100;
}

const xpCooldown = new Map();

// =========================
// دالة لوق التذاكر
// =========================

async function sendTicketLog(guild, message) {
  try {
    const logChannel =
      guild.channels.cache.get(
        TICKET_LOG_CHANNEL_ID
      );

    if (!logChannel) {
      console.error(
        `❌ لم يتم العثور على روم لوق التذاكر: ${TICKET_LOG_CHANNEL_ID}`
      );
      return;
    }

    await logChannel.send({
      content: message,
      allowedMentions: {
        parse: []
      }
    });

  } catch (error) {
    console.error(
      "❌ حدث خطأ أثناء إرسال لوق التذكرة:",
      error
    );
  }
}

// =========================
// إنشاء أوامر الرتب
// =========================

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

// =========================
// أوامر السلاش
// =========================

const giveRoleCommand = addRoleOptions(
  new SlashCommandBuilder()
    .setName("اعطاء-رتبة")
    .setDescription("إعطاء عضو حتى 20 رتبة")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو المستهدف")
        .setRequired(true)
    )
).setDefaultMemberPermissions(
  PermissionFlagsBits.ManageRoles
);

const removeRoleCommand = addRoleOptions(
  new SlashCommandBuilder()
    .setName("ازالة-رتبة")
    .setDescription("إزالة حتى 20 رتبة من عضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو المستهدف")
        .setRequired(true)
    )
).setDefaultMemberPermissions(
  PermissionFlagsBits.ManageRoles
);

const commands = [

  // =========================
  // الرتب
  // =========================

  giveRoleCommand,

  removeRoleCommand,

  // =========================
  // تحذير
  // =========================

  new SlashCommandBuilder()
    .setName("تحذير")
    .setDescription("تحذير عضو بدون حد أقصى")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو المستهدف")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("السبب")
        .setDescription("سبب التحذير")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ModerateMembers
    ),

  // =========================
  // مسج الرتبة
  // =========================

  new SlashCommandBuilder()
    .setName("مسج-الرتبة")
    .setDescription("إرسال رسالة خاصة لجميع أعضاء رتبة")
    .addRoleOption(option =>
      option
        .setName("الرتبة")
        .setDescription("الرتبة المستهدفة")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("الرسالة")
        .setDescription("نص الرسالة")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageRoles
    ),

  // =========================
  // إرسال إيمبد
  // =========================

  new SlashCommandBuilder()
    .setName("ارسال-ايمبد")
    .setDescription("إرسال رسالة مع إيمبد")
    .addChannelOption(option =>
      option
        .setName("مكان-الإرسال")
        .setDescription("الروم الذي سيتم الإرسال فيه")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(option =>
      option
        .setName("الكلام-داخل-الإيمبد")
        .setDescription("الكلام الذي يظهر داخل الإيمبد")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("الكلام-فوق-الإيمبد")
        .setDescription("الكلام الذي يظهر فوق الإيمبد")
        .setRequired(false)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  // =========================
  // إرسال إعلان
  // =========================

  new SlashCommandBuilder()
    .setName("ارسال-اعلان")
    .setDescription("إرسال إعلان في روم محدد")
    .addChannelOption(option =>
      option
        .setName("مكان-الإعلان")
        .setDescription("الروم الذي سيتم إرسال الإعلان فيه")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(option =>
      option
        .setName("الرسالة")
        .setDescription("نص الإعلان")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  // =========================
  // زر العداد
  // =========================

  new SlashCommandBuilder()
    .setName("زر-عداد")
    .setDescription("إرسال رسالة مع زر صح وعداد يزيد عند الضغط")
    .addChannelOption(option =>
      option
        .setName("مكان-الإرسال")
        .setDescription("الروم الذي سيتم الإرسال فيه")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )
    .addStringOption(option =>
      option
        .setName("الرسالة")
        .setDescription("نص الرسالة")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  // =========================
  // الردود التلقائية
  // =========================

  new SlashCommandBuilder()
    .setName("اضافة-رد")
    .setDescription("إضافة رد تلقائي على كلمة معينة")
    .addStringOption(option =>
      option
        .setName("الكلمة")
        .setDescription("الكلمة التي سيرد عليها البوت")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("الرد")
        .setDescription("الرد الذي سيرسله البوت")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("تعديل-رد")
    .setDescription("تعديل رد تلقائي موجود")
    .addStringOption(option =>
      option
        .setName("الكلمة")
        .setDescription("الكلمة التي تريد تعديل ردها")
        .setRequired(true)
    )
    .addStringOption(option =>
      option
        .setName("الرد-الجديد")
        .setDescription("الرد الجديد")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("حذف-رد")
    .setDescription("حذف رد تلقائي")
    .addStringOption(option =>
      option
        .setName("الكلمة")
        .setDescription("الكلمة المراد حذف الرد عليها")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("قائمة-الردود")
    .setDescription("عرض جميع الردود التلقائية"),

  // =========================
  // المستويات
  // =========================

  new SlashCommandBuilder()
    .setName("مستواي")
    .setDescription("عرض مستواك ونقاطك الحالية")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("اعرض مستوى عضو آخر")
        .setRequired(false)
    ),

  new SlashCommandBuilder()
    .setName("المتصدرين")
    .setDescription("عرض أعلى 10 أعضاء من حيث المستوى والنقاط"),

  new SlashCommandBuilder()
    .setName("تعديل-مستوى")
    .setDescription("تعديل مستوى ونقاط عضو يدويًا")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو المستهدف")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("المستوى")
        .setDescription("المستوى الجديد")
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName("النقاط")
        .setDescription("النقاط الحالية داخل المستوى")
        .setRequired(false)
    ),

  // =========================
  // تحديد روم إشعارات الفل
  // =========================

  new SlashCommandBuilder()
    .setName("تحديد-روم-الفل")
    .setDescription("تحديد الروم الذي تظهر فيه إشعارات الترقية")
    .addChannelOption(option =>
      option
        .setName("الروم")
        .setDescription("الروم الذي تظهر فيه رسائل الترقية")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    ),

  // =========================
  // لوحة التذاكر
  // =========================

  new SlashCommandBuilder()
    .setName("لوحة-تذاكر")
    .setDescription("إرسال لوحة فتح التذاكر")
    .addChannelOption(option =>
      option
        .setName("القناة")
        .setDescription("الروم الذي ستظهر فيه لوحة التذاكر")
        .setRequired(true)
        .addChannelTypes(ChannelType.GuildText)
    )

].map(command => command.toJSON());

// =========================
// تسجيل أوامر السلاش
// =========================

async function registerCommands() {
  try {
    console.log("⏳ جاري إنشاء أوامر السلاش...");

    const rest =
      new REST({ version: "10" }).setToken(TOKEN);

    const result =
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
      `✅ تم إنشاء ${result.length} أوامر سلاش بنجاح`
    );

  } catch (error) {
    console.error(
      "❌ خطأ أثناء إنشاء أوامر السلاش:"
    );

    console.error(error);
  }
}

// =========================
// تشغيل البوت
// =========================

client.once("ready", async () => {

  console.log(
    `✅ البوت شغال باسم ${client.user.tag}`
  );

  await registerCommands();

});

// =========================
// الردود التلقائية + XP
// =========================

client.on(
  "messageCreate",
  async message => {

    if (message.author.bot) return;
    if (!message.guild) return;

    // =========================
    // الرد التلقائي
    // =========================

    try {

      const replies =
        loadAutoReplies();

      const content =
        message.content.toLowerCase();

      for (const trigger in replies) {

        if (
          content.includes(
            trigger.toLowerCase()
          )
        ) {

          await message.reply(
            replies[trigger]
          );

          break;
        }
      }

    } catch (error) {

      console.error(
        "❌ خطأ في نظام الرد التلقائي:",
        error
      );

    }

    // =========================
    // نظام XP
    // =========================

    try {

      const cooldownKey =
        `${message.guild.id}_${message.author.id}`;

      const now =
        Date.now();

      const lastTime =
        xpCooldown.get(
          cooldownKey
        ) || 0;

      // XP مرة كل دقيقة لكل عضو
      if (
        now - lastTime <
        60 * 1000
      ) {
        return;
      }

      xpCooldown.set(
        cooldownKey,
        now
      );

      const data =
        loadLevels();

      const guildId =
        message.guild.id;

      const userId =
        message.author.id;

      if (!data[guildId]) {
        data[guildId] = {};
      }

      if (!data[guildId][userId]) {

        data[guildId][userId] = {
          xp: 0,
          level: 1
        };

      }

      const entry =
        data[guildId][userId];

      // من 15 إلى 25 XP
      const earnedXp =
        Math.floor(
          Math.random() * 11
        ) + 15;

      entry.xp += earnedXp;

      let leveledUp = false;

      // =========================
      // الترقية
      // =========================

      while (
        entry.xp >=
        xpNeededForLevel(
          entry.level
        )
      ) {

        entry.xp -=
          xpNeededForLevel(
            entry.level
          );

        entry.level++;

        leveledUp = true;
      }

      saveLevels(data);

      // =========================
      // إشعار الترقية
      // =========================

      if (leveledUp) {

        const levelUpChannels =
          loadXPLevelUpChannel();

        const levelUpChannelId =
          levelUpChannels[
            message.guild.id
          ];

        if (levelUpChannelId) {

          const levelUpChannel =
            message.guild.channels.cache.get(
              levelUpChannelId
            );

          if (levelUpChannel) {

            await levelUpChannel
              .send({
                content:
                  `🎉 مبروك ${message.author}!\n\n` +
                  `لقد ترقيت إلى المستوى **${entry.level}** 🎊`
              })
              .catch(() => {});

          }

        }

      }

    } catch (error) {

      console.error(
        "❌ خطأ في نظام المستويات:",
        error
      );

    }

  }
);

// =========================
// دالة الحصول على رقم التذكرة
// =========================

function getNextTicketNumber(
  guildId
) {

  const data =
    loadCounters();

  if (!data.tickets) {
    data.tickets = {};
  }

  if (
    typeof data.tickets[guildId] !==
      "number" ||
    data.tickets[guildId] < 100
  ) {

    data.tickets[guildId] = 100;

  } else {

    data.tickets[guildId]++;

  }

  saveCounters(data);

  return data.tickets[guildId];
}

// =========================
// أزرار أنواع التذاكر
// =========================

function createTicketTypeRow(
  disabled = false
) {

  const complaintButton =
    new ButtonBuilder()
      .setCustomId(
        "نوع_تذكرة_شكوى"
      )
      .setLabel("تكت شكوى")
      .setEmoji("📢")
      .setStyle(
        ButtonStyle.Danger
      )
      .setDisabled(disabled);

  const supportButton =
    new ButtonBuilder()
      .setCustomId(
        "نوع_تذكرة_دعم"
      )
      .setLabel("تكت دعم فني")
      .setEmoji("🛠️")
      .setStyle(
        ButtonStyle.Primary
      )
      .setDisabled(disabled);

  const partnershipButton =
    new ButtonBuilder()
      .setCustomId(
        "نوع_تذكرة_شراكة"
      )
      .setLabel("تكت شراكة")
      .setEmoji("🤝")
      .setStyle(
        ButtonStyle.Success
      )
      .setDisabled(disabled);

  return new ActionRowBuilder()
    .addComponents(
      complaintButton,
      supportButton,
      partnershipButton
    );
}

// =========================
// التعامل مع التفاعلات
// =========================

client.on(
  "interactionCreate",
  async interaction => {

    try {

      // ==========================================
      // زر العداد
      // ==========================================

      if (
        interaction.isButton() &&
        interaction.customId.startsWith(
          "عداد_"
        )
      ) {

        const counterId =
          interaction.customId.replace(
            "عداد_",
            ""
          );

        const data =
          loadCounters();

        if (!data[counterId]) {

          data[counterId] = {
            count: 0,
            users: []
          };

        }

        const entry =
          data[counterId];

        if (
          entry.users.includes(
            interaction.user.id
          )
        ) {

          return interaction.reply({
            content:
              "⚠️ أنت ضغطت الزر من قبل، لا يمكنك الضغط مرة أخرى.",
            ephemeral: true
          });

        }

        entry.users.push(
          interaction.user.id
        );

        entry.count++;

        saveCounters(data);

        const newButton =
          new ButtonBuilder()
            .setCustomId(
              interaction.customId
            )
            .setLabel(
              `✅ ${entry.count}`
            )
            .setStyle(
              ButtonStyle.Success
            );

        const newRow =
          new ActionRowBuilder()
            .addComponents(
              newButton
            );

        return interaction.update({
          components: [newRow]
        });

      }

      // ==========================================
      // فتح التذكرة
      // ==========================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "فتح_تذكرة"
      ) {

        const existing =
          interaction.guild.channels.cache.find(
            c =>
              c.type ===
                ChannelType.GuildText &&
              c.topic &&
              c.topic.includes(
                `ticketOwner:${interaction.user.id}`
              )
          );

        if (existing) {

          return interaction.reply({
            content:
              `⚠️ لديك تذكرة مفتوحة بالفعل: ${existing}`,
            ephemeral: true
          });

        }

        await interaction.deferReply({
          ephemeral: true
        });

        const ticketNumber =
          getNextTicketNumber(
            interaction.guild.id
          );

        const username =
          interaction.user.username
            .toLowerCase()
            .replace(
              /[^a-z0-9\u0600-\u06FF-_]/g,
              ""
            )
            .slice(0, 20) ||
          "عضو";

        const channelName =
          `تذكرة-${ticketNumber}-${username}`;

        const ticketChannel =
          await interaction.guild.channels.create({

            name: channelName,

            type:
              ChannelType.GuildText,

            topic:
              `ticketOwner:${interaction.user.id}|ticketNumber:${ticketNumber}|ticketType:none`,

            permissionOverwrites: [

              {
                id:
                  interaction.guild.id,

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

          });

        // =========================
        // رسالة اختيار النوع
        // =========================

        await ticketChannel.send({

          content:
            `${interaction.user} <@&${TICKET_STAFF_ROLE_ID}>\n\n` +
            `🎫 **اختيار نوع التكت**\n\n` +
            `مرحبًا ${interaction.user}\n\n` +
            `**اختر نوع التكت المناسب لك من الأزرار بالأسفل:**\n\n` +
            `📢 **تكت شكوى**\n` +
            `للشكاوى والمشاكل ضد الأعضاء.\n\n` +
            `🛠️ **تكت دعم فني**\n` +
            `للمشاكل والاستفسارات الفنية.\n\n` +
            `🤝 **تكت شراكة**\n` +
            `لطلب شراكة بين السيرفرات.`,

          components: [
            createTicketTypeRow(false)
          ]

        });

        // =========================
        // زر الإغلاق
        // =========================

        const closeButton =
          new ButtonBuilder()
            .setCustomId(
              "اغلاق_تذكرة"
            )
            .setLabel(
              "🔒 إغلاق التذكرة"
            )
            .setStyle(
              ButtonStyle.Danger
            );

        const closeRow =
          new ActionRowBuilder()
            .addComponents(
              closeButton
            );

        await ticketChannel.send({

          content:
            "🔒 عند الانتهاء من التذكرة يمكن لصاحبها أو مسؤولي التذاكر إغلاقها.",

          components: [
            closeRow
          ]

        });

        // =========================
        // لوق فتح التذكرة
        // =========================

        await sendTicketLog(
          interaction.guild,

          `🎫 **فتح تذكرة جديدة**\n\n` +
          `👤 صاحب التذكرة: ${interaction.user}\n` +
          `🔢 رقم التذكرة: **${ticketNumber}**\n` +
          `📁 التذكرة: ${ticketChannel}\n` +
          `📌 النوع: لم يتم اختياره بعد`
        );

        return interaction.editReply({

          content:
            `✅ تم فتح التذكرة رقم **${ticketNumber}** هنا: ${ticketChannel}`

        });

      }

      // ==========================================
      // اختيار شكوى
      // ==========================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "نوع_تذكرة_شكوى"
      ) {

        return await handleTicketType(
          interaction,
          "شكوى"
        );

      }

      // ==========================================
      // اختيار دعم فني
      // ==========================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "نوع_تذكرة_دعم"
      ) {

        return await handleTicketType(
          interaction,
          "دعم فني"
        );

      }

      // ==========================================
      // اختيار شراكة
      // ==========================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "نوع_تذكرة_شراكة"
      ) {

        return await handleTicketType(
          interaction,
          "شراكة"
        );

      }

      // ==========================================
      // إغلاق التذكرة
      // ==========================================

      if (
        interaction.isButton() &&
        interaction.customId ===
          "اغلاق_تذكرة"
      ) {

        const topic =
          interaction.channel.topic ||
          "";

        const ownerMatch =
          topic.match(
            /ticketOwner:(\d+)/
          );

        const creatorId =
          ownerMatch
            ? ownerMatch[1]
            : null;

        if (
          !isTicketStaff(
            interaction.member
          ) &&
          interaction.user.id !==
            creatorId
        ) {

          return interaction.reply({
            content:
              "❌ لا يمكنك إغلاق هذه التذكرة.",
            ephemeral: true
          });

        }

        // =========================
        // بيانات اللوق قبل الحذف
        // =========================

        const numberMatch =
          topic.match(
            /ticketNumber:(\d+)/
          );

        const typeMatch =
          topic.match(
            /ticketType:([^|]+)/
          );

        const ticketNumber =
          numberMatch
            ? numberMatch[1]
            : "غير معروف";

        const ticketType =
          typeMatch
            ? typeMatch[1]
            : "غير محدد";

        await sendTicketLog(
          interaction.guild,

          `🔒 **إغلاق تذكرة**\n\n` +
          `👤 صاحب التذكرة: <@${creatorId}>\n` +
          `👮 أغلق التذكرة: ${interaction.user}\n` +
          `🔢 رقم التذكرة: **${ticketNumber}**\n` +
          `📌 النوع: **${ticketType}**\n` +
          `📁 اسم الروم: **${interaction.channel.name}**`
        );

        await interaction.reply(
          "🔒 سيتم إغلاق التذكرة خلال 5 ثواني..."
        );

        setTimeout(() => {

          interaction.channel
            .delete()
            .catch(() => {});

        }, 5000);

        return;
      }

      // ==========================================
      // أوامر السلاش
      // ==========================================

      if (
        !interaction.isChatInputCommand()
      ) {
        return;
      }

      // ==========================================
      // إعطاء رتبة
      // ==========================================

      if (
        interaction.commandName ===
        "اعطاء-رتبة"
      ) {

        const user =
          interaction.options.getUser(
            "العضو"
          );

        const member =
          await interaction.guild.members.fetch(
            user.id
          );

        const roles = [];

        for (
          let i = 0;
          i <= 19;
          i++
        ) {

          const name =
            i === 0
              ? "الرتبة-الأساسية"
              : `رتبة-جانبية-${i}`;

          const role =
            interaction.options.getRole(
              name
            );

          if (role) {
            roles.push(role);
          }

        }

        const botMember =
          interaction.guild.members.me;

        let added = 0;
        let skipped = 0;

        for (
          const role of roles
        ) {

          if (
            role.position >=
            botMember.roles.highest.position
          ) {

            skipped++;
            continue;

          }

          try {

            await member.roles.add(
              role
            );

            added++;

          } catch {

            skipped++;

          }

        }

        return interaction.reply({

          content:
            `✅ تم إعطاء ${member} عدد **${added}** رتبة.` +
            (
              skipped > 0
                ? `\n⚠️ تعذر إعطاء **${skipped}** رتبة.`
                : ""
            )

        });

      }

      // ==========================================
      // إزالة رتبة
      // ==========================================

      if (
        interaction.commandName ===
        "ازالة-رتبة"
      ) {

        const user =
          interaction.options.getUser(
            "العضو"
          );

        const member =
          await interaction.guild.members.fetch(
            user.id
          );

        const roles = [];

        for (
          let i = 0;
          i <= 19;
          i++
        ) {

          const name =
            i === 0
              ? "الرتبة-الأساسية"
              : `رتبة-جانبية-${i}`;

          const role =
            interaction.options.getRole(
              name
            );

          if (role) {
            roles.push(role);
          }

        }

        const botMember =
          interaction.guild.members.me;

        let removed = 0;
        let skipped = 0;

        for (
          const role of roles
        ) {

          if (
            role.position >=
            botMember.roles.highest.position
          ) {

            skipped++;
            continue;

          }

          try {

            await member.roles.remove(
              role
            );

            removed++;

          } catch {

            skipped++;

          }

        }

        try {

          const embed =
            new EmbedBuilder()
              .setTitle(
                "تم إزالة رتب منك"
              )
              .setDescription(
                `تمت إزالة **${removed}** رتبة منك في سيرفر **${interaction.guild.name}**.`
              )
              .setColor("Orange")
              .setTimestamp();

          await member.send({
            embeds: [embed]
          });

        } catch {

          console.log(
            `⚠️ الخاص مقفول لدى ${member.user.tag}`
          );

        }

        return interaction.reply({

          content:
            `✅ تم إزالة **${removed}** رتبة من ${member}.` +
            (
              skipped > 0
                ? `\n⚠️ تعذر إزالة **${skipped}** رتبة.`
                : ""
            )

        });

      }

      // ==========================================
      // تحذير
      // ==========================================

      if (
        interaction.commandName ===
        "تحذير"
      ) {

        const user =
          interaction.options.getUser(
            "العضو"
          );

        const reason =
          interaction.options.getString(
            "السبب"
          ) ||
          "غير محدد";

        const member =
          await interaction.guild.members.fetch(
            user.id
          );

        const data =
          loadWarnings();

        const guildId =
          interaction.guild.id;

        const userId =
          member.id;

        if (!data[guildId]) {
          data[guildId] = {};
        }

        if (!data[guildId][userId]) {
          data[guildId][userId] = 0;
        }

        data[guildId][userId]++;

        const count =
          data[guildId][userId];

        saveWarnings(data);

        await interaction.reply({

          content:
            `⚠️ تم تحذير ${member}\n` +
            `📌 السبب: ${reason}\n` +
            `📊 عدد التحذيرات: **${count}**`

        });

        try {

          const embed =
            new EmbedBuilder()
              .setTitle(
                "⚠️ تحذير جديد"
              )
              .setDescription(
                `تم تحذيرك في سيرفر **${interaction.guild.name}**.`
              )
              .addFields(
                {
                  name: "السبب",
                  value: reason
                },
                {
                  name: "عدد التحذيرات",
                  value: `${count}`
                }
              )
              .setColor("Red")
              .setTimestamp();

          await member.send({
            embeds: [embed]
          });

        } catch {

          console.log(
            `⚠️ الخاص مقفول لدى ${member.user.tag}`
          );

        }

        return;
      }

      // ==========================================
      // مسج الرتبة
      // ==========================================

      if (
        interaction.commandName ===
        "مسج-الرتبة"
      ) {

        const role =
          interaction.options.getRole(
            "الرتبة"
          );

        const message =
          interaction.options.getString(
            "الرسالة"
          );

        await interaction.deferReply({
          ephemeral: true
        });

        let success = 0;
        let failed = 0;

        for (
          const member of role.members.values()
        ) {

          try {

            await member.send(
              message
            );

            success++;

          } catch {

            failed++;

          }

        }

        return interaction.editReply(
          `📨 تم الإرسال إلى **${success}** عضو.\n` +
          `❌ فشل الإرسال إلى **${failed}** عضو.`
        );

      }

      // ==========================================
      // إرسال إيمبد
      // ==========================================

      if (
        interaction.commandName ===
        "ارسال-ايمبد"
      ) {

        const channel =
          interaction.options.getChannel(
            "مكان-الإرسال"
          );

        const insideText =
          interaction.options.getString(
            "الكلام-داخل-الإيمبد"
          );

        const topText =
          interaction.options.getString(
            "الكلام-فوق-الإيمبد"
          );

        const embed =
          new EmbedBuilder()
            .setDescription(
              insideText
            )
            .setColor("Blue")
            .setTimestamp();

        await channel.send({

          content:
            topText || "",

          embeds: [
            embed
          ]

        });

        return interaction.reply({

          content:
            `✅ تم إرسال الإيمبد في ${channel}.`,

          ephemeral: true

        });

      }

      // ==========================================
      // إرسال إعلان
      // ==========================================

      if (
        interaction.commandName ===
        "ارسال-اعلان"
      ) {

        const channel =
          interaction.options.getChannel(
            "مكان-الإعلان"
          );

        const message =
          interaction.options.getString(
            "الرسالة"
          );

        const embed =
          new EmbedBuilder()
            .setTitle(
              "📢 إعلان"
            )
            .setDescription(
              message
            )
            .setColor("Blue")
            .setTimestamp();

        await channel.send({
          embeds: [embed]
        });

        return interaction.reply({

          content:
            `✅ تم إرسال الإعلان في ${channel}.`,

          ephemeral: true

        });

      }

      // ==========================================
      // زر عداد
      // ==========================================

      if (
        interaction.commandName ===
        "زر-عداد"
      ) {

        const channel =
          interaction.options.getChannel(
            "مكان-الإرسال"
          );

        const messageText =
          interaction.options.getString(
            "الرسالة"
          );

        const counterId =
          `${Date.now()}_${Math.floor(
            Math.random() * 100000
          )}`;

        const data =
          loadCounters();

        data[counterId] = {

          count: 0,

          users: []

        };

        saveCounters(data);

        const button =
          new ButtonBuilder()
            .setCustomId(
              `عداد_${counterId}`
            )
            .setLabel(
              "✅ 0"
            )
            .setStyle(
              ButtonStyle.Success
            );

        const row =
          new ActionRowBuilder()
            .addComponents(
              button
            );

        await channel.send({

          content:
            messageText,

          components: [
            row
          ]

        });

        return interaction.reply({

          content:
            `✅ تم إرسال الرسالة مع زر العداد في ${channel}.`,

          ephemeral: true

        });

      }

      // ==========================================
      // إضافة رد
      // ==========================================

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
              "❌ ليس لديك صلاحية استخدام هذا الأمر.",

            ephemeral: true

          });

        }

        const trigger =
          interaction.options.getString(
            "الكلمة"
          );

        const response =
          interaction.options.getString(
            "الرد"
          );

        const data =
          loadAutoReplies();

        data[trigger] =
          response;

        saveAutoReplies(data);

        return interaction.reply({

          content:
            `✅ تم حفظ الرد التلقائي على كلمة **${trigger}**.`,

          ephemeral: true

        });

      }

      // ==========================================
      // تعديل رد
      // ==========================================

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
              "❌ ليس لديك صلاحية استخدام هذا الأمر.",

            ephemeral: true

          });

        }

        const trigger =
          interaction.options.getString(
            "الكلمة"
          );

        const newResponse =
          interaction.options.getString(
            "الرد-الجديد"
          );

        const data =
          loadAutoReplies();

        if (
          !Object.prototype.hasOwnProperty.call(
            data,
            trigger
          )
        ) {

          return interaction.reply({

            content:
              `⚠️ لا يوجد رد تلقائي مسجل على كلمة **${trigger}**.`,

            ephemeral: true

          });

        }

        data[trigger] =
          newResponse;

        saveAutoReplies(data);

        return interaction.reply({

          content:
            `✅ تم تعديل الرد التلقائي على كلمة **${trigger}** بنجاح.`,

          ephemeral: true

        });

      }

      // ==========================================
      // حذف رد
      // ==========================================

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
              "❌ ليس لديك صلاحية استخدام هذا الأمر.",

            ephemeral: true

          });

        }

        const trigger =
          interaction.options.getString(
            "الكلمة"
          );

        const data =
          loadAutoReplies();

        if (
          !Object.prototype.hasOwnProperty.call(
            data,
            trigger
          )
        ) {

          return interaction.reply({

            content:
              `⚠️ لا يوجد رد مسجل على كلمة **${trigger}**.`,

            ephemeral: true

          });

        }

        delete data[trigger];

        saveAutoReplies(data);

        return interaction.reply({

          content:
            `✅ تم حذف الرد التلقائي على كلمة **${trigger}**.`,

          ephemeral: true

        });

      }

      // ==========================================
      // قائمة الردود
      // ==========================================

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
              "❌ ليس لديك صلاحية استخدام هذا الأمر.",

            ephemeral: true

          });

        }

        const data =
          loadAutoReplies();

        const triggers =
          Object.keys(data);

        if (
          triggers.length === 0
        ) {

          return interaction.reply({

            content:
              "⚠️ لا توجد أي ردود تلقائية مسجلة حاليًا.",

            ephemeral: true

          });

        }

        const list =
          triggers
            .map(
              t =>
                `**${t}** ⬅️ ${data[t]}`
            )
            .join("\n");

        const embed =
          new EmbedBuilder()
            .setTitle(
              "📋 قائمة الردود التلقائية"
            )
            .setDescription(
              list
            )
            .setColor("Blue");

        return interaction.reply({

          embeds: [
            embed
          ],

          ephemeral: true

        });

      }

      // ==========================================
      // تحديد روم إشعارات الفل
      // ==========================================

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
              "❌ ليس لديك صلاحية استخدام هذا الأمر.",

            ephemeral: true

          });

        }

        const channel =
          interaction.options.getChannel(
            "الروم"
          );

        const data =
          loadXPLevelUpChannel();

        data[
          interaction.guild.id
        ] =
          channel.id;

        saveXPLevelUpChannel(
          data
        );

        return interaction.reply({

          content:
            `✅ تم تحديد روم إشعارات الفل: ${channel}\n\n` +
            `📈 الـXP ينحسب من **جميع الرومات**، ` +
            `وهذا الروم مخصص فقط لإشعارات الترقية.`,

          ephemeral: true

        });

      }

      // ==========================================
      // مستواي
      // ==========================================

      if (
        interaction.commandName ===
        "مستواي"
      ) {

        const targetUser =
          interaction.options.getUser(
            "العضو"
          ) ||
          interaction.user;

        const data =
          loadLevels();

        const guildId =
          interaction.guild.id;

        const entry =
          (
            data[guildId] &&
            data[guildId][
              targetUser.id
            ]
          ) ||
          {
            xp: 0,
            level: 1
          };

        const embed =
          new EmbedBuilder()
            .setTitle(
              `📊 مستوى ${targetUser.username}`
            )
            .setDescription(
              `**المستوى:** ${entry.level}\n` +
              `**النقاط:** ${entry.xp} / ${xpNeededForLevel(entry.level)}`
            )
            .setColor("Green")
            .setThumbnail(
              targetUser.displayAvatarURL()
            );

        return interaction.reply({

          embeds: [
            embed
          ]

        });

      }

      // ==========================================
      // المتصدرين
      // ==========================================

      if (
        interaction.commandName ===
        "المتصدرين"
      ) {

        const data =
          loadLevels();

        const guildId =
          interaction.guild.id;

        const guildData =
          data[guildId] ||
          {};

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
            .slice(0, 10);

        if (
          sorted.length === 0
        ) {

          return interaction.reply(
            "⚠️ لا يوجد أي نشاط مسجل بعد."
          );

        }

        const list =
          sorted
            .map(
              (entry, index) =>
                `**${index + 1}.** <@${entry[0]}> — المستوى ${entry[1].level} (${entry[1].xp} نقطة)`
            )
            .join("\n");

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🏆 قائمة المتصدرين"
            )
            .setDescription(
              list
            )
            .setColor("Gold");

        return interaction.reply({

          embeds: [
            embed
          ]

        });

      }

      // ==========================================
      // تعديل مستوى
      // ==========================================

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
              "❌ ليس لديك صلاحية استخدام هذا الأمر.",

            ephemeral: true

          });

        }

        const targetUser =
          interaction.options.getUser(
            "العضو"
          );

        const newLevel =
          interaction.options.getInteger(
            "المستوى"
          );

        const newXp =
          interaction.options.getInteger(
            "النقاط"
          ) || 0;

        const data =
          loadLevels();

        const guildId =
          interaction.guild.id;

        if (!data[guildId]) {
          data[guildId] = {};
        }

        data[guildId][
          targetUser.id
        ] = {

          level:
            newLevel,

          xp:
            newXp

        };

        saveLevels(data);

        return interaction.reply({

          content:
            `✅ تم تعديل مستوى ${targetUser} إلى **${newLevel}** بنقاط **${newXp}**.`

        });

      }

      // ==========================================
      // لوحة التذاكر
      // ==========================================

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
              "❌ ليس لديك صلاحية استخدام هذا الأمر.",

            ephemeral: true

          });

        }

        const channel =
          interaction.options.getChannel(
            "القناة"
          );

        const embed =
          new EmbedBuilder()
            .setTitle(
              "🎫 نظام التذاكر"
            )
            .setDescription(
              "اضغط على الزر بالأسفل لفتح تذكرة خاصة بك."
            )
            .setColor("Blue")
            .setTimestamp();

        const button =
          new ButtonBuilder()
            .setCustomId(
              "فتح_تذكرة"
            )
            .setLabel(
              "📩 فتح تذكرة"
            )
            .setStyle(
              ButtonStyle.Primary
            );

        const row =
          new ActionRowBuilder()
            .addComponents(
              button
            );

        await channel.send({

          embeds: [
            embed
          ],

          components: [
            row
          ]

        });

        return interaction.reply({

          content:
            `✅ تم إرسال لوحة التذاكر في ${channel}.`,

          ephemeral: true

        });

      }

    } catch (error) {

      console.error(
        "❌ حدث خطأ أثناء تنفيذ الأمر:"
      );

      console.error(error);

      if (
        interaction.replied ||
        interaction.deferred
      ) {

        await interaction
          .followUp({

            content:
              "❌ حدث خطأ أثناء تنفيذ الأمر.",

            ephemeral: true

          })
          .catch(() => {});

      } else {

        await interaction
          .reply({

            content:
              "❌ حدث خطأ أثناء تنفيذ الأمر.",

            ephemeral: true

          })
          .catch(() => {});

      }

    }

  }
);

// =========================
// معالجة اختيار نوع التذكرة
// =========================

async function handleTicketType(
  interaction,
  type
) {

  if (
    !interaction.channel ||
    interaction.channel.type !==
      ChannelType.GuildText
  ) {

    return interaction.reply({

      content:
        "❌ لا يمكن استخدام هذا الزر هنا.",

      ephemeral: true

    });

  }

  const topic =
    interaction.channel.topic ||
    "";

  // =========================
  // التأكد من صاحب التذكرة
  // =========================

  const ownerMatch =
    topic.match(
      /ticketOwner:(\d+)/
    );

  if (
    ownerMatch &&
    ownerMatch[1] !==
      interaction.user.id
  ) {

    return interaction.reply({

      content:
        "❌ فقط صاحب التذكرة يستطيع اختيار نوع التذكرة.",

      ephemeral: true

    });

  }

  // =========================
  // منع الاختيار مرة ثانية
  // =========================

  if (
    topic.includes(
      "ticketType:"
    ) &&
    !topic.includes(
      "ticketType:none"
    )
  ) {

    return interaction.reply({

      content:
        "⚠️ تم اختيار نوع التذكرة مسبقًا، ولا يمكنك تغييره.",

      ephemeral: true

    });

  }

  let formText = "";

  // =========================
  // شكوى
  // =========================

  if (
    type === "شكوى"
  ) {

    formText =
      `**__\n` +
      `نموذج تكت الشكوى\n\n` +
      `الأسم الكريم :\n` +
      `هويتك :\n` +
      `• الي مشتكي عليه\n` +
      `السبب :\n` +
      `دليلك :\n\n` +
      `يرجى عدم العبث بالنموذج + يرجى ارفاق دليل لمشكلتك\n` +
      `.. <@&${TICKET_STAFF_ROLE_ID}> __**`;

  }

  // =========================
  // دعم فني
  // =========================

  if (
    type === "دعم فني"
  ) {

    formText =
      `**__\n` +
      `نموذج تكت الدعم الفني\n\n` +
      `الأسم الكريم :\n` +
      `هويتك :\n` +
      `مـاهي المشكله التي تواجهها :\n` +
      `دليلك :\n\n` +
      `يرجى عدم العبث بالنموذج + يرجى ارفاق دليل لمشكلتك\n` +
      `.. <@&${TICKET_STAFF_ROLE_ID}> __**`;

  }

  // =========================
  // شراكة
  // =========================

  if (
    type === "شراكة"
  ) {

    formText =
      `**__ نموذج تكت شراكة\n` +
      `• أسم السيرفر :\n` +
      `• عدد الأعضاء :\n` +
      `• عليه بلاك ليست من سيرفرات معروفه ؟ :\n` +
      `• السيرفر متفاعل ؟ :\n\n` +
      `ملاحضه السيرفر يكون عدد أعضائه فوق ال 200 ويكون متفاعل وادارتك يخشون عندي ولو احد طلع من الؤنرات تنلغي الشراكه\n` +
      `|| @here ||\n` +
      `|| @everyone ||\n` +
      `.. __**`;

  }

  // =========================
  // تحديث Topic
  // =========================

  const newTopic =
    topic.replace(
      "ticketType:none",
      `ticketType:${type}`
    );

  await interaction.channel
    .setTopic(newTopic)
    .catch(() => {});

  // =========================
  // تعطيل أزرار اختيار النوع
  // =========================

  const disabledRow =
    createTicketTypeRow(
      true
    );

  // =========================
  // تحديث رسالة الأزرار
  // =========================

  await interaction.update({

    components: [
      disabledRow
    ]

  });

  // =========================
  // إرسال النموذج كرسالة عادية
  // =========================

  if (
    type === "شراكة"
  ) {

    await interaction.channel.send({

      content:
        `@here\n@everyone\n\n${formText}`,

      allowedMentions: {
        parse: ["everyone"]
      }

    });

  } else {

    await interaction.channel.send({

      content:
        formText

    });

  }

  // =========================
  // لوق اختيار نوع التذكرة
  // =========================

  const numberMatch =
    newTopic.match(
      /ticketNumber:(\d+)/
    );

  const ticketNumber =
    numberMatch
      ? numberMatch[1]
      : "غير معروف";

  await sendTicketLog(
    interaction.guild,

    `📌 **تم اختيار نوع التذكرة**\n\n` +
    `👤 صاحب التذكرة: ${interaction.user}\n` +
    `🔢 رقم التذكرة: **${ticketNumber}**\n` +
    `📁 التذكرة: ${interaction.channel}\n` +
    `📌 النوع: **${type}**`
  );

}

// =========================
// تسجيل الدخول
// =========================

client
  .login(TOKEN)
  .then(() => {

    console.log(
      "✅ تم تسجيل الدخول إلى Discord"
    );

  })
  .catch(error => {

    console.error(
      "❌ فشل تسجيل الدخول:"
    );

    console.error(error);

  });
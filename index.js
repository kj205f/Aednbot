

const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");
require("dotenv").config();

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const CLIENT_ID = process.env.CLIENT_ID;

const WARN_FILE = "warnings.json";

if (!TOKEN || !GUILD_ID || !CLIENT_ID) {
  console.error("❌ تأكد من وجود DISCORD_TOKEN و GUILD_ID و CLIENT_ID في Environment Variables");
  process.exit(1);
}

// =========================
// البوت
// =========================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

// =========================
// تحميل التحذيرات
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
// أوامر السلاش
// =========================

const commands = [

  // إعطاء رتبة
  new SlashCommandBuilder()
    .setName("اعطاء-رتبة")
    .setDescription("إعطاء رتبة لعضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو المستهدف")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName("الرتبة")
        .setDescription("الرتبة المراد إعطاؤها")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  // إزالة رتبة
  new SlashCommandBuilder()
    .setName("ازالة-رتبة")
    .setDescription("إزالة رتبة من عضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو المستهدف")
        .setRequired(true)
    )
    .addRoleOption(option =>
      option
        .setName("الرتبة")
        .setDescription("الرتبة المراد إزالتها")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles),

  // تحذير
  new SlashCommandBuilder()
    .setName("تحذير")
    .setDescription("تحذير عضو")
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),

  // رسالة خاصة للرتبة
  new SlashCommandBuilder()
    .setName("مسج-الرتبة")
    .setDescription("إرسال رسالة خاصة لجميع أعضاء رتبة معينة")
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
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

].map(command => command.toJSON());

// =========================
// إنشاء أوامر السلاش تلقائيًا
// =========================

async function registerCommands() {
  try {
    console.log("⏳ جاري إنشاء أوامر السلاش...");

    const rest = new REST({ version: "10" }).setToken(TOKEN);

    await rest.put(
      Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
      {
        body: commands
      }
    );

    console.log(`✅ تم إنشاء ${commands.length} أوامر سلاش بنجاح`);
  } catch (error) {
    console.error("❌ حدث خطأ أثناء إنشاء أوامر السلاش:");
    console.error(error);
  }
}

// =========================
// عند تشغيل البوت
// =========================

client.once("ready", async () => {
  console.log(`✅ البوت شغال باسم ${client.user.tag}`);

  await registerCommands();
});

// =========================
// إعطاء رتبة
// =========================

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  try {

    // =========================
    // اعطاء-رتبة
    // =========================

    if (interaction.commandName === "اعطاء-رتبة") {

      const user = interaction.options.getUser("العضو");
      const role = interaction.options.getRole("الرتبة");

      const member = await interaction.guild.members.fetch(user.id);

      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية استخدام هذا الأمر.",
          ephemeral: true
        });
      }

      if (!role) {
        return interaction.reply({
          content: "❌ لم يتم العثور على الرتبة.",
          ephemeral: true
        });
      }

      if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({
          content: "❌ ما أقدر أعطي هذه الرتبة لأن رتبتها أعلى من أو مساوية لرتبتي.",
          ephemeral: true
        });
      }

      await member.roles.add(role);

      return interaction.reply({
        content: `✅ تم إعطاء رتبة **${role.name}** للعضو ${member}.`
      });
    }

    // =========================
    // ازالة-رتبة
    // =========================

    if (interaction.commandName === "ازالة-رتبة") {

      const user = interaction.options.getUser("العضو");
      const role = interaction.options.getRole("الرتبة");

      const member = await interaction.guild.members.fetch(user.id);

      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية استخدام هذا الأمر.",
          ephemeral: true
        });
      }

      if (role.position >= interaction.guild.members.me.roles.highest.position) {
        return interaction.reply({
          content: "❌ ما أقدر أزيل هذه الرتبة لأن رتبتها أعلى من أو مساوية لرتبتي.",
          ephemeral: true
        });
      }

      await member.roles.remove(role);

      await interaction.reply({
        content: `✅ تم إزالة رتبة **${role.name}** من العضو ${member}.`
      });

      try {

        const embed = new EmbedBuilder()
          .setTitle("تم إزالة رتبة عنك")
          .setDescription(
            `تمت إزالة رتبة **${role.name}** منك في سيرفر **${interaction.guild.name}**.`
          )
          .setColor("Orange");

        await member.send({
          embeds: [embed]
        });

      } catch {
        console.log(`⚠️ لا يمكن إرسال رسالة خاصة إلى ${member.user.tag}`);
      }
    }

    // =========================
    // تحذير
    // =========================

    if (interaction.commandName === "تحذير") {

      const user = interaction.options.getUser("العضو");
      const reason =
        interaction.options.getString("السبب") || "غير محدد";

      const member = await interaction.guild.members.fetch(user.id);

      if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية استخدام هذا الأمر.",
          ephemeral: true
        });
      }

      const data = loadWarnings();

      const guildId = interaction.guild.id;
      const userId = member.id;

      if (!data[guildId]) {
        data[guildId] = {};
      }

      if (!data[guildId][userId]) {
        data[guildId][userId] = 0;
      }

      // زيادة التحذير بدون أي حد أقصى
      data[guildId][userId]++;

      const count = data[guildId][userId];

      saveWarnings(data);

      await interaction.reply({
        content:
          `⚠️ تم تحذير ${member}\n` +
          `📌 السبب: ${reason}\n` +
          `📊 عدد التحذيرات: **${count}**`
      });

      // إرسال الخاص
      try {

        const embed = new EmbedBuilder()
          .setTitle("⚠️ تحذير جديد")
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
        console.log(`⚠️ لا يمكن إرسال رسالة خاصة إلى ${member.user.tag}`);
      }
    }

    // =========================
    // مسج-الرتبة
    // =========================

    if (interaction.commandName === "مسج-الرتبة") {

      const role = interaction.options.getRole("الرتبة");
      const message = interaction.options.getString("الرسالة");

      if (!interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
        return interaction.reply({
          content: "❌ ما عندك صلاحية استخدام هذا الأمر.",
          ephemeral: true
        });
      }

      await interaction.deferReply();

      let success = 0;
      let failed = 0;

      for (const member of role.members.values()) {

        try {

          await member.send(message);
          success++;

        } catch {

          failed++;

        }
      }

      await interaction.editReply(
        `📨 تم إرسال الرسالة إلى **${success}** عضو.\n` +
        `❌ فشل الإرسال إلى **${failed}** عضو.`
      );
    }

  } catch (error) {

    console.error("❌ حدث خطأ:");
    console.error(error);

    if (interaction.replied || interaction.deferred) {

      await interaction.followUp({
        content: "❌ حدث خطأ أثناء تنفيذ الأمر.",
        ephemeral: true
      }).catch(() => {});

    } else {

      await interaction.reply({
        content: "❌ حدث خطأ أثناء تنفيذ الأمر.",
        ephemeral: true
      }).catch(() => {});

    }
  }
});

// =========================
// تشغيل البوت
// =========================

client.login(TOKEN);
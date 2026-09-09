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

console.log("🚀 index.js بدأ التشغيل");

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
// إعدادات البوت
// =========================

const WARN_FILE = "warnings.json";

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
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
// إنشاء أمر إعطاء/إزالة الرتب
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
).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

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
).setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);

const commands = [

  // ==========================================
  // إعطاء رتبة
  // ==========================================

  giveRoleCommand,

  // ==========================================
  // إزالة رتبة
  // ==========================================

  removeRoleCommand,

  // ==========================================
  // تحذير
  // ==========================================

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

  // ==========================================
  // مسج الرتبة
  // ==========================================

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

  // ==========================================
  // إرسال إيمبد
  // ==========================================

  new SlashCommandBuilder()
    .setName("ارسال-ايمبد")
    .setDescription("إرسال رسالة مع إيمبد")

    // إجباري
    .addChannelOption(option =>
      option
        .setName("مكان-الإرسال")
        .setDescription("الروم الذي سيتم الإرسال فيه")
        .setRequired(true)
        .addChannelTypes(0)
    )

    // إجباري ويجب أن يأتي قبل الاختياري
    .addStringOption(option =>
      option
        .setName("الكلام-داخل-الإيمبد")
        .setDescription("الكلام الذي يظهر داخل الإيمبد")
        .setRequired(true)
    )

    // اختياري
    .addStringOption(option =>
      option
        .setName("الكلام-فوق-الإيمبد")
        .setDescription("الكلام الذي يظهر فوق الإيمبد")
        .setRequired(false)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    ),

  // ==========================================
  // إرسال إعلان
  // ==========================================

  new SlashCommandBuilder()
    .setName("ارسال-اعلان")
    .setDescription("إرسال إعلان في روم محدد")

    .addChannelOption(option =>
      option
        .setName("مكان-الإعلان")
        .setDescription("الروم الذي سيتم إرسال الإعلان فيه")
        .setRequired(true)
        .addChannelTypes(0)
    )

    .addStringOption(option =>
      option
        .setName("الرسالة")
        .setDescription("نص الإعلان")
        .setRequired(true)
    )

    .setDefaultMemberPermissions(
      PermissionFlagsBits.ManageMessages
    )

].map(command => command.toJSON());

// =========================
// تسجيل أوامر السلاش
// =========================

async function registerCommands() {
  try {
    console.log("⏳ جاري إنشاء أوامر السلاش...");

    const rest = new REST({ version: "10" }).setToken(TOKEN);

    const result = await rest.put(
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
// التعامل مع أوامر السلاش
// =========================

client.on(
  "interactionCreate",
  async interaction => {

    if (!interaction.isChatInputCommand()) {
      return;
    }

    try {

      // ==========================================
      // إعطاء رتبة
      // ==========================================

      if (
        interaction.commandName === "اعطاء-رتبة"
      ) {

        const user =
          interaction.options.getUser("العضو");

        const member =
          await interaction.guild.members.fetch(
            user.id
          );

        const roles = [];

        for (let i = 0; i <= 19; i++) {

          const name =
            i === 0
              ? "الرتبة-الأساسية"
              : `رتبة-جانبية-${i}`;

          const role =
            interaction.options.getRole(name);

          if (role) {
            roles.push(role);
          }
        }

        const botMember =
          interaction.guild.members.me;

        let added = 0;
        let skipped = 0;

        for (const role of roles) {

          if (
            role.position >=
            botMember.roles.highest.position
          ) {
            skipped++;
            continue;
          }

          try {

            await member.roles.add(role);
            added++;

          } catch {

            skipped++;

          }
        }

        return interaction.reply({
          content:
            `✅ تم إعطاء ${member} عدد **${added}** رتبة.` +
            (skipped > 0
              ? `\n⚠️ تعذر إعطاء **${skipped}** رتبة.`
              : "")
        });

      }

      // ==========================================
      // إزالة رتبة
      // ==========================================

      if (
        interaction.commandName === "ازالة-رتبة"
      ) {

        const user =
          interaction.options.getUser("العضو");

        const member =
          await interaction.guild.members.fetch(
            user.id
          );

        const roles = [];

        for (let i = 0; i <= 19; i++) {

          const name =
            i === 0
              ? "الرتبة-الأساسية"
              : `رتبة-جانبية-${i}`;

          const role =
            interaction.options.getRole(name);

          if (role) {
            roles.push(role);
          }
        }

        const botMember =
          interaction.guild.members.me;

        let removed = 0;
        let skipped = 0;

        for (const role of roles) {

          if (
            role.position >=
            botMember.roles.highest.position
          ) {
            skipped++;
            continue;
          }

          try {

            await member.roles.remove(role);
            removed++;

          } catch {

            skipped++;

          }
        }

        // رسالة خاصة
        try {

          const embed =
            new EmbedBuilder()
              .setTitle("تم إزالة رتب منك")
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
            (skipped > 0
              ? `\n⚠️ تعذر إزالة **${skipped}** رتبة.`
              : "")
        });

      }

      // ==========================================
      // تحذير
      // ==========================================

      if (
        interaction.commandName === "تحذير"
      ) {

        const user =
          interaction.options.getUser("العضو");

        const reason =
          interaction.options.getString("السبب") ||
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

        // إرسال التحذير للخاص
        try {

          const embed =
            new EmbedBuilder()
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
        interaction.commandName === "مسج-الرتبة"
      ) {

        const role =
          interaction.options.getRole("الرتبة");

        const message =
          interaction.options.getString("الرسالة");

        await interaction.deferReply({
          ephemeral: true
        });

        let success = 0;
        let failed = 0;

        for (
          const member of role.members.values()
        ) {

          try {

            await member.send(message);
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
        interaction.commandName === "ارسال-ايمبد"
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
            .setDescription(insideText)
            .setColor("Blue")
            .setTimestamp();

        await channel.send({
          content: topText || "",
          embeds: [embed]
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
        interaction.commandName === "ارسال-اعلان"
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
            .setTitle("📢 إعلان")
            .setDescription(message)
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

    } catch (error) {

      console.error(
        "❌ حدث خطأ أثناء تنفيذ الأمر:"
      );

      console.error(error);

      if (
        interaction.replied ||
        interaction.deferred
      ) {

        await interaction.followUp({
          content:
            "❌ حدث خطأ أثناء تنفيذ الأمر.",
          ephemeral: true
        }).catch(() => {});

      } else {

        await interaction.reply({
          content:
            "❌ حدث خطأ أثناء تنفيذ الأمر.",
          ephemeral: true
        }).catch(() => {});

      }

    }

  }
);

// =========================
// تسجيل الدخول
// =========================

client.login(TOKEN)
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
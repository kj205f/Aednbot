import os, zipfile, textwrap

base="/mnt/data/AN-BOT"
os.makedirs(base, exist_ok=True)

files={
"package.json": r'''{
  "name": "an-discord-bot",
  "version": "1.0.0",
  "description": "AN Discord management bot",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "discord.js": "^14.16.3",
    "dotenv": "^16.4.5"
  }
}''',

".env.example": r'''DISCORD_TOKEN=ضع_توكن_البوت_هنا
CLIENT_ID=ضع_Application_ID_هنا
''',

".gitignore": r'''node_modules/
.env
data.json
''',

"data.json": r'''{
  "guilds": {}
}''',

"index.js": r'''require("dotenv").config();

const fs = require("fs");
const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
  SlashCommandBuilder,
  REST,
  Routes,
  EmbedBuilder
} = require("discord.js");

const TOKEN = process.env.DISCORD_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;

if (!TOKEN || !CLIENT_ID) {
  console.error("ضع DISCORD_TOKEN و CLIENT_ID في ملف .env");
  process.exit(1);
}

const DATA_FILE = "./data.json";

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return { guilds: {} };
  }
}

function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

const db = loadData();

function guildConfig(guildId) {
  if (!db.guilds[guildId]) {
    db.guilds[guildId] = {
      primaryRoleId: null,
      extraRoleIds: []
    };
  }
  return db.guilds[guildId];
}

function allowedRoleIds(guildId) {
  const c = guildConfig(guildId);
  return [c.primaryRoleId, ...(c.extraRoleIds || [])].filter(Boolean);
}

function hasManagementPermission(member) {
  return member.permissions.has(PermissionsBitField.Flags.ManageRoles) ||
         member.permissions.has(PermissionsBitField.Flags.Administrator);
}

function roleIsAllowed(guildId, roleId) {
  return allowedRoleIds(guildId).includes(roleId);
}

const commands = [
  new SlashCommandBuilder()
    .setName("تحديد-رتبة")
    .setDescription("تحديد الرتبة الأساسية")
    .addRoleOption(o => o.setName("الرتبة").setDescription("الرتبة الأساسية").setRequired(true)),

  new SlashCommandBuilder()
    .setName("اضافة-رتبة")
    .setDescription("إضافة رتبة إلى قائمة الرتب المسموحة (حتى 20)")
    .addRoleOption(o => o.setName("الرتبة").setDescription("الرتبة").setRequired(true)),

  new SlashCommandBuilder()
    .setName("حذف-رتبة")
    .setDescription("حذف رتبة من قائمة الرتب المسموحة")
    .addRoleOption(o => o.setName("الرتبة").setDescription("الرتبة").setRequired(true)),

  new SlashCommandBuilder()
    .setName("قائمة-الرتب")
    .setDescription("عرض الرتب المسموحة"),

  new SlashCommandBuilder()
    .setName("اعطاء-رتبة")
    .setDescription("إعطاء رتبة مسموحة لعضو")
    .addUserOption(o => o.setName("العضو").setDescription("العضو").setRequired(true))
    .addRoleOption(o => o.setName("الرتبة").setDescription("الرتبة المسموحة").setRequired(true)),

  new SlashCommandBuilder()
    .setName("ازالة-رتبة")
    .setDescription("إزالة رتبة مسموحة من عضو")
    .addUserOption(o => o.setName("العضو").setDescription("العضو").setRequired(true))
    .addRoleOption(o => o.setName("الرتبة").setDescription("الرتبة المسموحة").setRequired(true)),

  new SlashCommandBuilder()
    .setName("تحذير")
    .setDescription("إرسال تحذير للعضو في الخاص")
    .addUserOption(o => o.setName("العضو").setDescription("العضو").setRequired(true))
    .addStringOption(o => o.setName("السبب").setDescription("سبب التحذير").setRequired(true)),

  new SlashCommandBuilder()
    .setName("تنويه")
    .setDescription("إرسال تنويه خاص لجميع أعضاء رتبة معينة")
    .addRoleOption(o => o.setName("الرتبة").setDescription("الرتبة المسموحة").setRequired(true))
    .addStringOption(o => o.setName("الرسالة").setDescription("نص التنويه").setRequired(true)),

  new SlashCommandBuilder()
    .setName("تغيير-اسم")
    .setDescription("تغيير اسم عضو في السيرفر")
    .addUserOption(o => o.setName("العضو").setDescription("العضو").setRequired(true))
    .addStringOption(o => o.setName("الاسم").setDescription("الاسم الجديد").setRequired(true))
].map(c => c.toJSON());

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(TOKEN);
  await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
  console.log("تم تسجيل أوامر السلاش.");
}

client.once("ready", async () => {
  console.log(`تم تشغيل البوت: ${client.user.tag}`);
  try {
    await registerCommands();
  } catch (err) {
    console.error("خطأ في تسجيل الأوامر:", err);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;
  if (!interaction.guild) {
    return interaction.reply({ content: "هذا الأمر يعمل داخل السيرفر فقط.", ephemeral: true });
  }

  const config = guildConfig(interaction.guild.id);
  const command = interaction.commandName;

  if (command === "تحديد-رتبة") {
    if (!hasManagementPermission(interaction.member))
      return interaction.reply({ content: "❌ تحتاج صلاحية إدارة الرتب أو Administrator.", ephemeral: true });

    const role = interaction.options.getRole("الرتبة", true);
    config.primaryRoleId = role.id;

    // إذا كانت موجودة ضمن الإضافية، نحذف التكرار.
    config.extraRoleIds = (config.extraRoleIds || []).filter(id => id !== role.id);
    saveData();

    return interaction.reply(`✅ تم تحديد ${role} كـ **الرتبة الأساسية**.`);
  }

  if (command === "اضافة-رتبة") {
    if (!hasManagementPermission(interaction.member))
      return interaction.reply({ content: "❌ تحتاج صلاحية إدارة الرتب أو Administrator.", ephemeral: true });

    const role = interaction.options.getRole("الرتبة", true);
    const ids = allowedRoleIds(interaction.guild.id);

    if (ids.includes(role.id))
      return interaction.reply({ content: "⚠️ هذه الرتبة مضافة بالفعل.", ephemeral: true });

    if (ids.length >= 20)
      return interaction.reply({ content: "❌ وصلت إلى الحد الأقصى: 20 رتبة.", ephemeral: true });

    if (!config.primaryRoleId) {
      config.primaryRoleId = role.id;
      saveData();
      return interaction.reply(`✅ لم تكن هناك رتبة أساسية، لذلك تم تعيين ${role} كرتبة أساسية.`);
    }

    config.extraRoleIds.push(role.id);
    saveData();
    return interaction.reply(`✅ تمت إضافة ${role}. العدد الآن: **${allowedRoleIds(interaction.guild.id).length}/20**.`);
  }

  if (command === "حذف-رتبة") {
    if (!hasManagementPermission(interaction.member))
      return interaction.reply({ content: "❌ تحتاج صلاحية إدارة الرتب أو Administrator.", ephemeral: true });

    const role = interaction.options.getRole("الرتبة", true);

    if (config.primaryRoleId === role.id) {
      config.primaryRoleId = null;
      saveData();
      return interaction.reply(`✅ تم حذف ${role} من الرتبة الأساسية. استخدم /تحديد-رتبة لتعيين أساسية جديدة.`);
    }

    if (!config.extraRoleIds.includes(role.id))
      return interaction.reply({ content: "⚠️ هذه الرتبة ليست ضمن القائمة.", ephemeral: true });

    config.extraRoleIds = config.extraRoleIds.filter(id => id !== role.id);
    saveData();
    return interaction.reply(`✅ تم حذف ${role} من القائمة.`);
  }

  if (command === "قائمة-الرتب") {
    const ids = allowedRoleIds(interaction.guild.id);
    if (!ids.length)
      return interaction.reply("لا توجد رتب محددة حاليًا.");

    const lines = ids.map((id, i) => {
      const role = interaction.guild.roles.cache.get(id);
      return `${i + 1}. ${role ? role.toString() : `رتبة محذوفة (${id})`}${id === config.primaryRoleId ? " — **أساسية**" : ""}`;
    });

    return interaction.reply(`**الرتب المسموحة (${ids.length}/20):**\n${lines.join("\n")}`);
  }

  if (["اعطاء-رتبة", "ازالة-رتبة"].includes(command)) {
    if (!hasManagementPermission(interaction.member))
      return interaction.reply({ content: "❌ تحتاج صلاحية إدارة الرتب أو Administrator.", ephemeral: true });

    const user = interaction.options.getUser("العضو", true);
    const role = interaction.options.getRole("الرتبة", true);

    if (!roleIsAllowed(interaction.guild.id, role.id))
      return interaction.reply({ content: "❌ هذه الرتبة غير موجودة ضمن الـ20 رتبة المسموحة.", ephemeral: true });

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member)
      return interaction.reply({ content: "❌ لم أستطع العثور على العضو.", ephemeral: true });

    if (!role.editable)
      return interaction.reply({ content: "❌ البوت لا يستطيع إدارة هذه الرتبة. تأكد أن رتبة البوت أعلى منها.", ephemeral: true });

    try {
      if (command === "اعطاء-رتبة") {
        await member.roles.add(role);
        return interaction.reply(`✅ تم إعطاء ${role} إلى ${member}.`);
      } else {
        await member.roles.remove(role);
        return interaction.reply(`✅ تم إزالة ${role} من ${member}.`);
      }
    } catch {
      return interaction.reply({ content: "❌ حدث خطأ أثناء تعديل الرتبة.", ephemeral: true });
    }
  }

  if (command === "تحذير") {
    if (!hasManagementPermission(interaction.member))
      return interaction.reply({ content: "❌ ليس لديك صلاحية استخدام هذا الأمر.", ephemeral: true });

    const user = interaction.options.getUser("العضو", true);
    const reason = interaction.options.getString("السبب", true);

    const embed = new EmbedBuilder()
      .setTitle("⚠️ تحذير إداري")
      .setDescription(`تم توجيه تحذير لك في **${interaction.guild.name}**.\n\n**السبب:** ${reason}`)
      .setFooter({ text: "AN Management" })
      .setTimestamp();

    try {
      await user.send({ embeds: [embed] });
      return interaction.reply(`✅ تم إرسال التحذير إلى ${user} في الخاص.`);
    } catch {
      return interaction.reply({ content: "⚠️ لم أستطع إرسال الخاص للعضو (قد تكون رسائله الخاصة مغلقة).", ephemeral: true });
    }
  }

  if (command === "تنويه") {
    if (!hasManagementPermission(interaction.member))
      return interaction.reply({ content: "❌ ليس لديك صلاحية استخدام هذا الأمر.", ephemeral: true });

    const role = interaction.options.getRole("الرتبة", true);
    const message = interaction.options.getString("الرسالة", true);

    if (!roleIsAllowed(interaction.guild.id, role.id))
      return interaction.reply({ content: "❌ اختر رتبة من الرتب المسموحة.", ephemeral: true });

    await interaction.deferReply({ ephemeral: true });

    const members = await interaction.guild.members.fetch();
    const targets = members.filter(m => !m.user.bot && m.roles.cache.has(role.id));

    let sent = 0;
    let failed = 0;

    for (const member of targets.values()) {
      try {
        await member.send({
          embeds: [
            new EmbedBuilder()
              .setTitle("📢 تنويه")
              .setDescription(message)
              .setFooter({ text: interaction.guild.name })
              .setTimestamp()
          ]
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return interaction.editReply(`✅ تم إرسال التنويه.\n📨 نجح: **${sent}**\n❌ تعذر الإرسال: **${failed}**`);
  }

  if (command === "تغيير-اسم") {
    if (!hasManagementPermission(interaction.member))
      return interaction.reply({ content: "❌ تحتاج صلاحية إدارة الألقاب أو Administrator.", ephemeral: true });

    const user = interaction.options.getUser("العضو", true);
    const name = interaction.options.getString("الاسم", true);

    if (name.length > 32)
      return interaction.reply({ content: "❌ الاسم يجب ألا يتجاوز 32 حرفًا.", ephemeral: true });

    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member)
      return interaction.reply({ content: "❌ لم أستطع العثور على العضو.", ephemeral: true });

    if (!member.manageable)
      return interaction.reply({ content: "❌ لا أستطيع تغيير اسم هذا العضو. تأكد من ترتيب رتب البوت.", ephemeral: true });

    try {
      await member.setNickname(name);
      return interaction.reply(`✅ تم تغيير اسم ${member} إلى **${name}**.`);
    } catch {
      return interaction.reply({ content: "❌ حدث خطأ أثناء تغيير الاسم.", ephemeral: true });
    }
  }
});

client.login(TOKEN);
''',

"README.md": r'''# AN Discord Bot

بوت إدارة لسيرفر Discord باستخدام Node.js و discord.js.

## الأوامر

- `/تحديد-رتبة`
- `/اضافة-رتبة`
- `/حذف-رتبة`
- `/قائمة-الرتب`
- `/اعطاء-رتبة`
- `/ازالة-رتبة`
- `/تحذير`
- `/تنويه`
- `/تغيير-اسم`

### نظام الرتب

يوجد حد أقصى 20 رتبة:
- رتبة أساسية واحدة.
- 19 رتبة إضافية.

الإعدادات محفوظة في `data.json`.

## التشغيل

1. ثبّت Node.js.
2. شغّل:
   `npm install`
3. انسخ `.env.example` إلى `.env`.
4. ضع توكن البوت و Application ID.
5. شغّل:
   `npm start`

## صلاحيات البوت

لإدارة الرتب والأسماء يحتاج البوت إلى الصلاحيات المناسبة، والأهم أن تكون رتبة البوت أعلى من الرتب التي سيديرها.

لإرسال التنويهات في الخاص، أعضاء السيرفر الذين أغلقوا الرسائل الخاصة قد لا يستقبلونها.

> لا ترفع ملف `.env` إلى GitHub.
'''
}

for path, content in files.items():
    with open(os.path.join(base,path),"w",encoding="utf-8") as f:
        f.write(content)

zip_path="/mnt/data/AN-BOT.zip"
with zipfile.ZipFile(zip_path,"w",zipfile.ZIP_DEFLATED) as z:
    for path in files:
        z.write(os.path.join(base,path), arcname=f"AN-BOT/{path}")

print(f"تم تجهيز المشروع: {zip_path}")
print("الملفات:", ", ".join(files.keys()))

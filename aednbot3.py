# ===================================================
# بوت ديسكورد - Python (discord.py 2.x)
# ===================================================
# التثبيت:
#   pip install discord.py python-dotenv
#
# أنشئ ملف .env بجانب هذا الملف وحط فيه:
#   DISCORD_TOKEN=توكن البوت
#   GUILD_ID=آيدي السيرفر اللي راح تسجل فيه الأوامر
#
# ملاحظة: لازم تفعّل "Server Members Intent" من بوابة المطورين
# (Discord Developer Portal > Bot > Privileged Gateway Intents)
#
# التشغيل:
#   python discord_bot.py
# ===================================================

import os
import json
import discord
from discord import app_commands
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID"))
WARN_FILE = "warnings.json"
MAX_WARNINGS = 20

intents = discord.Intents.default()
intents.members = True


class MyBot(discord.Client):
    def __init__(self):
        super().__init__(intents=intents)
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self):
        guild = discord.Object(id=GUILD_ID)
        self.tree.copy_global_to(guild=guild)
        print("⏳ جاري مزامنة أوامر السلاش...")
        synced = await self.tree.sync(guild=guild)
        print(f"✅ تم مزامنة أوامر السلاش ({len(synced)} أمر)")


client = MyBot()


def load_warnings():
    if not os.path.exists(WARN_FILE):
        return {}
    with open(WARN_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def save_warnings(data):
    with open(WARN_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


@client.event
async def on_ready():
    print(f"✅ البوت شغال باسم {client.user}")


# ===== اعطاء رتبة (بدون خاص) =====
@client.tree.command(name="اعطاء-رتبة", description="إعطاء رتبة لعضو")
@app_commands.describe(العضو="العضو المستهدف", الرتبة="الرتبة المراد إعطاؤها")
@app_commands.checks.has_permissions(manage_roles=True)
async def give_role(interaction: discord.Interaction, العضو: discord.Member, الرتبة: discord.Role):
    await العضو.add_roles(الرتبة)
    await interaction.response.send_message(f"✅ تم إعطاء رتبة **{الرتبة.name}** للعضو {العضو.mention}.")


# ===== إزالة رتبة (+ رسالة خاصة) =====
@client.tree.command(name="ازالة-رتبة", description="إزالة رتبة من عضو")
@app_commands.describe(العضو="العضو المستهدف", الرتبة="الرتبة المراد إزالتها")
@app_commands.checks.has_permissions(manage_roles=True)
async def remove_role(interaction: discord.Interaction, العضو: discord.Member, الرتبة: discord.Role):
    await العضو.remove_roles(الرتبة)
    await interaction.response.send_message(f"✅ تم إزالة رتبة **{الرتبة.name}** من العضو {العضو.mention}.")
    try:
        embed = discord.Embed(
            title="تم إزالة رتبة عنك",
            description=f"تمت إزالة رتبة **{الرتبة.name}** منك في سيرفر **{interaction.guild.name}**.",
            color=discord.Color.orange(),
        )
        await العضو.send(embed=embed)
    except discord.Forbidden:
        pass  # الخاص مقفول


# ===== تحذير (حد أقصى 20 + رسالة خاصة + طرد تلقائي) =====
@client.tree.command(name="تحذير", description="تحذير عضو (الحد الأقصى 20 تحذير)")
@app_commands.describe(العضو="العضو المستهدف", السبب="سبب التحذير")
@app_commands.checks.has_permissions(moderate_members=True)
async def warn(interaction: discord.Interaction, العضو: discord.Member, السبب: str = "غير محدد"):
    data = load_warnings()
    gid = str(interaction.guild.id)
    uid = str(العضو.id)
    data.setdefault(gid, {})
    data[gid][uid] = data[gid].get(uid, 0) + 1
    count = data[gid][uid]
    save_warnings(data)

    await interaction.response.send_message(f"⚠️ تم تحذير {العضو.mention} ({count}/{MAX_WARNINGS}). السبب: {السبب}")

    try:
        embed = discord.Embed(
            title="تحذير جديد",
            description=f"تم تحذيرك في سيرفر **{interaction.guild.name}**.",
            color=discord.Color.red(),
        )
        embed.add_field(name="السبب", value=السبب)
        embed.add_field(name="عدد التحذيرات", value=f"{count}/{MAX_WARNINGS}")
        await العضو.send(embed=embed)
    except discord.Forbidden:
        pass

    if count >= MAX_WARNINGS:
        data[gid][uid] = 0  # تصفير بعد الطرد
        save_warnings(data)
        try:
            await العضو.kick(reason="تجاوز الحد الأقصى للتحذيرات (20)")
            await interaction.followup.send(f"🚫 تم طرد {العضو.mention} لتجاوزه الحد الأقصى للتحذيرات.")
        except discord.Forbidden:
            await interaction.followup.send("⚠️ وصل للحد الأقصى لكن ما قدرت أطرده (صلاحيات البوت غير كافية).")


# ===== رسالة خاصة لجميع أعضاء رتبة معينة =====
@client.tree.command(name="مسج-الرتبة", description="إرسال رسالة خاصة لجميع أعضاء رتبة معينة")
@app_commands.describe(الرتبة="الرتبة المستهدفة", الرسالة="نص الرسالة")
@app_commands.checks.has_permissions(manage_roles=True)
async def dm_role(interaction: discord.Interaction, الرتبة: discord.Role, الرسالة: str):
    await interaction.response.defer()
    success, failed = 0, 0
    for member in الرتبة.members:
        try:
            await member.send(الرسالة)
            success += 1
        except discord.Forbidden:
            failed += 1
    await interaction.followup.send(f"📨 تم الإرسال إلى {success} عضو، وفشل الإرسال لـ {failed} عضو (خاصهم مقفول أو غادروا السيرفر).")


# ===== معالجة الأخطاء (صلاحيات ناقصة إلخ) =====
@give_role.error
@remove_role.error
@warn.error
@dm_role.error
async def on_cmd_error(interaction: discord.Interaction, error):
    if isinstance(error, app_commands.MissingPermissions):
        await interaction.response.send_message("❌ ما عندك صلاحية تستخدم هذا الأمر.", ephemeral=True)
    else:
        await interaction.response.send_message(f"❌ صار خطأ: {error}", ephemeral=True)


client.run(TOKEN)

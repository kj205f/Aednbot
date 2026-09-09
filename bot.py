import discord
from discord.ext import commands
from discord import app_commands
import asyncio
from dotenv import load_dotenv
import os
from datetime import datetime

# تحميل متغيرات البيئة
load_dotenv()

# إعداد البوت
intents = discord.Intents.default()
intents.members = True
intents.guilds = True
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)

# تخزين مؤقت للتحذيرات
warnings_dict = {}

@bot.event
async def on_ready():
    print(f'✅ {bot.user} تم تسجيل الدخول بنجاح!')
    try:
        synced = await bot.tree.sync()
        print(f"✅ تم مزامجة {len(synced)} أمر سلاش")
    except Exception as e:
        print(f"❌ خطأ في المزامجة: {e}")

# ====================================
# الأمر الأول: إعطاء رتبة لـ 20 عضو
# ====================================
@bot.tree.command(name="add_role_20", description="إعطاء رتبة لـ 20 عضو")
@app_commands.describe(
    role="الرتبة المراد إعطاؤها",
    count="عدد الأعضاء (الحد الأقصى 20)"
)
@app_commands.checks.has_permissions(manage_roles=True)
async def add_role_20(interaction: discord.Interaction, role: discord.Role, count: int = 20):
    """إعطاء رتبة لـ 20 عضو"""
    
    if count > 20:
        await interaction.response.send_message("❌ الحد الأقصى 20 عضو", ephemeral=True)
        return
    
    try:
        await interaction.response.defer(ephemeral=True)
        
        # الحصول على أعضاء بدون الرتبة
        members_without_role = [m for m in interaction.guild.members if role not in m.roles and not m.bot][:count]
        
        if not members_without_role:
            await interaction.followup.send(f"⚠️ لا يوجد أعضاء بدون رتبة {role.mention}", ephemeral=True)
            return
        
        successful = 0
        failed = 0
        
        for member in members_without_role:
            try:
                await member.add_roles(role)
                successful += 1
                await asyncio.sleep(0.3)
            except Exception as e:
                failed += 1
                print(f"❌ خطأ مع {member}: {e}")
        
        result_embed = discord.Embed(
            title="✅ تم إعطاء الرتبة",
            color=discord.Color.green()
        )
        result_embed.add_field(name="الرتبة:", value=role.mention, inline=True)
        result_embed.add_field(name="✅ نجح:", value=successful, inline=True)
        result_embed.add_field(name="❌ فشل:", value=failed, inline=True)
        
        await interaction.followup.send(embed=result_embed, ephemeral=True)
        
    except Exception as e:
        await interaction.followup.send(f"❌ خطأ: {str(e)}", ephemeral=True)

# ====================================
# الأمر الثاني: إزالة رتبة من 20 عضو
# ====================================
@bot.tree.command(name="remove_role_20", description="إزالة رتبة من 20 عضو")
@app_commands.describe(
    role="الرتبة المراد إزالتها",
    count="عدد الأعضاء (الحد الأقصى 20)"
)
@app_commands.checks.has_permissions(manage_roles=True)
async def remove_role_20(interaction: discord.Interaction, role: discord.Role, count: int = 20):
    """إزالة رتبة من 20 عضو"""
    
    if count > 20:
        await interaction.response.send_message("❌ الحد الأقصى 20 عضو", ephemeral=True)
        return
    
    try:
        await interaction.response.defer(ephemeral=True)
        
        # الحصول على أعضاء لديهم الرتبة
        members_with_role = [m for m in role.members if not m.bot][:count]
        
        if not members_with_role:
            await interaction.followup.send(f"⚠️ لا يوجد أعضاء برتبة {role.mention}", ephemeral=True)
            return
        
        successful = 0
        failed = 0
        
        for member in members_with_role:
            try:
                await member.remove_roles(role)
                successful += 1
                await asyncio.sleep(0.3)
            except Exception as e:
                failed += 1
                print(f"❌ خطأ مع {member}: {e}")
        
        result_embed = discord.Embed(
            title="✅ تم إزالة الرتبة",
            color=discord.Color.green()
        )
        result_embed.add_field(name="الرتبة:", value=role.mention, inline=True)
        result_embed.add_field(name="✅ نجح:", value=successful, inline=True)
        result_embed.add_field(name="❌ فشل:", value=failed, inline=True)
        
        await interaction.followup.send(embed=result_embed, ephemeral=True)
        
    except Exception as e:
        await interaction.followup.send(f"❌ خطأ: {str(e)}", ephemeral=True)

# ====================================
# الأمر الثالث: تحذير شخص بالخاص
# ====================================
@bot.tree.command(name="warn_member", description="تحذير عضو وإرسال رسالة خاصة")
@app_commands.describe(
    member="العضو المراد تحذيره",
    reason="سبب التحذير"
)
@app_commands.checks.has_permissions(moderate_members=True)
async def warn_member(interaction: discord.Interaction, member: discord.Member, reason: str):
    """تحذير عضو وإرسال رسالة خاصة له"""
    
    if member.bot:
        await interaction.response.send_message("❌ لا يمكن تحذير البوت", ephemeral=True)
        return
    
    if member == interaction.user:
        await interaction.response.send_message("❌ لا يمكن تحذير نفسك", ephemeral=True)
        return
    
    try:
        # حفظ التحذير
        if member.id not in warnings_dict:
            warnings_dict[member.id] = []
        
        warnings_dict[member.id].append({
            "reason": reason,
            "warned_by": interaction.user.name,
            "timestamp": discord.utils.utcnow()
        })
        
        # الرسالة الخاصة
        dm_embed = discord.Embed(
            title="⚠️ تنبيه تحذير",
            description=f"لقد تم تحذيرك من قبل {interaction.user.mention}",
            color=discord.Color.red()
        )
        dm_embed.add_field(name="السبب:", value=reason, inline=False)
        dm_embed.add_field(name="عدد التحذيرات:", value=len(warnings_dict[member.id]), inline=True)
        dm_embed.add_field(name="الخادم:", value=interaction.guild.name, inline=True)
        dm_embed.add_field(name="التاريخ:", value=f"<t:{int(discord.utils.utcnow().timestamp())}:f>", inline=False)
        dm_embed.set_footer(text="⚠️ احذر من تكرار هذا السلوك")
        
        try:
            await member.send(embed=dm_embed)
            sent_status = "✅ تم إرسال الرسالة الخاصة"
        except discord.Forbidden:
            sent_status = "⚠️ لم يتم إرسال الرسالة الخاصة (الخصوصية مغلقة)"
        
        # الرد
        success_embed = discord.Embed(
            title="✅ تم التحذير بنجاح",
            description=f"تم تحذير {member.mention}",
            color=discord.Color.green()
        )
        success_embed.add_field(name="العضو:", value=member.mention, inline=True)
        success_embed.add_field(name="السبب:", value=reason, inline=False)
        success_embed.add_field(name="عدد التحذيرات:", value=len(warnings_dict[member.id]), inline=True)
        success_embed.add_field(name="الحالة:", value=sent_status, inline=False)
        
        await interaction.response.send_message(embed=success_embed, ephemeral=True)
        
    except Exception as e:
        await interaction.response.send_message(f"❌ خطأ: {str(e)}", ephemeral=True)

# ====================================
# الأمر الرابع: تغيير اسم العضو
# ====================================
@bot.tree.command(name="change_nickname", description="تغيير اسم العضو في الخادم")
@app_commands.describe(
    member="العضو المراد تغيير اسمه",
    new_nickname="الاسم الجديد"
)
@app_commands.checks.has_permissions(manage_nicknames=True)
async def change_nickname(interaction: discord.Interaction, member: discord.Member, new_nickname: str):
    """تغيير اسم العضو في الخادم"""
    
    try:
        old_nickname = member.nick or member.name
        await member.edit(nick=new_nickname)
        
        # إرسال إشعار
        notify_embed = discord.Embed(
            title="📝 تم تغيير اسمك",
            description=f"تم تغيير اسمك في الخادم {interaction.guild.name}",
            color=discord.Color.blue()
        )
        notify_embed.add_field(name="الاسم القديم:", value=old_nickname, inline=True)
        notify_embed.add_field(name="الاسم الجديد:", value=new_nickname, inline=True)
        notify_embed.add_field(name="غيره:", value=interaction.user.mention, inline=False)
        
        try:
            await member.send(embed=notify_embed)
        except discord.Forbidden:
            pass
        
        # الرد
        success_embed = discord.Embed(
            title="✅ تم التغيير بنجاح",
            description=f"تم تغيير اسم {member.mention}",
            color=discord.Color.green()
        )
        success_embed.add_field(name="الاسم القديم:", value=old_nickname, inline=True)
        success_embed.add_field(name="الاسم الجديد:", value=new_nickname, inline=True)
        
        await interaction.response.send_message(embed=success_embed, ephemeral=True)
        
    except Exception as e:
        await interaction.response.send_message(f"❌ خطأ: {str(e)}", ephemeral=True)

# ====================================
# الأمر الخامس: رسالة للرتبة المخصصة بالخاص
# ====================================
@bot.tree.command(name="mass_dm", description="إرسال رسالة خاصة لجميع أعضاء برتبة معينة")
@app_commands.describe(
    role="الرتبة المراد الإرسال لأعضائها",
    message="الرسالة المراد إرسالها"
)
@app_commands.checks.has_permissions(manage_roles=True)
async def mass_dm(interaction: discord.Interaction, role: discord.Role, message: str):
    """إرسال رسالة خاصة لأعضاء برتبة معينة"""
    
    try:
        await interaction.response.defer(ephemeral=True)
        
        members_with_role = [m for m in role.members if not m.bot]
        
        if not members_with_role:
            await interaction.followup.send(f"⚠️ لا يوجد أعضاء برتبة {role.mention}", ephemeral=True)
            return
        
        successful = 0
        failed = 0
        
        for member in members_with_role:
            try:
                dm_embed = discord.Embed(
                    title="📨 رسالة من الخادم",
                    description=message,
                    color=discord.Color.blurple()
                )
                dm_embed.add_field(name="الرتبة:", value=role.mention, inline=False)
                dm_embed.set_footer(text=f"من: {interaction.guild.name} | المرسل: {interaction.user.name}")
                dm_embed.timestamp = discord.utils.utcnow()
                
                await member.send(embed=dm_embed)
                successful += 1
                await asyncio.sleep(0.5)
                
            except Exception as e:
                failed += 1
                print(f"❌ خطأ مع {member}: {e}")
        
        result_embed = discord.Embed(
            title="📊 تقرير الإرسال",
            color=discord.Color.green()
        )
        result_embed.add_field(name="الرتبة:", value=role.mention, inline=True)
        result_embed.add_field(name="✅ نجح:", value=successful, inline=True)
        result_embed.add_field(name="❌ فشل:", value=failed, inline=True)
        result_embed.add_field(name="📋 الإجمالي:", value=len(members_with_role), inline=True)
        result_embed.add_field(name="الرسالة:", value=message, inline=False)
        
        await interaction.followup.send(embed=result_embed, ephemeral=True)
        
    except Exception as e:
        await interaction.followup.send(f"❌ خطأ: {str(e)}", ephemeral=True)

# ====================================
# أمر عرض التحذيرات
# ====================================
@bot.tree.command(name="warnings", description="عرض عدد التحذيرات")
@app_commands.describe(
    member="العضو المراد عرض تحذيراته"
)
@app_commands.checks.has_permissions(moderate_members=True)
async def show_warnings(interaction: discord.Interaction, member: discord.Member):
    """عرض عدد التحذيرات للعضو"""
    
    try:
        if member.id not in warnings_dict or not warnings_dict[member.id]:
            await interaction.response.send_message(
                f"✅ {member.mention} ليس لديه أي تحذيرات",
                ephemeral=True
            )
            return
        
        warnings = warnings_dict[member.id]
        embed = discord.Embed(
            title=f"⚠️ تحذيرات {member.name}",
            color=discord.Color.red()
        )
        embed.add_field(name="العدد الكلي:", value=len(warnings), inline=True)
        
        for i, warning in enumerate(warnings, 1):
            embed.add_field(
                name=f"التحذير #{i}",
                value=f"**السبب:** {warning['reason']}\n**من:** {warning['warned_by']}\n**التاريخ:** <t:{int(warning['timestamp'].timestamp())}:f>",
                inline=False
            )
        
        await interaction.response.send_message(embed=embed, ephemeral=True)
        
    except Exception as e:
        await interaction.response.send_message(f"❌ خطأ: {str(e)}", ephemeral=True)

# ====================================
# معالج الأخطاء
# ====================================
@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    if isinstance(error, app_commands.MissingPermissions):
        await interaction.response.send_message(
            "❌ ليس لديك الصلاحيات اللازمة لاستخدام هذا الأمر",
            ephemeral=True
        )
    else:
        await interaction.response.send_message(f"❌ خطأ: {str(error)}", ephemeral=True)

# ====================================
# تشغيل البوت
# ====================================
if __name__ == "__main__":
    TOKEN = os.getenv("DISCORD_TOKEN")
    if not TOKEN:
        raise ValueError("❌ لم يتم العثور على DISCORD_TOKEN في ملف .env")
    bot.run(TOKEN)

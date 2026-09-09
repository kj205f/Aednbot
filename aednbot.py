import discord
from discord.ext import commands
from discord import app_commands
import asyncio

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
    print(f'{bot.user} تم تسجيل الدخول بنجاح!')
    try:
        synced = await bot.tree.sync()
        print(f"تم مزامجة {len(synced)} أمر سلاش")
    except Exception as e:
        print(f"خطأ في المزامجة: {e}")

# ====================================
# الأمر الأول: تحذير العضو (warn_member)
# ====================================
@bot.tree.command(name="warn_member", description="تحذير عضو في الخادم")
@app_commands.describe(
    member="العضو المراد تحذيره",
    reason="سبب التحذير"
)
@app_commands.checks.has_permissions(moderate_members=True)
async def warn_member(interaction: discord.Interaction, member: discord.Member, reason: str):
    """تحذير عضو وإرسال رسالة خاصة له"""
    
    try:
        # حفظ التحذير في قاموس
        if member.id not in warnings_dict:
            warnings_dict[member.id] = []
        
        warnings_dict[member.id].append({
            "reason": reason,
            "warned_by": interaction.user.name,
            "timestamp": discord.utils.utcnow()
        })
        
        # الرسالة الخاصة للعضو
        embed = discord.Embed(
            title="⚠️ تنبيه تحذير",
            description=f"لقد تم تحذيرك من قبل {interaction.user.mention}",
            color=discord.Color.red()
        )
        embed.add_field(name="السبب:", value=reason, inline=False)
        embed.add_field(name="عدد التحذيرات:", value=f"{len(warnings_dict[member.id])}", inline=True)
        embed.set_footer(text=f"الخادم: {interaction.guild.name}")
        
        # إرسال الرسالة الخاصة
        try:
            await member.send(embed=embed)
        except discord.Forbidden:
            print(f"لا يمكن إرسال رسالة خاصة للعضو {member}")
        
        # الرد على الأمر
        success_embed = discord.Embed(
            title="✅ تم التحذير بنجاح",
            description=f"تم تحذير العضو {member.mention}",
            color=discord.Color.green()
        )
        success_embed.add_field(name="السبب:", value=reason, inline=False)
        success_embed.add_field(name="عدد التحذيرات:", value=f"{len(warnings_dict[member.id])}", inline=True)
        
        await interaction.response.send_message(embed=success_embed, ephemeral=True)
        
    except Exception as e:
        error_embed = discord.Embed(
            title="❌ حدث خطأ",
            description=str(e),
            color=discord.Color.red()
        )
        await interaction.response.send_message(embed=error_embed, ephemeral=True)

# ====================================
# الأمر الثاني: تغيير اسم العضو
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
        
        # إرسال رسالة خاصة للعضو
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
            print(f"لا يمكن إرسال رسالة خاصة للعضو {member}")
        
        # الرد على الأمر
        success_embed = discord.Embed(
            title="✅ تم التغيير بنجاح",
            description=f"تم تغيير اسم {member.mention}",
            color=discord.Color.green()
        )
        success_embed.add_field(name="الاسم القديم:", value=old_nickname, inline=True)
        success_embed.add_field(name="الاسم الجديد:", value=new_nickname, inline=True)
        
        await interaction.response.send_message(embed=success_embed, ephemeral=True)
        
    except Exception as e:
        error_embed = discord.Embed(
            title="❌ حدث خطأ",
            description=str(e),
            color=discord.Color.red()
        )
        await interaction.response.send_message(embed=error_embed, ephemeral=True)

# ====================================
# الأمر الثالث: إرسال رسالة خاصة لجميع أعضاء برتبة معينة
# ====================================
@bot.tree.command(name="mass_dm", description="إرسال رسالة خاصة لجميع أعضاء برتبة معينة")
@app_commands.describe(
    role="الرتبة المراد الإرسال لأعضائها",
    message="الرسالة المراد إرسالها"
)
@app_commands.checks.has_permissions(manage_roles=True)
async def mass_dm(interaction: discord.Interaction, role: discord.Role, message: str):
    """إرسال رسالة خاصة لجميع أعضاء برتبة معينة"""
    
    try:
        await interaction.response.defer(ephemeral=True)
        
        # الحصول على جميع الأعضاء بهذه الرتبة
        members_with_role = role.members
        
        if not members_with_role:
            empty_embed = discord.Embed(
                title="⚠️ لا توجد أعضاء",
                description=f"لا يوجد أعضاء برتبة {role.mention}",
                color=discord.Color.yellow()
            )
            await interaction.followup.send(embed=empty_embed, ephemeral=True)
            return
        
        successful = 0
        failed = 0
        
        # إرسال الرسالة لكل عضو
        for member in members_with_role:
            try:
                # عدم إرسال رسالة للبوت نفسه
                if member.bot:
                    continue
                
                dm_embed = discord.Embed(
                    title="📨 رسالة من الخادم",
                    description=message,
                    color=discord.Color.blurple()
                )
                dm_embed.set_footer(text=f"من: {interaction.guild.name} | المرسل: {interaction.user.name}")
                
                await member.send(embed=dm_embed)
                successful += 1
                
                # تأخير صغير لتجنب الحد الأقصى للرسائل
                await asyncio.sleep(0.5)
                
            except discord.Forbidden:
                failed += 1
            except Exception as e:
                print(f"خطأ في إرسال رسالة إلى {member}: {e}")
                failed += 1
        
        # إرسال تقرير النتائج
        result_embed = discord.Embed(
            title="📊 تقرير الإرسال",
            description=f"تم الإرسال إلى أعضاء رتبة {role.mention}",
            color=discord.Color.green()
        )
        result_embed.add_field(name="نجح:", value=successful, inline=True)
        result_embed.add_field(name="فشل:", value=failed, inline=True)
        result_embed.add_field(name="إجمالي الأعضاء:", value=len(members_with_role), inline=True)
        result_embed.add_field(name="الرسالة:", value=message, inline=False)
        
        await interaction.followup.send(embed=result_embed, ephemeral=True)
        
    except Exception as e:
        error_embed = discord.Embed(
            title="❌ حدث خطأ",
            description=str(e),
            color=discord.Color.red()
        )
        await interaction.followup.send(embed=error_embed, ephemeral=True)

# ====================================
# أمر لمسح أوامر السلاش القديمة
# ====================================
@bot.tree.command(name="clear_commands", description="مسح جميع أوامر السلاش")
@app_commands.checks.has_permissions(administrator=True)
async def clear_commands(interaction: discord.Interaction):
    """مسح جميع أوامر السلاش المسجلة"""
    
    try:
        await interaction.response.defer(ephemeral=True)
        
        # الحصول على جميع الأوامر
        await bot.tree.clear_commands(guild=None)
        await bot.tree.sync()
        
        success_embed = discord.Embed(
            title="✅ تم المسح بنجاح",
            description="تم مسح جميع أوامر السلاش",
            color=discord.Color.green()
        )
        
        await interaction.followup.send(embed=success_embed, ephemeral=True)
        
    except Exception as e:
        error_embed = discord.Embed(
            title="❌ حدث خطأ",
            description=str(e),
            color=discord.Color.red()
        )
        await interaction.followup.send(embed=error_embed, ephemeral=True)

# ====================================
# معالج الأخطاء
# ====================================
@bot.tree.error
async def on_app_command_error(interaction: discord.Interaction, error: app_commands.AppCommandError):
    if isinstance(error, app_commands.MissingPermissions):
        perm_embed = discord.Embed(
            title="❌ صلاحيات غير كافية",
            description="ليس لديك الصلاحيات اللازمة لاستخدام هذا الأمر",
            color=discord.Color.red()
        )
        await interaction.response.send_message(embed=perm_embed, ephemeral=True)
    else:
        error_embed = discord.Embed(
            title="❌ خطأ",
            description=str(error),
            color=discord.Color.red()
        )
        await interaction.response.send_message(embed=error_embed, ephemeral=True)

# ====================================
# تشغيل البوت
# ====================================
if __name__ == "__main__":
    # ضع رمز البوت هنا
    TOKEN = ""
    bot.run(TOKEN)

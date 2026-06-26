import re

with open('e:/Coding/Web/rafiq-salah-extension/background.js', 'r', encoding='utf-8') as f:
    content = f.read()

i18n_code = '''let i18nData = null;

async function getTranslation(key, params = {}) {
    if (!i18nData) {
        try {
            const response = await fetch('data/translations.json');
            i18nData = await response.json();
        } catch (e) {
            console.error("Failed to load translations in background", e);
            return key;
        }
    }
    const settings = await chrome.storage.local.get('language');
    const currentLang = settings.language || 'ar';
    
    if (!i18nData[key]) return key;
    let str = i18nData[key][currentLang] || i18nData[key]['ar'] || key;
    for (let k in params) {
        str = str.replace('{'+k+'}', params[k]);
    }
    return str;
}'''

content = re.sub(r'// Prayer names in Arabic.*?};', i18n_code, content, flags=re.DOTALL)

# Welcome notification
content = content.replace("title: 'مرحباً بك في رفيق الصلاة  🕌',", "title: await getTranslation('notif_welcome_title'),")
content = content.replace("message: 'تم تثبيت الإكستنشن بنجاح. اختر موقعك لبدء التذكير.',", "message: await getTranslation('notif_welcome_msg'),")

# Snooze notification
content = content.replace("title: 'تذكير مؤجل 🔔',", "title: await getTranslation('notif_snooze_title'),")
content = content.replace("message: 'تذكير: حان وقت الصلاة (لا يمكن التأجيل مرة أخرى)',", "message: await getTranslation('notif_snooze_msg'),")
content = content.replace("{ title: 'تم' }", "{ title: await getTranslation('btn_done') }")

# In handlePrayerReminder
content = content.replace("const arabicName = PRAYER_NAMES[prayerName];", "const arabicName = await getTranslation('prayer_' + prayerName);")

time_str_old = '''    if (alarmType === 'pre') {
        let actualRemainingMinutes = reminderMinutes;
        if (result.prayerTimes && result.prayerTimes[prayerName]) {
            const now = new Date();
            const prayerTimeStr = result.prayerTimes[prayerName];
            const [hours, minutes] = prayerTimeStr.split(':').map(Number);
            const prayerTime = new Date();
            prayerTime.setHours(hours, minutes, 0, 0);
            const diffMs = prayerTime.getTime() - now.getTime();
            if (diffMs > 0) {
                actualRemainingMinutes = Math.round(diffMs / 60000);
            }
        }

        if (actualRemainingMinutes === 1) {
            timeMessage = 'خلال دقيقة واحدة';
        } else if (actualRemainingMinutes === 2) {
            timeMessage = 'خلال دقيقتين';
        } else if (actualRemainingMinutes >= 3 && actualRemainingMinutes <= 10) {
            timeMessage = `خلال ${actualRemainingMinutes} دقائق`;
        } else if (actualRemainingMinutes < 60) {
            timeMessage = `خلال ${actualRemainingMinutes} دقيقة`;
        } else {
            const hours = Math.floor(actualRemainingMinutes / 60);
            const mins = actualRemainingMinutes % 60;
            if (mins === 0) {
                timeMessage = `خلال ${hours} ساعة`;
            } else {
                timeMessage = `خلال ${hours} ساعة و${mins} دقيقة`;
            }
        }
    } else {
        timeMessage = 'الآن';
    }'''

time_str_new = '''    if (alarmType === 'pre') {
        let actualRemainingMinutes = reminderMinutes;
        if (result.prayerTimes && result.prayerTimes[prayerName]) {
            const now = new Date();
            const prayerTimeStr = result.prayerTimes[prayerName];
            const [hours, minutes] = prayerTimeStr.split(':').map(Number);
            const prayerTime = new Date();
            prayerTime.setHours(hours, minutes, 0, 0);
            const diffMs = prayerTime.getTime() - now.getTime();
            if (diffMs > 0) {
                actualRemainingMinutes = Math.round(diffMs / 60000);
            }
        }

        if (actualRemainingMinutes === 1) {
            timeMessage = await getTranslation('time_in_1m');
        } else if (actualRemainingMinutes === 2) {
            timeMessage = await getTranslation('time_in_2m');
        } else if (actualRemainingMinutes >= 3 && actualRemainingMinutes <= 10) {
            timeMessage = await getTranslation('time_in_mins', {m: actualRemainingMinutes});
        } else if (actualRemainingMinutes < 60) {
            timeMessage = await getTranslation('time_in_min_single', {m: actualRemainingMinutes});
        } else {
            const hours = Math.floor(actualRemainingMinutes / 60);
            const mins = actualRemainingMinutes % 60;
            if (mins === 0) {
                timeMessage = await getTranslation('time_in_hours', {h: hours});
            } else {
                timeMessage = await getTranslation('time_in_hm', {h: hours, m: mins});
            }
        }
    } else {
        timeMessage = await getTranslation('time_now');
    }'''

content = content.replace(time_str_old, time_str_new)

content = content.replace("title: alarmType === 'pre' ? 'تذكير الصلاة 🕌' : 'حان وقت الصلاة 🕌',", "title: alarmType === 'pre' ? await getTranslation('notif_pre_title') : await getTranslation('notif_exact_title'),")
content = content.replace("message: alarmType === 'pre' ? `حان وقت صلاة ${arabicName} ${timeMessage}` : `حان وقت صلاة ${arabicName}`,", "message: alarmType === 'pre' ? await getTranslation('notif_pre_msg', {prayer: arabicName, time: timeMessage}) : await getTranslation('notif_exact_msg', {prayer: arabicName}),")
content = content.replace("buttons: alarmType === 'pre'\n                ? [{ title: 'تم' }, { title: 'تأجيل 5 دقائق' }]\n                : [{ title: 'تم' }]", "buttons: alarmType === 'pre'\n                ? [{ title: await getTranslation('btn_done') }, { title: await getTranslation('btn_snooze') }]\n                : [{ title: await getTranslation('btn_done') }]")
content = content.replace("buttons: alarmType === 'pre' ? [{ title: 'تم' }, { title: 'تأجيل 5 دقائق' }] : [{ title: 'تم' }]", "buttons: alarmType === 'pre' ? [{ title: await getTranslation('btn_done') }, { title: await getTranslation('btn_snooze') }] : [{ title: await getTranslation('btn_done') }]")
content = content.replace("title: 'تذكير الصلاة',", "title: await getTranslation('notif_pre_title'),")
content = content.replace("message: alarmType === 'pre' ? `صلاة ${arabicName} ${timeMessage}` : `حان وقت صلاة ${arabicName}`", "message: alarmType === 'pre' ? await getTranslation('notif_pre_msg', {prayer: arabicName, time: timeMessage}) : await getTranslation('notif_exact_msg', {prayer: arabicName})")

content = content.replace("title: 'لا يمكن التأجيل مرة أخرى',", "title: await getTranslation('notif_no_snooze_title'),")
content = content.replace("message: 'تم تأجيل هذا التذكير مسبقاً. حان وقت الصلاة الآن.'", "message: await getTranslation('notif_no_snooze_msg')")

content = content.replace("title: 'تم التأجيل',", "title: await getTranslation('notif_snooze_confirm_title'),")
content = content.replace("message: 'سيتم تذكيرك مرة أخرى خلال 5 دقائق (لمرة واحدة فقط)'", "message: await getTranslation('notif_snooze_confirm_msg')")

with open('e:/Coding/Web/rafiq-salah-extension/background.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('background.js updated')

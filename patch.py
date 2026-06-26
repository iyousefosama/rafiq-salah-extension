import re

with open('e:/Coding/Web/rafiq-salah-extension/popup.js', 'r', encoding='utf-8') as f:
    content = f.read()

i18n_code = '''let i18nData = {};
let currentLang = 'ar';

async function fetchTranslations() {
    try {
        const response = await fetch('data/translations.json');
        i18nData = await response.json();
        
        const settings = await chrome.storage.local.get('language');
        currentLang = settings.language || 'ar';
        document.documentElement.lang = currentLang;
        document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    } catch (e) {
        console.error("Failed to load translations", e);
    }
}

function t(key, params = {}) {
    if (!i18nData[key]) return key;
    let str = i18nData[key][currentLang] || i18nData[key]['ar'] || key;
    for (let k in params) {
        str = str.replace('{'+k+'}', params[k]);
    }
    return str;
}

function applyTranslationsToDOM() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = t(el.getAttribute('data-i18n'));
    });
    
    const langBtn = document.getElementById('langToggle');
    if(langBtn && !langBtn.hasAttribute('data-listener')) {
        langBtn.setAttribute('data-listener', 'true');
        langBtn.onclick = async () => {
            currentLang = currentLang === 'ar' ? 'en' : 'ar';
            document.documentElement.lang = currentLang;
            document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
            await chrome.storage.local.set({language: currentLang});
            applyTranslationsToDOM();
            
            const currCountry = countrySelect.value;
            const currCity = citySelect.value;
            populateCountrySelect();
            if(currCountry) {
                countrySelect.value = currCountry;
                populateCitySelect(currCountry);
                if(currCity) citySelect.value = currCity;
            }
            
            updatePrayerDisplay();
            updateCalculationMethodDisplay();
            
            chrome.storage.local.get(['selectedCountry', 'selectedCity', 'autoDetected']).then(result => {
                if (result.selectedCountry && result.selectedCity) {
                    const country = citiesData.find(c => c.code === result.selectedCountry);
                    const city = country?.cities.find(c => c.en === result.selectedCity);
                    if (country && city) {
                        const autoDetectedText = result.autoDetected ? ' 📍' : '';
                        const countryName = currentLang === 'en' ? country.english_name : country.name;
                        const cityName = currentLang === 'en' ? city.en : city.ar;
                        locationText.textContent = cityName + ', ' + countryName + autoDetectedText;
                    }
                }
            });
        };
    }
}'''

country_map = '''// Country to calculation method mapping
const countryMethodMap = {
    'EG': 5,  'DZ': 5,  'SD': 5,  'IQ': 3,  'MA': 5,  'SA': 4,  'YE': 3,  'JO': 3,
    'AE': 8,  'LY': 5,  'PS': 3,  'OM': 8,  'KW': 9,  'MR': 3,  'QA': 10, 'BH': 8,
    'LB': 3,  'SY': 3,  'TN': 7,  'TR': 7,  'IR': 8,  'PK': 7,  'BD': 7,  'ID': 7,
    'MY': 3,  'BN': 3,  'MV': 3,  'AF': 3,  'UZ': 7,  'KZ': 7,  'KG': 7,  'TJ': 7,
    'TM': 7,  'AZ': 7,  'AL': 7,  'XK': 7,  'BA': 7,  'NG': 3,  'NE': 3,  'SN': 3,
    'ML': 3,  'GN': 3,  'SL': 3,  'BF': 3,  'GM': 3,  'GW': 3,  'TD': 3,  'ER': 3,
    'GH': 3,  'CI': 3,  'MZ': 3,  'ET': 3,  'TG': 3,  'BJ': 3,  'MU': 7,  'MG': 7,
    'ZA': 7
};'''

content = re.sub(r'// Prayer names in Arabic.*?// DOM elements', i18n_code + '\n\n' + country_map + '\n\n// DOM elements', content, flags=re.DOTALL)

init_code = '''document.addEventListener('DOMContentLoaded', async () => {
    await fetchTranslations();
    initializeElements();
    applyTranslationsToDOM();'''
content = content.replace("document.addEventListener('DOMContentLoaded', async () => {\n    initializeElements();", init_code)

content = content.replace('PRAYER_NAMES[nextPrayer.name]', "t('prayer_' + nextPrayer.name)")
content = content.replace('PRAYER_NAMES[prayer.name]', "t('prayer_' + prayer.name)")
content = content.replace('PRAYER_NAMES[prayerName]', "t('prayer_' + prayerName)")
content = content.replace('PRAYER_NAMES[name]', "t('prayer_' + name)")
content = content.replace('PRAYER_NAMES[data.prayer]', "t('prayer_' + data.prayer)")
content = re.sub(r'PRAYER_NAMES\[([^\]]+)\]', r"t('prayer_' + \1)", content)

content = re.sub(
    r"methodName = `\$\{CALCULATION_METHODS\['auto'\]\} \(\$\{CALCULATION_METHODS\[autoMethodId\.toString\(\)\]\}\)`;",
    r"methodName = `${t('calc_short_auto')} (${t('calc_short_' + autoMethodId)})`;",
    content
)
content = re.sub(
    r"methodName = CALCULATION_METHODS\[currentMethod\] \|\| CALCULATION_METHODS\['auto'\];",
    r"methodName = t('calc_' + currentMethod) || t('calc_auto');",
    content
)

loc_disp_old = "locationText.textContent = `${city.ar}, ${country.name}${autoDetectedText}`;"
loc_disp_new = "const countryName = currentLang === 'en' ? country.english_name : country.name; const cityName = currentLang === 'en' ? city.en : city.ar; locationText.textContent = `${cityName}, ${countryName}${autoDetectedText}`;"
content = content.replace(loc_disp_old, loc_disp_new)

content = content.replace("option.textContent = country.name;", "option.textContent = currentLang === 'en' ? country.english_name : country.name;")
content = content.replace("option.textContent = city.ar;", "option.textContent = currentLang === 'en' ? city.en : city.ar;")

time_str_old = '''let timeText = '';
    if (hours > 0) {
        timeText = `${hours} ساعة و${minutes} دقيقة`;
    } else {
        timeText = `${minutes} دقيقة`;
    }'''
time_str_new = '''let timeText = '';
    if (hours > 0) {
        timeText = t('time_remaining_hm', {h: hours, m: minutes});
    } else {
        timeText = t('time_remaining_m', {m: minutes});
    }'''
content = content.replace(time_str_old, time_str_new)

content = content.replace("const period = hours >= 12 ? 'م' : 'ص'; // م for مساء (evening), ص for صباح (morning)", "const period = hours >= 12 ? t('pm') : t('am');")

content = content.replace("nextPrayerText.innerHTML = `🕌 الصلاة القادمة: ${t('prayer_' + nextPrayer.name)} في ${formattedTime}<br><span class=\"countdown-time\">${timeText}</span>`;", "nextPrayerText.innerHTML = t('next_prayer_prefix', {prayer: t('prayer_' + nextPrayer.name), time: formattedTime}) + '<br><span class=\"countdown-time\">' + timeText + '</span>';")
content = content.replace("countdownText.textContent = `الوقت الحالي: ${timeStr}`", "countdownText.textContent = t('time_current', {time: timeStr})")

content = content.replace("showError('خطأ في تحميل بيانات المدن');", "showError(t('err_load_cities'));")
content = content.replace("showError('خطأ في تحميل رفيق الصلاة. يرجى المحاولة مرة أخرى.');", "showError(t('err_load_prayer_times'));")
content = content.replace("showLocationError('لم يتم العثور على مدينة قريبة من موقعك. يرجى اختيار الموقع يدوياً.');", "showLocationError(t('err_no_nearby_city'));")
content = content.replace("errorMessage = 'حدث خطأ أثناء تحديد الموقع. يرجى المحاولة مرة أخرى أو اختيار الموقع يدوياً.';", "errorMessage = t('err_location_general');")
content = content.replace("errorMessage = 'تم رفض إذن الوصول للموقع. يرجى السماح بالوصول من إعدادات المتصفح أو اختيار الموقع يدوياً.';", "errorMessage = t('err_permission_denied');")
content = content.replace("errorMessage = 'معلومات الموقع غير متوفرة حالياً. يرجى التحقق من اتصال الإنترنت أو اختيار الموقع يدوياً.';", "errorMessage = t('err_position_unavailable');")
content = content.replace("errorMessage = 'انتهت مهلة تحديد الموقع. يرجى المحاولة مرة أخرى أو اختيار الموقع يدوياً.';", "errorMessage = t('err_timeout');")
content = content.replace("errorMessage = 'متصفحك لا يدعم تحديد الموقع الجغرافي. يرجى اختيار الموقع يدوياً.';", "errorMessage = t('err_no_geolocation');")

title_old = '''        if (isEdit) {
            titleElement.textContent = 'تغيير الموقع';
            textElement.textContent = 'اختر كيف تريد تحديث موقعك للحصول على أوقات الصلاة بدقة';
        } else {
            titleElement.textContent = 'حدد موقعك';
            textElement.textContent = 'اختر كيف تريد تحديد موقعك للحصول على أوقات الصلاة بدقة';
        }'''
title_new = '''        if (isEdit) {
            titleElement.textContent = t('changeLocationTitle');
            textElement.textContent = t('changeLocationDesc');
        } else {
            titleElement.textContent = t('selectLocationTitle');
            textElement.textContent = t('selectLocationDesc');
        }'''
content = content.replace(title_old, title_new)

with open('e:/Coding/Web/rafiq-salah-extension/popup.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('popup.js updated')

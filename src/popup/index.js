let i18nData = {};
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
    
    document.querySelectorAll('.reminder-slider-label').forEach(el => {
        const val = el.getAttribute('data-value');
        if (currentLang === 'ar') {
            el.textContent = val + ' ' + t('min_short');
        } else {
            el.textContent = val + t('min_short');
        }
    });
    
    const closeBtn = document.getElementById('closeSettingsBtn');
    if (closeBtn) {
        closeBtn.setAttribute('aria-label', t('close_settings'));
    }
    
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
}

// Country to calculation method mapping
const countryMethodMap = {
    'EG': 5,  'DZ': 5,  'SD': 5,  'IQ': 3,  'MA': 5,  'SA': 4,  'YE': 3,  'JO': 3,
    'AE': 8,  'LY': 5,  'PS': 3,  'OM': 8,  'KW': 9,  'MR': 3,  'QA': 10, 'BH': 8,
    'LB': 3,  'SY': 3,  'TN': 7,  'TR': 7,  'IR': 8,  'PK': 7,  'BD': 7,  'ID': 7,
    'MY': 3,  'BN': 3,  'MV': 3,  'AF': 3,  'UZ': 7,  'KZ': 7,  'KG': 7,  'TJ': 7,
    'TM': 7,  'AZ': 7,  'AL': 7,  'XK': 7,  'BA': 7,  'NG': 3,  'NE': 3,  'SN': 3,
    'ML': 3,  'GN': 3,  'SL': 3,  'BF': 3,  'GM': 3,  'GW': 3,  'TD': 3,  'ER': 3,
    'GH': 3,  'CI': 3,  'MZ': 3,  'ET': 3,  'TG': 3,  'BJ': 3,  'MU': 7,  'MG': 7,
    'ZA': 7
};

// DOM elements
let countrySelect, citySelect, saveLocationBtn, locationDisplay, locationText, editLocationBtn;
let locationSelection, locationPrompt, prayerTimesSection, loadingState, errorState;
let autoDetectBtn, manualSelectBtn, locationError;
let nextPrayerText, countdownText, calculationMethodText, prayerCards;

// Global variables
let citiesData = [];
let currentPrayerTimes = null;
let countdownInterval = null;
let settingsToggle, reminderSettings, reminderTimeSlider, reminderTimeSliderWrap, reminderTimeLabels, calculationMethodSelect;
let preReminderToggle, exactReminderToggle;
let scrollAnimationFrame = null;
let scrollCancelHandlers = [];
let isAutoScrolling = false;
let lastPrayerCardSignature = null;
let notificationMasterEnabled = true;
let idleAutoScrollTimer = null;
let idleAutoScrollFrame = null;
let idleAutoScrollDirection = 1;
let idleAutoScrollActive = false;
let idleAutoScrollLastTime = 0;
let isCardHovering = false;
const reminderTimeOptions = [1, 5, 10, 15, 30];

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
    await fetchTranslations();
    initializeElements();
    applyTranslationsToDOM();
    await loadCitiesData();
    await checkUserLocation();
    setupEventListeners();
    initializeIdleAutoScroll();
});

function initializeElements() {
    countrySelect = document.getElementById('countrySelect');
    citySelect = document.getElementById('citySelect');
    saveLocationBtn = document.getElementById('saveLocationBtn');
    locationDisplay = document.getElementById('locationDisplay');
    locationText = document.getElementById('locationText');
    editLocationBtn = document.getElementById('editLocationBtn');
    locationSelection = document.getElementById('locationSelection');
    locationPrompt = document.getElementById('locationPrompt');
    prayerTimesSection = document.getElementById('prayerTimesSection');
    loadingState = document.getElementById('loadingState');
    errorState = document.getElementById('errorState');
    autoDetectBtn = document.getElementById('autoDetectBtn');
    manualSelectBtn = document.getElementById('manualSelectBtn');
    locationError = document.getElementById('locationError');
    nextPrayerText = document.getElementById('nextPrayerText');
    countdownText = document.getElementById('countdownText');
    calculationMethodText = document.getElementById('calculationMethodText');
    prayerCards = document.getElementById('prayerCards');
    settingsToggle = document.getElementById('settingsToggle');
    reminderSettings = document.getElementById('reminderSettings');
    let settingsBackdrop = document.getElementById('settingsBackdrop');
    let closeSettingsBtn = document.getElementById('closeSettingsBtn');
    if (settingsBackdrop) window.settingsBackdrop = settingsBackdrop;
    if (closeSettingsBtn) window.closeSettingsBtn = closeSettingsBtn;
    reminderTimeSlider = document.getElementById('reminderTimeSlider');
    reminderTimeSliderWrap = document.getElementById('reminderTimeSliderWrap');
    reminderTimeLabels = Array.from(document.querySelectorAll('.reminder-slider-label'));
    calculationMethodSelect = document.getElementById('calculationMethod');
    preReminderToggle = document.getElementById('preReminderToggle');
    exactReminderToggle = document.getElementById('exactReminderToggle');

}

function getReminderTimeFromSlider() {
    if (!reminderTimeSlider) {
        return 5;
    }
    const index = Number(reminderTimeSlider.value);
    return reminderTimeOptions[index] || 5;
}

function setReminderSliderByMinutes(minutes) {
    if (!reminderTimeSlider) {
        return;
    }
    const index = reminderTimeOptions.indexOf(minutes);
    const safeIndex = index === -1 ? 1 : index;
    reminderTimeSlider.value = String(safeIndex);
    updateReminderSliderLabels(reminderTimeOptions[safeIndex]);
}

function updateReminderSliderLabels(selectedMinutes) {
    if (!reminderTimeLabels || reminderTimeLabels.length === 0) {
        return;
    }
    const currentValue = selectedMinutes ?? getReminderTimeFromSlider();
    reminderTimeLabels.forEach(label => {
        const labelValue = Number(label.dataset.value);
        label.classList.toggle('active', labelValue === currentValue);
    });
}

async function loadCitiesData() {
    try {
        const [countriesResponse, citiesResponse] = await Promise.all([
            fetch('data/countries.json'),
            fetch('data/cities.json')
        ]);

        const countries = await countriesResponse.json();
        const citiesByCountry = await citiesResponse.json();

        // Merge countries with their cities
        citiesData = countries.map(country => ({
            ...country,
            cities: citiesByCountry[country.code] || []
        }));

        populateCountrySelect();
    } catch (error) {
        showError(t('err_load_cities'));
    }
}

function populateCountrySelect() {
    countrySelect.innerHTML = '<option value="">' + t('select_country') + '</option>';
    citiesData.forEach(country => {
        const option = document.createElement('option');
        option.value = country.code;
        option.textContent = currentLang === 'en' ? country.english_name : country.name;
        countrySelect.appendChild(option);
    });
}



function populateCitySelect(countryCode) {
    const country = citiesData.find(c => c.code === countryCode);
    citySelect.innerHTML = '<option value="">' + t('select_city') + '</option>';

    if (country && country.cities) {
        country.cities.forEach(city => {
            const option = document.createElement('option');
            option.value = city.en;
            option.textContent = currentLang === 'en' ? city.en : city.ar;
            citySelect.appendChild(option);
        });
        citySelect.disabled = false;
    } else {
        citySelect.disabled = true;
    }

    updateSaveButton();
}

function updateSaveButton() {
    saveLocationBtn.disabled = !countrySelect.value || !citySelect.value;
}

async function checkUserLocation() {
    const result = await chrome.storage.local.get(['selectedCountry', 'selectedCity', 'locationPromptSeen']);

    if (result.selectedCountry && result.selectedCity) {
        showPrayerTimesSection(result.selectedCountry, result.selectedCity);
    } else if (!result.locationPromptSeen) {
        // First time user - show location prompt
        showLocationPrompt();
    } else {
        showLocationSelection();
    }
}

function showLocationPrompt(isEdit = false) {
    locationPrompt?.classList.remove('hidden');
    locationSelection?.classList.add('hidden');
    locationDisplay?.classList.add('hidden');
    prayerTimesSection?.classList.add('hidden');
    hideLocationError();

    // Update title based on mode (first time vs edit)
    const titleElement = locationPrompt?.querySelector('h3');
    const textElement = locationPrompt?.querySelector('.location-prompt-text');

    if (titleElement && textElement) {
        if (isEdit) {
            titleElement.textContent = t('changeLocationTitle');
            textElement.textContent = t('changeLocationDesc');
        } else {
            titleElement.textContent = t('selectLocationTitle');
            textElement.textContent = t('selectLocationDesc');
        }
    }
}

function updatePromptTitleForEdit() {
    showLocationPrompt(true);
}

function showLocationError(message) {
    if (locationError) {
        locationError.textContent = message;
        locationError.classList.remove('hidden');
        // Re-trigger animation
        locationError.style.animation = 'none';
        locationError.offsetHeight; // Trigger reflow
        locationError.style.animation = '';
    }
}

function hideLocationError() {
    locationError?.classList.add('hidden');
}

function setLocationPromptLoading(isLoading) {
    if (autoDetectBtn) {
        if (isLoading) {
            autoDetectBtn.classList.add('btn-loading');
            autoDetectBtn.disabled = true;
            manualSelectBtn.disabled = true;
        } else {
            autoDetectBtn.classList.remove('btn-loading');
            autoDetectBtn.disabled = false;
            manualSelectBtn.disabled = false;
        }
    }
}

function showLocationSelection() {
    locationDisplay?.classList.add('hidden');
    prayerTimesSection?.classList.add('hidden');
    locationPrompt?.classList.add('hidden');
    locationSelection?.classList.remove('hidden');
}

// Automatic location detection functions
async function attemptAutoLocationDetection() {
    setLocationPromptLoading(true);
    hideLocationError();

    try {
        const position = await getCurrentPosition();
        const { latitude, longitude } = position.coords;

        // Find closest city from our data
        const closestLocation = await findClosestCity(latitude, longitude);

        if (closestLocation) {
            // Save the detected location
            await chrome.storage.local.set({
                selectedCountry: closestLocation.countryCode,
                selectedCity: closestLocation.cityName,
                locationPromptSeen: true,
                autoDetected: true
            });

            // Show prayer times for detected location
            await showPrayerTimesSection(closestLocation.countryCode, closestLocation.cityName);
        } else {
            // No nearby city found - show error and allow manual selection
            showLocationError(t('err_no_nearby_city'));
            setTimeout(() => {
                showLocationSelection();
            }, 2000);
        }
    } catch (error) {
        console.error('Auto location detection failed:', error);

        // Handle specific error types
        let errorMessage = t('err_location_general');

        if (error.name === 'PermissionDeniedError' || error.code === 1) {
            errorMessage = t('err_permission_denied');
        } else if (error.name === 'PositionUnavailableError' || error.code === 2) {
            errorMessage = t('err_position_unavailable');
        } else if (error.name === 'TimeoutError' || error.code === 3) {
            errorMessage = t('err_timeout');
        } else if (!navigator.geolocation) {
            errorMessage = t('err_no_geolocation');
        }

        showLocationError(errorMessage);
    } finally {
        setLocationPromptLoading(false);
    }
}

function proceedToManualSelection() {
    // Mark that user has seen the prompt
    chrome.storage.local.set({ locationPromptSeen: true });
    showLocationSelection();

    // Reset selections for fresh manual selection
    countrySelect.value = '';
    citySelect.innerHTML = '<option value="">اختر المدينة</option>';
    citySelect.disabled = true;
    updateSaveButton();
}

// Update loading message
function updateLoadingMessage(message) {
    if (loadingState) {
        loadingState.textContent = message;
    }
}



async function fallbackToIp(resolve, reject) {
    try {
        const res = await fetch('https://get.geojs.io/v1/ip/geo.json');
        const data = await res.json();
        if (data.latitude && data.longitude) {
            resolve({ coords: { latitude: parseFloat(data.latitude), longitude: parseFloat(data.longitude) } });
            return;
        }
    } catch (e) {
        console.warn('geojs failed', e);
    }

    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        if (data.latitude && data.longitude) {
            resolve({ coords: { latitude: parseFloat(data.latitude), longitude: parseFloat(data.longitude) } });
            return;
        }
    } catch (e) {
        console.warn('ipapi failed', e);
    }

    reject(new Error('IP location failed'));
}

function getCurrentPosition() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            fallbackToIp(resolve, reject);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            resolve,
            (error) => {
                console.warn('Geolocation failed, falling back to IP:', error);
                fallbackToIp(resolve, reject);
            },
            {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 10000 // 5 minutes
            }
        );
    });
}

// Calculate distance between two coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// Find closest city from available data
async function findClosestCity(userLat, userLon) {
    try {
        // Get approximate coordinates for major cities in each country
        const cityCoordinates = await getCityCoordinates();

        let closestCity = null;
        let minDistance = Infinity;

        for (const country of citiesData) {
            for (const city of country.cities) {
                const coords = cityCoordinates[country.code]?.[city.en];
                if (coords) {
                    const distance = calculateDistance(userLat, userLon, coords.lat, coords.lon);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestCity = {
                            countryCode: country.code,
                            cityName: city.en,
                            distance: distance
                        };
                    }
                }
            }
        }

        // Only return if within reasonable distance (500km)
        return (closestCity && closestCity.distance < 500) ? closestCity : null;
    } catch (error) {
        console.error('Error finding closest city:', error);
        return null;
    }
}

// Get approximate coordinates for major cities
function getCityCoordinates() {
    // This is a simplified dataset with major cities coordinates
    // In a real implementation, you might want to use a more comprehensive API
    return {
        'EG': {
            'Cairo': { lat: 30.0444, lon: 31.2357 },
            'Alexandria': { lat: 31.2001, lon: 29.9187 },
            'Giza': { lat: 30.0131, lon: 31.2089 },
            'Luxor': { lat: 25.6872, lon: 32.6396 },
            'Aswan': { lat: 24.0889, lon: 32.8998 }
        },
        'SA': {
            'Riyadh': { lat: 24.7136, lon: 46.6753 },
            'Jeddah': { lat: 21.4858, lon: 39.1925 },
            'Mecca': { lat: 21.3891, lon: 39.8579 },
            'Medina': { lat: 24.5247, lon: 39.5692 },
            'Dammam': { lat: 26.4207, lon: 50.0888 }
        },
        'AE': {
            'Dubai': { lat: 25.2048, lon: 55.2708 },
            'Abu Dhabi': { lat: 24.2992, lon: 54.6972 },
            'Sharjah': { lat: 25.3463, lon: 55.4209 },
            'Ajman': { lat: 25.4052, lon: 55.5136 }
        },
        'JO': {
            'Amman': { lat: 31.9454, lon: 35.9284 },
            'Zarqa': { lat: 32.0727, lon: 36.0888 },
            'Irbid': { lat: 32.5556, lon: 35.8500 }
        },
        'LB': {
            'Beirut': { lat: 33.8938, lon: 35.5018 },
            'Tripoli': { lat: 34.4367, lon: 35.8497 },
            'Sidon': { lat: 33.5633, lon: 35.3650 }
        },
        'SY': {
            'Damascus': { lat: 33.5138, lon: 36.2765 },
            'Aleppo': { lat: 36.2021, lon: 37.1343 },
            'Homs': { lat: 34.7394, lon: 36.7163 }
        },
        'IQ': {
            'Baghdad': { lat: 33.3152, lon: 44.3661 },
            'Basra': { lat: 30.5085, lon: 47.7804 },
            'Mosul': { lat: 36.3350, lon: 43.1189 }
        },
        'KW': {
            'Kuwait City': { lat: 29.3759, lon: 47.9774 },
            'Hawalli': { lat: 29.3375, lon: 48.0281 }
        },
        'QA': {
            'Doha': { lat: 25.2854, lon: 51.5310 },
            'Al Rayyan': { lat: 25.2919, lon: 51.4240 }
        },
        'BH': {
            'Manama': { lat: 26.2285, lon: 50.5860 },
            'Riffa': { lat: 26.1300, lon: 50.5550 }
        },
        'OM': {
            'Muscat': { lat: 23.5859, lon: 58.4059 },
            'Salalah': { lat: 17.0151, lon: 54.0924 }
        },
        'YE': {
            'Sanaa': { lat: 15.3694, lon: 44.1910 },
            'Aden': { lat: 12.7797, lon: 45.0367 }
        },
        'PS': {
            'Gaza': { lat: 31.3547, lon: 34.3088 },
            'Ramallah': { lat: 31.9073, lon: 35.2044 }
        },
        'MA': {
            'Casablanca': { lat: 33.5731, lon: -7.5898 },
            'Rabat': { lat: 34.0209, lon: -6.8416 },
            'Marrakech': { lat: 31.6295, lon: -7.9811 }
        },
        'DZ': {
            'Algiers': { lat: 36.7538, lon: 3.0588 },
            'Oran': { lat: 35.6976, lon: -0.6337 },
            'Constantine': { lat: 36.3650, lon: 6.6147 }
        },
        'TN': {
            'Tunis': { lat: 36.8065, lon: 10.1815 },
            'Sfax': { lat: 34.7406, lon: 10.7603 }
        },
        'LY': {
            'Tripoli': { lat: 32.8872, lon: 13.1913 },
            'Benghazi': { lat: 32.1167, lon: 20.0683 }
        },
        'SD': {
            'Khartoum': { lat: 15.5007, lon: 32.5599 },
            'Omdurman': { lat: 15.6445, lon: 32.4777 }
        },
        'MR': {
            'Nouakchott': { lat: 18.0735, lon: -15.9582 }
        }
    };
}

async function showPrayerTimesSection(countryCode, cityName) {
    const country = citiesData.find(c => c.code === countryCode);
    const city = country?.cities.find(c => c.en === cityName);

    if (country && city) {
        // Check if location was auto-detected
        const result = await chrome.storage.local.get(['autoDetected']);
        const autoDetectedText = result.autoDetected ? ' 📍' : '';

        const countryName = currentLang === 'en' ? country.english_name : country.name; const cityName = currentLang === 'en' ? city.en : city.ar; locationText.textContent = `${cityName}, ${countryName}${autoDetectedText}`;
        locationDisplay.classList.remove('hidden');
        locationSelection.classList.add('hidden');
        locationPrompt?.classList.add('hidden');

        await loadPrayerTimes(countryCode, cityName);
        await updateReminderToggle();

        prayerTimesSection.classList.remove('hidden');
    }
}

async function loadPrayerTimes(countryCode, cityName) {
    showLoading(true);
    hideError();

    try {
        // Get current date
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;

        // Auto-detect calculation method based on country, fallback to user setting or default
        const settings = await chrome.storage.local.get(['calculationMethod', 'monthlyPrayerTimes', 'lastMonthFetched']);
        const autoMethod = countryMethodMap[countryCode] || 2;

        let method;
        if (settings.calculationMethod === 'auto' || !settings.calculationMethod) {
            method = autoMethod;
        } else {
            method = parseInt(settings.calculationMethod);
        }

        let timingsData = null;

        // Check if we have cached data for this month
        if (settings.monthlyPrayerTimes && settings.lastMonthFetched === `${year}-${month}`) {
            const dayStr = String(today.getDate()).padStart(2, '0');
            const todayData = settings.monthlyPrayerTimes.find(d => d.date.gregorian.day === dayStr);
            if (todayData && todayData.timings) {
                timingsData = todayData.timings;
            }
        }

        if (!timingsData) {
            // Fetch prayer times from Aladhan API (monthly calendar)
            const school = 0; // Shafi/Maliki/Hanbali default
            const latitudeAdjustmentMethod = 'NONE';
            const response = await fetch(
                `https://api.aladhan.com/v1/calendarByCity/${year}/${month}?city=${encodeURIComponent(cityName)}&country=${countryCode}&method=${method}&school=${school}&latitudeAdjustmentMethod=${latitudeAdjustmentMethod}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch prayer times');
            }

            const data = await response.json();

            if (data.code === 200 && data.data && Array.isArray(data.data)) {
                const monthlyData = data.data;
                await chrome.storage.local.set({
                    monthlyPrayerTimes: monthlyData,
                    lastMonthFetched: `${year}-${month}`,
                    lastUpdated: Date.now()
                });
                
                const dayStr = String(today.getDate()).padStart(2, '0');
                const todayData = monthlyData.find(d => d.date.gregorian.day === dayStr);
                if (todayData && todayData.timings) {
                    timingsData = todayData.timings;
                }
            } else {
                throw new Error('Invalid API response');
            }
        }

        if (timingsData) {
            currentPrayerTimes = timingsData;
            await chrome.storage.local.set({
                prayerTimes: currentPrayerTimes,
                lastUpdated: Date.now()
            });

            updatePrayerDisplay();
            startCountdown();

            // Send prayer times to background script for alarm setup
            chrome.runtime.sendMessage({
                action: 'updatePrayerTimes',
                prayerTimes: currentPrayerTimes,
                countryCode: countryCode,
                cityName: cityName
            });
        } else {
            throw new Error('Invalid API response');
        }
    } catch (error) {
        showError(t('err_load_prayer_times'));
    } finally {
        showLoading(false);
    }
}

function updatePrayerDisplay() {
    if (!currentPrayerTimes) return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    // Prayer times in minutes from midnight
    const prayers = [
        { name: 'Fajr', time: timeToMinutes(currentPrayerTimes.Fajr), timeStr: currentPrayerTimes.Fajr },
        { name: 'Dhuhr', time: timeToMinutes(currentPrayerTimes.Dhuhr), timeStr: currentPrayerTimes.Dhuhr },
        { name: 'Asr', time: timeToMinutes(currentPrayerTimes.Asr), timeStr: currentPrayerTimes.Asr },
        { name: 'Maghrib', time: timeToMinutes(currentPrayerTimes.Maghrib), timeStr: currentPrayerTimes.Maghrib },
        { name: 'Isha', time: timeToMinutes(currentPrayerTimes.Isha), timeStr: currentPrayerTimes.Isha }
    ];

    // Find next prayer
    let nextPrayer = null;
    for (const prayer of prayers) {
        if (prayer.time > currentTime) {
            nextPrayer = prayer;
            break;
        }
    }

    // If no prayer found today, next prayer is Fajr tomorrow
    if (!nextPrayer) {
        nextPrayer = { name: 'Fajr', time: prayers[0].time + 24 * 60, timeStr: currentPrayerTimes.Fajr };
    }

    const timeUntil = nextPrayer.time - currentTime;
    const hours = Math.floor(timeUntil / 60);
    const minutes = timeUntil % 60;

    // Convert 24-hour time to 12-hour AM/PM format with Arabic indicators
    function formatTo12Hour(timeStr) {
        const [hours, minutes] = timeStr.split(' ')[0].split(':').map(Number);
        const period = hours >= 12 ? t('pm') : t('am');
        const displayHours = hours % 12 || 12;
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }

    let timeText = '';
    if (hours > 0) {
        timeText = t('time_remaining_hm', {h: hours, m: minutes});
    } else {
        timeText = t('time_remaining_m', {m: minutes});
    }

    const formattedTime = formatTo12Hour(nextPrayer.timeStr);
    nextPrayerText.innerHTML = t('next_prayer_prefix', {prayer: t('prayer_' + nextPrayer.name), time: formattedTime}) + '<br><span class="countdown-time">' + timeText + '</span>';

    renderPrayerCards(prayers, nextPrayer.name, formatTo12Hour);

    // Update calculation method display
    updateCalculationMethodDisplay();
}

function timeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(' ')[0].split(':').map(Number);
    return hours * 60 + minutes;
}

function startCountdown() {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    countdownInterval = setInterval(() => {
        updatePrayerDisplay();
        updateCountdownDisplay();
    }, 1000);
}

function updateCountdownDisplay() {
    if (!countdownText) return;
    const now = new Date();
    const locale = currentLang === 'en' ? 'en-US' : 'ar-SA';
    let timeStr = now.toLocaleTimeString(locale, {
        hour12: true,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    if (currentLang === 'ar') {
        timeStr = timeStr.replace(/AM/i, t('am')).replace(/PM/i, t('pm'));
    }
    countdownText.textContent = t('time_current', {time: timeStr});
    countdownText.classList.remove('hidden');
}

function getScrollRoot() {
    return document.scrollingElement || document.documentElement;
}

function clearScrollCancelHandlers() {
    scrollCancelHandlers.forEach(handler => handler());
    scrollCancelHandlers = [];
}

function cancelAutoScroll() {
    if (scrollAnimationFrame) {
        cancelAnimationFrame(scrollAnimationFrame);
        scrollAnimationFrame = null;
    }
    isAutoScrolling = false;
    clearScrollCancelHandlers();
    if (reminderSettings) {
        reminderSettings.classList.remove('scroll-focus');
    }
    document.body.classList.remove('scrolling-settings');
}

function addScrollCancelListener(type, options) {
    const handler = () => {
        if (isAutoScrolling) {
            cancelAutoScroll();
        }
    };
    document.addEventListener(type, handler, options);
    scrollCancelHandlers.push(() => document.removeEventListener(type, handler, options));
}

function startAutoScroll(targetY, prefersReducedMotion) {
    const scrollRoot = getScrollRoot();
    cancelAutoScroll();
    if (!scrollRoot) {
        return;
    }
    if (prefersReducedMotion) {
        scrollRoot.scrollTop = targetY;
        if (reminderSettings) {
            reminderSettings.classList.add('scroll-focus');
            setTimeout(() => {
                reminderSettings.classList.remove('scroll-focus');
            }, 400);
        }
        return;
    }
    const startY = scrollRoot.scrollTop;
    const distance = targetY - startY;
    const duration = 400;
    const startTime = performance.now();
    isAutoScrolling = true;
    if (reminderSettings) {
        reminderSettings.classList.add('scroll-focus');
    }
    document.body.classList.add('scrolling-settings');
    addScrollCancelListener('wheel', { passive: true });
    addScrollCancelListener('touchstart', { passive: true });
    addScrollCancelListener('mousedown', { passive: true });
    addScrollCancelListener('keydown', false);

    const ease = (t) => {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    };

    const step = (now) => {
        if (!isAutoScrolling) {
            return;
        }
        const elapsed = now - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = ease(progress);
        scrollRoot.scrollTop = startY + distance * eased;
        if (progress < 1) {
            scrollAnimationFrame = requestAnimationFrame(step);
        } else {
            cancelAutoScroll();
        }
    };

    scrollAnimationFrame = requestAnimationFrame(step);
}

function openSettingsMenu() {
    reminderSettings.classList.remove('hidden');
    // Force a reflow so display: block is applied before opacity transition
    void reminderSettings.offsetWidth;
    reminderSettings.classList.add('show');

    if (window.settingsBackdrop) {
        window.settingsBackdrop.classList.remove('hidden');
        void window.settingsBackdrop.offsetWidth;
        window.settingsBackdrop.classList.add('show');
    }
    stopIdleAutoScroll();
}

function closeSettingsMenu() {
    reminderSettings.classList.remove('show');
    if (window.settingsBackdrop) {
        window.settingsBackdrop.classList.remove('show');
    }

    // Wait for transition to finish before hiding from DOM to prevent layout box expansion
    setTimeout(() => {
        if (!reminderSettings.classList.contains('show')) {
            reminderSettings.classList.add('hidden');
        }
        if (window.settingsBackdrop && !window.settingsBackdrop.classList.contains('show')) {
            window.settingsBackdrop.classList.add('hidden');
        }
    }, 400);
}

async function updateCalculationMethodDisplay() {
    const result = await chrome.storage.local.get(['calculationMethod', 'selectedCountry']);
    const currentMethod = result.calculationMethod || 'auto';

    let methodName;
    if (currentMethod === 'auto' && result.selectedCountry) {
        const autoMethodId = countryMethodMap[result.selectedCountry] || 2;
        methodName = `${t('calc_short_auto')} (${t('calc_short_' + autoMethodId)})`;
    } else {
        methodName = t('calc_' + currentMethod) || t('calc_auto');
    }

    if (calculationMethodText) {
        calculationMethodText.textContent = `${t('calcMethodLabel')} ${methodName}`;
    }
}

async function updateReminderToggle() {
    const result = await chrome.storage.local.get([
        'reminderTime',
        'calculationMethod',
        'selectedCountry',
        'preReminderEnabled',
        'exactReminderEnabled',
        'lastScheduleError'
    ]);

    // Default both reminders to true if not explicitly set to false
    const preEnabled = result.preReminderEnabled !== false;
    const exactEnabled = result.exactReminderEnabled !== false;
    notificationMasterEnabled = true;

    // Update settings UI
    if (result.reminderTime) {
        setReminderSliderByMinutes(result.reminderTime);
    } else {
        setReminderSliderByMinutes(5);
    }

    // Set calculation method - default to auto if not set
    const currentMethod = result.calculationMethod || 'auto';
    calculationMethodSelect.value = currentMethod;

    preReminderToggle.checked = preEnabled;
    exactReminderToggle.checked = exactEnabled;
    updateToggleAvailability(true);

    if (result.lastScheduleError && result.lastScheduleError.message) {
        showError(result.lastScheduleError.message);
        setTimeout(() => {
            hideError();
        }, 3000);
    }
}

function setupEventListeners() {
    countrySelect.addEventListener('change', (e) => {
        populateCitySelect(e.target.value);
    });

    citySelect.addEventListener('change', updateSaveButton);

    saveLocationBtn.addEventListener('click', async () => {
        const countryCode = countrySelect.value;
        const cityName = citySelect.value;

        if (countryCode && cityName) {
            await chrome.storage.local.set({
                selectedCountry: countryCode,
                selectedCity: cityName,
                autoDetected: false // Clear auto-detected flag for manual selection
            });

            await showPrayerTimesSection(countryCode, cityName);
        }
    });

    editLocationBtn.addEventListener('click', () => {
        showLocationPrompt();
        updatePromptTitleForEdit();
    });

    // Location prompt buttons
    autoDetectBtn?.addEventListener('click', () => {
        attemptAutoLocationDetection();
    });

    manualSelectBtn?.addEventListener('click', () => {
        proceedToManualSelection();
    });

    preReminderToggle.addEventListener('change', () => {
        updateToggleAvailability(true);
    });

    exactReminderToggle.addEventListener('change', () => {
        updateToggleAvailability(true);
    });

    settingsToggle.addEventListener('click', () => {
        const isShown = reminderSettings.classList.contains('show');
        if (isShown) {
            closeSettingsMenu();
        } else {
            openSettingsMenu();
        }
    });

    if (window.settingsBackdrop) {
        window.settingsBackdrop.addEventListener('click', closeSettingsMenu);
    }
    if (window.closeSettingsBtn) {
        window.closeSettingsBtn.addEventListener('click', closeSettingsMenu);
    }

    async function saveSettings() {
        const reminderTime = getReminderTimeFromSlider();
        const calculationMethod = calculationMethodSelect.value;
        const preEnabled = preReminderToggle.checked;
        const exactEnabled = exactReminderToggle.checked;

        const oldSettings = await chrome.storage.local.get(['calculationMethod']);

        await chrome.storage.local.set({
            reminderTime: reminderTime,
            calculationMethod: calculationMethod,
            preReminderEnabled: preEnabled,
            exactReminderEnabled: exactEnabled
        });

        if (oldSettings.calculationMethod !== calculationMethod) {
            const result = await chrome.storage.local.get(['selectedCountry', 'selectedCity']);
            if (result.selectedCountry && result.selectedCity) {
                await loadPrayerTimes(result.selectedCountry, result.selectedCity);
            }
        } else {
            await chrome.runtime.sendMessage({
                action: 'updateNotificationSettings'
            });
        }

        updateCalculationMethodDisplay();

        showSnackbar('تم حفظ الإعدادات بنجاح');
    }

    if (reminderTimeSlider) {
        reminderTimeSlider.addEventListener('change', saveSettings);
        reminderTimeSlider.addEventListener('input', () => {
            updateReminderSliderLabels();
        });
    }

    if (reminderTimeLabels && reminderTimeLabels.length > 0) {
        reminderTimeLabels.forEach(label => {
            label.addEventListener('click', async () => {
                const value = Number(label.dataset.value);
                setReminderSliderByMinutes(value);
                await saveSettings();
            });
        });
    }

    preReminderToggle.addEventListener('change', async () => {
        updateToggleAvailability(true);
        await saveSettings();
    });

    exactReminderToggle.addEventListener('change', async () => {
        updateToggleAvailability(true);
        await saveSettings();
    });

    calculationMethodSelect.addEventListener('change', saveSettings);

}

function updateToggleAvailability(isEnabled) {
    const toggleRows = reminderSettings.querySelectorAll('.toggle-row');
    toggleRows.forEach(row => {
        row.classList.toggle('disabled', !isEnabled);
    });
    preReminderToggle.disabled = !isEnabled;
    exactReminderToggle.disabled = !isEnabled;
    if (reminderTimeSlider) {
        reminderTimeSlider.disabled = !isEnabled || !preReminderToggle.checked;
    }
    if (reminderTimeSliderWrap) {
        reminderTimeSliderWrap.classList.toggle('disabled', !isEnabled || !preReminderToggle.checked);
    }
    calculationMethodSelect.disabled = !isEnabled;
}

function renderPrayerCards(prayers, nextPrayerName, formatTo12Hour) {
    if (!prayerCards) {
        return;
    }
    const signature = `${currentLang}:${nextPrayerName}:${prayers.map(prayer => prayer.name + prayer.timeStr).join('|')}`;
    if (signature === lastPrayerCardSignature) {
        return;
    }
    lastPrayerCardSignature = signature;
    prayerCards.innerHTML = '';

    prayers.forEach(prayer => {
        const card = document.createElement('div');
        card.className = `prayer-card${prayer.name === nextPrayerName ? ' next' : ''}`;

        const info = document.createElement('div');
        info.className = 'prayer-card-info';

        const title = document.createElement('div');
        title.className = 'prayer-card-title';
        title.textContent = t('prayer_' + prayer.name);

        const time = document.createElement('div');
        time.className = 'prayer-card-time';
        time.textContent = formatTo12Hour(prayer.timeStr);

        info.appendChild(title);
        info.appendChild(time);

        card.appendChild(info);

        if (prayer.name === nextPrayerName) {
            const badge = document.createElement('div');
            badge.className = 'prayer-card-next';
            badge.textContent = t('badge_next');
            card.appendChild(badge);
        }

        prayerCards.appendChild(card);
    });
    scheduleIdleAutoScroll();
}

function initializeIdleAutoScroll() {
    if (!prayerCards) {
        return;
    }
    scheduleIdleAutoScroll();
    prayerCards.addEventListener('mouseenter', handleCardsHoverStart);
    prayerCards.addEventListener('mouseleave', handleCardsHoverEnd);
    prayerCards.addEventListener('wheel', handleCardsScrollInteraction, { passive: true });
    prayerCards.addEventListener('touchstart', handleCardsScrollInteraction, { passive: true });
    prayerCards.addEventListener('touchmove', handleCardsScrollInteraction, { passive: true });
    prayerCards.addEventListener('pointerdown', handleCardsScrollInteraction, { passive: true });
    prayerCards.addEventListener('pointermove', handleCardsScrollInteraction, { passive: true });
    prayerCards.addEventListener('scroll', handleCardsScrollInteraction, { passive: true });
}

function handleCardsHoverStart() {
    isCardHovering = true;
    stopIdleAutoScroll();
    clearIdleAutoScrollTimer();
}

function handleCardsHoverEnd() {
    isCardHovering = false;
    scheduleIdleAutoScroll();
}

function handleCardsScrollInteraction() {
    stopIdleAutoScroll();
    scheduleIdleAutoScroll();
}

function clearIdleAutoScrollTimer() {
    if (idleAutoScrollTimer) {
        clearTimeout(idleAutoScrollTimer);
        idleAutoScrollTimer = null;
    }
}

function scheduleIdleAutoScroll() {
    if (isCardHovering) {
        return;
    }
    clearIdleAutoScrollTimer();
    idleAutoScrollTimer = setTimeout(() => {
        startIdleAutoScroll();
    }, 4000);
}

function startIdleAutoScroll() {
    if (idleAutoScrollActive || isAutoScrolling || !prayerCards) {
        return;
    }
    const maxScroll = prayerCards.scrollWidth - prayerCards.clientWidth;
    if (maxScroll <= 0) {
        scheduleIdleAutoScroll();
        return;
    }
    idleAutoScrollActive = true;
    idleAutoScrollLastTime = performance.now();

    const step = (now) => {
        if (!idleAutoScrollActive || !prayerCards) {
            return;
        }
        const deltaSeconds = Math.max((now - idleAutoScrollLastTime) / 1000, 0);
        idleAutoScrollLastTime = now;
        const currentMax = prayerCards.scrollWidth - prayerCards.clientWidth;
        if (currentMax <= 0) {
            stopIdleAutoScroll();
            return;
        }
        let nextScrollLeft = prayerCards.scrollLeft + idleAutoScrollDirection * 70 * deltaSeconds;
        if (nextScrollLeft >= currentMax) {
            nextScrollLeft = currentMax;
            idleAutoScrollDirection = -1;
        } else if (nextScrollLeft <= 0) {
            nextScrollLeft = 0;
            idleAutoScrollDirection = 1;
        }
        prayerCards.scrollLeft = nextScrollLeft;
        idleAutoScrollFrame = requestAnimationFrame(step);
    };

    idleAutoScrollFrame = requestAnimationFrame(step);
}

function stopIdleAutoScroll() {
    if (idleAutoScrollFrame) {
        cancelAnimationFrame(idleAutoScrollFrame);
        idleAutoScrollFrame = null;
    }
    idleAutoScrollActive = false;
}

function showLoading(show) {
    if (show) {
        loadingState.classList.remove('hidden');
    } else {
        loadingState.classList.add('hidden');
    }
}


let snackbarTimeout = null;

function showSnackbar(message) {
    if (snackbarTimeout) {
        clearTimeout(snackbarTimeout);
    }
    errorState.textContent = message;
    errorState.classList.add('snackbar');
    errorState.classList.remove('out');
    errorState.classList.remove('hidden');

    snackbarTimeout = setTimeout(() => {
        errorState.classList.add('out');
        setTimeout(() => {
            if (errorState.classList.contains('out')) {
                errorState.classList.remove('snackbar');
                errorState.classList.remove('out');
                errorState.classList.add('hidden');
            }
        }, 300);
    }, 3000);
}

function showError(message) {
    errorState.textContent = message;
    errorState.classList.remove('snackbar');
    errorState.classList.remove('hidden');
}

function hideError() {
    errorState.classList.add('hidden');
    errorState.classList.remove('snackbar');
}

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
    if (countdownInterval) {
        clearInterval(countdownInterval);
    }
    stopIdleAutoScroll();
    clearIdleAutoScrollTimer();
});

// public/js/detailmodal.js
console.log("detailmodal.js loaded!"); // Add this line

// Global variables for detailmodal.html
let seasonData = {}; // For peak/off-peak data
let current_nationname = "";
let current_cityname = ""; // Add this global variable
let currentDate = new Date(); // Current date for calendar navigation
const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
const festivalDataCache = {}; // Cache for festival data
let functions = undefined
  document.addEventListener('DOMContentLoaded', function () {
    functions = firebase.app().functions("asia-northeast3");

    // 로컬 에뮬레이터로 테스트 하기 위한 코드
    if (location.hostname === "localhost") {
        functions.useEmulator("localhost", 5001);
    }
});

async function loadSeasonData() {
    try {
        const response = await fetch('popular.csv'); // Corrected path
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.text();
        const rows = data.split('\n').slice(1); // Skip header row
        rows.forEach(row => {
            const columns = row.split(',');
            if (columns.length > 13) { // 국가명 + 12 months
                const countryName = columns[1].replace(/"/g, '').trim();
                if (countryName) {
                    const monthlyData = {};
                    for (let i = 2; i <= 13; i++) {
                        monthlyData[i - 1] = columns[i].replace(/"/g, '').trim();
                    }
                    seasonData[countryName] = monthlyData;
                }
            }
        });
        console.log("Season data loaded successfully");
    } catch (error) {
        console.error('Error loading or parsing season data:', error);
    }
}


document.addEventListener('DOMContentLoaded', async function () {
    await loadSeasonData(); // Ensure season data is loaded first

    let query = window.location.search;
    let param = new URLSearchParams(query);
    // Assign to global variables
    current_cityname = param.get('Cityname'); // Assign to global
    current_nationname = param.get('Nationname'); // Assign to global
    let coord1 = param.get('coord2'); // Local, as it's only used here
    let coord2 = param.get('coord1'); // Local, as it's only used here

    // console.log("detailmodal.js DOMContentLoaded - Nationname:", current_nationname, "Cityname:", current_cityname);

    $("#name").text(current_nationname + " " + current_cityname);

    // Initialize calendars and fetch festivals
    initDetailCalendar();

    // Load images (existing logic)
    functions.httpsCallable('getGoogleMapAPIKey')().then((result) => {
        (g => { var h, a, k, p = "The Google Maps JavaScript API", c = "google", l = "importLibrary", q = "__ib__", m = document, b = window; b = b[c] || (b[c] = {}); var d = b.maps || (b.maps = {}), r = new Set, e = new URLSearchParams, u = () => h || (h = new Promise(async (f, n) => { await (a = m.createElement("script")); e.set("libraries", [...r] + ""); for (k in g) e.set(k.replace(/[A-Z]/g, t => "_" + t[0].toLowerCase()), g[k]); e.set("callback", c + ".maps." + q); a.src = `https://maps.${c}apis.com/maps/api/js?` + e; d[q] = f; a.onerror = () => h = n(Error(p + " could not load.")); a.nonce = m.querySelector("script[nonce]")?.nonce || ""; m.head.append(a) })); d[l] ? console.warn(p + " only loads once. Ignoring:", g) : d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)) })({
            key: result.data,
            v: "weekly",
            // Add the callback here to ensure loadImg is called after the API is ready
        
        });
        console.log("Google map ready (from callback)");
        loadImg(Number(coord1), Number(coord2), current_cityname, current_nationname);
    
    }).catch((error) => {
        console.log("ERROR! (Google Maps API key fetch failed)", error);
    });

    // Fetch and display weather forecast (existing logic)
    functions.httpsCallable('getWeatherForecast')({
        lat: Number(coord1),
        lon: Number(coord2),
        days: 8,
    }).then(result => {
        const forecasts = result.data;
        if (forecasts && forecasts.length > 0) {
            $("#weather-forecast-container").empty();
            let totalTemp = 0;
            let totalPrecipProb = 0;

            forecasts.forEach((day, index) => {
                const dateParts = day.date.split('-');
                const month = parseInt(dateParts[1], 10);
                const dayOfMonth = parseInt(dateParts[2], 10);
                const displayDate = `${month}/${dayOfMonth}`;
                const temp = Math.round(day.maxTemp);
                const emoji = weatherTypeToEmoji(day.daytime.type);

                totalTemp += (day.maxTemp + day.minTemp) / 2;
                totalPrecipProb += (day.daytime.precipProbPercent + day.nighttime.precipProbPercent) / 2;

                const cardHtml = `
                    <div class="weather-day-card" id="weather-day-${index}">
                        <div class="weather-day-date">${displayDate}</div>
                        <div class="weather-day-icon">${emoji}</div>
                        <div class="weather-day-temp">${temp}°</div>
                    </div>
                `;
                $("#weather-forecast-container").append(cardHtml);
            });

            const avgTemp = Math.round(totalTemp / forecasts.length);
            const avgPrecipProb = Math.round(totalPrecipProb / forecasts.length);

            const summaryHtml = `
                <p class="weather-summary-line">평균기온: ${avgTemp}°</p>
                <p class="weather-summary-line">강수확률: ${avgPrecipProb}%</p>
            `;
            $("#weather-summary").html(summaryHtml);
        }
    }).catch(error => {
        console.error("날씨 정보 로딩 에러!", error);
        $('#weather-forecast-section').hide();
    });

    // Instagram share logic (existing logic)
    const instagramShareBtn = document.getElementById('instagramShareBtn');
    const shareDialog = document.getElementById('instagram-share-dialog');
    const shareImage = document.getElementById('share-image');
    const shareText = document.getElementById('share-text');
    const copyTextBtn = document.getElementById('copy-text-btn');
    const closeShareDialogBtn = document.getElementById('close-share-dialog-btn');

    instagramShareBtn.addEventListener('click', () => {
        const firstImage = document.querySelector('#imgDiv img');
        if (firstImage) {
            shareImage.src = firstImage.src;
        }
        const localNationname = current_nationname;
        const localCityname = current_cityname;
        const shareMessage = `${localCityname}, ${localNationname}! #PeekAndFree #Travel #${localCityname.replace(/\s/g, '')} #${localNationname.replace(/\s/g, '')}`;
        shareText.value = shareMessage;
        shareDialog.style.display = 'block';
    });

    copyTextBtn.addEventListener('click', () => {
        shareText.select();
        document.execCommand('copy');
        alert('텍스트가 복사되었습니다. 인스타그램으로 이동합니다.');
        window.open('https://www.instagram.com', '_blank');
    });

    closeShareDialogBtn.addEventListener('click', () => {
        shareDialog.style.display = 'none';
    });

    // Exchange rate logic (existing logic)
    console.log("Attempting to fetch exchange rate information..."); // Add this log
    functions.httpsCallable('getLatestExchangeRate')().then((result) => {
        console.log("Exchange rate Firebase function call successful. Result:", result); // Add this log
        if (!result.data || !result.data.todayRates) {
            console.log("Exchange rate data is not an object or todayRates is missing."); // Add this log
            $("#exchangerate").text("환율 정보를 가져올 수 없습니다.");
            return;
        }
        const todayRates = result.data.todayRates;
        const previousDayRates = result.data.previousDayRates;

        if (!current_nationname) { // Use global current_nationname
            console.log("current_nationname is not defined for exchange rate."); // Add this log
            $("#exchangerate").text("국가 정보가 없습니다.");
            return;
        }
        let found = false;
        const countryMapping = {
            '미국': '미국달러', '중국': '위안', '일본': '일본엔', '영국': '영국파운드', '캐나다': '캐나다달러', '스위스': '스위스프랑', '홍콩': '홍콩달러', '스웨덴': '스웨덴크로나', '오스트레일리아': '호주달러', '덴마크': '덴마크크로나', '노르웨이': '노르웨이크로나', '사우디아라비아': '사우디아라비아리얄', '쿠웨이트': '쿠웨이트디나르', '바레인': '바레인디나르', '아랍에미리트': '아랍에미리트디르함', '싱가포르': '싱가포르달러', '말레이시아': '말레이지아링깃', '뉴질랜드': '뉴질랜드달러', '태국': '태국바트', '인도네시아': '인도네시아루피아', '대만': '대만달러', '몽골': '몽골투그릭', '카자흐스탄': '카자흐스탄텡게', '필리핀': '필리핀페소', '베트남': '베트남동', '브루나이': '브루나이달러', '인도': '인도루피', '파키스탄': '파키스탄루피', '방글라데시': '방글라데시타카', '멕시코': '멕시코 페소', '브라질': '브라질 헤알', '아르헨티나': '아르헨티나페소', '러시아': '러시아루블', '헝가리': '헝가리포린트', '폴란드': '폴란트즈워티', '체코': '체코코루나', '카타르': '카타르리얄', '이스라엘': '이스라엘셰켈', '요르단': '요르단디나르', '튀르키예': '튀르키예리라', '터키': '튀르키예리라', '남아프리카공화국': '남아프리카공화국랜드', '남아공': '남아프리카공화국랜드', '이집트': '이집트파운드'
        };
        const currencyToFind = countryMapping[current_nationname]; // Use global current_nationname
        // console.log("Currency to find:", currencyToFind); // Add this log
        if (currencyToFind) {
            let todayRate = null;
            let previousRate = null;

            for (let item of todayRates) {
                if (item.id && item.id.indexOf(currencyToFind) != -1) {
                    todayRate = item;
                    break;
                }
            }

            if (previousDayRates) {
                for (let item of previousDayRates) {
                    if (item.id && item.id.indexOf(currencyToFind) != -1) {
                        previousRate = item;
                        break;
                    }
                }
            }

            if (todayRate) {
                let exchangeRateText = `💵 ${todayRate.id} ${todayRate.value}원`;
                if (previousRate) {
                    const diff = todayRate.value - previousRate.value;
                    let diffText = '';
                    if (diff > 0) {
                        diffText = `<span style="color: red;"> ▲${diff.toFixed(2)}</span>`;
                    } else if (diff < 0) {
                        diffText = `<span style="color: blue;"> ▼${Math.abs(diff).toFixed(2)}</span>`;
                    } else {
                        diffText = ` -`;
                    }
                    exchangeRateText += ` (전일 대비: ${diffText})`;
                }
                $("#exchangerate").html(exchangeRateText);
                $("#exchangerate").css('cursor', 'pointer');
                $("#exchangerate").off('click').on('click', function() {
                    const currencyName = todayRate.id;
                    const googleSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(currencyName.replace("(매매기준율)",""))} 환율 그래프`;
                    window.open(googleSearchUrl, '_blank');
                });
                found = true;
            } else {
                console.log("No today's exchange rate found for the current nation.");
            }
        }
        if (!found) {
            console.log("No exchange rate found for the current nation."); // Add this log
            $("#exchangerate").text("해당 국가의 환율 정보를 제공하지 않습니다.");
        }
    }).catch((error) => {
        console.error("환율 ERROR! Firebase function call failed:", error); // Change to console.error and log error object
        $("#exchangerate").text("환율 정보 로딩 실패");
    });

    // Country info logic (existing logic)
    functions.httpsCallable('getCountryInfo')({
        country: current_nationname ? current_nationname.trim() : "",
    }).then((result) => {
        if (result.data.country) {
            updateCountry(result.data.country[0]["국가 한줄소개"]);
        }
    }).catch((error) => {
        console.log("ERROR!", error);
    });

    // Booking button handler (existing logic)
    document.getElementById('bookingBtn').addEventListener('click', handleBookingClick);
});

// Function to update country info (moved from inline script)
function updateCountry(country) {
    const div = document.getElementById("countryInfo");
    div.textContent = country;
}

// Function to handle booking click (moved from inline script)
function handleBookingClick() {
    console.log('예매하기 버튼 클릭됨');
    if (window.parent) {
        try {
            const modal = window.parent.bootstrap.Modal.getInstance(window.parent.document.getElementById('detailModal'));
            if (modal) {
                modal.hide();
            }
        } catch (e) {
            console.log('모달 닫기 실패:', e);
        }
    }
    if (window.parent && window.parent.unlockCalendarSectionFromMap) {
        window.parent.unlockCalendarSectionFromMap();
    } else if (window.parent && window.parent.parent && window.parent.parent.unlockCalendarSectionFromMap) {
        window.parent.parent.unlockCalendarSectionFromMap();
    } else {
        try {
            if (window.parent) {
                const parentDoc = window.parent.document;
                const initialAction = parentDoc.getElementById('initialAction');
                const calendarSection = parentDoc.querySelector('.calendar-section');
                if (initialAction) {
                    initialAction.style.display = 'none';
                }
                if (calendarSection) {
                    calendarSection.style.display = 'block';
                    calendarSection.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        } catch (e) {
            console.log('직접 처리 실패:', e);
        }
    }
    if (current_cityname && current_nationname) {
        sessionStorage.setItem('selectedDestination', `${current_nationname} ${current_cityname}`);
        sessionStorage.setItem('bookingAction', 'true');
        if (current_iata) {
            sessionStorage.setItem('selectedAirportCode', current_iata);
        }
    }
}

// Function to load images (moved from inline script)
async function loadImg(coord1, coord2, cityname, nationname) {
    const pixabayApiKey = '52281114-88b2ee02640359c4a109ad9a7';

    const fetchImagesFromPixabay = async () => {
        let searchQuery = cityname && cityname !== 'null' ? cityname : nationname;
        const query = encodeURIComponent(searchQuery);
        const pixabayUrl = `https://pixabay.com/api/?key=${pixabayApiKey}&q=${query}&image_type=photo&per_page=10`;
        try {
            const response = await fetch(pixabayUrl);
            const data = await response.json();
            if (data.hits && data.hits.length > 0) {
                $("#imgDiv").empty();
                data.hits.forEach(hit => {
                    const img = $(`<img class="rounded m-1" src="${hit.webformatURL}"/>`);
                    $("#imgDiv").append(img);
                });
            } else {
                $("#imgDiv").text("주변의 추천 장소 이미지를 찾지 못했습니다.");
            }
        } catch (pixabayError) {
            console.error("loadImg: Pixabay API call failed:", pixabayError);
            $("#imgDiv").text("이미지를 불러오는 데 실패했습니다.");
        }
    };

    const getImagesFn = functions.httpsCallable('getPlaceImages');
    try {
        // console.log("loadImg: Attempting to fetch cached images from Firebase.");
        const cachedResult = await getImagesFn({ lat: coord1, lon: coord2 });

        if (cachedResult.data && cachedResult.data.length > 0) {
            // console.log("loadImg: Cached images found. Displaying them.");
            $("#imgDiv").empty();
            cachedResult.data.forEach(url => {
                const img = $(`<img class="rounded m-1" src="${url}"/>`);
                $("#imgDiv").append(img);
            });
        } else {
            // console.log("loadImg: No cached images. Attempting Google Places API.");
            try {
                // Ensure google.maps is available before calling importLibrary
                if (typeof google === 'undefined' || typeof google.maps === 'undefined') {
                    console.error("loadImg: Google Maps API not loaded yet.");
                    await fetchImagesFromPixabay(); // Fallback if Google Maps API isn't ready
                    return;
                }
                const { Place, SearchNearbyRankPreference } = await google.maps.importLibrary("places");
                // console.log("loadImg: Google Places library imported.");
                let center = new google.maps.LatLng(coord1, coord2);
                const request = {
                    fields: ["displayName", "photos"],
                    locationRestriction: {
                        center: center,
                        radius: 30000,
                    },
                    includedPrimaryTypes: ["cultural_landmark", "historical_landmark", "beach", "hiking_area"],
                    maxResultCount: 10,
                    rankPreference: SearchNearbyRankPreference.POPULARITY,
                    language: "ko-kr",
                };
                const { places } = await Place.searchNearby(request);
                // console.log("loadImg: Google Places searchNearby result:", places);

                if (places.length > 0 && places[0].photos && places[0].photos.length > 0) {
                    // console.log("loadImg: Google Places images found. Displaying and caching.");
                    const imageUrls = places.map(place => place.photos[0].getURI({ maxWidth: 400, maxHeight: 400 }));
                    $("#imgDiv").empty();
                    imageUrls.forEach(url => {
                        const img = $(`<img class="rounded m-1" src="${url}"/>`);
                        $("#imgDiv").append(img);
                    });
                    const storeImagesFn = functions.httpsCallable('storePlaceImages');
                    await storeImagesFn({ lat: coord1, lon: coord2, urls: imageUrls });
                } else {
                    console.log("loadImg: No Google Places images found. Falling back to Pixabay.");
                    await fetchImagesFromPixabay();
                }
            } catch (googleError) {
                console.error("loadImg: Google Places API call failed:", googleError);
                await fetchImagesFromPixabay();
            }
        }
    } catch (error) {
        console.error("loadImg: Error during image loading process (Firebase or initial fetch):", error);
        await fetchImagesFromPixabay();
    }
}

// Function to convert weather type to emoji (moved from inline script)
function weatherTypeToEmoji(type) {
    const mapping = {
        'CLEAR': '☀️', 'MOSTLY_CLEAR': '🌤️', 'PARTLY_CLOUDY': '⛅️', 'MOSTLY_CLOUDY': '🌥️', 'CLOUDY': '☁️',
        'WINDY': '🌬️', 'WIND_AND_RAIN': '🌧️', 'LIGHT_RAIN_SHOWERS': '🌦️', 'CHANCE_OF_SHOWERS': '🌦️',
        'SCATTERED_SHOWERS': '🌦️', 'RAIN_SHOWERS': '🌦️', 'HEAVY_RAIN_SHOWERS': '🌧️',
        'LIGHT_TO_MODERATE_RAIN': '🌧️', 'MODERATE_TO_HEAVY_RAIN': '🌧️', 'RAIN': '🌧️', 'LIGHT_RAIN': '🌦️',
        'HEAVY_RAIN': '🌧️', 'RAIN_PERIODICALLY_HEAVY': '🌧️', 'LIGHT_SNOW_SHOWERS': '🌨️',
        'CHANCE_OF_SNOW_SHOWERS': '🌨️', 'SCATTERED_SNOW_SHOWERS': '🌨️', 'SNOW_SHOWERS': '🌨️',
        'HEAVY_SNOW_SHOWERS': '❄️', 'LIGHT_TO_MODERATE_SNOW': '🌨️', 'MODERATE_TO_HEAVY_SNOW': '❄️',
        'SNOW': '❄️', 'LIGHT_SNOW': '🌨️', 'HEAVY_SNOW': '❄️', 'SNOWSTORM': '❄️',
        'SNOW_PERIODICALLY_HEAVY': '❄️', 'HEAVY_SNOW_STORM': '❄️', 'BLOWING_SNOW': '🌬️❄️',
        'RAIN_AND_SNOW': '🌨️', 'HAIL': '🌨️', 'HAIL_SHOWERS': '🌨️', 'THUNDERSTORM': '⛈️',
        'THUNDERSHOWER': '⛈️', 'LIGHT_THUNDERSTORM_RAIN': '⛈️', 'SCATTERED_THUNDERSTORMS': '⛈️',
        'HEAVY_THUNDERSTORM': '⛈️', 'FOG': '🌫️', 'HAZE': '🌫️', 'DUST': '💨'
    };
    return mapping[type] || '❓';
}


// Calendar functions for detailmodal.html
function initDetailCalendar() {
    renderDetailCalendars();
}

function changeMonthForDetail(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderDetailCalendars();
}

async function renderDetailCalendars() {
    const firstMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const secondMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

    let month1Title = `${firstMonth.getFullYear()}년 ${monthNames[firstMonth.getMonth()]}`;
    let month2Title = `${secondMonth.getFullYear()}년 ${monthNames[secondMonth.getMonth()]}`;

    if (seasonData && current_nationname && seasonData[current_nationname]) {
        const countrySeasonData = seasonData[current_nationname];
        const month1 = firstMonth.getMonth() + 1;
        const month2 = secondMonth.getMonth() + 1;

        if (countrySeasonData[month1] === '1') {
            month1Title += ' 🔥';
        } else if (countrySeasonData[month1] === '2' || countrySeasonData[month1] === '3') {
            month1Title += ' 😴';
        }

        if (countrySeasonData[month2] === '1') {
            month2Title += ' 🔥';
        } else if (countrySeasonData[month2] === '2' || countrySeasonData[month2] === '3') {
            month2Title += ' 😴';
        }
    }

    document.getElementById('monthTitle1').textContent = month1Title;
    document.getElementById('monthTitle2').textContent = month2Title;

    // Fetch festivals for both months
    // console.log("renderDetailCalendars: Fetching festivals for month 1:", firstMonth);
    const festivalsMonth1 = await fetchFestivalsForMonth(firstMonth);
    // console.log("renderDetailCalendars: Festivals for month 1:", festivalsMonth1);

    // console.log("renderDetailCalendars: Fetching festivals for month 2:", secondMonth);
    const festivalsMonth2 = await fetchFestivalsForMonth(secondMonth);
    // console.log("renderDetailCalendars: Festivals for month 2:", festivalsMonth2);

    // Extract festival dates for highlighting
    let allFestivalDatesMonth1 = [];
    festivalsMonth1.forEach(f => {
        if (f["개최일"]) {
            allFestivalDatesMonth1 = allFestivalDatesMonth1.concat(getDatesInRange(f["개최일"], firstMonth.getFullYear()));
        }
    });
    const festivalDatesMonth1 = [...new Set(allFestivalDatesMonth1)]; // Remove duplicates

    let allFestivalDatesMonth2 = [];
    festivalsMonth2.forEach(f => {
        if (f["개최일"]) {
            allFestivalDatesMonth2 = allFestivalDatesMonth2.concat(getDatesInRange(f["개최일"], secondMonth.getFullYear()));
        }
    });
    const festivalDatesMonth2 = [...new Set(allFestivalDatesMonth2)]; // Remove duplicates

    // console.log("renderDetailCalendars: Festival dates for month 1 (individual, formatted):"), festivalDatesMonth1);
    // console.log("renderDetailCalendars: Festival dates for month 2 (individual, formatted):"), festivalDatesMonth2);

    renderDetailMonthCalendar('calendar1', firstMonth, festivalDatesMonth1);
    renderDetailMonthCalendar('calendar2', secondMonth, festivalDatesMonth2);

    updateFestivalList('festivalInfo1', festivalsMonth1);
    updateFestivalList('festivalInfo2', festivalsMonth2);
}

function renderDetailMonthCalendar(containerId, monthDate, festivalDates = []) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    // Day headers
    dayNames.forEach(day => {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-cell header';
        dayCell.textContent = day;
        container.appendChild(dayCell);
    });

    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    let dayCount = 0;

    // Empty cells for the first week
    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-cell empty';
        container.appendChild(emptyCell);
        dayCount++;
    }

    // Days of the month
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const cellDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-cell';

        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        dayCell.appendChild(dayNumber);

        // Format date string for comparison (YYYY-MM-DD)
        const year = cellDate.getFullYear();
        const month = String(cellDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(cellDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${dayStr}`;
        // console.log(`renderDetailMonthCalendar: Cell dateString: ${dateString}`); // Add this log

        // Highlight festival dates
        if (festivalDates.includes(dateString)) {
            dayCell.classList.add('festival-date');
            // console.log(`renderDetailMonthCalendar: Highlighting ${dateString} in ${containerId}`);
        }

        container.appendChild(dayCell);
        dayCount++;
    }

    // Empty cells for the last week (to complete 6 rows)
    while (dayCount < 42) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-cell empty';
        container.appendChild(emptyCell);
        dayCount++;
    }

// Helper function to get all dates in a range
function getDatesInRange(dateRangeString, year) {
    const dates = [];
    const parts = dateRangeString.split('~').map(s => s.trim());

    if (parts.length === 0) return dates;

    const parseDate = (datePart) => {
        const [month, day] = datePart.split('/').map(Number);
        return new Date(year, month - 1, day);
    };

    const startDate = parseDate(parts[0]);
    let endDate = startDate; // Default to single day if no range

    if (parts.length > 1) {
        endDate = parseDate(parts[1]);
        // Handle year rollover for ranges like "12/25 ~ 01/05"
        if (endDate.getMonth() < startDate.getMonth()) {
            endDate.setFullYear(year + 1);
        }
    }

    let currentDateIterator = new Date(startDate);
    while (currentDateIterator <= endDate) {
        const y = currentDateIterator.getFullYear();
        const m = String(currentDateIterator.getMonth() + 1).padStart(2, '0');
        const d = String(currentDateIterator.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        currentDateIterator.setDate(currentDateIterator.getDate() + 1);
    }
    return dates;
}
}

async function fetchFestivalsForMonth(monthDate) {
    const monthKey = `${monthDate.getFullYear()}-${monthDate.getMonth()}`;
    if (festivalDataCache[monthKey]) {
        return festivalDataCache[monthKey];
    }

    const monthName = monthNames[monthDate.getMonth()];

    // Add a check for current_nationname
    if (!current_nationname) {
        console.error("fetchFestivalsForMonth: current_nationname is null or undefined. Cannot fetch festival info.");
        return []; // Return empty array if nation name is missing
    }

    // console.log(`fetchFestivalsForMonth: Calling Firebase function for country: ${current_nationname.trim()}, month: ${monthName}`);
    try {
        const result = await functions.httpsCallable('getFestivalInfo')({
            country: current_nationname.trim(),
            month: monthName
        });
        if (result.data && result.data.festivals) {
            // console.log(`fetchFestivalsForMonth: Received festival data for ${monthKey}:`, result.data.festivals);
            festivalDataCache[monthKey] = result.data.festivals;
            return result.data.festivals;
        } else if (result.data && result.data.error) {
            console.error(`fetchFestivalsForMonth: Firebase function returned error for ${monthKey}:`, result.data.error);
        } else {
            console.log(`fetchFestivalsForMonth: No festival data found for ${monthKey}. Result:`, result.data);
        }
    } catch (error) {
        console.error("fetchFestivalsForMonth: Error fetching festival info from Firebase:", error);
    }
    return [];
}

function updateFestivalList(containerId, festivals) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';
    if (festivals.length === 0) {
        html += '<p>해당 월에는 예정된 축제가 없습니다.</p>';
    } else {
        html += '<ul>';
        for (let item of festivals) {
            const date = item["개최일"] || "";
            const name = item["축제명"] || "(이름 없음)";
            const feature = item["특징"] || "";
            const site = item["공식/정보 사이트"] || "";

            const siteLink = site
                ? `<a class="badge bg-white" style="font-size:16px" href="${site}" target="_blank" rel="noopener noreferrer">🔗 관련링크</a>`
                : "";

            html += `<li>${date} ${feature} ${siteLink}</li>`;
        }
        html += '</ul>';
    }
    container.innerHTML = html;
}

// Helper function to get all dates in a range
function getDatesInRange(dateRangeString, year) {
    const dates = [];
    const parts = dateRangeString.split('~').map(s => s.trim());

    if (parts.length === 0) return dates;

    const parseDate = (datePart) => {
        const [month, day] = datePart.split('/').map(Number);
        return new Date(year, month - 1, day);
    };

    const startDate = parseDate(parts[0]);
    let endDate = startDate; // Default to single day if no range

    if (parts.length > 1) {
        endDate = parseDate(parts[1]);
        // Handle year rollover for ranges like "12/25 ~ 01/05"
        if (endDate.getMonth() < startDate.getMonth()) {
            endDate.setFullYear(year + 1);
        }
    }

    let currentDateIterator = new Date(startDate);
    while (currentDateIterator <= endDate) {
        const y = currentDateIterator.getFullYear();
        const m = String(currentDateIterator.getMonth() + 1).padStart(2, '0');
        const d = String(currentDateIterator.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        currentDateIterator.setDate(currentDateIterator.getDate() + 1);
    }
    return dates;
}

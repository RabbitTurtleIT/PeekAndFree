const { onCall } = require("firebase-functions/v2/https");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
require("dotenv").config();

// Initialize Firebase
initializeApp();
const db = getFirestore();

// Import modularized functions
const { requestTestAccessKey, requestFlightOffer } = require("./flights");
const { getLatestExchangeRate } = require("./exchange");
const { getAirportInfo, getFestivalInfo, getCountryInfo } = require("./places");
const { fetchAllDailyForecast, reverseGeocodeCountry, mapDayToDoc } = require("./weather");
const { getInformationOfCountry, getServiceDestinationInfo, loadWeather, getWeather } = require("./misc");
const { makeGeoKey } = require("./utils");

// --- Re-exporting functions for Firebase --- //

// Simple API Key function
exports.getGoogleMapAPIKey = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, () => {
  return process.env.GOOGLEMAP_API_KEY;
});

// Flight-related functions
exports.fetchFlightForCalendar = onCall({cors: ["https://peakandfree.com", "https://peekandfree.web.app"]}, async (data) => {
    const { startDate, endDate, iata } = data.data;
    const today = new Date();
    const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    const startRequestDate = new Date(startDate);
    const endRequestDate = new Date(endDate);

    if (startRequestDate > nextMonthEnd || endRequestDate > nextMonthEnd) {
        return { error: '조회 가능한 날짜 범위를 초과했습니다.', data: null };
    }
    if (startRequestDate < new Date(today.setDate(today.getDate() - 1))) {
        return { error: '과거 날짜는 조회할 수 없습니다.', data: null };
    }

    const flightRef = db.collection('ICN').doc(iata);
    const flightDoc = await flightRef.get();

    if (flightDoc.exists) {
        const flightData = flightDoc.data();
        const outboundKey = `outbound_${startDate}`;
        const returnKey = `return_${endDate}`;
        if (flightData[outboundKey] && flightData[returnKey]) {
            const totalPrice = flightData[outboundKey] + (flightData[returnKey] || 0);
            console.log(`Firestore에서 캐시된 데이터 반환: ${startDate} - ${totalPrice}`);
            return { data: { data: [{ price: { total: totalPrice } }] } };
        }
    }

    console.log(`API 호출: ${startDate}`);
    let accessKey = await requestTestAccessKey();
    const apiResult = await requestFlightOffer(accessKey.access_token, 'ICN', iata, endDate, endDate);

    if (apiResult.data && apiResult.data.length > 0) {
        const flightOffer = apiResult.data[0];
        const totalPrice = flightOffer.price.total;
        const itineraries = flightOffer.itineraries;
        const updateData = {};

        if (itineraries && itineraries.length === 1) {
            updateData[`outbound_${endDate}`] = totalPrice;
        } else if (itineraries && itineraries.length === 2) {
            const outboundPrice = Math.round(totalPrice / 2);
            updateData[`outbound_${endDate}`] = outboundPrice;
            updateData[`return_${endDate}`] = totalPrice - outboundPrice;
        }
        await flightRef.set(updateData, { merge: true });
    }
    return { data: { data: apiResult.data || [] } };
});

exports.fetchFlight = onCall({cors: ["https://peakandfree.com", "https://peekandfree.web.app"]}, async (data) => { 
  const { iata, startDate, endDate } = data.data;
  let accessKey = await requestTestAccessKey();
  return await requestFlightOffer(accessKey.access_token, 'ICN', iata, startDate, endDate);
});

// Weather-related functions
exports.getWeatherForecast = onCall({cors: ["https://peekandfree.web.app", "http://localhost:5002", "https://peakandfree.com"]}, async (data) => {
    const { lat, lon, days = 10 } = data.data || data;
    const normalizedDays = Math.min(Math.max(Number(days) || 10, 1), 10);

    if (typeof lat !== 'number' || typeof lon !== 'number') {
        throw new functions.https.HttpsError('invalid-argument', 'lat, lon 숫자값을 전달하세요.');
    }

    const col = db.collection('weatherForecastDaily');
    const { geoKey } = makeGeoKey(lon, lat);
    const today = new Date();
    const fromDate = today.toISOString().slice(0, 10);
    const toDateObj = new Date(today);
    toDateObj.setDate(today.getDate() + normalizedDays - 1);
    const toDate = toDateObj.toISOString().slice(0, 10);

    let q = col.where('location.geoKey', '==', geoKey).where('date', '>=', fromDate).where('date', '<=', toDate).orderBy('date').limit(normalizedDays);
    let snap = await q.get();

    if (snap.docs.length >= normalizedDays) {
        console.log(`[Weather] Found ${snap.docs.length} cached forecasts for ${geoKey}.`);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    console.log(`[Weather] Cached data for ${geoKey} is insufficient. Fetching from API...`);
    const forecastDays = await fetchAllDailyForecast({ lat, lon, days: normalizedDays, units: 'METRIC' });
    if (!forecastDays.length) {
        throw new functions.https.HttpsError('not-found', 'Weather API에서 예보를 받지 못했습니다.');
    }

    let country = null;
    try {
        country = await reverseGeocodeCountry(lat, lon, 'ko');
    } catch (e) {
        console.log('reverseGeocodeCountry 실패:', e.message);
    }

    const docs = forecastDays.map((day, idx) => mapDayToDoc(day, idx, lat, lon, 'METRIC', country));
    const batch = db.batch();
    docs.forEach(doc => batch.set(col.doc(doc.id), doc, { merge: true }));
    await batch.commit();

    snap = await q.get();
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
});

// Place and Info functions
exports.getPlaceImages = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, async (data) => {
    const { lat, lon } = data.data || data;
    const { geoKey } = makeGeoKey(lon, lat);
    const docRef = db.collection('placeImageCache').doc(geoKey);
    const docSnap = await docRef.get();
    if (docSnap.exists) {
        return docSnap.data().imageUrls;
    }
    return null;
});

exports.storePlaceImages = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, async (data) => {
    const { lat, lon, urls } = data.data || data;
    const { geoKey } = makeGeoKey(lon, lat);
    const docRef = db.collection('placeImageCache').doc(geoKey);
    await docRef.set({ imageUrls: urls, updatedAt: new Date().toISOString() });
    return { success: true };
});

exports.getAirportInfo = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, (data) => getAirportInfo(data.data.iata));
exports.getFestivalInfo = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, (data) => getFestivalInfo(data.data.country, data.data.month));
exports.getCountryInfo = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, (data) => getCountryInfo(data.data.country));

// Exchange Rate function
exports.getLatestExchangeRate = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, () => getLatestExchangeRate());

// Misc Gov API functions
exports.getInformationOfCountry = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, () => getInformationOfCountry());
exports.getServiceDestinationInfo = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, () => getServiceDestinationInfo());
exports.loadWeather = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, () => loadWeather());
exports.getWeather = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, () => getWeather());
const https = require('https');
const { getFirestore } = require("firebase-admin/firestore");
const { makeGeoKey, delay } = require("./utils");

const agent = new https.Agent({keepAlive: true});

function buildDailyForecastPath({ lat, lon, days = 5, pageSize = 5, pageToken = "", units = "METRIC" }) {
  const params = new URLSearchParams({
    key: process.env.GOOGLEMAP_API_KEY,
    "location.latitude": String(lat),
    "location.longitude": String(lon),
    days: String(days),
    pageSize: String(pageSize),
    units_system: units
  });
  if (pageToken) params.set("pageToken", pageToken);
  return `/v1/forecast/days:lookup?${params.toString()}`;
}

async function fetchDailyForecastPage({ lat, lon, days, pageSize, pageToken, units }) {
  const options = {
    hostname: 'weather.googleapis.com',
    port: 443,
    path: buildDailyForecastPath({ lat, lon, days, pageSize, pageToken, units }),
    method: 'GET',
    agent
  };

  return await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('[WeatherAPI] status =', res.statusCode);
        console.log('[WeatherAPI] body =', data);
        try {
          const json = JSON.parse(data);
          if (res.statusCode >= 400 || json.error) {
            const msg = json.error?.message || `HTTP ${res.statusCode}`;
            return reject(new Error(`Weather API error: ${msg}`));
          }
          resolve(json);
        } catch (e) {
          reject(new Error('JSON 파싱 실패'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('요청 타임아웃')); });
    req.end();
  });
}

async function fetchAllDailyForecast({ lat, lon, days = 5, units = 'METRIC' }) {
  let all = [];
  let remaining = Math.min(Math.max(Number(days) || 5, 1), 10);
  let pageToken = '';

  do {
    const pageSize = Math.min(remaining, 5);
    const page = await fetchDailyForecastPage({ lat, lon, days, pageSize, pageToken, units });
    const items = Array.isArray(page.forecastDays) ? page.forecastDays : [];
    all = all.concat(items);
    remaining -= items.length;
    pageToken = page.nextPageToken || '';
    if (pageToken) await delay(200);
  } while (pageToken && remaining > 0);

  return all;
}

const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000 * 30; // 30일

async function getGeocodeCache(geoKey) {
  const db = getFirestore();
  const docRef = db.collection('geocodeCache').doc(geoKey);
  const docSnap = await docRef.get();

  if (docSnap.exists) {
    const data = docSnap.data();
    const now = new Date().getTime();
    if (now < data.expiresAt) {
      console.log(`[GeocodeCache] Cache hit for ${geoKey}.`);
      return data.result;
    }
    console.log(`[GeocodeCache] Cache expired for ${geoKey}.`);
  }
  return null;
}

async function setGeocodeCache(geoKey, result) {
  const db = getFirestore();
  const docRef = db.collection('geocodeCache').doc(geoKey);
  const expiresAt = new Date().getTime() + GEOCODE_CACHE_TTL_MS;
  await docRef.set({ result, expiresAt });
  console.log(`[GeocodeCache] Stored geocode for ${geoKey}.`);
}

async function reverseGeocodeCountry(lat, lon, lang = 'ko') {
  const { geoKey } = makeGeoKey(lon, lat);
  const cachedResult = await getGeocodeCache(geoKey);
  if (cachedResult) {
    return cachedResult;
  }

  console.log(`[GeocodeAPI] Cache miss for ${geoKey}. Calling API.`);
  const params = new URLSearchParams({
    latlng: `${lat},${lon}`,
    key: process.env.GOOGLEMAP_API_KEY,
    language: lang
  });
  const options = {
    hostname: 'maps.googleapis.com',
    port: 443,
    path: `/maps/api/geocode/json?${params.toString()}`,
    method: 'GET',
    agent
  };

  const json = await new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); }
        catch { reject(new Error('Geocoding JSON 파싱 실패')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Geocoding 요청 타임아웃')); });
    req.end();
  });

  let result = { countryName: null, countryCode: null };
  for (const r of (json.results || [])) {
    const comp = (r.address_components || []).find(c => (c.types || []).includes('country'));
    if (comp) {
      result = {
        countryName: comp.long_name,
        countryCode: comp.short_name
      };
      break; 
    }
  }

  await setGeocodeCache(geoKey, result);
  return result;
}

function mapDayToDoc(day, idx, lat, lon, units, country) {
    const display = day?.displayDate;
    const y = display?.year, m = display?.month, d = display?.day;
  
    const baseDateId = (y && m && d)
      ? `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      : (day?.interval?.startTime ? String(day.interval.startTime).slice(0, 10) : `day-${idx}`);
  
    const { lonKey, latKey, geoKey } = makeGeoKey(lon, lat);  
  
    const id = `${geoKey}_${baseDateId}`;
  
    const maxTemp = day?.maxTemperature?.degrees ?? day?.temperatureMax?.value ?? null;
  
    const minTemp = day?.minTemperature?.degrees ?? day?.temperatureMin?.value ?? null;
  
    const daytime = day?.daytimeForecast || {};
    const nighttime = day?.nighttimeForecast || {};
  
    return {
      id,
      date: baseDateId,
      startTime: day?.interval?.startTime || null,
      endTime: day?.interval?.endTime || null,
      maxTemp,
      minTemp,
      daytime: {
        desc: daytime?.weatherCondition?.description?.text ?? null,
        type: daytime?.weatherCondition?.type ?? null,
        icon: daytime?.weatherCondition?.iconBaseUri ?? null,
        humidity: daytime?.relativeHumidity ?? null,
        uvIndex: daytime?.uvIndex ?? null,
        precipProbPercent: daytime?.precipitation?.probability?.percent ?? null,
        qpfMm: daytime?.precipitation?.qpf?.quantity ?? null,
        windKmh: daytime?.wind?.speed?.value ?? null,
        windGustKmh: daytime?.wind?.gust?.value ?? null,
        windDirDeg: daytime?.wind?.direction?.degrees ?? null
      },
      nighttime: {
        desc: nighttime?.weatherCondition?.description?.text ?? null,
        type: nighttime?.weatherCondition?.type ?? null,
        icon: nighttime?.weatherCondition?.iconBaseUri ?? null,
        humidity: nighttime?.relativeHumidity ?? null,
        uvIndex: nighttime?.uvIndex ?? null,
        precipProbPercent: nighttime?.precipitation?.probability?.percent ?? null,
        qpfMm: nighttime?.precipitation?.qpf?.quantity ?? null,
        windKmh: nighttime?.wind?.speed?.value ?? null,
        windGustKmh: nighttime?.wind?.gust?.value ?? null,
        windDirDeg: nighttime?.wind?.direction?.degrees ?? null
      },
      location: {
        lat, lon,
        latKey, lonKey,
        geoKey,
        countryCode: country?.countryCode || null
      },
    };
  }

module.exports = {
    fetchAllDailyForecast,
    reverseGeocodeCountry,
    mapDayToDoc
};
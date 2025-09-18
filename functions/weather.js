const https = require('https');
const { getFirestore } = require("firebase-admin/firestore");
const { makeGeoKey, delay } = require("./utils");

const agent = new https.Agent({keepAlive: true});

// --- Google Weather API Functions ---

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
        console.log('[GoogleWeatherAPI] status =', res.statusCode);
        try {
          if (res.statusCode === 204 || data.length === 0) {
            console.log('[GoogleWeatherAPI] No content returned.');
            resolve({ forecastDays: [], nextPageToken: '' });
            return;
          }
          const json = JSON.parse(data);
          if (res.statusCode >= 400 || json.error) {
            const msg = json.error?.message || `HTTP ${res.statusCode}`;
            return reject(new Error(`Google Weather API error: ${msg}`));
          }
          resolve(json);
        } catch (e) {
          reject(new Error('Google Weather JSON parsing failed'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Google Weather request timed out')); });
    req.end();
  });
}

// --- OpenWeatherMap API Functions ---

async function fetchWeatherFromOpenWeatherMap({ lat, lon }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    appid: process.env.OPENWEATHER,
    units: 'metric',
    lang: 'ko'
  });
  const options = {
    hostname: 'api.openweathermap.org',
    port: 443,
    path: `/data/2.5/forecast?${params.toString()}`,
    method: 'GET',
    agent
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log('[OpenWeatherMap] status =', res.statusCode);
        if (res.statusCode >= 400) {
            return reject(new Error(`OpenWeatherMap API error: HTTP ${res.statusCode}`));
        }
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          reject(new Error('OpenWeatherMap JSON parsing failed'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('OpenWeatherMap request timed out')); });
    req.end();
  });
}

function mapOpenWeatherTypeToGoogleType(owmType) {
    if (!owmType) return null;
    const owmTypeStr = String(owmType).toUpperCase();
    switch (owmTypeStr) {
        case 'CLEAR':
            return 'CLEAR';
        case 'CLOUDS':
            return 'CLOUDY';
        case 'RAIN':
            return 'RAIN';
        case 'DRIZZLE':
            return 'LIGHT_RAIN';
        case 'THUNDERSTORM':
            return 'THUNDERSTORM';
        case 'SNOW':
            return 'SNOW';
        case 'MIST':
        case 'SMOKE':
        case 'HAZE':
        case 'DUST':
        case 'FOG':
            return 'FOG';
        default:
            return null;
    }
}

function mapOpenWeatherResponseToGoogleFormat(openWeatherResponse) {
    if (!openWeatherResponse || !openWeatherResponse.list) return [];

    const dailyData = {};
    openWeatherResponse.list.forEach(item => {
        const date = item.dt_txt.split(' ')[0];
        if (!dailyData[date]) {
            dailyData[date] = {
                minTemps: [], maxTemps: [], weather: [], humidity: [], wind: [], pop: []
            };
        }
        dailyData[date].minTemps.push(item.main.temp_min);
        dailyData[date].maxTemps.push(item.main.temp_max);
        dailyData[date].weather.push(item.weather[0]);
        dailyData[date].humidity.push(item.main.humidity);
        dailyData[date].wind.push(item.wind);
        dailyData[date].pop.push(item.pop);
    });

    const forecastDays = Object.keys(dailyData).map(date => {
        const dayData = dailyData[date];
        const avgHumidity = dayData.humidity.reduce((a, b) => a + b, 0) / dayData.humidity.length;
        const avgWind = {
            speed: dayData.wind.reduce((a, b) => a + b.speed, 0) / dayData.wind.length,
            deg: dayData.wind.reduce((a, b) => a + b.deg, 0) / dayData.wind.length,
        };
        const maxPop = Math.max(...dayData.pop);
        const noonWeather = dayData.weather[Math.floor(dayData.weather.length / 2)] || dayData.weather[0];
        const googleWeatherType = mapOpenWeatherTypeToGoogleType(noonWeather.main);

        return {
            maxTemperature: { degrees: Math.max(...dayData.maxTemps) },
            minTemperature: { degrees: Math.min(...dayData.minTemps) },
            daytimeForecast: {
                weatherCondition: { description: { text: noonWeather.description }, type: googleWeatherType, iconBaseUri: `http://openweathermap.org/img/wn/${noonWeather.icon}.png` },
                relativeHumidity: avgHumidity,
                precipitation: { probability: { percent: maxPop * 100 } },
                wind: { speed: { value: avgWind.speed * 3.6 }, direction: { degrees: avgWind.deg } }
            },
            nighttimeForecast: { // No separate nighttime data, so duplicate
                weatherCondition: { description: { text: noonWeather.description }, type: googleWeatherType, iconBaseUri: `http://openweathermap.org/img/wn/${noonWeather.icon}.png` },
                relativeHumidity: avgHumidity,
                precipitation: { probability: { percent: maxPop * 100 } },
                wind: { speed: { value: avgWind.speed * 3.6 }, direction: { degrees: avgWind.deg } }
            },
            interval: { startTime: new Date(date).toISOString() }
        };
    });

    return forecastDays;
}


// --- Main Fetch Function with Fallback ---

async function fetchAllDailyForecast({ lat, lon, days = 5, units = 'METRIC' }) {
  let all = [];
  try {
    console.log(`[Weather] Attempting to fetch from Google Weather API for lat=${lat}, lon=${lon}`);
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

    if (all.length > 0) {
      console.log(`[Weather] Google Weather API successful, found ${all.length} days.`);
      return all;
    }
    console.log(`[Weather] Google Weather API returned no data.`);
  } catch (error) {
    console.warn(`[Weather] Google Weather API failed for lat=${lat}, lon=${lon}. Error: ${error.message}`);
  }

  // Fallback to OpenWeatherMap
  console.log(`[Weather] Falling back to OpenWeatherMap for lat=${lat}, lon=${lon}`);
  try {
    const openWeatherResponse = await fetchWeatherFromOpenWeatherMap({ lat, lon });
    const mappedForecast = mapOpenWeatherResponseToGoogleFormat(openWeatherResponse);
    console.log(`[Weather] OpenWeatherMap fallback successful, found ${mappedForecast.length} days.`);
    return mappedForecast;
  } catch (fallbackError) {
    console.error(`[Weather] OpenWeatherMap fallback also failed. Error: ${fallbackError.message}`);
    return []; // Return empty array if both fail
  }
}

// --- Geocoding Functions ---

const GEOCODE_CACHE_TTL_MS = 24 * 60 * 60 * 1000 * 30; // 30일

async function getGeocodeCache(geoKey) {
  const db = getFirestore("peekandfree");
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
  const db = getFirestore("peekandfree");
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
        catch { reject(new Error('Geocoding JSON parsing failed')); }
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Geocoding request timed out')); });
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

// --- Data Mapping Function ---

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
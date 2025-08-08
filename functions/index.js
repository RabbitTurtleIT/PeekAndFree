/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest, onCall } = require("firebase-functions/v2/https");

const https = require('https');
const querystring = require('querystring');
const agent = new https.Agent({keepAlive: true});
require("dotenv").config();

const logger = require("firebase-functions/logger");

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const app = initializeApp();

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

exports.getGoogleMapAPIKey = onCall({cors: ["https://peekandfree.web.app"]}, (context) => {
  return process.env.GOOGLEMAP_API_KEY
});

exports.getInformationOfCountry = onCall({cors: ["https://peekandfree.web.app"]}, async (request) => { 
  const apiData = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'apis.data.go.kr',
      port: 443,
      path: `/1262000/CountrySafetyService6/getCountrySafetyList6?serviceKey=${process.env.COUNTRYINFO_APIKEY}&numOfRows=5&pageNo`,
      method: 'GET',
      agent: agent
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log("API 결과 : ")
          console.log(result) 
          resolve(result);
        } catch (error) {
          reject(new Error('JSON 파싱 실패'));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error("요청 에러:", error);
      reject(error);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
        reject(new Error('요청 타임아웃'));
    });
    
    req.end();
  })

  return apiData;

})
/////////////////////////////////////////////// 아래부터 수정

// === Daily Forecast (Google Maps Weather API) ===

// 요청 URL 빌더
function buildDailyForecastPath({ lat, lon, days = 5, pageSize = 5, pageToken = "", units = "METRIC" }) {
  const params = new URLSearchParams({
    key: process.env.GOOGLEMAP_API_KEY,          // 필수
    "location.latitude": String(lat),
    "location.longitude": String(lon),
    days: String(days),                           // 최대 10
    pageSize: String(pageSize),                   // 기본 5
    units_system: units                           // METRIC | IMPERIAL
  });
  if (pageToken) params.set("pageToken", pageToken);
  // Google Weather Daily Forecast
  return `/v1/forecast/days:lookup?${params.toString()}`;
}

// 한 페이지 호출
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
        // 상태/본문 로그
        console.log('[WeatherAPI] status =', res.statusCode);
        console.log('[WeatherAPI] body =', data);

        try {
          const json = JSON.parse(data);
          // Google 에러 포맷 처리
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

// 전체 페이지 수집
async function fetchAllDailyForecast({ lat, lon, days = 5, units = 'METRIC' }) {
  let all = [];
  let remaining = Math.min(Math.max(Number(days) || 5, 1), 10); // 1~10
  let pageToken = '';

  do {
    const pageSize = Math.min(remaining, 5); // 기본 5개씩
    const page = await fetchDailyForecastPage({ lat, lon, days, pageSize, pageToken, units });
    const items = Array.isArray(page.forecastDays) ? page.forecastDays : [];
    all = all.concat(items);
    remaining -= items.length;
    pageToken = page.nextPageToken || '';
    // API 보호를 위해 살짝 텀
    if (pageToken) await delay(200);
  } while (pageToken && remaining > 0);

  return all;
}

// 좌표 정규화: 소수점 2자리(필요하면 3~4로 조절)
const DEC = 3; // 좌표 고정 소수점 자릿수(필요시 2~4로 조정)
function normCoord(n, precision = 2) {
  return Number(Number(n).toFixed(precision));
}

function makeGeoKey(lon, lat) {
  const lonKey = normCoord(lon);
  const latKey = normCoord(lat);
  return { lonKey, latKey, geoKey: `${lonKey}_${latKey}` };
}

// 기존 mapDayToDoc을 교체/업데이트
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
      latKey, lonKey,          // 쿼리 최적화용
      geoKey,                  // "경도_위도"
      countryCode: country?.countryCode || null
    },
  };
}

// 클라이언트 <- 서버(DB) : 조회
exports.getDailyForecast = onCall({
  cors: ["https://peekandfree.web.app", "http://localhost:5002"]
}, async (data, context) => {
  const payload = data?.data || data || {};
  const { lat, lon, fromDate, toDate, limit = 10 } = payload;

  if (typeof lat !== 'number' || typeof lon !== 'number') {
    throw new Error('lat, lon 숫자값을 전달하세요.');
  }

  const { geoKey } = makeGeoKey(lon, lat); // 경도, 위도 순으로 주의!

  const db = getFirestore(app, 'peekandfree');
  let q = db.collection('weatherForecastDaily')
            .where('location.geoKey', '==', geoKey);

  if (fromDate) q = q.where('date', '>=', fromDate);
  if (toDate)   q = q.where('date', '<=', toDate);

  q = q.orderBy('date').limit(limit);

  const snap = await q.get();
  // 복합 인덱스가 필요할 수 있음(콘솔에 링크 뜨면 한 번 생성)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
});

// 서버(DB) <- Google Weather API : 저장
exports.loadDailyForecast = onCall({
  cors: ["https://peekandfree.web.app"]
}, async (data, context) => {
  const payload = data?.data || data || {};
  const { lat = 37.4220, lon = -122.0841, days = 10, units = 'METRIC' } = payload;

  if (!process.env.GOOGLEMAP_API_KEY) {
    throw new Error('GOOGLEMAP_API_KEY 가 설정되지 않았습니다.');
  }

  // 1) 외부 API 호출 (페이지네이션 포함)
  const forecastDays = await fetchAllDailyForecast({ lat, lon, days, units });
  if (!forecastDays.length) {
    throw new Error('Weather API에서 예보를 받지 못했습니다.');
  }

  // 2) (선택) 역지오코딩 - 실패해도 진행
  let country = null;
  try {
    country = await reverseGeocodeCountry(lat, lon, 'ko'); // 옵션
  } catch (e) {
    console.log('reverseGeocodeCountry 실패:', e.message);
  }

  // 3) 문서 변환 (경도_위도_날짜 ID)
  const docs = forecastDays.map((day, idx) => mapDayToDoc(day, idx, lat, lon, units, country));

  // 4) Firestore 저장
  const db = getFirestore(app, 'peekandfree');
  const batch = db.batch();
  const col = db.collection('weatherForecastDaily');

  docs.forEach(doc => batch.set(col.doc(doc.id), doc, { merge: true }));
  await batch.commit();

  return { success: true, count: docs.length, ids: docs.map(d => d.id) };
});

// === helpers: reverse geocoding (lat/lon -> country) ===
function sanitizeId(s) {
  // 한글/영문/숫자/밑줄/하이픈만 남김
  return String(s || '')
    .trim()
    .replace(/\s+/g, '-')                // 공백 -> 하이픈
    .replace(/[^\w\-가-힣]/g, '');       // 안전 문자만 유지
}

async function reverseGeocodeCountry(lat, lon, lang = 'ko') {
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

  // 결과에서 country 컴포넌트만 추출
  for (const r of (json.results || [])) {
    const comp = (r.address_components || []).find(c => (c.types || []).includes('country'));
    if (comp) {
      return {
        countryName: comp.long_name,                     // 예: 대한민국
        countryCode: comp.short_name                     // 예: KR
      };
    }
  }
  return { countryName: null, countryCode: null };
}


// 클라이언트 <- 서버(데이터베이스) 
exports.getWeather = onCall({
  cors: ["https://peekandfree.web.app", "http://localhost:5002"]
}, async (data, context) => {
  const db = getFirestore(app, 'peekandfree')
  
  const snapshot = await db.collection('weather').get();

  const weathers = [];
    snapshot.forEach(doc => {
      weathers.push({
        id: doc.id,
        ...doc.data() // 스프레드 연산자.
        // id: doc.data().id // 마지막에 온 프로퍼티가 반영됨.
        // value: doc.data().value 
      });
  });

  return weathers;

})

// 서버(데이터베이스) <- API
exports.loadWeather = onCall({
  cors: ["https://peekandfree.web.app"]
}, async (data, context) => {

  const apiData = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'apis.data.go.kr',  
      port: 443,
      path: '/B551177/StatusOfPassengerWorldWeatherInfo/getPassengerArrivalsWorldWeather' +
            '?serviceKey=' + process.env.WEATHER_APIKEY +
            '&numOfRows=10000&pageNo=1&lang=K&type=json',
      method: 'GET',
      agent: agent
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          console.log("API 결과 : ")
          console.log(result) 
          resolve(result);
        } catch (error) {
          reject(new Error('JSON 파싱 실패'));
        }
      });
    });
    req.on('error', (error) => {
      reject(error);
    });
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('요청 타임아웃'));
    });
    req.end();

  }); 

    console.log(JSON.stringify(apiData, null, 2));

 let filtered = [];
try {
  const items = apiData.response.body.items;
  if (Array.isArray(items)) {
    filtered = items.map(item => ({
      airport: item.airport,
      himidity: item.himidity,
      temp: item.temp,
      wind: item.wind
    }));
  } else if (typeof items === 'object' && items !== null) {
    filtered = [{
      airport: items.airport,
      himidity: items.himidity,
      temp: items.temp,
      wind: items.wind
    }];
  }

  } catch (e) {
    filtered = [];
    console.log("에러" + e) 
  }

const db = getFirestore(app, 'peekandfree');
const chunkSize = 500;

for (let i = 0; i < filtered.length; i += chunkSize) {
  const batch = db.batch();
  const chunk = filtered.slice(i, i + chunkSize);

  chunk.forEach(item => {
    const safeId = item.airport.replace(/\//g, '-');
    const docRef = db.collection('weather').doc(safeId);
    batch.set(docRef, item);
  });

  await batch.commit();
}


  return {
    success: true,
    count: filtered.length,
    data: filtered
  };

});



exports.fetchFlightNearby = onCall({cors: ["https://peekandfree.web.app"]}, async (data, request) => { 
  const { startDate, endDate, maxBudget } = data.data;
  let accessKey = await requestTestAccessKey()
  accessKey = accessKey.access_token
  let result = []
  await delay(300); // 0.3초 대기
  console.log("일본 불러오기")
  let tokyo = await requestFlightOffer(accessKey, 'ICN', 'NRT', startDate, endDate, maxBudget)
  result.push(tokyo)
  await delay(300); 
  let yokohama = await requestFlightOffer(accessKey, 'ICN', 'HND', startDate, endDate, maxBudget)
  result.push(yokohama)
  await delay(300);
  let nagoya = await requestFlightOffer(accessKey, 'ICN', 'NGO', startDate, endDate, maxBudget)
  result.push(nagoya)
  await delay(300); 
  let shanghai = await requestFlightOffer(accessKey, 'ICN', 'SHA', startDate, endDate, maxBudget)
  result.push(shanghai)
  await delay(300); 
  let hongkong = await requestFlightOffer(accessKey, 'ICN', 'HKG', startDate, endDate, maxBudget)
  result.push(hongkong)
  return result

})

exports.fetchFlight = onCall({cors: ["https://peekandfree.web.app"]}, async (data, request) => { 
  const { startDate, endDate, maxBudget, iata } = data.data;
  let accessKey = await requestTestAccessKey()
  accessKey = accessKey.access_token
  return await requestFlightOffer(accessKey, 'ICN', iata, startDate, endDate, maxBudget)

})

async function requestFlightOffer(accessKey, startAirport, destAirport, startDate, endDate, maxBudget) {
  console.log(startDate, endDate, maxBudget)
  const apiData = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'test.api.amadeus.com',
      port: 443,
      path: `/v2/shopping/flight-offers?originLocationCode=${startAirport}&destinationLocationCode=${destAirport}&departureDate=${startDate}&returnDate=${endDate}&adults=1&nonStop=true&currencyCode=KRW&maxPrice=${Number(maxBudget)}&max=1`,
      method: 'GET',
      headers: { 
        'Authorization': `Bearer ${accessKey}`
      },
      agent: agent
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error('JSON 파싱 실패'));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error("요청 에러:", error);
      reject(error);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
        reject(new Error('요청 타임아웃'));
    });
    
    req.end();
  })
  console.log(apiData)
  return apiData
  // return {
  //   "price": apiData.data[0].price.total,
  //   "time": apiData.data[0].itineraries[0].duration 
  // };
}

async function requestTestAccessKey() {
  const postData = querystring.stringify({
    'grant_type': 'client_credentials',
    'client_id': process.env.AMADEUS_KEY,
    'client_secret': process.env.AMADEUS_SECRET
  });

  const apiData = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'test.api.amadeus.com',
      port: 443,
      path: `/v1/security/oauth2/token`,
      method: 'POST',
      headers: { 
        'Content-Type': `application/x-www-form-urlencoded`,
        'Content-Length': Buffer.byteLength(postData)
      },
      agent: agent
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error('JSON 파싱 실패'));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error("요청 에러:", error);
      reject(error);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
        reject(new Error('요청 타임아웃'));
    });
    
    req.write(postData);
    req.end();
  })
  console.log("ACCESS")
  console.log(apiData);
  return apiData
}

// 클라이언트 <- 서버(데이터베이스)
exports.getExchangeRate = onCall({
  cors: ["https://peekandfree.web.app"]
}, async (data, context) => {
  const db = getFirestore(app, 'peekandfree');
  const snapshot = await db.collection('exchangerate').get();

  const exchangeRates = [];
    snapshot.forEach(doc => {
      exchangeRates.push({
        id: doc.id,
        ...doc.data() // 스프레드 연산자.
        // id: doc.data().id // 마지막에 온 프로퍼티가 반영됨.
        // value: doc.data().value 
      });
  });

  return exchangeRates;

})

// 서버(데이터베이스) <- API
exports.loadExchangeRate = onCall({
  cors: ["https://peekandfree.web.app"]
}, async (data, context) => {
  
  const apiData = await new Promise((resolve, reject) => {
    const today = new Date(); 
    const year = today.getFullYear(); 
    const month = (today.getMonth() + 1).toString().padStart(2, '0'); 
    const day = today.getDate().toString().padStart(2, '0');
    const yyyymmdd = `${year}${month}${day}`;

    const options = {
      hostname: 'ecos.bok.or.kr',
      port: 443,
      path: `/api/StatisticSearch/${process.env.KOREABANK_APIKEY}/json/kr/1/53/731Y001/D/${yyyymmdd}/${yyyymmdd}`,
      method: 'GET',
      agent: agent
    };

    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error('JSON 파싱 실패'));
        }
      });
    });
    
    req.on('error', (error) => {
      console.error("요청 에러:", error);
      reject(error);
    });
    
    req.setTimeout(30000, () => {
      req.destroy();
        reject(new Error('요청 타임아웃'));
    });
    
    req.end();


  });
  
  const db = getFirestore(app, 'peekandfree');
  const batch = db.batch();

    for(const item of apiData.StatisticSearch.row) {
        const docRef = db.collection("exchangerate").doc(item.ITEM_NAME1.split("/")[1].split('(')[0]);
        batch.set(docRef, {id:item.ITEM_NAME1, value: item.DATA_VALUE})
    }
    await batch.commit()

    return {
      success: true,
      data: apiData
    }
});
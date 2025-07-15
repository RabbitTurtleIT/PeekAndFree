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
const sendRequest = require("request-promise-native"); // deprecated

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const app = initializeApp();

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});

require("dotenv").config();
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
  await delay(500); // 0.5초 대기
  console.log("일본 불러오기")
  let tokyo = await requestFlightOffer(accessKey, 'ICN', 'NRT', startDate, endDate, maxBudget)
  await delay(500); // 0.5초 대기
  let yokohama = await requestFlightOffer(accessKey, 'ICN', 'HND', startDate, endDate, maxBudget)
  await delay(500); // 0.5초 대기
  let nagoya = await requestFlightOffer(accessKey, 'ICN', 'NGO', startDate, endDate, maxBudget)
  await delay(500); 
  let shanghai = await requestFlightOffer(accessKey, 'ICN', 'SHA', startDate, endDate, maxBudget)
  await delay(500); 
  let hongkong = await requestFlightOffer(accessKey, 'ICN', 'HKG', startDate, endDate, maxBudget)
  await delay(500); 

  return {
    tokyo: tokyo, 
    yokohama: yokohama, 
    nagoya: nagoya, 
    shanghai: shanghai, 
    hongkong: hongkong
  }

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
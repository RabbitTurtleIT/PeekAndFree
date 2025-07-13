/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onRequest, onCall } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const sendRequest = require("request-promise-native"); // deprecated


const https = require('https');
const agent = new https.Agent({keepAlive: true});
require("dotenv").config();

const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const app = initializeApp();



// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});


exports.getInformationOfCountry = onCall({cors: ["https://peekandfree.web.app", "http://localhost:5002"]}, (request) => {
  
  // open api 쓸때
  const options = {
    uri: "https://apis.data.go.kr/1262000/CountrySafetyService6/getCountrySafetyList6",
    qs: {
      serviceKey: process.env.COUNTRYINFO_APIKEY, // API키는 깃허브에서도 추가해주세요(노션 참고)
      numOfRows: 8, // 메인페이지의 몇개의 공지사항을 올릴지 개수
      pageNo: 1 // 항상 최신 데이터
    },
    json: true, // json으로 받겠다
  }

  const result = sendRequest(options); //send request 
  return result; // json으로 받아옴

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


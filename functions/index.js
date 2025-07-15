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
const sendRequest = require("request-promise-native");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
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



exports.openpage = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("열렸당 ~~");
});



exports.openpagetoo = onCall({cors: ["https://peekandfree.web.app"]}, (request) => {
  
return "또 열렸당 ~~"

})

exports.heejinTest = onCall({cors: ["https://peekandfree.web.app"]}, (request) => {
  return "오빠 알려줘서 고마워~~";
})
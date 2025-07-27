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

const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

let ROOTaccessKey = undefined
let ROOTaccessKeyExpiry = null

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// exports.helloWorld = onRequest((request, response) => {
//   logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });


exports.getGoogleMapAPIKey = onCall({cors: ["https://peekandfree.web.app", "https://peakandfree.com"]}, (context) => {
  return process.env.GOOGLEMAP_API_KEY
});

exports.getInformationOfCountry = onCall({cors: ["https://peakandfree.com", "https://peekandfree.web.app"]}, async (request) => { 

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
// /////////////////////////////////////////////// 아래부터 수정


// // 클라이언트 <- 서버(데이터베이스) 
exports.getWeather = onCall({
  cors: ["https://peekandfree.web.app", "http://localhost:5002", "https://peakandfree.com"]
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

// // 서버(데이터베이스) <- API
exports.loadWeather = onCall({

  cors: ["https://peekandfree.web.app", "https://peakandfree.com"]

  ,cors: ["https://peakandfree.com", "https://peekandfree.web.app"]

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


// 취항 정보
exports.getServiceDestinationInfo = onCall({cors: ["https://peakandfree.com", "https://peekandfree.web.app"]}, async (data, request) => {
  const apiData = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'apis.data.go.kr',
      port: 443,
      path: `/B551177/StatusOfSrvDestinations/getServiceDestinationInfo?serviceKey=${process.env.COUNTRYINFO_APIKEY}&type=json`,
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
  })

  console.log(apiData)
  result = []
  for(let item of apiData.response.body.items) {
    result.push(item.airportCode)
  }

  return result
}) 


// // exports.fetchFlightNearby = onCall({cors: ["https://peekandfree.web.app"]}, async (data, request) => { 
// //   const { startDate, endDate, maxBudget } = data.data;
// //   let accessKey = await requestTestAccessKey()
// //   accessKey = accessKey.access_token
// //   let result = []
// //   await delay(300); // 0.3초 대기
// //   console.log("일본 불러오기")
// //   let tokyo = await requestFlightOffer(accessKey, 'ICN', 'NRT', startDate, endDate, maxBudget)
// //   result.push(tokyo)
// //   await delay(300); 
// //   let yokohama = await requestFlightOffer(accessKey, 'ICN', 'HND', startDate, endDate, maxBudget)
// //   result.push(yokohama)
// //   await delay(300);
// //   let nagoya = await requestFlightOffer(accessKey, 'ICN', 'NGO', startDate, endDate, maxBudget)
// //   result.push(nagoya)
// //   await delay(300); 
// //   let shanghai = await requestFlightOffer(accessKey, 'ICN', 'SHA', startDate, endDate, maxBudget)
// //   result.push(shanghai)
// //   await delay(300); 
// //   let hongkong = await requestFlightOffer(accessKey, 'ICN', 'HKG', startDate, endDate, maxBudget)
// //   result.push(hongkong)
// //   return result

// // })


exports.fetchFlightForCalendar = onCall({cors: ["https://peakandfree.com", "https://peekandfree.web.app"]}, async (data, request) => { 

  const { startDate, endDate, iata } = data.data;
  
  // 날짜 범위 제한: 다음달 마지막날 초과 방지
  const today = new Date();
  const nextMonthEnd = new Date(today.getFullYear(), today.getMonth() + 2, 0);
  const startRequestDate = new Date(startDate);
  const endRequestDate = new Date(endDate);
  
  // 시작일과 종료일 모두 검증
  if (startRequestDate > nextMonthEnd || endRequestDate > nextMonthEnd) {
    console.log(`날짜 범위 초과 차단: ${startDate} ~ ${endDate}, 최대 허용: ${nextMonthEnd.toISOString().split('T')[0]}`);
    return { 
      error: '조회 가능한 날짜 범위를 초과했습니다.',
      data: null 
    };
  }
  
  // 과거 날짜도 차단
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (startRequestDate < yesterday || endRequestDate < yesterday) {
    console.log(`과거 날짜 차단: ${startDate} ~ ${endDate}`);
    return { 
      error: '과거 날짜는 조회할 수 없습니다.',
      data: null 
    };
  }
  
  // Firestore에서 캐시된 데이터 확인
  const db = getFirestore(app, 'peekandfree');
  const flightRef = db.collection('ICN').doc(iata);
  
  try {
    const flightDoc = await flightRef.get();
    
    if (flightDoc.exists) {
      const flightData = flightDoc.data();
      console.log(startDate + " <-> " + endDate)
      const outboundKey = `outbound_${startDate}`;
      const returnKey = `return_${endDate}`;
      
      // 가는편과 오는편 둘 다 캐시에 있는지 확인
      if (flightData[outboundKey] && flightData[returnKey]) {
        const outboundPrice = flightData[outboundKey];
        const returnPrice = flightData[returnKey] || 0;
        const totalPrice = outboundPrice + returnPrice;
        
        console.log(`Firestore에서 캐시된 데이터 반환: ${startDate} - ${totalPrice}`);
        return {
          data: {
            data: [{
              price: {
                total: totalPrice
              }
            }]
          }
        };
      }
    }
    
    // 캐시에 없으면 API 호출
    console.log(`API 호출: ${startDate}`);
    let accessKey = await requestTestAccessKey();
    accessKey = accessKey.access_token;
    const apiResult = await requestFlightOffer(accessKey, 'ICN', iata, endDate, endDate); // 각각 날짜에 대한 편도 가격을 알아야함
    
    // API 결과를 Firestore에 저장 (왕복 정보 분리 저장)
    if (apiResult.data && apiResult.data.length > 0) {
      const flightOffer = apiResult.data[0];
      const totalPrice = flightOffer.price.total;
      const itineraries = flightOffer.itineraries;
      
      const updateData = {};
      
      if (itineraries && itineraries.length > 0) {
        if (itineraries.length === 1) {
          // 편도인 경우
          updateData[`outbound_${endDate}`] = totalPrice;
        } else if (itineraries.length === 2) {
          // 왕복인 경우 - 첫 번째는 가는편, 두 번째는 오는편
          const outboundPrice = Math.round(totalPrice / 2);
          const returnPrice = totalPrice - outboundPrice;
          
          updateData[`outbound_${endDate}`] = outboundPrice;
          updateData[`return_${endDate}`] = returnPrice;
        }
        
        await flightRef.set(updateData, { merge: true });
        console.log(`Firestore에 저장:`, updateData);
      } else {
        console.log('itineraries 데이터 없음');
      }
    }
    
    // 프론트엔드와 일관된 형태로 반환 (Firestore 구조와 동일하게)
    return {
      data: {
        data: apiResult.data || []
      }
    };
    
  } catch (error) {
    console.error('Firestore 처리 오류:', error);
    // Firestore 오류 시 API 직접 호출
    let accessKey = await requestTestAccessKey();
    accessKey = accessKey.access_token;
    const fallbackResult = await requestFlightOffer(accessKey, 'ICN', iata, startDate, endDate);
    
    // 프론트엔드와 일관된 형태로 반환 (Firestore 구조와 동일하게)
    return {
      data: {
        data: fallbackResult.data || []
      }
    };
  }
})

exports.fetchFlight = onCall({cors: ["https://peakandfree.com", "https://peekandfree.web.app"]}, async (data, request) => { 

  const { iata, startDate, endDate } = data.data;
  let accessKey = await requestTestAccessKey()
  accessKey = accessKey.access_token
  
  return await requestFlightOffer(accessKey, 'ICN', iata, startDate, endDate);
})

async function requestFlightOffer(accessKey, startAirport, destAirport, startDate, endDate) {
  console.log(startDate, endDate)
  const apiData = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'test.api.amadeus.com',
      port: 443,
      path: `/v2/shopping/flight-offers?originLocationCode=${startAirport}&destinationLocationCode=${destAirport}&departureDate=${startDate}&returnDate=${endDate}&adults=1&nonStop=true&currencyCode=KRW&max=1`,
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
  // 현재 시간 확인
  const now = Date.now();
  
  // 토큰이 있고 만료되지 않았으면 기존 토큰 반환
  if(ROOTaccessKey != undefined && ROOTaccessKeyExpiry && now < ROOTaccessKeyExpiry) {
    console.log("기존 토큰 사용 중, 만료까지 남은 시간:", Math.floor((ROOTaccessKeyExpiry - now) / 1000), "초");
    return { 'access_token' : ROOTaccessKey }
  }

  console.log("새로운 토큰 요청 중...");
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
  
  console.log("TEST_ACCESS")
  console.log(apiData);
  
  // 토큰 및 만료 시간 저장 (expires_in은 초 단위, 안전을 위해 30초 일찍 만료 처리)
  ROOTaccessKey = apiData.access_token;
  const expiresInSeconds = apiData.expires_in || 1799; // 기본값 1799초
  ROOTaccessKeyExpiry = Date.now() + (expiresInSeconds - 30) * 1000; // 30초 일찍 만료
  
  console.log(`토큰 만료 시간 설정: ${expiresInSeconds}초 후 (안전 마진 30초 적용)`);
  
  return apiData
}


async function requestRealAccessKey() {
  const postData = querystring.stringify({
    'grant_type': 'client_credentials',
    'client_id': process.env.AMADEUS_REAL_KEY,
    'client_secret': process.env.AMADEUS_REAL_SECRET
  });

  const apiData = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.amadeus.com',  
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
  console.log("Real_ACCESS")
  console.log(apiData);
  return apiData
}

async function requestFlightCheapestDates(accessKey, startAirport, destAirport, departureDate, returnDate) {
  console.log(startAirport, destAirport, departureDate, )
  const apiData = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'test.api.amadeus.com',
      port: 443,
      path: `/v1/shopping/flight-dates?origin=${startAirport}&destination=${destAirport}&departureDate=${departureDate}&oneWay=true`,
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
}

// 클라이언트 <- 서버(데이터베이스)
exports.getExchangeRate = onCall({

  cors: ["https://peakandfree.web.app", "https://peakandfree.com"]

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

  cors: ["https://peekandfree.web.app", "https://peakandfree.com"]

}, async (data, context) => {
  
  const apiData = await new Promise((resolve, reject) => {
    let currentDate = new Date();
    let yyyymmdd;
    let maxRetries = 10;
    let retryCount = 0;

    const tryGetData = async (dateStr) => {
      const options = {
        hostname: 'ecos.bok.or.kr',
        port: 443,
        path: `/api/StatisticSearch/${process.env.KOREABANK_APIKEY}/json/kr/1/53/731Y001/D/${dateStr}/${dateStr}`,
        method: 'GET',
        agent: agent
      };

      return new Promise((resolveInner, rejectInner) => {
        const req = https.request(options, (res) => {
          let data = '';
          
          res.on('data', (chunk) => {
            data += chunk;
          });
          
          res.on('end', () => {
            try {
              const result = JSON.parse(data);
              resolveInner(result);
            } catch (error) {
              rejectInner(new Error('JSON 파싱 실패'));
            }
          });
        });
        
        req.on('error', (error) => {
          console.error("요청 에러:", error);
          rejectInner(error);
        });
        
        req.setTimeout(30000, () => {
          req.destroy();
          rejectInner(new Error('요청 타임아웃'));
        });
        
        req.end();
      });
    };

    const getDateString = (date) => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, '0');
      const day = date.getDate().toString().padStart(2, '0');
      return `${year}${month}${day}`;
    };

    const attemptApiCall = async () => {
      yyyymmdd = getDateString(currentDate);
      console.log(`환율 데이터 조회 시도: ${yyyymmdd}`);
      
      try {
        const result = await tryGetData(yyyymmdd);
        
        if (result.StatisticSearch && result.StatisticSearch.row && result.StatisticSearch.row.length > 0) {
          console.log(`환율 데이터 성공적으로 조회: ${yyyymmdd}`);
          resolve(result);
        } else {
          console.log(`${yyyymmdd}에 대한 환율 데이터 없음, 이전 날로 재시도`);
          retryCount++;
          if (retryCount < maxRetries) {
            currentDate.setDate(currentDate.getDate() - 1);
            attemptApiCall();
          } else {
            reject(new Error('최대 재시도 횟수 초과: 환율 데이터를 찾을 수 없습니다'));
          }
        }
      } catch (error) {
        console.error(`${yyyymmdd} 환율 데이터 조회 실패:`, error);
        retryCount++;
        if (retryCount < maxRetries) {
          currentDate.setDate(currentDate.getDate() - 1);
          attemptApiCall();
        } else {
          reject(error);
        }
      }
    };

    attemptApiCall();
  });
  
  const db = getFirestore(app, 'peekandfree');
  const batch = db.batch();
  console.log(apiData)

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


/// 공항 정보 추가

exports.getAirportInfo = onCall(async (data, context) => {
  const { iata } = data.data;
  if (!iata) {
    return { error: "IATA 코드가 제공되지 않았습니다." };
  }


  const inputIata = iata.trim().toUpperCase();


  const csvPath = path.join(__dirname, 'airport.csv');


  return new Promise((resolve, reject) => {
    let found = null;
    let resolved = false;


    const stream = fs.createReadStream(csvPath);


    stream
      .pipe(csv())
      .on('data', (row) => {
        const iataCode = row["공항코드1(IATA)"].trim().toUpperCase();
        if (!resolved && iataCode === inputIata) {
          found = row;
          resolved = true; 
          stream.destroy();  
          resolve(found);
        }
      })
      .on('end', () => {
        if (!resolved) {
          resolved = true;
          resolve({ error: `IATA 코드 '${inputIata}'에 해당하는 공항 정보를 찾을 수 없습니다.` });
        }
      })
      .on('error', (error) => {
        if (!resolved) {
          resolved = true;
          reject({ error: error.message });
        }
      });
  });
}); 

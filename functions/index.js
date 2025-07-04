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


const functions = require('firebase-functions');
const https = require('https');
const agent = new https.Agent({keepAlive: true});
require("dotenv").config();

const admin = require('firebase-admin');

admin.initializeApp();



// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});


exports.getInformationOfCountry = onCall({cors: ["https://peekandfree.web.app"]}, (request) => {
  
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


// 클라이언트 <- 서버(데이터베이스)
exports.getExchangeRate = onCall({
  cors: ["https://peekandfree.web.app"]
}, async (data, context) => {
  const db = admin.firestore();
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
  
  const db = admin.firestore();
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
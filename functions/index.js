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
const agent = new https.Agent({keepAlive: true});
require("dotenv").config();

const logger = require("firebase-functions/logger");
const sendRequest = require("request-promise-native");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

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
/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest, onCall} = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const sendRequest = require("request-promise-native");

// Create and deploy your first functions
// https://firebase.google.com/docs/functions/get-started

exports.helloWorld = onRequest((request, response) => {
  logger.info("Hello logs!", {structuredData: true});
  response.send("Hello from Firebase!");
});
require("dotenv").config();
exports.getInformationOfCountry = onCall({cors: ["https://peekandfree.web.app"]}, (request) => {
  
  const options = {
    uri: "https://apis.data.go.kr/1262000/CountrySafetyService6/getCountrySafetyList6",
    qs: {
      serviceKey: process.env.COUNTRYINFO_APIKEY,
      numOfRows: 8, // 메인페이지의 몇개의 공지사항을 올릴지
      pageNo: 1 // 항상 최신 데이터
    },
    json: true,
  }

  const result = sendRequest(options);
  return result;

})

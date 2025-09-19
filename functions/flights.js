const https = require('https');
const querystring = require('querystring');
const agent = new https.Agent({keepAlive: true});

let ROOTaccessKey = undefined;
let ROOTaccessKeyExpiry = null;

async function requestTestAccessKey() {
  const now = Date.now();
  if(ROOTaccessKey != undefined && ROOTaccessKeyExpiry && now < ROOTaccessKeyExpiry) {
    console.log("기존 토큰 사용 중, 만료까지 남은 시간:", Math.floor((ROOTaccessKeyExpiry - now) / 1000), "초");
    return { 'access_token' : ROOTaccessKey };
  }

  console.log("새로운 토큰 요청 중...");
  const postData = querystring.stringify({
    'grant_type': 'client_credentials',
    'client_id': process.env.AMADEUS_KEY,
    'client_secret': process.env.AMADEUS_SECRET
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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error('JSON 파싱 실패'));
        }
      });
    });
    req.on('error', (error) => { reject(error); });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('요청 타임아웃')); });
    req.write(postData);
    req.end();
  });
  
  ROOTaccessKey = apiData.access_token;
  const expiresInSeconds = apiData.expires_in || 1799;
  ROOTaccessKeyExpiry = Date.now() + (expiresInSeconds - 30) * 1000;
  
  console.log(`토큰 만료 시간 설정: ${expiresInSeconds}초 후 (안전 마진 30초 적용)`);
  return apiData;
}

async function requestFlightOffer(accessKey, startAirport, destAirport, startDate, endDate) {
  console.log(startDate, endDate);
  const apiData = await new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.amadeus.com',
      port: 443,
      path: `/v2/shopping/flight-offers?originLocationCode=${startAirport}&destinationLocationCode=${destAirport}&departureDate=${startDate}&returnDate=${endDate}&adults=1&nonStop=true&currencyCode=KRW&max=1`,
      method: 'GET',
      headers: { 'Authorization': `Bearer ${accessKey}` },
      agent: agent
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (error) {
          reject(new Error('JSON 파싱 실패'));
        }
      });
    });
    req.on('error', (error) => { console.error("요청 에러:", error); reject(error); });
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('요청 타임아웃')); });
    req.end();
  });
  console.log(apiData);
  return apiData;
}

module.exports = {
    requestTestAccessKey,
    requestFlightOffer
};
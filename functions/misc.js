const https = require('https');
const agent = new https.Agent({keepAlive: true});
const { getFirestore } = require("firebase-admin/firestore");

function getInformationOfCountry() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'apis.data.go.kr',
            port: 443,
            path: `/1262000/CountrySafetyService6/getCountrySafetyList6?serviceKey=${process.env.COUNTRYINFO_APIKEY}&numOfRows=5&pageNo`,
            method: 'GET',
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
        req.end();
    });
}

function getServiceDestinationInfo() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'apis.data.go.kr',
            port: 443,
            path: `/B551177/StatusOfSrvDestinations/getServiceDestinationInfo?serviceKey=${process.env.COUNTRYINFO_APIKEY}&type=json`,
            method: 'GET',
            agent: agent
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    const airportCodes = result.response.body.items.map(item => item.airportCode);
                    resolve(airportCodes);
                } catch (error) {
                    reject(new Error('JSON 파싱 실패'));
                }
            });
        });
        req.on('error', (error) => { reject(error); });
        req.setTimeout(30000, () => { req.destroy(); reject(new Error('요청 타임아웃')); });
        req.end();
    });
}

async function loadWeather() {
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
        req.end();
    });

    let filtered = [];
    try {
        const items = apiData.response.body.items;
        if (Array.isArray(items)) {
            filtered = items.map(item => ({ airport: item.airport, himidity: item.himidity, temp: item.temp, wind: item.wind }));
        } else if (typeof items === 'object' && items !== null) {
            filtered = [{ airport: items.airport, himidity: items.himidity, temp: items.temp, wind: items.wind }];
        }
    } catch (e) {
        filtered = [];
        console.log("에러" + e);
    }

    const db = getFirestore();
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

    return { success: true, count: filtered.length, data: filtered };
}

async function getWeather() {
    const db = getFirestore();
    const snapshot = await db.collection('weather').get();
    const weathers = [];
    snapshot.forEach(doc => {
        weathers.push({ id: doc.id, ...doc.data() });
    });
    return weathers;
}

module.exports = {
    getInformationOfCountry,
    getServiceDestinationInfo,
    loadWeather,
    getWeather
};
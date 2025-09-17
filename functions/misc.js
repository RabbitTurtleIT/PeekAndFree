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
            filtered = items.map(item => {
                let cityName = item.airport;
                if (cityName.includes('-')) {
                    cityName = cityName.split('-')[0];
                }
                return {
                    iata: item.airportCode,
                    city: cityName,
                    himidity: item.himidity,
                    temp: item.temp,
                    wind: item.wind
                };
            });
        } else if (typeof items === 'object' && items !== null) {
            let cityName = items.airport;
            if (cityName.includes('-')) {
                cityName = cityName.split('-')[0];
            }
            filtered = [{
                iata: items.airportCode,
                city: cityName,
                himidity: items.himidity,
                temp: items.temp,
                wind: items.wind
            }];
        }
    } catch (e) {
        filtered = [];
        console.log("에러" + e);
    }

    const db = getFirestore("peekandfree");
    const chunkSize = 500;

    for (let i = 0; i < filtered.length; i += chunkSize) {
        const batch = db.batch();
        const chunk = filtered.slice(i, i + chunkSize);
        chunk.forEach(item => {
            if (item.iata) {
                const docRef = db.collection('weather').doc(item.iata);
                batch.set(docRef, {
                    city: item.city,
                    himidity: item.himidity,
                    temp: item.temp,
                    wind: item.wind
                });
            }
        });
        await batch.commit();
    }

    return { success: true, count: filtered.length, data: filtered };
}

async function getWeather() {
    const db = getFirestore("peekandfree");
    const snapshot = await db.collection('weather').get();
    const weathers = [];
    snapshot.forEach(doc => {
        weathers.push({ id: doc.id, ...doc.data() });
    });
    return weathers;
}

const WEATHER_LOAD_INTERVAL_HOURS = 24;

async function getWeatherAndLoadIfNeeded() {
    const db = getFirestore("peekandfree");
    const metadataRef = db.collection('metadata').doc('weather');
    const metadataDoc = await metadataRef.get();

    let shouldLoad = false;
    if (!metadataDoc.exists) {
        shouldLoad = true;
        console.log('Weather metadata not found. Forcing a refresh.');
    } else {
        const lastLoaded = metadataDoc.data().lastLoaded;
        if (lastLoaded && typeof lastLoaded.toDate === 'function') {
            const lastLoadedDate = lastLoaded.toDate();
            const now = new Date();
            const hoursSinceLastLoad = (now.getTime() - lastLoadedDate.getTime()) / (1000 * 60 * 60);
            if (hoursSinceLastLoad > WEATHER_LOAD_INTERVAL_HOURS) {
                shouldLoad = true;
                console.log(`Weather data is stale (loaded ${hoursSinceLastLoad.toFixed(1)} hours ago). Refreshing.`);
            } else {
                 console.log(`Weather data is fresh (loaded ${hoursSinceLastLoad.toFixed(1)} hours ago). Skipping refresh.`);
            }
        } else {
            shouldLoad = true;
            console.log('lastLoaded field is missing or not a valid timestamp in weather metadata. Forcing a refresh.');
        }
    }

    if (shouldLoad) {
        console.log('Executing loadWeather...');
        try {
            await loadWeather();
            await metadataRef.set({ lastLoaded: new Date() }, { merge: true });
            console.log('loadWeather finished and timestamp updated.');
        } catch (e) {
            console.error('Error during automatic weather load:', e);
        }
    }

    return await getWeather();
}

module.exports = {
    getInformationOfCountry,
    getServiceDestinationInfo,
    loadWeather,
    getWeather,
    getWeatherAndLoadIfNeeded
};
const https = require('https');
const { getFirestore } = require("firebase-admin/firestore");
const { requestTestAccessKey } = require('./flights');

const db = getFirestore("peekandfree");
const CACHE_DURATION_DAYS = 30;

// Firestore에서 호텔 목록을 가져오거나, 캐시가 만료된 경우 API를 통해 새로 가져와 캐시를 업데이트하는 함수
async function getHotels(iata, latitude, longitude) {
    const cacheRef = db.collection('hotelLists').doc(iata);

    try {
        const doc = await cacheRef.get();
        if (doc.exists) {
            const data = doc.data();
            const lastFetched = data.lastFetched.toDate();
            const now = new Date();
            const daysSinceFetched = (now.getTime() - lastFetched.getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceFetched < CACHE_DURATION_DAYS) {
                console.log(`[Hotels] Returning cached data for ${iata}.`);
                return { data: data.hotels }; // API 응답과 동일한 구조로 반환
            }
        }
    } catch (error) {
        console.error("Error reading hotel cache from Firestore:", error);
    }

    console.log(`[Hotels] Fetching new hotel data from Amadeus API for ${iata}.`);
    const hotels = await fetchHotelsFromAPI(latitude, longitude);

    if (hotels && hotels.data) {
        try {
            await cacheRef.set({
                hotels: hotels.data,
                lastFetched: new Date()
            });
        } catch (error) {
            console.error("Error writing hotel cache to Firestore:", error);
        }
    }

    return hotels;
}

// 아마데우스 API를 사용하여 위도/경도 주변의 호텔 목록을 가져오는 함수 (내부용)
async function fetchHotelsFromAPI(latitude, longitude) {
    try {
        const accessToken = await requestTestAccessKey();
        const params = new URLSearchParams({
            latitude: latitude,
            longitude: longitude,
            radius: 20, // 반경 20km
            radiusUnit: 'KM',
            hotelSource: 'ALL',
            ratings: ['3','4','5']
        });

        const options = {
            hostname: 'test.api.amadeus.com',
            port: 443,
            path: `/v1/reference-data/locations/hotels/by-geocode?${params.toString()}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken.access_token}`
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Failed to parse Amadeus hotel list response.'));
                    }
                });
            });
            req.on('error', (error) => {
                reject(error);
            });
            req.end();
        });
    } catch (error) {
        console.error('Error fetching hotels by coordinates:', error);
        throw error;
    }
}

// 아마데우스 API를 사용하여 특정 호텔의 가격 정보를 가져오는 함수
async function getHotelOffers(hotelId, checkInDate, checkOutDate) {
    try {
        const accessToken = await requestTestAccessKey();
        const params = new URLSearchParams({
            hotelIds: hotelId,
            checkInDate: checkInDate,
            checkOutDate: checkOutDate,
            adults: 1,
            currency: 'KRW',
        });

        const options = {
            hostname: 'test.api.amadeus.com',
            port: 443,
            path: `/v3/shopping/hotel-offers?${params.toString()}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken.access_token}`
            }
        };

        return new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => {
                    data += chunk;
                });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(new Error('Failed to parse Amadeus hotel offers response.'));
                    }
                });
            });
            req.on('error', (error) => {
                reject(error);
            });
            req.end();
        });
    } catch (error) {
        console.error('Error fetching hotel offers:', error);
        throw error;
    }
}


module.exports = {
    getHotels,
    getHotelOffers
};

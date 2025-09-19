const https = require('https');
const { getFirestore, FieldPath } = require("firebase-admin/firestore");

const agent = new https.Agent({keepAlive: true});

async function getLatestExchangeRate() {
    const db = getFirestore("peekandfree");
    const exchangeRateRef = db.collection('exchangeRatesByDate');
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const docRef = exchangeRateRef.doc(todayStr);
    const docSnap = await docRef.get();

    // Helper function to fetch previous day's rates
    const fetchPreviousDayRates = async (currentDateStr) => {
        console.log(`[ExchangeRate] fetchPreviousDayRates called for currentDateStr: ${currentDateStr}`);
        try {
            let dateToSearch = new Date(currentDateStr);
            for (let i = 0; i < 10; i++) { // Try up to 10 previous days
                dateToSearch.setDate(dateToSearch.getDate() - 2);
                const prevDayStr = dateToSearch.toISOString().slice(0, 10);
                console.log(`[ExchangeRate] Searching for previous day: ${prevDayStr}`);
                const prevDocSnap = await exchangeRateRef.doc(prevDayStr).get();

                if (prevDocSnap.exists) {
                    console.log(`[ExchangeRate] Found previous day's rates for ${prevDocSnap.id}.`);
                    return prevDocSnap.data().rates;
                }
                console.log(`[ExchangeRate] Document for ${prevDayStr} does not exist.`);
            }
            console.log("[ExchangeRate] No previous day's rates found in DB within 10 days.");
            return null;
        } catch (error) {
            console.error("[ExchangeRate] Error fetching previous day's rates:", error);
            return null;
        }
    };

    if (docSnap.exists) {
        console.log(`[ExchangeRate] Cache hit for ${todayStr}. Returning from DB.`);
        const todayRates = docSnap.data().rates;
        const previousDayRates = await fetchPreviousDayRates(todayStr);
        return { todayRates, previousDayRates };
    }

    console.log(`[ExchangeRate] Cache miss for ${todayStr}. Fetching from API.`);
    
    let apiData = null;
    let actualDateFetched = todayStr; // To store the date for which API data was actually fetched

    try {
        apiData = await new Promise((resolve, reject) => {
            let currentDate = new Date();
            let maxRetries = 10;
            let retryCount = 0;

            const getDateString = (date) => {
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                return `${year}${month}${day}`;
            };

            const tryGetData = (dateStr) => {
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
                        res.on('data', (chunk) => data += chunk);
                        res.on('end', () => {
                            try { resolveInner(JSON.parse(data)); }
                            catch (e) { rejectInner(new Error('JSON 파싱 실패')); }
                        });
                    });
                    req.on('error', rejectInner);
                    req.setTimeout(30000, () => { req.destroy(); rejectInner(new Error('요청 타임아웃')); });
                    req.end();
                });
            };

            const attemptApiCall = async () => {
                const yyyymmdd = getDateString(currentDate);
                console.log(`[ExchangeRate] API call attempt for ${yyyymmdd}`);
                try {
                    const result = await tryGetData(yyyymmdd);
                    if (result.StatisticSearch && result.StatisticSearch.row && result.StatisticSearch.row.length > 0) {
                        console.log(`[ExchangeRate] API call successful for ${yyyymmdd}`);
                        actualDateFetched = currentDate.toISOString().slice(0, 10); // Update the actual date fetched
                        resolve(result);
                    } else {
                        throw new Error('No data found');
                    }
                } catch (error) {
                    console.log(`[ExchangeRate] No data for ${yyyymmdd}, trying previous day.`);
                    retryCount++;
                    if (retryCount < maxRetries) {
                        currentDate.setDate(currentDate.getDate() - 1);
                        attemptApiCall();
                    } else {
                        reject(new Error('최대 재시도 횟수 초과'));
                    }
                }
            };
            attemptApiCall();
        });
    } catch (err) {
        console.error("[ExchangeRate] API fetch failed after retries:", err.message);
        const latestQuery = exchangeRateRef.orderBy(FieldPath.documentId(), 'desc').limit(1);
        const latestSnapshot = await latestQuery.get();
        if (!latestSnapshot.empty) {
            console.log("[ExchangeRate] Falling back to latest data in DB.");
            const fallbackRates = latestSnapshot.docs[0].data().rates;
            const fallbackDateStr = latestSnapshot.docs[0].id;
            const previousDayRates = await fetchPreviousDayRates(fallbackDateStr);
            return { todayRates: fallbackRates, previousDayRates };
        }
        console.log("[ExchangeRate] No data from API and no fallback data in DB.");
        return { todayRates: [], previousDayRates: null };
    }

    if (!apiData || !apiData.StatisticSearch || !apiData.StatisticSearch.row) {
        console.log("[ExchangeRate] No data from API and no fallback data in DB.");
        return { todayRates: [], previousDayRates: null };
    }

    const rates = [];
    apiData.StatisticSearch.row.forEach(item => {
        rates.push({
            id: item.ITEM_NAME1,
            value: item.DATA_VALUE,
            name: item.ITEM_NAME1.split("/")[1].split('(')[0]
        });
    });

    const newDocPayload = {
        updatedAt: new Date().toISOString(),
        rates: rates
    };

    // Store the rates for the actual date fetched, not necessarily todayStr
    await exchangeRateRef.doc(actualDateFetched).set(newDocPayload);
    console.log(`[ExchangeRate] New rates for ${actualDateFetched} stored in DB.`);

    const todayRates = rates;
    const previousDayRates = await fetchPreviousDayRates(actualDateFetched);

    return { todayRates, previousDayRates };
}

module.exports = {
    getLatestExchangeRate
};
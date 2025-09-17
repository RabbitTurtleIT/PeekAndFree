const path = require("path");
const fs = require("fs");
const csv = require("csv-parser");
const { makeGeoKey } = require("./utils");

function getAirportInfo(iata) {
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
}

function getFestivalInfo(country, month) {
    if (!country || !month) {
        return { error: "국가명, 월이 제공되지 않았습니다." };
    }
    const inputCountry = country.trim();
    const inputMonth = month.trim().toUpperCase();
    const csvPath = path.join(__dirname, 'festival.csv');

    return new Promise((resolve, reject) => {
        let results = [];
        const stream = fs.createReadStream(csvPath);

        stream
            .pipe(csv())
            .on('data', (row) => {
                if(!row["국가"] | !row["시기"])
                    return;
                const countryName = row["국가"].trim().toUpperCase();
                const monthName = row["시기"].trim().toUpperCase();
                if (inputCountry.includes(countryName) && monthName.includes(inputMonth)) {
                    results.push(row);
                }
            })
            .on('end', () => {
                if (results.length > 0) {
                    resolve({ festivals: results }); 
                } else {
                    resolve({ error: `국가명 '${inputCountry}'에 해당하는 축제를 찾을 수 없습니다.` });
                }
            })
            .on('error', (error) => {
                reject({ error: error.message });
            });
    });
}

function getCountryInfo(country) {
    const inputCountry = (country ? country.trim() : "").toUpperCase();
    const csvPath = path.join(__dirname, 'country.csv');

    return new Promise((resolve, reject) => {
        let results = [];
        const stream = fs.createReadStream(csvPath);

        stream
            .pipe(csv())
            .on('data', (row) => {
                if(!row["국가명"])
                    return;
                const countryName = row["국가명"].trim().toUpperCase();
                if (inputCountry.includes(countryName)) {
                    results.push(row);
                }
            })
            .on('end', () => {
                if (results.length > 0) {
                    resolve({ country: results }); 
                } else {
                    resolve({ error: `국가명 '${inputCountry}'에 해당하는 정보를 찾을 수 없습니다.` });
                }
            })
            .on('error', (error) => {
                reject({ error: error.message });
            });
    });
}

module.exports = {
    getAirportInfo,
    getFestivalInfo,
    getCountryInfo
};
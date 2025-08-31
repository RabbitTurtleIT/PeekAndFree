let map;
let serviceAirportInIncheon;
let seasonData = {};
let airportGeoJSON;
let isMapReady = false;
let queuedMonthUpdate = null;

$(document).ready(function () {
    console.log('map.js 로딩 시작');
    initializeMap();
    setupSearchbox();
});

function initializeMap() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiY2hsd2hkdG4wMyIsImEiOiJjanM4Y205N3MwMnI2NDRxZG55YnBucWJxIn0.TTN7N6WL69jnephZ7fJAnA';
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/chlwhdtn03/cmags3pq200s601rf85pfep41',
        center: [127, 37.5],
        zoom: 5
    });

    map.on('load', () => {
        console.log('맵 로드 완료, 데이터 및 이미지 로딩 시작');
        Promise.all([
            loadDataSources(),
            loadMapImages()
        ]).then(() => {
            console.log('모든 데이터와 이미지 로딩 완료');
            appendAirportOnMap();
            isMapReady = true; // 맵과 데이터가 준비되었음을 표시
            if (queuedMonthUpdate) {
                console.log(`큐에 저장된 월(${queuedMonthUpdate})로 마커 업데이트 실행`);
                window.updateAirportMarkers(queuedMonthUpdate);
                queuedMonthUpdate = null;
            }
        }).catch(error => {
            console.error("데이터 또는 이미지 로딩 실패:", error);
        });

        map.addSource('route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } } });
        map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#080', 'line-width': 8 } });
        
        setTimeout(replaceWithSeoulButton, 500);
    });
}

function loadMapImages() {
    return Promise.all([
        new Promise((resolve, reject) => {
            map.loadImage('img/hot.png', (error, image) => {
                if (error) return reject(error);
                if (!map.hasImage('hot')) map.addImage('hot', image);
                resolve();
            });
        }),
        new Promise((resolve, reject) => {
            map.loadImage('img/sleep.png', (error, image) => {
                if (error) return reject(error);
                if (!map.hasImage('sleep')) map.addImage('sleep', image);
                resolve();
            });
        })
    ]);
}

function loadDataSources() {
    return new Promise((resolve, reject) => {
        const firebaseReady = setInterval(() => {
            if (typeof firebase !== 'undefined') {
                clearInterval(firebaseReady);
                Promise.all([
                    fetch('popular.csv').then(res => res.text()),
                    fetch('Airport.geojson').then(res => res.json()),
                    firebase.functions().httpsCallable('getServiceDestinationInfo')()
                ]).then(([csvText, geojsonData, firebaseResult]) => {
                    const data = {};
                    const rows = csvText.split('\n').slice(1);
                    rows.forEach(row => {
                        const cols = row.split(',');
                        if (cols.length > 1) {
                            const country = cols[1].replace(/"/g, '');
                            if (country) {
                                const monthlyData = {};
                                for (let i = 2; i < 14; i++) {
                                    monthlyData[i - 1] = (cols[i] || '').replace(/"/g, '').trim();
                                }
                                data[country] = monthlyData;
                            }
                        }
                    });
                    seasonData = data;
                    airportGeoJSON = geojsonData;
                    serviceAirportInIncheon = firebaseResult.data;
                    console.log('모든 소스 데이터 로딩 완료');
                    resolve();
                }).catch(reject);
            }
        }, 100);
    });
}

function appendAirportOnMap() {
    console.log('=== appendAirportOnMap 시작 ===');
    if (!map.isStyleLoaded()) {
        console.warn("맵 스타일이 아직 로드되지 않았습니다.");
        return;
    }

    const currentMonth = new Date().getMonth() + 1;
    updateAirportFeaturesWithSeason(currentMonth);

    if (map.getSource('airport')) {
        map.getSource('airport').setData(airportGeoJSON);
    } else {
        map.addSource('airport', { type: 'geojson', data: airportGeoJSON });
    }

    if (!map.getLayer('airport-point')) {
        map.addLayer({
            id: 'airport-point',
            type: 'symbol',
            source: 'airport',
            filter: ['in', ['get', '공항코드1.IATA.'], ['literal', serviceAirportInIncheon]],
            layout: {
                'icon-image': ['get', 'season_icon'],
                'icon-size': 0.5,
                'icon-allow-overlap': true
            }
        });

        map.on('click', 'airport-point', async (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const airport_kor = e.features[0].properties.한글공항;
            const nation_kor = e.features[0].properties.한글국가명;
            const iata = e.features[0].properties['공항코드1.IATA.'];
            
            $(".calendar-section").show();
            if (typeof clearAllPrices === 'function') clearAllPrices();
            if (typeof setIATA === 'function') {
                setIATA({ korName: nation_kor, airportKor: airport_kor, iata: iata, coord: coordinates });
            }

            map.getSource('route').setData({ 'type': 'Feature', 'properties': {}, 'geometry': { 'type': 'LineString', 'coordinates': [ [126.4406957, 37.4601908], coordinates ] } });
            
            let citydata = await IATAtoCityInformation(iata);
            if (citydata) {
                $("#detailFrame").attr("src", `detailmodal.html?coord1=${citydata.longitude}&coord2=${citydata.Latitude}&Cityname=${citydata.한글도시명}&Nationname=${citydata.한글국가명}`);
            }

            new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(`<p class="text-center"><span style="font-size:16px">${airport_kor}</span><br><a style="width:100%" data-bs-toggle="modal" data-bs-target="#detailModal" class="text-muted btn btn-light d-block">${nation_kor} ${citydata?.한글도시명 || ''}</a></p>`)
                .setMaxWidth("500px")
                .addTo(map);
        });
    }
    console.log('=== 공항 데이터 추가/업데이트 완료 ===');
}

function updateAirportFeaturesWithSeason(month) {
    if (!airportGeoJSON || !seasonData) return;
    airportGeoJSON.features.forEach(feature => {
        const countryName = feature.properties.한글국가명;
        const seasonInfo = seasonData[countryName];
        let icon = 'sleep';
        if (seasonInfo && seasonInfo[month] == '1') {
            icon = 'hot';
        }
        feature.properties.season_icon = icon;
    });
}

window.updateAirportMarkers = function(month) {
    if (!isMapReady) {
        console.log(`맵이 아직 준비되지 않아 월(${month}) 업데이트를 큐에 저장합니다.`);
        queuedMonthUpdate = month;
        return;
    }
    console.log(`마커 업데이트, 월: ${month}`);
    updateAirportFeaturesWithSeason(month);
    map.getSource('airport').setData(airportGeoJSON);
    console.log('공항 소스 데이터 업데이트 완료');
}

window.filterBySeason = function(seasonType) {
    if (!isMapReady || !map.getLayer('airport-point')) {
        console.warn('시즌 필터링 실패: 맵이 준비되지 않음');
        return;
    }
    console.log(`시즌 필터링: ${seasonType}`);

    const baseFilter = ['in', ['get', '공항코드1.IATA.'], ['literal', serviceAirportInIncheon]];
    let seasonFilter;

    if (seasonType === '성수기') {
        seasonFilter = ['==', ['get', 'season_icon'], 'hot'];
    } else if (seasonType === '비성수기') {
        seasonFilter = ['==', ['get', 'season_icon'], 'sleep'];
    }

    if (seasonFilter) {
        map.setFilter('airport-point', ['all', baseFilter, seasonFilter]);
    } else {
        map.setFilter('airport-point', baseFilter);
    }
}

function setupSearchbox() {
    $("#searchbox").on('keyup', (e) => {
        const searchText = e.target.value.toLowerCase().trim();
        if (map && map.getSource('airport')) {
            if (searchText === '') {
                map.setFilter('airport-point', ['in', ['get', '공항코드1.IATA.'], ['literal', serviceAirportInIncheon || []]]);
            } else {
                const filterExpression = [
                    'all',
                    ['in', ['get', '공항코드1.IATA.'], ['literal', serviceAirportInIncheon || []]],
                    [
                        'any',
                        ['in', searchText, ['downcase', ['get', '한글공항']]],
                        ['in', searchText, ['downcase', ['get', '영문공항명']]],
                        ['in', searchText, ['downcase', ['get', '한글국가명']]],
                        ['in', searchText, ['downcase', ['get', '영문도시명']]],
                        ['in', searchText, ['downcase', ['get', '공항코드1.IATA.']]]
                    ]
                ];
                map.setFilter('airport-point', filterExpression);
            }
        }
    });
}

async function IATAtoCityInformation(IATA) {
    try {
        const result = await firebase.functions().httpsCallable('getAirportInfo')({iata: IATA});
        return result.data;
    } catch (error) {
        console.error('도시 정보 조회 실패:', error);
        return null;
    }
}

function addReturnToSeoulButton() {
    const mapContainer = document.getElementById('when-mapdiv');
    if (!mapContainer) return;
    const existingButton = mapContainer.querySelector('.seoul-ctrl');
    if (existingButton) existingButton.remove();
    
    const container = document.createElement('div');
    container.className = 'seoul-ctrl';
    Object.assign(container.style, { position: 'absolute', top: '10px', right: '10px', zIndex: '1000' });

    const btn = document.createElement('button');
    Object.assign(btn.style, { background: 'none', border: 'none', padding: '8px', cursor: 'pointer' });
    btn.innerHTML = `<svg viewBox="0 0 24 24" style="width: 18px; height: 18px;" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l9-7 9 7"></path><path d="M9 22V12h6v10"></path></svg>`;
    btn.onclick = () => map.flyTo({ center: [127, 37.5], zoom: 5, essential: true });
    
    container.appendChild(btn);
    mapContainer.appendChild(container);
}

function replaceWithSeoulButton() {
    const testButton = document.querySelector('[style*="background: red"]');
    if (testButton) testButton.remove();
    addReturnToSeoulButton();
}
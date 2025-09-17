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
        // map.addLayer({ id: 'route', type: 'line', source: 'route', layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#080', 'line-width': 8 } });
        
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
                    firebase.functions().httpsCallable('getServiceDestinationInfo')(),
                    firebase.functions().httpsCallable('getWeather')()
                ]).then(([csvText, geojsonData, firebaseResult, weatherResult]) => {
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
                    window.seasonData = data;

                    const weatherByIATA = {};
                    weatherResult.data.forEach(w => {
                        weatherByIATA[w.id] = w;
                    });

                    geojsonData.features.forEach(feature => {
                        const iata = feature.properties['공항코드1.IATA.'];
                        if (iata && weatherByIATA[iata]) {
                            feature.properties.weather = weatherByIATA[iata];
                            if (!feature.properties.한글도시명 && weatherByIATA[iata].city) {
                                feature.properties.한글도시명 = weatherByIATA[iata].city;
                            }
                        }
                    });

                    airportGeoJSON = geojsonData;
                    serviceAirportInIncheon = firebaseResult.data;
                    console.log('모든 소스 데이터 로딩 완료');
                    resolve();
                }).catch(reject);
            }
        }, 100);
    });
}

function getPreferredAirports() {
    if (!airportGeoJSON || !serviceAirportInIncheon) {
        return { type: 'FeatureCollection', features: [] };
    }
    return {
        ...airportGeoJSON,
        features: airportGeoJSON.features.filter(f => serviceAirportInIncheon.includes(f.properties['공항코드1.IATA.']))
    };
}

function groupAirportsByCountry(geojson) {
    const airportsByCountry = {};
    if (!geojson || !geojson.features) return airportsByCountry;
    geojson.features.forEach(feature => {
        const country = feature.properties.한글국가명;
        if (country) {
            if (!airportsByCountry[country]) {
                airportsByCountry[country] = {
                    type: 'FeatureCollection',
                    features: []
                };
            }
            airportsByCountry[country].features.push(feature);
        }
    });
    return airportsByCountry;
}

function appendAirportOnMap() {
    console.log('=== appendAirportOnMap 시작 ===');
    if (!map.isStyleLoaded()) {
        console.warn("맵 스타일이 아직 로드되지 않았습니다.");
        return;
    }
    
    const currentMonth = new Date().getMonth() + 1;
    updateAirportFeatures(currentMonth);

    const preferredAirports = getPreferredAirports();
    const airportsByCountry = groupAirportsByCountry(preferredAirports);

    for (const country in airportsByCountry) {
        if (country === '대한민국') continue;

        const sourceId = `airport-${country}`;
        const countryData = airportsByCountry[country];

        if (countryData.features.length === 0) continue;

        map.addSource(sourceId, {
            type: 'geojson',
            data: countryData,
            cluster: true,
            clusterMaxZoom: 3,
            clusterRadius: 1000
        });

        const countryName = country;
        const seasonIcon = countryData.features[0].properties.season_icon;
        const clusterLayerId = `clusters-${country}`;

        map.addLayer({
            id: clusterLayerId,
            type: 'symbol',
            source: sourceId,
            filter: ['has', 'point_count'],
            layout: {
                'icon-image': seasonIcon,
                'icon-size': 0.8,
                'icon-allow-overlap': true,
                'text-field': countryName,
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12,
                'text-offset': [0, 2],
                'text-anchor': 'top'
            },
            paint: {
                'text-color': '#000000',
                'text-halo-color': '#FFFFFF',
                'text-halo-width': 1
            }
        });

        const unclusteredLayerId = `unclustered-point-${country}`;
        map.addLayer({
            id: unclusteredLayerId,
            type: 'symbol',
            source: sourceId,
            filter: ['!', ['has', 'point_count']],
            layout: {
                'icon-image': ['get', 'season_icon'],
                'icon-size': 0.5,
                'icon-allow-overlap': true,
                'text-field': [
                    'case',
                    ['has', 'weather_icon'],
                    ['format',
                        ['get', 'weather_icon'], { 'font-scale': 2 },
                        ' ',
                        ['coalesce', ['get', '한글도시명'], ['get', '한글공항']], { 'font-scale': 1.2 }
                    ],
                    ['coalesce', ['get', '한글도시명'], ['get', '한글공항']]
                ],
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 10,
                'text-offset': [0, 0.8],
                'text-anchor': 'top'
            },
            paint: {
                'text-color': '#000000',
                'text-halo-color': '#FFFFFF',
                'text-halo-width': 1
            }
        });

        map.on('click', clusterLayerId, (e) => {
            const features = map.queryRenderedFeatures(e.point, { layers: [clusterLayerId] });
            const clusterId = features[0].properties.cluster_id;
            map.getSource(sourceId).getClusterExpansionZoom(clusterId, (err, zoom) => {
                if (err) return;
                map.easeTo({ center: features[0].geometry.coordinates, zoom: zoom });
            });
        });

        map.on('click', unclusteredLayerId, async (e) => {
            const coordinates = e.features[0].geometry.coordinates.slice();
            const { 한글공항, 한글국가명 } = e.features[0].properties;
            const iata = e.features[0].properties['공항코드1.IATA.'];

            $(".calendar-section").show();
            if (typeof clearAllPrices === 'function') clearAllPrices();
            if (typeof setIATA === 'function') setIATA({ korName: 한글국가명, airportKor: 한글공항, iata: iata, coord: coordinates });

            map.getSource('route').setData({ 'type': 'Feature', 'properties': {}, 'geometry': { 'type': 'LineString', 'coordinates': [[126.4406957, 37.4601908], coordinates] } });
            
            let citydata = await IATAtoCityInformation(iata);
            console.log("map.js: citydata from IATAtoCityInformation:", citydata); // Add this log
            if (citydata) {
                let cityname = citydata.한글도시명;
                if (!cityname && 한글공항) {
                    cityname = 한글공항.split(' ')[0];
                }
                $("#detailFrame").attr("src", `detailmodal.html?coord1=${citydata.longitude}&coord2=${citydata.Latitude}&Cityname=${cityname}&Nationname=${citydata.한글국가명}`);
            }

            let popupCityName = citydata?.한글도시명;
            if (!popupCityName && 한글공항) {
                popupCityName = 한글공항.split(' ')[0];
            }

            new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(`<p class="text-center p-1" style="opacity: 1"><span style="font-size:20px">${한글공항} ${iata}</span><br><a style="width:100%" data-bs-toggle="modal" data-bs-target="#detailModal" class="text-muted btn btn-light d-block">${한글국가명} ${popupCityName || ''}</a></p><style>.mapboxgl-popup-content { position: relative; background: #fff; opacity: 0.9; border-radius: 3px; box-shadow: 0 1px 2px rgba(0,0,0,0.10); pointer-events: auto; }</style>`) 
                .setMaxWidth("500px")
                .addTo(map);
        });

        map.on('mouseenter', clusterLayerId, () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', clusterLayerId, () => { map.getCanvas().style.cursor = ''; });
    }
    console.log('=== 공항 데이터 추가/업데이트 완료 ===');
}

function updateAirportFeatures(month) {
    if (!airportGeoJSON || !seasonData) return;
    airportGeoJSON.features.forEach(feature => {
        const countryName = feature.properties.한글국가명;
        const seasonInfo = seasonData[countryName];
        feature.properties.season_icon = (seasonInfo && seasonInfo[month] == '1') ? 'hot' : 'sleep';

        if (feature.properties.weather && feature.properties.weather.temp) {
            const temp = parseFloat(feature.properties.weather.temp);
            if (temp > 25) {
                feature.properties.weather_icon = '☀️';
            } else if (temp > 10) {
                feature.properties.weather_icon = '☁️';
            } else {
                feature.properties.weather_icon = '❄️';
            }
        } else {
            feature.properties.weather_icon = null;
        }
    });
}

window.updateAirportMarkers = function(month) {
    if (!isMapReady) {
        queuedMonthUpdate = month;
        return;
    }
    console.log(`마커 업데이트, 월: ${month}`);
    updateAirportFeatures(month);
    
    const preferredAirports = getPreferredAirports();
    const airportsByCountry = groupAirportsByCountry(preferredAirports);

    for (const country in airportsByCountry) {
        if (!country) continue;
        const sourceId = `airport-${country}`;
        const countryData = airportsByCountry[country];

        if (map.getSource(sourceId)) {
            map.getSource(sourceId).setData(countryData);
        }

        if (countryData.features.length > 0) {
            const clusterLayerId = `clusters-${country}`;
            if (map.getLayer(clusterLayerId)) {
                const newSeasonIcon = countryData.features[0].properties.season_icon;
                map.setLayoutProperty(clusterLayerId, 'icon-image', newSeasonIcon);
            }
        }
    }
    console.log('공항 소스 데이터 업데이트 완료');
}

window.filterBySeason = function(seasonType) {
    if (!isMapReady) return;
    console.log(`시즌 필터링: ${seasonType}`);

    let seasonFilter;
    if (seasonType === '성수기') seasonFilter = ['==', ['get', 'season_icon'], 'hot'];
    else if (seasonType === '비성수기') seasonFilter = ['==', ['get', 'season_icon'], 'sleep'];

    const preferredAirports = getPreferredAirports();
    const airportsByCountry = groupAirportsByCountry(preferredAirports);

    for (const country in airportsByCountry) {
        if (!country) continue;
        const layerId = `unclustered-point-${country}`;
        if (map.getLayer(layerId)) {
            const unclusteredFilter = ['!', ['has', 'point_count']];
            const newFilter = seasonFilter ? ['all', unclusteredFilter, seasonFilter] : ['all', unclusteredFilter];
            map.setFilter(layerId, newFilter);
        }
    }
}

function setupSearchbox() {
    $("#searchbox").on('keyup', (e) => {
        const searchText = e.target.value.toLowerCase().trim();
        if (!map) return;

        const preferredAirports = getPreferredAirports();
        const airportsByCountry = groupAirportsByCountry(preferredAirports);

        for (const country in airportsByCountry) {
            if (!country) continue;
            const layerId = `unclustered-point-${country}`;
            if (map.getLayer(layerId)) {
                const baseUnclusteredFilter = ['all', ['!', ['has', 'point_count']]];
                
                if (searchText === '') {
                    map.setFilter(layerId, baseUnclusteredFilter);
                } else {
                    const searchFilter = [
                        'any',
                        ['in', searchText, ['downcase', ['get', '한글공항']]],
                        ['in', searchText, ['downcase', ['get', '영문공항명']]],
                        ['in', searchText, ['downcase', ['get', '한글국가명']]],
                        ['in', searchText, ['downcase', ['get', '영문도시명']]],
                        ['in', searchText, ['downcase', ['get', '공항코드1.IATA.']]]
                    ];
                    map.setFilter(layerId, ['all', ...baseUnclusteredFilter, searchFilter]);
                }
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

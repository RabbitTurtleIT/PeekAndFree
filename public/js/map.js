let airports = [];
let map;
let serviceAirportInIncheon = undefined;

$(document).ready(function () {
    console.log('map.js 로딩 시작');
    
    // Firebase 대기 후 초기화
    const waitForFirebase = setInterval(() => {
        if (typeof firebase !== 'undefined') {
            clearInterval(waitForFirebase);
            initializeMap();
            loadFirebaseData();
        }
    }, 100);
});

function loadFirebaseData() {
    console.log('Firebase 데이터 로딩 시작');
    
    firebase.functions().httpsCallable('getServiceDestinationInfo')()
        .then((result) => {
            console.log("인천공항 취항지 정보 로드 완료");
            serviceAirportInIncheon = result.data;
            console.log('취항지 개수:', serviceAirportInIncheon?.length || 0);
            console.log('첫 5개 취항지:', serviceAirportInIncheon?.slice(0, 5));
            
            // 맵이 이미 로드되었다면 공항 추가
            if (map && map.isStyleLoaded()) {
                appendAirportOnMap();
            }
        })
        .catch((error) => {
            console.error("Firebase 데이터 로딩 실패:", error);
        });
}

function initializeMap() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiY2hsd2hkdG4wMyIsImEiOiJjanM4Y205N3MwMnI2NDRxZG55YnBucWJxIn0.TTN7N6WL69jnephZ7fJAnA';
    
    map = new mapboxgl.Map({
        container: 'map',
        style: 'mapbox://styles/chlwhdtn03/cmags3pq200s601rf85pfep41',
        center: [127, 37.5],
        zoom: 3
    });

    // 맵 로드 완료 시
    map.on('load', () => {
        console.log('맵 로드 완료');
        
        // 루트 소스 및 레이어 추가
        map.addSource('route', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': []
                }
            }
        });

        map.addLayer({
            'id': 'route',
            'type': 'line',
            'source': 'route',
            'layout': {
                'line-join': 'round',
                'line-cap': 'round'
            },
            'paint': {
                'line-color': '#080',
                'line-width': 8
            }
        });

        // Firebase 데이터가 이미 로드되었다면 공항 추가
        if (serviceAirportInIncheon && serviceAirportInIncheon.length > 0) {
            console.log('맵 로드 완료, Firebase 데이터 있음 - 공항 추가');
            appendAirportOnMap();
        } else {
            console.log('맵 로드 완료, Firebase 데이터 대기 중');
        }
        
    });
    
    setTimeout(() => {
            replaceWithSeoulButton();
        }, 500);


    console.log('맵 초기화 완료');
}

function addReturnToSeoulButton() {
    // map-container를 찾기
    const mapContainer = document.getElementById('when-mapdiv');
    if (!mapContainer) {
        console.warn('지도 컨테이너를 찾을 수 없습니다');
        return;
    }

    // 기존 버튼이 있다면 제거
    const existingButton = mapContainer.querySelector('.seoul-ctrl');
    if (existingButton) {
        existingButton.remove();
    }
    const container = document.createElement('div');
    container.className = 'seoul-ctrl';
    container.style.position = 'absolute';
    container.style.top = '10px';
    container.style.right = '10px';
    container.style.zIndex = '1000';

    const btn = document.createElement('button');
    btn.className = 'seoul-ctrl-btn';
    btn.type = 'button';
    btn.setAttribute('type', 'button');
    btn.title = '서울로 이동';
    btn.style.background = 'none';
    btn.style.border = 'none';
    btn.style.padding = '8px';
    btn.style.cursor = 'pointer';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width: 18px; height: 18px;">
            <path d="M3 11l9-7 9 7"></path>
            <path d="M9 22V12h6v10"></path>
        </svg>
    `;
    btn.addEventListener('click', (e) => {

        if (map && typeof SEOUL_CENTER !== 'undefined' && typeof SEOUL_ZOOM !== 'undefined') {
            map.flyTo({ center: SEOUL_CENTER, zoom: SEOUL_ZOOM, essential: true });
        } else {
            
            map.flyTo({ center: [127, 37.5], zoom: 5, essential: true });
        }
        
    });

    btn.addEventListener('mouseenter', () => {
        btn.style.background = '#f0f0f0';
    });

    btn.addEventListener('mouseleave', () => {
        btn.style.background = 'none';
    });

    container.appendChild(btn);
    mapContainer.appendChild(container);
    
    console.log('서울 버튼 추가 완료');
    return container;
}

function replaceWithSeoulButton() {
    // 기존 테스트 버튼 제거
    const testButton = document.querySelector('[style*="background: red"]');
    if (testButton) {
        testButton.remove();
    }
    
    // 서울 버튼 추가
    addReturnToSeoulButton();
}



function appendAirportOnMap() {
    console.log('=== appendAirportOnMap 시작 ===');
    
    if (!map || !serviceAirportInIncheon) {
        console.warn('맵 또는 취항지 데이터가 없음');
        return;
    }

    try {
        // 공항 소스 추가
        map.addSource('airport', {
            type: 'geojson',
            data: 'Airport.geojson',
            filter: ['in', ['get', '공항코드1.IATA.'], ['literal', serviceAirportInIncheon || []]]
        });

        // 공항 포인트 레이어 추가
        map.addLayer({
            id: 'airport-point',
            type: 'symbol',
            source: 'airport',
            layout: {
                'text-field': ['get', '공항코드1.IATA.'],
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 15,
                'text-allow-overlap': true,
                'text-ignore-placement': true,
            },
            paint: {
                'text-color': '#ffffff',
                'text-halo-color': '#4dda4a',
                'text-halo-width': 10
            }
        });

        console.log('공항 레이어 추가 완료');

        // 공항 클릭 이벤트 (하나만!)
        map.on('click', 'airport-point', async (e) => {
            console.log('공항 클릭됨:', e.features[0].properties);
            
            const coordinates = e.features[0].geometry.coordinates.slice();
            const airport_kor = e.features[0].properties.한글공항;
            const nation_kor = e.features[0].properties.한글국가명;
            const iata = e.features[0].properties['공항코드1.IATA.'];
            
            // 달력 섹션 표시
            $(".calendar-section").show();
            
            // 가격 정보 초기화
            if (typeof clearAllPrices === 'function') {
                clearAllPrices();
            }
            
            // IATA 설정
            if (typeof setIATA === 'function') {
                setIATA({
                    korName: nation_kor,
                    airportKor: airport_kor,
                    iata: iata,
                    coord: coordinates
                });
            }

            // 루트 라인 업데이트
            map.getSource('route').setData({
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': [
                        [126.4406957, 37.4601908], // ICN
                        [(126.4406957 + coordinates[0]) / 2, (37.4601908 + coordinates[1]) / 2],
                        coordinates
                    ]
                }
            });
            
            // 도시 정보 가져오기
            let citydata = await IATAtoCityInformation(iata);
            console.log('도시 데이터:', citydata);

            if (citydata) {
                $("#detailFrame").attr("src", "detailmodal.html?coord1=" + citydata.longitude + "&coord2=" + citydata.Latitude + "&Cityname=" + citydata.한글도시명 + "&Nationname=" + citydata.한글국가명);
            }

            // 팝업 생성
            new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <p class="text-center">
                        <span style="font-size:16px">${airport_kor}</span><br>
                        <a style="width:100%" data-bs-toggle="modal" data-bs-target="#detailModal" class="text-muted btn btn-light d-block">${nation_kor} ${citydata?.한글도시명 || ''}</a>
                    </p>
                `)
                .setMaxWidth("500px")
                .addTo(map);
        });

        console.log('=== 공항 데이터 추가 완료 ===');

    } catch (error) {
        console.error('공항 데이터 추가 실패:', error);
    }
}

// 검색 기능
$(document).ready(function() {
    $("#searchbox").on('keyup', (e) => {
        const searchText = e.target.value.toLowerCase().trim();
        console.log('검색어:', searchText);

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
});

// IATAtoCityInformation 함수
async function IATAtoCityInformation(IATA) {
    try {
        const result = await firebase.functions().httpsCallable('getAirportInfo')({iata: IATA});
        return result.data;
    } catch (error) {
        console.error('도시 정보 조회 실패:', error);
        return null;
    }
}

// browse 함수
async function browse(iata, nation_kor, coordinates) {
    if (!iata) {
        alert("IATA 코드가 존재하지 않는 공항입니다. 티켓 조회가 불가능합니다.")
        return
    }
    coord = coordinates.split(",")
    const { Place, SearchNearbyRankPreference } = await google.maps.importLibrary("places");
    $("#countryName").text(nation_kor)
    $("#countryDesc").text("국가별 설명")
    console.log(coord[0] + " <- Lat, Lng -> " + coord[1])
    let center = new google.maps.LatLng(coord[1], coord[0]);
    const request = {
        // required parameters
        fields: ["displayName", "photos", "businessStatus", "reviews"],
        locationRestriction: {
            center: center,
            radius: 30000,
        },
        // optional parameters https://developers.google.com/maps/documentation/javascript/place-types?hl=ko&_gl=1*1w1np5t*_up*MQ..*_ga*MTM5MTUxNTEyMy4xNzUyNjUyODcy*_ga_NRWSTWS78N*czE3NTI2NTI4NzIkbzEkZzEkdDE3NTI2NTI4NzgkajU0JGwwJGgw#table-a
        includedPrimaryTypes: ["cultural_landmark","historical_landmark", "beach", "event_venue", "hiking_area"],
        maxResultCount: 10,
        rankPreference: SearchNearbyRankPreference.POPULARITY,
        language: "ko-kr",
        // region: "us",
    };
    //@ts-ignore
    const { places } = await Place.searchNearby(request);
    $('.preferLocation').empty()
    $('.reviewdiv').empty()
    if (places.length) {

        // Loop through and get all the results.
        places.forEach((place) => { 
            const $placeItem = $(`
                <div class="place-item" style="display: flex; align-items: center; padding: 10px; margin: 5px 0; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <img class="img-thumbnail" style="max-height: 200px; max-width: 200px;" src="${place.photos[Math.floor(Math.random() * place.photos.length)].getURI()}"/>
                    <div>
                        <div style="font-weight: bold;">${place.displayName || '장소명 없음'}</div>
                        <div style="font-size: 12px; color: #666;">
                            ${place.businessStatus === 'OPERATIONAL' ? '영업중' :
                    place.businessStatus === 'CLOSED_TEMPORARILY' ? '임시휴업' :
                        place.businessStatus === 'CLOSED_PERMANENTLY' ? '폐업' : '상태불명'}
                        </div>
                    </div>
                </div>
                `);
            $('.preferLocation').append($placeItem);
            console.log(place)
            place.reviews.forEach((review) => {
                const $reviewItem = $(`
                    <div class="review-item" style="padding: 15px; margin: 10px 0; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                        <p class="text-center">${place.displayName}에 대한 리뷰</p>
                        <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <img class="img m-1" style="max-height: 30px; max-width: 30px;" src="${review.authorAttribution.photoURI}"/>
                        
                            <div>
                                <div style="font-weight: bold; font-size: 14px;">${review.authorAttribution.displayName}</div>
                                <div style="font-size: 12px; color: #666;">${review.relativePublishTimeDescription}</div>
                            </div>
                            <div style="margin-left: auto; color: #ffa500;">
                                ${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}
                            </div>
                        </div>
                        <div style="font-size: 14px; line-height: 1.4;">
                            ${review.text}
                        </div>
                    </div>
                `);
                $('.reviewdiv').append($reviewItem);
            })
        })
    } else {
        const $placeItem = $(`
                <p>검색결과가 없어요... <p>
                `);
        $('.preferLocation').append($placeItem);
    }
}

// 중복된 국가명+도시명 조합 제거
function removeDuplicateCities(data) {
    const uniqueData = [];
    const seenCombinations = new Set();
    const duplicateInfo = [];

    data.forEach(airport => {
        // 국가명+도시명 조합을 키로 사용
        const combination = `${airport['영문국가명']}_${airport['영문도시명']}`;

        if (!seenCombinations.has(combination)) {
            seenCombinations.add(combination);
            uniqueData.push(airport);
        } else {
            // 중복 정보 저장
            duplicateInfo.push({
                country: airport['영문국가명'],
                city: airport['영문도시명'],
                airport: airport['영문공항명'],
                iata: airport['공항코드1(IATA)']
            });
        }
    });

    return uniqueData;
}

// Because features come from tiled vector data,
// feature geometries may be split
// or duplicated across tile boundaries.
// As a result, features may appear
// multiple times in query results.
function getUniqueFeatures(features, comparatorProperty) {
    const uniqueIds = new Set();
    const uniqueFeatures = [];
    for (const feature of features) {
        const id = feature.properties[comparatorProperty];
        if (!uniqueIds.has(id)) {
            uniqueIds.add(id);
            uniqueFeatures.push(feature);
        }
    }
    return uniqueFeatures;
}

function createGeometry(doesCrossAntimeridian, coord1, coord2) {
    const geometry = {
        'type': 'LineString',
        'coordinates': [
            coord1,
            coord2
        ]
    };

    // To draw a line across the 180th meridian,
    // if the longitude of the second point minus
    // the longitude of original (or previous) point is >= 180,
    // subtract 360 from the longitude of the second point.
    // If it is less than 180, add 360 to the second point.

    if (doesCrossAntimeridian) {
        const startLng = geometry.coordinates[0][0];
        const endLng = geometry.coordinates[1][0];

        if (endLng - startLng >= 180) {
            geometry.coordinates[1][0] -= 360;
        } else if (endLng - startLng < 180) {
            geometry.coordinates[1][0] += 360;
        }
    }

    return geometry;
}
let airports = []
let map;
let serviceAirportInIncheon = undefined;

// map.js 시작 부분
$(document).ready(function () {
        const layerIDs = []; // 공항 마커들의 위치를 담고있습니다.

    let serviceAirportInIncheon = undefined
    console.log('map.js 로딩 시작');
    
    // Firebase가 로드될 때까지 대기
    const waitForFirebase = setInterval(() => {
        if (typeof firebase !== 'undefined') {
            clearInterval(waitForFirebase);
            initializeMap();
            loadFirebaseData();
        }
    }, 100);
});

let isAirportAdded = false; // 공항 추가 여부 플래그

function loadFirebaseData() {
    console.log('Firebase 데이터 로딩 시작');
    
    firebase.functions().httpsCallable('getServiceDestinationInfo')()
        .then((result) => {
            console.log("인천공항 취항지 정보 로드 완료");
            serviceAirportInIncheon = result.data;
            console.log('취항지 개수:', serviceAirportInIncheon?.length || 0);
            
            // 맵이 이미 로드되었고 아직 공항이 추가되지 않았다면 공항 추가
            if (map && !isAirportAdded) {
                appendAirportOnMap();
            }
        })
        .catch((error) => {
            console.error("Firebase 데이터 로딩 실패:", error);
        });
}

function initializeMap() {
    mapboxgl.accessToken = 'pk.eyJ1IjoiY2hsd2hkdG4wMyIsImEiOiJjanM4Y205N3MwMnI2NDRxZG55YnBucWJxIn0.TTN7N6WL69jnephZ7fJAnA';
    
    try {
        map = new mapboxgl.Map({
            container: 'map',
            style: 'mapbox://styles/chlwhdtn03/cmags3pq200s601rf85pfep41',
            center: [127, 37.5],
            zoom: 3
        });

        // 서울 좌표 고정
        const SEOUL_CENTER = [126.9784, 37.5665];
        const SEOUL_ZOOM = 10;

        // 네비게이션 컨트롤 추가
        map.addControl(new mapboxgl.NavigationControl(), 'top-right');

        // 커스텀 컨트롤: 서울로 이동 + 달력/예매창 노출
        class ReturnToSeoulControl {
            onAdd(mapInstance) {
                this._map = mapInstance;
                this._container = document.createElement('div');
                this._container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group seoul-ctrl';

                const btn = document.createElement('button');
                btn.className = 'seoul-ctrl-btn';
                btn.type = 'button';
                btn.title = '서울로 이동';
                btn.innerHTML = `
                    <svg viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M3 11l9-7 9 7"></path>
                        <path d="M9 22V12h6v10"></path>
                    </svg>
                `;

                btn.addEventListener('click', () => {
                    this._map.flyTo({ center: SEOUL_CENTER, zoom: SEOUL_ZOOM, essential: true });
                    const calSec = document.getElementById('when-calsec');
                    if (calSec) calSec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                });

                this._container.appendChild(btn);
                return this._container;
            }
            
            onRemove() {
                this._container.parentNode.removeChild(this._container);
                this._map = undefined;
            }
        }
        
        map.addControl(new ReturnToSeoulControl(), 'top-right');

        // 맵 로드 완료 시 이벤트 핸들러
        map.on('load', () => {
            console.log('맵 로드 완료');
            
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

            // Firebase 데이터가 이미 로드되었고 아직 공항이 추가되지 않았다면 공항 추가
            if (serviceAirportInIncheon && serviceAirportInIncheon.length > 0 && !isAirportAdded) {
                console.log('맵 로드 완료, Firebase 데이터 있음 - 공항 추가');
                appendAirportOnMap();
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
    
    

    // inspect a cluster on click
    map.on('click', 'clusters', (e) => {
        const features = map.queryRenderedFeatures(e.point, {
            layers: ['clusters']
        });
        const clusterId = features[0].properties.cluster_id;
        map.getSource('airport').getClusterExpansionZoom(
            clusterId,
            (err, zoom) => {
                if (err) return;

                map.easeTo({
                    center: features[0].geometry.coordinates,
                    zoom: zoom
                });
            }
        );
    });

    map.on('click', 'airport-point', async (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const airport_kor = e.features[0].properties.한글공항;
        const airport_eng = e.features[0].properties.영문공항명;
        const nation_kor = e.features[0].properties.한글국가명;
        const nation_eng = e.features[0].properties.영문도시명;
        const iata = e.features[0].properties['공항코드1.IATA.']
        $(".calendar-section").show()
        clearAllPrices()
        // if(selectedIATA == undefined)
        //     $(".calendar-section")[0].scrollIntoView()
        setIATA({
            korName: nation_kor,
            airportKor: airport_kor,
            iata: iata,
            coord: coordinates
        })

    // 축제 정보 추가
    // 전역 변수
let currentSelectedCountry = null; // 마지막 클릭한 국가 저장

// 지도에서 공항 클릭 시
    map.on('click', 'airport-point', (e) => {
    const nation_kor = e.features[0].properties.한글국가명;

    console.log("선택한 국가:", nation_kor);

    


    
  });




        map.getSource('route').setData({

                'type': 'Feature',
                'properties': {},
                // 'geometry': createGeometry(true, [126.4406957,37.4601908], coordinates )
                'geometry': {
                    'type': 'LineString',
                    'coordinates': [
                        [126.4406957,37.4601908],// ICN
                        [(126.4406957 + coordinates[0]) / 2, (37.4601908 + coordinates[1]) / 2],// ICN
                        coordinates
                    ]
                }
            
        })
        let citydata = await IATAtoCityInformation(iata)
        console.log(citydata)


        $("#detailFrame").attr("src", "detailmodal.html?coord1="+citydata.longitude+"&coord2="+citydata.Latitude+"&Cityname="+citydata.한글도시명+"&Nationname="+citydata.한글국가명)
        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(
                `
                    <p class="text-center"><span style="font-size:16px">${airport_kor}</span><br>
                    <a style="width:100%" data-bs-toggle="modal" data-bs-target="#detailModal" class="text-muted btn btn-light d-block">${nation_kor} ${citydata.한글도시명}</a>
                    
                    `
            )
            .setMaxWidth("500px")
            .addTo(map);

            
    });

    const detailModal = document.getElementById('detailModal')
    if (detailModal) {
        detailModal.addEventListener('show.bs.modal', event => {

        })
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

    function appendAirportOnMap() {
         map.addSource('airport', {
            type: 'geojson',
            data: 'Airport.geojson'
        });

        console.log('airport 소스 추가 완료');

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

        console.log('airport-point 레이어 추가 완료');
        
        // 공항 클릭 이벤트 리스너 추가
        map.on('click', 'airport-point', async (e) => {
            console.log('공항 클릭됨:', e.features[0].properties);
            
            const coordinates = e.features[0].geometry.coordinates.slice();
            const airport_kor = e.features[0].properties.한글공항;
            const nation_kor = e.features[0].properties.한글국가명;
            const iata = e.features[0].properties['공항코드1.IATA.'];
            
            $(".calendar-section").show();

            // 달력 섹션 잠금 해제
            if (typeof window.unlockCalendarSectionFromMap === 'function') {
                window.unlockCalendarSectionFromMap();
            } else {
                $("#initialAction").hide();
                $(".calendar-section").show();
                $(".calendar-section")[0].scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }
            
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
            if (map.getSource('route')) {
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
            }
            
            // 도시 정보 가져오기
            let citydata = await IATAtoCityInformation(iata);
            console.log(citydata);
            
            if (citydata) {
                $("#detailFrame").attr("src", "detailmodal.html?coord1=" + citydata.longitude + "&coord2=" + citydata.Latitude + "&Cityname=" + citydata.한글도시명 + "&Nationname=" + citydata.한글국가명);
            }
            
            // 팝업 생성
            const popup = new mapboxgl.Popup()
                .setLngLat(coordinates)
                .setHTML(`
                    <p class="text-center">
                        <span style="font-size:16px">${airport_kor}</span><br>
                        <a style="width:100%" data-bs-toggle="modal" data-bs-target="#detailModal" class="text-muted btn btn-light d-block">${nation_kor} ${citydata?.한글도시명 || ''}</a>
                        <button id="booking-btn-${iata}" class="booking-btn mt-2" style="width:100%">✈️ 예매하기</button>
                    </p>
                `)
                .setMaxWidth("500px")
                .addTo(map);
                
            // 예매 버튼 이벤트 리스너
            setTimeout(() => {
                const bookingBtn = document.getElementById(`booking-btn-${iata}`);
                if (bookingBtn) {
                    bookingBtn.addEventListener('click', () => {
                        popup.remove();
                        
                        const modal = bootstrap.Modal.getInstance(document.getElementById('detailModal'));
                        if (modal) {
                            modal.hide();
                        }
                        
                        unlockCalendarSectionFromMap();
                    });
                }
            }, 100);
        });
        
        // 공항 추가 완료 플래그 설정
        isAirportAdded = true;
        console.log('=== 공항 데이터 추가 완료 ===');
        
    } catch (error) {
        console.error('공항 데이터 추가 실패:', error);
    }
}

// 검색 기능
$(document).ready(function() {
    $("#searchbox").on('keyup', (e) => {
        const searchText = e.target.value.toLowerCase().trim();
        console.log(searchText);

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

// 에러 처리 함수
function showMapError() {
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; height: 100%; background: #f8f9fa;">
                <div style="text-align: center; color: #666;">
                    <p>지도를 불러오는데 실패했습니다.</p>
                    <button onclick="location.reload()" class="btn btn-primary">새로고침</button>
                </div>
            </div>
        `;
    }
}

// 지도에서 예매하기 클릭 시 달력 해제 함수
function unlockCalendarSectionFromMap() {
    $("#initialAction").hide();
    $(".calendar-section").show();
    
    if (typeof clearAllPrices === 'function') {
        clearAllPrices();
    }
    
    setTimeout(() => {
        const calendarSection = document.querySelector(".calendar-section");
        if (calendarSection) {
            calendarSection.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
    }, 100);
}

// 전역 함수로 설정
window.unlockCalendarSectionFromMap = unlockCalendarSectionFromMap;
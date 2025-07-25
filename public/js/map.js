let airports = []

$(document).ready(function () {

    const layerIDs = []; // 공항 마커들의 위치를 담고있습니다.

    let serviceAirportInIncheon = undefined
    firebase.functions().httpsCallable('getServiceDestinationInfo')().then((result) => {
        console.log("인청공항 취항지 정보");
        serviceAirportInIncheon = result.data
        console.log(serviceAirportInIncheon);
        appendAirportOnMap()
    }).catch((error) => {
        console.log("ERROR!", error);
    });

    mapboxgl.accessToken = 'pk.eyJ1IjoiY2hsd2hkdG4wMyIsImEiOiJjanM4Y205N3MwMnI2NDRxZG55YnBucWJxIn0.TTN7N6WL69jnephZ7fJAnA';
    const map = new mapboxgl.Map({
        container: 'map', // container ID
        style: 'mapbox://styles/chlwhdtn03/cmags3pq200s601rf85pfep41',
        center: [127, 37.5], // starting position [lng, lat]. Note that lat must be set between -90 and 90
        zoom: 3 // starting zoom
    });

    // async function initMap() {
    //     google.maps.importLibrary("places");
    // }

    // initMap();


    // $.get("/airport.csv", function(CSVdata) {
    //     Papa.parse(CSVdata, {
    //         header: true,
    //         skipEmptyLines: true,
    //         error: function(error) {
    //             console.error('파싱 오류:', error);
    //         },
    //         complete: function(results) {
    //             airports = results.data;
    //             console.log("공항 정보를 불러왔습니다.")
    //         }
    //     });
    // });

    map.on('load', () => {


        map.addSource('route', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'properties': {},
                'geometry': {
                    'type': 'LineString',
                    'coordinates': [
                    ]
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
       


    });


    $("#searchbox").on('keyup', (e) => {
        const searchText = e.target.value.toLowerCase().trim();
        
        console.log(searchText)

        if (map.getSource('airport')) {
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
    })


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

    map.on('click', 'airport-point', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const airport_kor = e.features[0].properties.한글공항;
        const airport_eng = e.features[0].properties.영문공항명;
        const nation_kor = e.features[0].properties.한글국가명;
        const nation_eng = e.features[0].properties.영문도시명;
        const iata = e.features[0].properties['공항코드1.IATA.']
        $(".calendar-section").show()
        clearAllPrices()
        if(selectedIATA == undefined)
            $(".calendar-section")[0].scrollIntoView()
        setIATA({
            korName: nation_kor,
            airportKor: airport_kor,
            iata: iata,
            coord: coordinates
        })

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
        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(
                `
                    <p><span style="font-size:16px">${airport_kor}</span><br>
                    ${airport_eng}<br>${nation_kor} ${iata}</p>
                    <a style="width:100%" class='btn btn-info d-block' onclick="appendFlightCard('${iata}', '${nation_kor}', '${airport_kor}', '${e.features[0].geometry.coordinates}')">최저가 확인하기</a>
                    <a style="width:100%" data-bs-toggle="modal" data-bs-target="#detailModal" class='btn btn-info d-block mt-1' onclick="browse('${iata}', '${nation_kor}', '${e.features[0].geometry.coordinates}')">주변 리뷰 확인하기</a>
                    
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
            data: 'Airport.geojson',
            // cluster: true,
            // clusterMaxZoom: 14, // Max zoom to cluster points on
            // clusterRadius: 50, // Radius of each cluster when clustering points (defaults to 50)
            filter: ['in', ['get', '공항코드1.IATA.'], ['literal', serviceAirportInIncheon || []]]
        });

        // map.addLayer({
        //     id: 'clusters',
        //     type: 'circle',
        //     source: 'airport',
        //     filter: ['has', 'point_count'],
        //     paint: {
        //         'circle-color': [
        //             'step',
        //             ['get', 'point_count'],
        //             '#51bbd6',
        //             50,
        //             '#f1f075',
        //             100,
        //             '#f28cb1'
        //         ],
        //         'circle-radius': [
        //             'step',
        //             ['get', 'point_count'],
        //             20,
        //             100,
        //             30,
        //             750,
        //             40
        //         ],
        //         'circle-emissive-strength': 1
        //     }
        // });



        // map.addLayer({
        //     id: 'unclustered-point',
        //     type: 'circle',
        //     source: 'airport',
        //     filter: ['!', ['has', 'point_count']],
        //     paint: {
        //         'circle-color': '#11b4da',
        //         'circle-radius': 20,
        //         'circle-stroke-width': 1,
        //         'circle-stroke-color': '#fff',
        //         'circle-emissive-strength': 1
        //     },
        // });


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



        // map.addLayer({
        //     id: 'cluster-count',
        //     type: 'symbol',
        //     source: 'airport',
        //     filter: ['has', 'point_count'],
        //     layout: {
        //         'text-field': ['get', 'point_count_abbreviated'],
        //         'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
        //         'text-size': 12
        //     }
        // });

    

    }


})
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
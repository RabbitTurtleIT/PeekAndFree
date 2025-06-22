let airports = []

$(document).ready(function () {

    mapboxgl.accessToken = 'pk.eyJ1IjoiY2hsd2hkdG4wMyIsImEiOiJjanM4Y205N3MwMnI2NDRxZG55YnBucWJxIn0.TTN7N6WL69jnephZ7fJAnA';
    const map = new mapboxgl.Map({
        container: 'map', // container ID
        style: 'mapbox://styles/chlwhdtn03/cmags3pq200s601rf85pfep41',
        center: [127, 37.5], // starting position [lng, lat]. Note that lat must be set between -90 and 90
        zoom: 9 // starting zoom
    });

    // async function initMap() {
    //     google.maps.importLibrary("places");
    // }

    // initMap();


    // $.get("airport.csv", function(CSVdata) {
    //     Papa.parse(CSVdata, {
    //         header: true,
    //         skipEmptyLines: true,
    //         error: function(error) {
    //             console.error('파싱 오류:', error);
    //         },
    //         complete: function(results) {
    //             airports = removeDuplicateCities(results.data);
    //             console.log("공항 정보를 불러왔습니다.")
    //         }
    //     });
    // });

    map.on('load', () => {

        map.addSource('airport', {
            type: 'geojson',
            data: 'Airport.geojson',
            cluster: true,
            clusterMaxZoom: 14, // Max zoom to cluster points on
            clusterRadius: 50 // Radius of each cluster when clustering points (defaults to 50)
        });

        map.addLayer({
            id: 'clusters',
            type: 'circle',
            source: 'airport',
            filter: ['has', 'point_count'],
            paint: {
                'circle-color': [
                    'step',
                    ['get', 'point_count'],
                    '#51bbd6',
                    50,
                    '#f1f075',
                    100,
                    '#f28cb1'
                ],
                'circle-radius': [
                    'step',
                    ['get', 'point_count'],
                    20,
                    100,
                    30,
                    750,
                    40
                ],
                'circle-emissive-strength': 1
            }
        });



        map.addLayer({
            id: 'unclustered-point',
            type: 'circle',
            source: 'airport',
            filter: ['!', ['has', 'point_count']],
            paint: {
                'circle-color': '#11b4da',
                'circle-radius': 20,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#fff',
                'circle-emissive-strength': 1
            },
        });

        map.addLayer({
            id: 'unclusterd-text',
            type: 'symbol',
            source: 'airport',
            filter: ['!', ['has', 'point_count']],
            layout: {
                'text-field': ['get', '공항코드1.IATA.'],
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12
            }
        });


        map.addLayer({
            id: 'cluster-count',
            type: 'symbol',
            source: 'airport',
            filter: ['has', 'point_count'],
            layout: {
                'text-field': ['get', 'point_count_abbreviated'],
                'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold'],
                'text-size': 12
            }
        });



    });



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

    map.on('click', 'unclustered-point', (e) => {
        const coordinates = e.features[0].geometry.coordinates.slice();
        const airport_kor = e.features[0].properties.한글공항;
        const airport_eng = e.features[0].properties.영문공항명;
        const nation_kor = e.features[0].properties.한글국가명;
        const nation_eng = e.features[0].properties.영문도시명;
        const iata = e.features[0].properties['공항코드1.IATA.']
        new mapboxgl.Popup()
            .setLngLat(coordinates)
            .setHTML(
                `
                    <p><span style="font-size:16px">${airport_kor}</span><br>
                    ${airport_eng}<br>${nation_kor} ${iata}</p>
                    <a style="width:100%" data-bs-toggle="modal" data-bs-target="#detailModal" class='btn btn-info' onclick="browse('${iata}', '${nation_kor}', '${e.features[0].geometry.coordinates}')">여행지 상세보기</a>
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
            radius: 5000,
        },
        // optional parameters
        includedPrimaryTypes: ["restaurant"],
        maxResultCount: 3,
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

            const $reviewItem = $(`
                <div class="review-item" style="padding: 15px; margin: 10px 0; background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <div style="display: flex; align-items: center; margin-bottom: 10px;">
                        <div>
                            <div style="font-weight: bold; font-size: 14px;">${place.reviews[0].authorAttribution.displayName}</div>
                            <div style="font-size: 12px; color: #666;">${place.reviews[0].relativePublishTimeDescription}</div>
                        </div>
                        <div style="margin-left: auto; color: #ffa500;">
                            ${'★'.repeat(place.reviews[0].rating)}${'☆'.repeat(5 - place.reviews[0].rating)}
                        </div>
                    </div>
                    <div style="font-size: 14px; line-height: 1.4;">
                        ${place.reviews[0].text}
                    </div>
                </div>
            `);
            console.log($reviewItem)
            $('.reviewdiv').append($reviewItem);
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


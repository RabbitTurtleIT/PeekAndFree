let airports = []
$(document).ready(function() {

    mapboxgl.accessToken = 'pk.eyJ1IjoiY2hsd2hkdG4wMyIsImEiOiJjanM4Y205N3MwMnI2NDRxZG55YnBucWJxIn0.TTN7N6WL69jnephZ7fJAnA';
    const map = new mapboxgl.Map({
        container: 'map', // container ID
        style: 'mapbox://styles/chlwhdtn03/cmags3pq200s601rf85pfep41',
        center: [127, 37.5], // starting position [lng, lat]. Note that lat must be set between -90 and 90
        zoom: 9 // starting zoom
    });


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
                    <a style="width:100%" class='btn btn-info' onclick="browse('${iata}')">여행지 상세보기</a>
                    `
                )
                .setMaxWidth("500px")
                .addTo(map);
        });


})

function browse(iata) {
    if(!iata) {
        alert("IATA 코드가 존재하지 않는 공항입니다. 티켓 조회가 불가능합니다.")
        return
    }
    alert(iata)
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


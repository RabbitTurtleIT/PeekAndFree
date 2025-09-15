let g_currentNation = null;
let nowMaxBudget = 0;
let startTripDate = '';
let endTripDate = '';
let isDateReady = false;
let isFetchingFlightNearby = false;
let selectedIATA = undefined;

function setIATA(selected) {
    selectedIATA = selected;
    renderCalendar();
}

async function IATAtoCityInformation(IATA) {
    let cityData = undefined
          
      await firebase.functions().httpsCallable('getAirportInfo')({iata : IATA}).then((result) => {
        cityData = result.data
      }).catch((error) => {
        return "ERROR"
      });

    return cityData

}


document.addEventListener('DOMContentLoaded', () => {
const now = new Date();
const currentMonth = now.getMonth() + 1;

//map section
// 월 선택 드롭다운
document.querySelectorAll('[data-month]').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        
        const month = this.getAttribute('data-month');
        const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
        const emoji = month === '7' || month === '8' ? '☀️' : month === '12' || month === '1' || month === '2' ? '❄️' : '🌸';
        
        document.getElementById('monthDropdown').innerHTML = `${emoji} ${monthNames[month-1]}`;
        console.log(`선택된 월: ${month}`);
        
        if (window.updateAirportMarkers) {
            window.updateAirportMarkers(month);
        }
    });
    
});

// 시즌 선택 드롭다운
document.querySelectorAll('[data-filter]').forEach(item => {
    item.addEventListener('click', function(e) {
        e.preventDefault();
        const filter = this.getAttribute('data-filter');
        document.getElementById('seasonDropdown').textContent = filter;
        console.log(`선택된 필터: ${filter}`);
        
        if (window.filterBySeason) {
            window.filterBySeason(filter);
        }
        });
    });
    console.log('드롭다운 이벤트 핸들러가 등록되었습니다.');
    
    const carousel = document.getElementById('mainCarousel');
    const indicators = document.querySelectorAll('.indicator-dot'); 
    const whenContent = document.getElementById('when-content');
    // const whereContent = document.getElementById('where-content');
    $(".final-reservation").hide();
    $("#flightResultsSection").hide();
    $("#initialAction").show();

    function updateIndicators(activeIndex) {
        indicators.forEach((indicator, index) => {
            if (index === activeIndex) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
    }
    indicators.forEach((indicator, index) => {
        indicator.addEventListener('click', function() {
            // Bootstrap 캐러셀 인스턴스 가져오기
            const carouselInstance = bootstrap.Carousel.getInstance(carousel) || 
                                   new bootstrap.Carousel(carousel);
            carouselInstance.to(index);
        });
    });
    
    // 캐러셀 슬라이드 변경 이벤트
    if (carousel) {
        // 초기 인디케이터 설정
        updateIndicators(0);
        
        // Bootstrap 5 이벤트 사용
        carousel.addEventListener('slid.bs.carousel', function(event) {
            updateIndicators(event.to);
        });
    }
    
// 달력 네비게이션 함수
function changeMonth(direction) {
    console.log(`달력 월 변경: ${direction}`);
    // 여기에 달력 월 변경 로직 추가
}

// 디버깅용: 드롭다운 위치 확인
function checkDropdownPosition() {
    const mapContainer = document.querySelector('.map-container');
    const mapFilters = document.querySelector('.map-filters');
    
    if (mapContainer && mapFilters) {
        const containerStyle = window.getComputedStyle(mapContainer);
        const filtersStyle = window.getComputedStyle(mapFilters);
        
        console.log('Map Container position:', containerStyle.position);
        console.log('Map Filters position:', filtersStyle.position);
        console.log('Map Filters top:', filtersStyle.top);
        console.log('Map Filters left:', filtersStyle.left);
    }
}
    // showContent('when', false);
    initCalendar();
   

    function selectBtn(selectedBtn, unselectedBtn) {
        selectedBtn.classList.add('selected');
        unselectedBtn.classList.remove('selected');
    }
    function setupSlider(sliderId, valueId) {
        const slider = document.getElementById(sliderId);
        const valueDisplay = document.getElementById(valueId);

        function updateSliderUI(value) {
            const min = Number(slider.min);
            const max = Number(slider.max);
            const percent = ((value - min) / (max - min));

            valueDisplay.textContent = `₩${Number(value).toLocaleString('ko-KR')}`;
            $('#budget').text(Number(value).toLocaleString('ko-KR'));
            nowMaxBudget = Number(value);

            const sliderWidth = slider.offsetWidth;
            const offset = percent * sliderWidth;
            valueDisplay.style.left = `${offset}px`;
            slider.style.background = `linear-gradient(to right, orange ${percent * 100}%, lightgray ${percent * 100}%)`;
        }

    }

    setupSlider('budget-slider-when', 'slider-value-when');
    hideLoading();
});

//지도에서 예매하기 버튼 클릭 시 달력 잠금 해제 함수 (전역 함수로 선언)
window.unlockCalendarSectionFromMap = function() {
    $("#initialAction").hide() // 잠금 화면 숨기기
    $("#flightResultsSection").hide() 
    clearAllPrices() // 가격 캐시 초기화
    
    // 달력 섹션으로 스크롤
    setTimeout(() => {
        $(".calendar-section")[0].scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }, 100);
}

//checkBookingFromMap();

function checkBookingFromMap() {
    // sessionStorage에서 예매 정보 확인
    const selectedDestination = sessionStorage.getItem('selectedDestination');
    const bookingAction = sessionStorage.getItem('bookingAction');
    const selectedAirportCode = sessionStorage.getItem('selectedAirportCode');
    
    if (bookingAction === 'true' && selectedDestination) {
        console.log(`🎯 map.html에서 예매 요청: ${selectedDestination}`);
        
        // 1. 달력 섹션 자동으로 표시
        showCalendarFromMap(selectedDestination, selectedAirportCode);
        
        // 2. 목적지 정보 업데이트
        updateDestinationInfo(selectedDestination);
        
        // 3. 사용한 정보 정리
        sessionStorage.removeItem('bookingAction');
        // selectedDestination과 selectedAirportCode는 유지 (예매 과정에서 사용)
    }
}

function updateSelectedTitle() {
    $("#selectedTitle").text(`지금 ${selectedIATA.korName}는 `)
}
let currentDate = new Date();
let selectedStartDate = null;
let selectedEndDate = null;
let isSelectingRange = false;
let isFetchingPrices = false;
let priceCache = {};

const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

function initCalendar() {
    renderCalendar();
}

function renderCalendar() {
    const firstMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const secondMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

    let month1Title = `${firstMonth.getFullYear()}년 ${monthNames[firstMonth.getMonth()]}`;
    let month2Title = `${secondMonth.getFullYear()}년 ${monthNames[secondMonth.getMonth()]}`;

    if (window.seasonData && selectedIATA && window.seasonData[selectedIATA.korName]) {
        const countrySeasonData = window.seasonData[selectedIATA.korName];
        const month1 = firstMonth.getMonth() + 1;
        const month2 = secondMonth.getMonth() + 1;

        if (countrySeasonData[month1] === '1') {
            month1Title += ' 🔥';
        } else if (countrySeasonData[month1] === '2' || countrySeasonData[month1] === '3') {
            month1Title += ' 😴';
        }

        if (countrySeasonData[month2] === '1') {
            month2Title += ' 🔥';
        } else if (countrySeasonData[month2] === '2' || countrySeasonData[month2] === '3') {
            month2Title += ' 😴';
        }
    }

    document.getElementById('monthTitle1').textContent = month1Title;
    document.getElementById('monthTitle2').textContent = month2Title;

    renderMonthCalendar('calendar1', firstMonth);
    renderMonthCalendar('calendar2', secondMonth);
}

function renderMonthCalendar(containerId, monthDate) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    // 요일 헤더
    dayNames.forEach(day => {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-cell header';
        dayCell.textContent = day;
        container.appendChild(dayCell);
    });

    const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const lastDay = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentRow = [];
    let dayCount = 0;

    // 첫 주 빈 칸들
    for (let i = 0; i < firstDay.getDay(); i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-cell empty';
        container.appendChild(emptyCell);
        dayCount++;
    }

    // 해당 월의 날짜들
    for (let day = 1; day <= lastDay.getDate(); day++) {
        const cellDate = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);

        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-cell';
        
        const dayNumber = document.createElement('div');
        dayNumber.className = 'day-number';
        dayNumber.textContent = day;
        
        const priceInfo = document.createElement('div');
        priceInfo.className = 'price-info';
        priceInfo.textContent = '';
        
        dayCell.appendChild(dayNumber);
        dayCell.appendChild(priceInfo);
        
        // 시간대 문제 해결을 위해 로컬 날짜 사용
        const year = cellDate.getFullYear();
        const month = String(cellDate.getMonth() + 1).padStart(2, '0');
        const dayStr = String(cellDate.getDate()).padStart(2, '0');
        const dateString = `${year}-${month}-${dayStr}`;
        dayCell.dataset.date = dateString;
        
        // 기존 가격 정보 복원
        restorePriceInfo(dayCell, dateString);

        // 오늘 날짜
        if (cellDate.getTime() === today.getTime()) {
            dayCell.classList.add('today');
        }

        // 선택된 범위 표시
        updateCellSelection(dayCell, cellDate);

        dayCell.addEventListener('click', () => selectDate(cellDate));

        container.appendChild(dayCell);
        dayCount++;
    }

    // 마지막 주 빈 칸들 (6주 완성을 위해)
    while (dayCount < 42) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-cell empty';
        container.appendChild(emptyCell);
        dayCount++;
    }
}

function updateCellSelection(cell, cellDate) {
    if (selectedStartDate && cellDate.getTime() === selectedStartDate.getTime()) {
        cell.classList.add('selected-start');
    }
    if (selectedEndDate && cellDate.getTime() === selectedEndDate.getTime()) {
        cell.classList.add('selected-end');
    }
    if (selectedStartDate && selectedEndDate &&
        cellDate.getTime() > selectedStartDate.getTime() &&
        cellDate.getTime() < selectedEndDate.getTime()) {
        cell.classList.add('in-range');
    }
}

function selectDate(date) {
    if (!selectedStartDate || (selectedStartDate && selectedEndDate)) {
        // 새로운 선택 시작
        selectedStartDate = new Date(date);
        selectedEndDate = null;
        isSelectingRange = true;
        
        // 기존 캐시 삭제
        priceCache = {};

    } else if (selectedStartDate && !selectedEndDate) {
        // 종료일 선택
        if (date.getTime() >= selectedStartDate.getTime()) {
            selectedEndDate = new Date(date);
        } else {
            selectedEndDate = new Date(selectedStartDate);
            selectedStartDate = new Date(date);
        }

        // 종요일 선택 시 그 범위의 추정 예산 표시
        console.log(selectedIATA.iata + " 선택된 상태")
        if (selectedIATA) {
            fetchMonthPrices(selectedStartDate, selectedEndDate);
        }
        isSelectingRange = false;
    }

    updateSelectedRangeDisplay();
    renderCalendar();
}

function updateSelectedRangeDisplay() {
    const startDateElement = $('span#startDate');
    const endDateElement = $('span#endDate');

    if (selectedStartDate) {
        startDateElement.text(formatDate(selectedStartDate));
        startTripDate = formatDateWithYear(selectedStartDate);
    } else {
        startDateElement.textContent = '선택되지 않음';
    }

    if (selectedEndDate) {
        endDateElement.text(formatDate(selectedEndDate));
        endTripDate = formatDateWithYear(selectedEndDate);
    } else {
        endDateElement.textContent = '선택되지 않음';
    }

    if (selectedStartDate && selectedEndDate) {
        isDateReady = true;
        if (isDateReady && selectedIATA) {
            appendFlightCard(selectedIATA.iata, selectedIATA.airportKor, selectedIATA.korName, selectedIATA.coord);
        }
    } else {
        isDateReady = false;
    }
}

function formatDate(date) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateWithYear(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function fetchFlightDataNearby(startDate, endDate) {
    if (!isFetchingFlightNearby) {
        showLoading();
        isFetchingFlightNearby = true;
        const result = await firebase.functions().httpsCallable('fetchFlightNearby')({
            startDate: startDate,
            endDate: endDate,
        });

        refreshFlightCard(result);
        isFetchingFlightNearby = false;
        hideLoading();
        $(".whereFetchDone")[0].scrollIntoView();
    }
}
function refreshFlightCard(result) {
    console.log(result);
    $('#nearbyFlightList').empty();

    for(let item of result.data) {
        try {
            let price = item.data[0].price.total
            let arrivalIata = item.data[0].itineraries[0].segments[0].arrival.iataCode
            let time = item.data[0].itineraries[0].duration
            time = time.replaceAll("PT", "").replaceAll("H", "시간 ").replaceAll("M","분")
            let loc = item.dictionaries.locations[arrivalIata]
            $('#nearbyFlightList').append(FlightCard(loc.countryCode + " " + loc.cityCode + " (" + arrivalIata + ")", price, time, item))
            $('#nearbyFlightList').empty(); 
        } catch(e) {
            console.log(e)
            continue
        }
    }
}

async function appendFlightCard(IATA, korName, airportKor, coord) {
    if (!isFetchingFlightNearby && startTripDate && endTripDate) {
        showLoading();
        isFetchingFlightNearby = true;
        console.log(startTripDate)
        console.log(endTripDate)
        try {
            const result = await firebase.functions().httpsCallable('fetchFlight')({
                startDate: startTripDate,
                endDate: endTripDate,
                iata: IATA
            });
            console.log(result)

            const flightData = result.data.data[0];
            console.log('항공편 데이터:', flightData);
            
            let price = result.data.data[0].price.total
            let arrivalIata = result.data.data[0].itineraries[0].segments[0].arrival.iataCode
            let time = result.data.data[0].itineraries[0].duration
            time = time.replaceAll("PT", "").replaceAll("H", "시간 ").replaceAll("M","분")
            $('#nearbyFlightList').append(FlightCard(korName + " " + airportKor + " (" + arrivalIata + ")", price, time, result.data))
            //항공편 카드를 지도 아래 영역에 추가
            $('#nearbyFlightList').empty(); // 기존 내용 제거
            $('#nearbyFlightList').append(FlightCard(korName + " " + airportKor + " (" + arrivalIata + ")", price, time, result.data))
            
            //항공편 목록이 보이는 영역으로 스크롤
             $('.flight-results-section').show(); // 섹션 표시
            setTimeout(() => {
                $('.flight-results-section')[0].scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'start' 
                });
            }, 100);
            
            console.log('항공편 카드 생성 완료');
            
        } catch(e) {
            console.error('항공편 조회 에러:', e);
            console.log('에러 상세:', e.message);
        }
        hideLoading();
        isFetchingFlightNearby = false;
    } else {
        alert("캘린더에서 여행 날짜를 먼저 선택해주세요! 그런 다음, 여러 공항의 최저가를 확인하실 수 있습니다")
    }
}

function FlightCard(locName, price, time, data) {
        let startDate = data.data[0].itineraries[0].segments[0].arrival.at.split("T")[0]
        let endDate = data.data[0].itineraries[1].segments[0].arrival.at.split("T")[0]
        let seatClass = data.data[0].travelerPricings[0].fareDetailsBySegment[0].cabin
        let peopleNum = "성인 " + data.data[0].travelerPricings.length + "명"
        let card = $(`<div class="rounded-pill bg-white p-1 mt-1">
                    <span style='text-size=16px'>${locName} <strong>${Number(price).toLocaleString('ko-KR')}원</strong> | ${startDate}~${endDate} ✈️ 약 ${time} 소요 🌡️ 평균기온</span>
                </div>`);
                

        card.on("click", function() {
            $(".final-reservation").show() 
            setTimeout(() => {
            $(".final-reservation")[0].scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
            viewTrip(locName, peopleNum, seatClass, startDate, endDate)
        })

    return card;
}

function viewTrip(locName, peopleNum, seatClass, startDate, endDate) {
    $("#viewLocationName").text(locName)
    $("#viewCountPeople").text(peopleNum)
    $("#viewSeatClass").text(seatClass)
    $("span#startDate").text(startDate)
    $("span#endDate").text(endDate)
    $("#skyscannerDiv").empty()
    let skyscanner = $('<div id="skyscanner" data-skyscanner-widget="FlightSearchWidget" data-locale="ko-KR"></div> <script src="https://widgets.skyscanner.net/widget-server/js/loader.js" async></script>')
    skyscanner.attr("data-market","KR")
    skyscanner.attr("data-currency","KRW")
    skyscanner.attr("data-origin-iata-code","ICN")
    console.log(locName.split("(")[1].split(")")[0])
    skyscanner.attr("data-destination-iata-code", locName.split("(")[1].split(")")[0])
    skyscanner.attr("data-flight-outbound-date",startDate)
    skyscanner.attr("data-flight-inbound-date",endDate)
    skyscanner.attr("data-flight-type","return")

    $("#skyscannerDiv").append(skyscanner)
    
}

function changeMonth(direction) {
    currentDate.setMonth(currentDate.getMonth() + direction);
    renderCalendar();
}

function resetSelection() {
    selectedStartDate = null;
    selectedEndDate = null;
    isSelectingRange = false;
    updateSelectedRangeDisplay();
    renderCalendar();
}

function getSelectedRange() {
    return {
        startDate: selectedStartDate ? formatDate(selectedStartDate) : null,
        endDate: selectedEndDate ? formatDate(selectedEndDate) : null
    };
}

function setPriceForDate(dateString, price) {
    console.log(`setPriceForDate 호출: 날짜=${dateString}, 가격=${price}`);
    const dateElements = document.querySelectorAll(`[data-date="${dateString}"]`);
    console.log(`찾은 날짜 요소 개수: ${dateElements.length}`);
    
    dateElements.forEach((element, index) => {
        console.log(`요소 ${index}의 data-date: ${element.dataset.date}`);
        const priceElement = element.querySelector('.price-info');
        if (priceElement) {
            if (price === '비행편 없음') {
                priceElement.textContent = '비행편 없음';
                console.log(`${dateString}에 "비행편 없음" 설정`);
            } else if (price && price > 0) {
                const priceText = `₩${Number(price).toLocaleString('ko-KR')}`;
                priceElement.textContent = priceText;
                console.log(`${dateString}에 가격 ${priceText} 설정`);
            } else {
                priceElement.textContent = '';
                console.log(`${dateString}에 빈 문자열 설정`);
            }
        }
    });
}

function clearAllPrices() {
    // DOM에서 가격 정보 제거
    const priceElements = document.querySelectorAll('.price-info');
    priceElements.forEach(element => {
        element.textContent = '';
    });
    
    // 캐시도 함께 삭제
    priceCache = {};
}

function setPricesForMonth(priceData) {
    Object.keys(priceData).forEach(dateString => {
        setPriceForDate(dateString, priceData[dateString]);
    });
}

function restorePriceInfo(dayCell, dateString) {
    // 모든 캐시에서 해당 날짜의 가격 정보 찾기
    for (const cacheKey in priceCache) {
        if (priceCache[cacheKey][dateString]) {
            const priceElement = dayCell.querySelector('.price-info');
            if (priceElement) {
                const price = priceCache[cacheKey][dateString];
                if (price === '비행편 없음') {
                    priceElement.textContent = '비행편 없음';
                } else if (price && price > 0) {
                    priceElement.textContent = `₩${Number(price).toLocaleString('ko-KR')}`;
                }
            }
            break;
        }
    }
}

async function fetchMonthPrices(startDate, endDate = null) {
    if (isFetchingPrices || !selectedIATA) return;

    isFetchingPrices = true;
    const startDateStr = startTripDate;
    const cacheKey = `${selectedIATA.iata}_${startDateStr}`;
    
    // 캐시 확인
    if (priceCache[cacheKey]) {
        setPricesForMonth(priceCache[cacheKey]);
        isFetchingPrices = false;
        return;
    }
    
    try {
        // 현재 날짜 기준으로 조회 가능한 최대 날짜 계산 (다음달 마지막날까지)
        const today = new Date();
        // const maxAllowedDate = new Date(today.getFullYear(), today.getMonth() + 2, 0); // 다음달 마지막날
        const maxAllowedDate = new Date(today.getFullYear(), today.getMonth()+1, today.getDate() + 2); // 2일치만
        
        const dates = [];
        const currentDateObj = new Date(startDate);
        
        // 시작일부터 endDate(또는 maxAllowedDate 중 더 작은 값)까지 모든 날짜 조회
        let finalDate = maxAllowedDate;
        if (endDate) {
            const endDateObj = new Date(endDate);
            finalDate = endDateObj < maxAllowedDate ? endDateObj : maxAllowedDate;
        }
        
        while (currentDateObj <= finalDate) {
            const dateStr = formatDateWithYear(new Date(currentDateObj));
            dates.push(dateStr);
            currentDateObj.setDate(currentDateObj.getDate() + 1);
        }
        
        console.log(`조회 가능 최대 날짜: ${formatDateWithYear(maxAllowedDate)}`);
        console.log(`실제 조회 종료 날짜: ${formatDateWithYear(finalDate)}`);
        console.log(`실제 조회할 날짜들:`, dates);
        
        console.log('생성된 dates 배열:', dates);
        
        const priceData = {};
        
        // 개별 요청으로 각 날짜의 가격 조회 (Firestore 캐싱 활용)
        await fetchIndividualPrices(dates, priceData);
        
        // 캐시에 저장 (5분간 유지)
        priceCache[cacheKey] = priceData;
        setTimeout(() => {
            delete priceCache[cacheKey];
        }, 5 * 60 * 1000);
        
    } catch (error) {
        console.log('가격 조회 오류:', error);
    }
    
    isFetchingPrices = false;
}

async function fetchIndividualPrices(dates, priceData) {
    const startDateStr = formatDateWithYear(selectedStartDate);
    const today = new Date();
    const maxAllowedDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);
    
    console.log(`fetchIndividualPrices 호출 - 시작일: ${startDateStr}, 조회할 날짜들:`, dates);
    
    for (const dateStr of dates) {
        // 프론트엔드에서 한 번 더 날짜 범위 검증
        const requestDate = new Date(dateStr);
        if (requestDate > maxAllowedDate) {
            console.log(`날짜 범위 초과로 API 호출 차단: ${dateStr}`);
            setPriceForDate(dateStr, '조회 불가');
            priceData[dateStr] = '조회 불가';
            continue;
        }
        
        try {
            console.log(`API 호출 시작: 가는날=${startDateStr}, 오는날=${dateStr}`);
            
            // 왕복 요청: 가는날은 시작일, 오는날은 각 날짜
            const result = await firebase.functions().httpsCallable('fetchFlightForCalendar')({
                startDate: startDateStr,
                endDate: dateStr,
                iata: selectedIATA.iata
            });
            
            if (result.data && result.data.error) {
                console.log(`범위 초과: ${dateStr}`);
                setPriceForDate(dateStr, '범위 초과');
                priceData[dateStr] = '범위 초과';
            } else if (result.data && result.data.data && result.data.data.data && result.data.data.data.length > 0) {
                // 왕복 총 가격 (시작일 출발 + 각 날짜 복귀)
                const totalPrice = result.data.data.data[0].price.total;
                console.log(`가격 설정: ${dateStr} = ${totalPrice}`);
                setPriceForDate(dateStr, totalPrice);
                priceData[dateStr] = totalPrice;
            } else {
                console.log(`비행편 없음: ${dateStr}`);
                console.log('비행편이 없어서 추가 조회를 중단합니다.');
                setPriceForDate(dateStr, '비행편 없음');
                priceData[dateStr] = '비행편 없음';
                break; // 비행편 없음 시 즉시 반복문 중단
            }
            
            // Firestore 캐싱으로 속도가 빨라졌으므로 지연 시간 단축
            await new Promise(resolve => setTimeout(resolve, 50));
            
        } catch (e) {
            console.log(`날짜 ${dateStr} 조회 실패:`, e);
            console.log('API 호출 실패로 인해 추가 조회를 중단합니다.');
            setPriceForDate(dateStr, '조회 실패');
            priceData[dateStr] = '조회 실패';
            break; // 실패 시 즉시 반복문 중단
        }
    }
}




function showLoading() {
    $('#loading').show();
}

function hideLoading() {
    $('#loading').hide();
}
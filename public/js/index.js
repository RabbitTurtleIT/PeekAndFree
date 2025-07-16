let nowMaxBudget = 0;
let startTripDate = '';
let endTripDate = '';
let isDateReady = false;
let isFetchingFlightNearby = false;

document.addEventListener('DOMContentLoaded', () => {
    const btnWhen = document.getElementById('btn-when');
    const btnWhere = document.getElementById('btn-where');
    const btnMypage = document.getElementById('mypage-btn');
    const carousel = document.getElementById('mainCarousel');
    const indicators = $('.indicator-dot');
    const whenContent = document.getElementById('when-content');
    const whereContent = document.getElementById('where-content');
    $(".final-reservation").hide()


    const selectedImg = 'img/btn_selected.png';
    const unselectedImg = 'img/btn_unselected.png';

    function updateIndicators(activeIndex) {
        indicators.attr('src', unselectedImg);
        indicators[activeIndex].src = selectedImg;
    }

    function activateButton(activeBtn, inactiveBtn) {
        activeBtn.classList.add('active');
        inactiveBtn.classList.remove('active');
    }

    function showContent(type, isScroll) {
        if (type === 'when') {
            whenContent.style.display = 'block';
            whereContent.style.display = 'none';
            if (isScroll) {
                $("div#map").appendTo('div#when-mapdiv')
                $(".calendar-container").appendTo('section#when-calsec')
                whenContent.scrollIntoView({ behavior: 'smooth' });
            }
        } else {
            whenContent.style.display = 'none';
            whereContent.style.display = 'block';
            // jQuery("#map").detach().append('#where-content.map-section')
            if (isScroll) {
                $("div#map").appendTo('div#where-mapdiv')
                $(".calendar-container").appendTo('section#where-calsec')
                whereContent.scrollIntoView({ behavior: 'smooth' });
            }
        }
    }

    updateIndicators(0);
    showContent('when', false);
    initCalendar();
    
    carousel.addEventListener('slide.bs.carousel', function (e) {
        updateIndicators(e.to);
    });


    btnWhen.addEventListener('click', () => {
        activateButton(btnWhen, btnWhere);
        showContent('when', true);
    });

    btnWhere.addEventListener('click', () => {
        activateButton(btnWhere, btnWhen);
        showContent('where', true);
    });

    btnMypage.addEventListener('click', () => {
        window.location.href = 'mypage.html';
    });

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

        updateSliderUI(slider.value);

        slider.addEventListener('input', (e) => {
            updateSliderUI(e.target.value);
        });

        slider.addEventListener('mouseup', (e) => {
            if (isDateReady) {
                fetchFlightDataNearby(startTripDate, endTripDate, e.target.value);
            }
        });
    }

    setupSlider('budget-slider-when', 'slider-value-when');
    setupSlider('budget-slider-where', 'slider-value-where');
    hideLoading();
});



let currentDate = new Date();
let selectedStartDate = null;
let selectedEndDate = null;
let isSelectingRange = false;

const monthNames = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];
const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

function initCalendar() {
    renderCalendar();
}

function renderCalendar() {
    const firstMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const secondMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);

    document.getElementById('monthTitle1').textContent = `${firstMonth.getFullYear()}년 ${monthNames[firstMonth.getMonth()]}`;
    document.getElementById('monthTitle2').textContent = `${secondMonth.getFullYear()}년 ${monthNames[secondMonth.getMonth()]}`;

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
        dayCell.textContent = day;
        dayCell.dataset.date = cellDate.toISOString().split('T')[0];

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
    } else if (selectedStartDate && !selectedEndDate) {
        // 종료일 선택
        if (date.getTime() >= selectedStartDate.getTime()) {
            selectedEndDate = new Date(date);
        } else {
            selectedEndDate = new Date(selectedStartDate);
            selectedStartDate = new Date(date);
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

async function fetchFlightDataNearby(startDate, endDate, maxBudget) {
    if (!isFetchingFlightNearby) {
        showLoading();
        isFetchingFlightNearby = true;
        const result = await firebase.functions().httpsCallable('fetchFlightNearby')({
            startDate: startDate,
            endDate: endDate,
            maxBudget: maxBudget
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
                maxBudget: nowMaxBudget,
                iata: IATA
            });
            console.log(result)
            let price = result.data.data[0].price.total
            let arrivalIata = result.data.data[0].itineraries[0].segments[0].arrival.iataCode
            let time = result.data.data[0].itineraries[0].duration
            time = time.replaceAll("PT", "").replaceAll("H", "시간 ").replaceAll("M","분")
            $('#nearbyFlightList').append(FlightCard(korName + " " + airportKor + " (" + arrivalIata + ")", price, time, result.data))
        } catch(e) {
            alert("조건에 맞는 항공권을 찾지 못했어요.")
        }
        hideLoading();
        isFetchingFlightNearby = false;
    }
}

function FlightCard(locName, price, time, data) {
        let seatClass = data.data[0].travelerPricings[0].fareDetailsBySegment[0].cabin
        let peopleNum = "성인 " + data.data[0].travelerPricings.length + "명"
        let card = $(`<div class="rounded-pill bg-white p-1 mt-1">
                    <span style='text-size=16px'>${locName} <strong>${Number(price).toLocaleString('ko-KR')}원</strong> | ✈️ 약 ${time} 소요 🌡️ 평균기온</span>
                </div>`);
                

        card.on("click", function() {
            $(".final-reservation").show()
            $(".final-reservation")[0].scrollIntoView();
            viewTrip(locName, peopleNum, seatClass)
        })

    return card;
}

function viewTrip(locName, peopleNum, seatClass) {
    $("#viewLocationName").text(locName)
    $("#viewCountPeople").text(peopleNum)
    $("#viewSeatClass").text(seatClass)
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



function showLoading() {
    $('#loading').show();
}

function hideLoading() {
    $('#loading').hide();
}
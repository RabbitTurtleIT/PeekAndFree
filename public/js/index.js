let nowMaxBudget = 0
let startTripDate = ''
let endTripDate = ''
let isDateReady = false
let isFetchingFlightNearby = false;

document.addEventListener('DOMContentLoaded', () => {
    const btnWhen = document.getElementById('btn-when');
    const btnWhere = $('#btn-where')[0]; // document.getElementById('btn-where');
    const btnMypage = document.getElementById('mypage-btn');
    const carousel = document.getElementById('mainCarousel');
    const indicators = $(".indicator-dot") // document.querySelectorAll('.indicator-dot');
    const whenContent = document.getElementById('when-content');
    const whereContent = document.getElementById('where-content');


    const selectedImg = 'img/btn_selected.png';
    const unselectedImg = 'img/btn_unselected.png';

    function updateIndicators(activeIndex) {
        //   indicators.forEach((dot, idx) => {
        //     dot.src = (idx === activeIndex) ? selectedImg : unselectedImg;
        //   });

        indicators.attr("src", unselectedImg)
        indicators[activeIndex].src = selectedImg
    }

    function activateButton(activeBtn, inactiveBtn) {
        activeBtn.classList.add('active');
        inactiveBtn.classList.remove('active');
    }

    function showContent(type, isScroll) {
        if (type === 'when') {
            whenContent.style.display = 'block';
            whereContent.style.display = 'none';
            if (isScroll)
                whenContent.scrollIntoView({ behavior: 'smooth' });
        } else {
            whenContent.style.display = 'none';
            whereContent.style.display = 'block';
            if (isScroll)
                whereContent.scrollIntoView({ behavior: 'smooth' });
        }
    }

    updateIndicators(0);
    showContent('when', false)
    initCalendar()
    // 슬라이드 변경될 때 인디케이터 갱신
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
        selectResult.style.display = 'block';
        window.scrollTo({ top: selectResult.offsetTop, behavior: 'smooth' });
    });

    btnMypage.addEventListener('click', () => {
        window.location.href = 'mypage.html';
    });

    // btnNearby.addEventListener('click', () => {

    // });    
    function selestBtn(selectedBtn, unselectedBtn) {
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
            $("#budget").text(Number(value).toLocaleString('ko-KR'))
            nowMaxBudget = Number(value)

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
            if(isDateReady) {
                fetchFlightDataNearby(startTripDate, endTripDate, e.target.value)
            }
        })
    }

    setupSlider("budget-slider-when", "slider-value-when");
    setupSlider("budget-slider-where", "slider-value-where");
    hideLoading()
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
    const startDateElement = document.getElementById('startDate');
    const endDateElement = document.getElementById('endDate');

    if (selectedStartDate) {
        startDateElement.textContent = formatDate(selectedStartDate);
        startTripDate = formatDateWithYear(selectedStartDate)
    } else {
        startDateElement.textContent = '선택되지 않음';
    }

    if (selectedEndDate) {
        endDateElement.textContent = formatDate(selectedEndDate);
        endTripDate = formatDateWithYear(selectedEndDate)
    } else {
        endDateElement.textContent = '선택되지 않음';
    }

    if(selectedStartDate && selectedEndDate) {
        isDateReady = true
    } else {
        isDateReady = false

    }
}

function formatDate(date) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateWithYear(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function fetchFlightDataNearby(startDate, endDate, maxBudget) {
    if(!isFetchingFlightNearby) {
        showLoading()
        isFetchingFlightNearby = true
        const result = await firebase.functions().httpsCallable('fetchFlightNearby')({
            startDate: startDate ,endDate: endDate,maxBudget: maxBudget
        })

        refreshFlightCard(result)
        isFetchingFlightNearby = false
        hideLoading()
    }
}
  //   "price": apiData.data[0].price.total,
  //   "time": apiData.data[0].itineraries[0].duration 
function refreshFlightCard(result) {
    console.log(result)
    $('#nearbyFlightList').empty()
    $('#nearbyFlightList').append(FlightCard("일본 도쿄", result.data.tokyo))
    $('#nearbyFlightList').append(FlightCard("일본 요코하마", result.data.yokohama))
    $('#nearbyFlightList').append(FlightCard("일본 나고야", result.data.nagoya))
    $('#nearbyFlightList').append(FlightCard("중국 상하이", result.data.shanghai))
    $('#nearbyFlightList').append(FlightCard("홍콩", result.data.hongkong))

    
}

function FlightCard(locName, data) {
    if(data.data[0]) {
        return `<div class="rounded-pill bg-white p-2">
                    ${locName} ${Number(data.data[0].price.total).toLocaleString('ko-KR')}원 (항공권 최저가) | ✈️ 약 ${data.data[0].itineraries[0].duration } 소요 🌡️ 평균기온 기온 
                    </div><br>`
    }
    return ''
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

// 선택된 날짜 범위를 가져오는 함수 (외부에서 사용 가능)
function getSelectedRange() {
    return {
        startDate: selectedStartDate ? formatDate(selectedStartDate) : null,
        endDate: selectedEndDate ? formatDate(selectedEndDate) : null
    };
}



function showLoading() {
    $("#loading").show()
}
function hideLoading() {
    $("#loading").hide()
}
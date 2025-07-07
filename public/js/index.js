document.addEventListener('DOMContentLoaded', () => {
    const btnWhen = document.getElementById('btn-when');
    const btnWhere = $('#btn-where')[0]; // document.getElementById('btn-where');
    const btnMypage = document.getElementById('btn-mypage');
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
            if(isScroll)
                whenContent.scrollIntoView({ behavior: 'smooth' });
        } else {
            whenContent.style.display = 'none';
            whereContent.style.display = 'block';
            if(isScroll)
                whereContent.scrollIntoView({ behavior: 'smooth' });
        }
    }

    updateIndicators(0);
    showContent('where', false)
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
    
 const slider = document.getElementById('budget-slider');
const valueDisplay = document.querySelector('.slider-value');

function updateSliderUI(value) {
  const min = Number(slider.min);
  const max = Number(slider.max);
  const percent = ((value - min) / (max - min));
  
  valueDisplay.textContent = `₩${Number(value).toLocaleString('ko-KR')}`;

  const sliderWidth = slider.offsetWidth;
  const offset = percent * sliderWidth;
  valueDisplay.style.left = `${offset}px`;

  slider.style.background = `linear-gradient(to right, orange, yellow ${percent * 100}%, lightgray ${percent * 100}%)`;
}

updateSliderUI(slider.value);

slider.addEventListener('input', (e) => {
  updateSliderUI(e.target.value);
});


});


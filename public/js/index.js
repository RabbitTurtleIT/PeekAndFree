document.addEventListener('DOMContentLoaded', () => {
    const btnWhen = document.getElementById('btn-when');
    const btnWhere = document.getElementById('btn-where');
    const btnMypage = document.getElementById('btn-mypage');
    const carousel = document.getElementById('mainCarousel');
    const indicators = document.querySelectorAll('.indicator-dot');

    const selectedImg = 'img/btn_selected.png';
    const unselectedImg = 'img/btn_unselected.png';

    function updateIndicators(activeIndex) {
      indicators.forEach((dot, idx) => {
        dot.src = (idx === activeIndex) ? selectedImg : unselectedImg;
      });
    }

    updateIndicators(0);

    // 슬라이드 변경될 때 인디케이터 갱신
    carousel.addEventListener('slide.bs.carousel', function (e) {
      updateIndicators(e.to);
    });     
    function activateButton(activeBtn, inactiveBtn) {
    activeBtn.classList.add('active');
    inactiveBtn.classList.remove('active');
     }

    btnWhen.addEventListener('click', () => {
        activateButton(btnWhen, btnWhere);
    });

    btnWhere.addEventListener('click', () => {
        activateButton(btnWhere, btnWhen);
    });

    btnMypage.addEventListener('click', () => {
        window.location.href = 'mypage.html';
    });
});

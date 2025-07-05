document.addEventListener('DOMContentLoaded', () => {
    const btnWhen = document.getElementById('btn-when');
    const btnWhere = document.getElementById('btn-where');
    const btnMypage = document.getElementById('btn-mypage');
    const carousel = document.getElementById('mainCarousel');
    const indicators = document.querySelectorAll('.indicator-dot');
    const whenContent = document.getElementById('when-content');
    const whereContent = document.getElementById('where-content');


    const selectedImg = 'img/btn_selected.png';
    const unselectedImg = 'img/btn_unselected.png';

    function updateIndicators(activeIndex) {
      indicators.forEach((dot, idx) => {
        dot.src = (idx === activeIndex) ? selectedImg : unselectedImg;
      });
    }

    function activateButton(activeBtn, inactiveBtn) {
    activeBtn.classList.add('active');
    inactiveBtn.classList.remove('active');
    }
    
    function showContent(type) {
        if (type === 'when') {
            whenContent.style.display = 'block';
            whereContent.style.display = 'none';
            whenContent.scrollIntoView({ behavior: 'smooth' });
        } else {
            whenContent.style.display = 'none';
            whereContent.style.display = 'block';
            whereContent.scrollIntoView({ behavior: 'smooth' });
        }
    }

    updateIndicators(0);

    // 슬라이드 변경될 때 인디케이터 갱신
    carousel.addEventListener('slide.bs.carousel', function (e) {
      updateIndicators(e.to);
    });     


    btnWhen.addEventListener('click', () => {
        activateButton(btnWhen, btnWhere);
        showContent('when');
    });

    btnWhere.addEventListener('click', () => {
        activateButton(btnWhere, btnWhen);
        showContent('where');
        selectResult.style.display = 'block';
        window.scrollTo({ top: selectResult.offsetTop, behavior: 'smooth' });
    });

    btnMypage.addEventListener('click', () => {
        window.location.href = 'mypage.html';
    });
});

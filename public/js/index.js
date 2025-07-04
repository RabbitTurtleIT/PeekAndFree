document.addEventListener('DOMContentLoaded', () => {
  const btnWhen = document.querySelector('.btn-when');
  const btnWhere = document.querySelector('.btn-where');
  const btnMypage = document.querySelector('.btn-mypage');

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

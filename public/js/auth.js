$("#welcomeDiv").hide()
$(document).ready(function () {
    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            // User is signed in, see docs for a list of available properties
            // https://firebase.google.com/docs/reference/js/v8/firebase.User
            var uid = user.uid;

            $("#needLogin").hide()
            $("#welcomeDiv").show()
            $("#welcomeUser").text(user.email)
            console.log(user)
        } else {
            $("#needLogin").show()
            $("#welcomeDiv").hide()
        }
    });
})

function emailCheck(email_address) {
    email_regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/i;
    if (!email_regex.test(email_address)) {
        return false;
    } else {
        return true;
    }
}

function logout() {
    firebase.auth().signOut().then(() => {
        alert("로그아웃 완료!")
    }).catch((error) => {
        alert(error)
    });
}

function login() {
    let email = $("#login-email").val()
    let pw = $("#login-pw").val()
    if (email.length == 0) {
        $("#loginErrorMessage").text("이메일을 입력해주세요.")
        return
    }

    if (pw.length == 0) {
        $("#loginErrorMessage").text("비밀번호를 입력해주세요.")
        return
    }
    firebase.auth().signInWithEmailAndPassword(email, pw)
        .then((userCredential) => {
            // Signed in
            var user = userCredential.user;
            closeLoginModal()
        })
        .catch((error) => {
            var errorCode = error.code;
            var errorMessage = error.message;
            $("#loginErrorMessage").text(errorMessage)
        });
}

function closeCreateAccount() {
    $('#createAccount').modal('hide');
}
function closeLoginModal() {
    $('#loginModal').modal('hide');
}
function createAccount() {
    var emailInput = document.getElementById('reg-email');
    var pwInput = document.getElementById('reg-pw');
    var pwRInput = document.getElementById('reg-pw-repeat');
    if (!emailCheck(emailInput.value)) {
        $("#createAccountErrorMessage").text("이메일 형식이 아닙니다.")
        return
    }
    if (pwInput.value.length < 1) {
        $("#createAccountErrorMessage").text("비밀번호를 입력하세요.")
        return
    }
    if (pwInput.value != pwRInput.value) {
        $("#createAccountErrorMessage").text("비밀번호가 다릅니다.")
        return
    }

    firebase.auth().createUserWithEmailAndPassword(emailInput.value, pwInput.value)
        .then((userCredential) => {
            // Signed in 
            var user = userCredential.user;
            console.log(user)
            closeCreateAccount()
        })
        .catch((error) => {
            var errorCode = error.code;
            var errorMessage = error.message;
            $("#createAccountErrorMessage").text(errorMessage)
        });
}
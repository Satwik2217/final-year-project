let login=document.getElementById("loginBtn") ;
let signup=document.getElementById("signupBtn") ;
let loginform=document.getElementById("loginForm") ;
let signupform=document.getElementById("signupForm") ;

login.addEventListener("click",function(){
    loginform.classList.remove("hidden") ;
    signupform.classList.add("hidden") ;
}) ;
signup.addEventListener("click",function(){
    signupform.classList.remove("hidden") ;
    loginform.classList.add("hidden") ;
}) ;
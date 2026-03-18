let navbarIcon=document.getElementById("navbarIcon") ;
let navbar=document.getElementById("navbar") ;
let login=document.getElementById("loginBtn") ;
let signup=document.getElementById("signupBtn") ;
let loginform=document.getElementById("loginForm") ;
let signupform=document.getElementById("signupForm") ;
let closeLogin=document.getElementById("closeLogin") ;
let closeSignup=document.getElementById("closeSignup") ;
let closenavbar=document.getElementById("closenavbar") ;
let logout=document.getElementById("logoutBtn") ;


/* here at the time of revising code give attention to the names of the variable of the getElementBYId */

navbarIcon.addEventListener("click",function(event){
    event.preventDefault() ;
    navbar.classList.remove("hidden") ;
    navbarIcon.classList.add("hidden") ;
}) ;
closenavbar.addEventListener("click",function(event){
    event.preventDefault() ;
    navbarIcon.classList.remove("hidden") ;
    navbar.classList.add("hidden") ;
}) ;
login.addEventListener("click",function(event){
    event.preventDefault() ;
    navbar.classList.add("hidden") ;
    loginform.classList.remove("hidden") ;
    signupform.classList.add("hidden") ;
}) ;
signup.addEventListener("click",function(event){
    event.preventDefault() ;
    navbar.classList.add("hidden") ;
    signupform.classList.remove("hidden") ;
    loginform.classList.add("hidden") ;
}) ;
closeLogin.addEventListener("click",function(){
    loginform.classList.add("hidden") ;
    navbar.classList.remove("hidden") ;
}) ;
closeSignup.addEventListener("click",function(){
    signupform.classList.add("hidden") ;
    navbar.classList.remove("hidden") ;
}) ;
logout.addEventListener("click",function(){
    loginform.classList.add("hidden")
    signupform.classList.add("hidden")
}) ;

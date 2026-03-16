let login=document.getElementById("loginBtn") ;
let signup=document.getElementById("signupBtn") ;
let loginform=document.getElementById("loginForm") ;
let signupform=document.getElementById("signupForm") ;
let closeLogin=document.getElementById("closeLogin") ;
let closeSignup=document.getElementById("closeSignup") ;
let logout=document.getElementById("logoutBtn") ;


/* here at the time of revising code give attention to the names of the variable of the getElementBYId */


login.addEventListener("click",function(event){
    event.preventDefault()
    loginform.classList.remove("hidden") ;
    signupform.classList.add("hidden") ;
}) ;
signup.addEventListener("click",function(event){
    event.preventDefault()
    signupform.classList.remove("hidden") ;
    loginform.classList.add("hidden") ;
}) ;
closeLogin.addEventListener("click",function(){
    loginform.classList.add("hidden") ;
}) ;
closeSignup.addEventListener("click",function(){
    signupform.classList.add("hidden") ;
}) ;
logout.addEventListener("click",function(){
    loginform.classList.add("hidden")
    signupform.classList.add("hidden")
}) ;
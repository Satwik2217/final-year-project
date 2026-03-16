$(document).ready(function () {
    $(".text").textillate({
        loop: true,
        sync: true,
        in: {
            effect: "bounceIn",
        },
        out: {
            effect: "bounceOut",
        },
    });
});

const video = document.getElementById("webcam");
const cameraBtn = document.getElementById("cameraToggle");

let cameraStream = null;

async function startCamera() {
    try {

        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

        video.srcObject = cameraStream;

    } catch (error) {
        console.error("Camera permission denied", error);
    }
}

function stopCamera() {

    if (cameraStream) {

        cameraStream.getTracks().forEach(track => track.stop());

        video.srcObject = null;

        cameraStream = null;
    }

}

cameraBtn.addEventListener("click", () => {

    if (cameraStream) {
        stopCamera();
        cameraBtn.innerHTML = '<i class="bi bi-camera-video-off"></i>';
    } else {
        startCamera();
        cameraBtn.innerHTML = '<i class="bi bi-camera-video"></i>';
    }

});


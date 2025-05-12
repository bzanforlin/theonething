let media_stream; // stores microphone audio
let recording_interval; 
let user_intent = null;
let stop_processing = false; // used to stop analysis if the user says what was intended before the meeting finishes
let mic_ready = false; // checks if mic is ready before start recording audio
let user_ready = false; // checks if user input is ready before start recording audio

// creates a canvas where the growing circle is displayed
const canvas = document.getElementById("viz"); 
const ctx = canvas.getContext("2d");

// resizes canvas to match window size
resizeCanvas(); 

let start_time = Date.now();
let stop_grow = false; // used to stop the growing circle if the user says what was intended before the meeting finishes
let meeting_duration = null;
const CHECK_INTERVAL = 16; // frequency in which transcripts are obtained and sent for analysis to check if user accomplished their intent
let last_check_time = Date.now(); // used to draw the border around the window frame

// gets user input from previous pop-up, stored in local storage
chrome.storage.local.get(["userIntent", "meetingDuration"], (result) => {
  if (!result.userIntent || !result.meetingDuration) {
    return;
  }

  user_intent = result.userIntent;
  document.getElementById("intentText").textContent = user_intent; // displays user intent in the screen so they can remember it
  meeting_duration = result.meetingDuration * 60; // transforms meeting duration to seconds
  // console.log("intent, duration:", user_intent, meeting_duration);

  user_ready = true; // sets user as ready, once user input was retrieved from local storage
  tryStartSession(); // tries to start audio capture
});

document.addEventListener("DOMContentLoaded", async function () {

  // initializes recording
  try {
    media_stream = await navigator.mediaDevices.getUserMedia({ audio: true }); // asks user for mic permission
    document.getElementById("status").textContent = "Mic active";

    mic_ready = true; // sets mic ready
    tryStartSession(); // tries to start audio capture
  } catch (error) {
    document.getElementById("status").textContent = "No mic detected!";
  }
});

// recalculates circle radius everytime users changes window size
window.addEventListener("resize", resizeCanvas);

function tryStartSession() {
  if (mic_ready && user_ready) {
    drawCircle();
    startRecordingChunk(); // start immediately
    recording_interval = setInterval(startRecordingChunk, CHECK_INTERVAL * 1000);
  }
}

// prepares audio and sends to whisper
function startRecordingChunk() {
  if (stop_processing) return; // checks if still running (if user didn't say what they intended)

  last_check_time = Date.now(); // get recording cycle time to use in the calculations for displaying the border around the screen, as a "progress bar"

  const recorder = new MediaRecorder(media_stream, { mimeType: 'audio/webm' });
  const chunks = [];

  // adds available audio data to chunk
  recorder.ondataavailable = function (e) {
    chunks.push(e.data);
  };

  // when recorder stops because of timer, send to whisper to get transcript
  recorder.onstop = function () {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    analyze(blob);
  };

  recorder.start();
  setTimeout(() => recorder.stop(), CHECK_INTERVAL * 1000);
}

// sends to openai for transcript and analysis
function analyze(blob) {
  // checks if user's intent is available, as it's sent with prompt for analysis
  if (!user_intent) { 
    return;
  }

  // prepares file to send to openai for transcript
  const audioFile = new File([blob], "audio.webm", { type: "audio/webm" });
  const formData = new FormData();
  formData.append("file", audioFile);

  // route to get the transcript through backend
  fetch("https://theonething-backend.onrender.com/transcribe", {
    method: "POST",
    body: formData
  })
  .then(res => res.json())
  .then(data => {
    const transcript = data.text;
    //console.log("transcript:", transcript);

    // sends transcript and user intent to openai, with prompt, through route on the backend
    return fetch("https://theonething-backend.onrender.com/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript, intent: user_intent })
    });
  })
  .then(res => res.json())
  .then(data => {
    //console.log("openAI analysis:", data.result);

    // if 'yes', the user said their intent, so freeze the circle's growth and stop sending audio for analysis
    if (data.result === "yes") {
      stop_grow = true; 
      stop_processing = true;
    }
  })
  .catch(err => {
    //console.error("error processing:", err);
  });
}

// function that recalculates canvas if user changes window size, so circle grows accordingly
function resizeCanvas () {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

// function that calculates the circles max radius (when it takes all the screen) to then calculate the circle's growth progression
function getMaxRadius() {
  const w = canvas.width;
  const h = canvas.height;
  return Math.sqrt(w * w + h * h) / 2;
}

// function that draws the growing circle on the canvas
function drawCircle() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const elapsed = (Date.now() - start_time) / 1000; // gets the time elapsed since meeting started
  const progress = Math.min(elapsed / meeting_duration, 1); // gets % of meeting duration that has progressed
  const maxRadius = getMaxRadius();
  const radius = progress * maxRadius; // sets circle radius proportionally to meeting time progress

  // if user said their intent, stop_grow is true, and we show a new message and color on the screen, before the meeting ends
  if (stop_grow) {
    ctx.fillStyle = "#d1ffbd"; 
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    document.getElementById("centerText").textContent = "And you did it!";
    document.getElementById("intentLabel").textContent = "You wanted to say:";
    return;
  }

  // if time is over, and stop_grow is false the user didn't say their intent, and we show a message and color on the screen
  if (elapsed >= meeting_duration) {
    if (!stop_grow) {
      ctx.fillStyle = "#f88378";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      document.getElementById("centerText").textContent = "It's OK, you can try again next time.";
      document.getElementById("intentLabel").textContent = "You didn't say:";
    }

    return;
  }

  // draws circle
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, radius, 0, 2 * Math.PI);
  ctx.fillStyle = "#f88378";
  ctx.fill();

  // draw animated border
  drawBorderProgress();

  requestAnimationFrame(drawCircle);
}

// draws the animated border, as a progress bar, to indicate the frequency of processing
function drawBorderProgress() {
  const now = Date.now();
  const elapsed = (now - last_check_time) / 1000; 
  let progress = Math.min(elapsed / CHECK_INTERVAL, 1); 

  const w = canvas.width;
  const h = canvas.height;
  const perimeter = 2 * (w + h);
  let drawLength;

  if (progress >= 1) {
    progress = 1;
    drawLength = perimeter;
    last_check_time = now; 
  } else {
    drawLength = progress * perimeter; // calculates draw length proportionally to the interval's progressed time
  }

  ctx.strokeStyle = "#89cff0"; 
  ctx.lineWidth = 10;
  ctx.beginPath();

  // computes how much of this has been drawn clockwise starting from the top left and continues drawing as needed
  let remaining = drawLength;

  // top
  const topLen = w;
  if (remaining <= topLen) {
    ctx.moveTo(0, 0);
    ctx.lineTo(remaining, 0);
    ctx.stroke();
    return;
  }
  ctx.moveTo(0, 0);
  ctx.lineTo(w, 0);
  remaining -= topLen;

  // right
  const rightLen = h;
  if (remaining <= rightLen) {
    ctx.lineTo(w, remaining);
    ctx.stroke();
    return;
  }
  ctx.lineTo(w, h);
  remaining -= rightLen;

  // bottom
  const bottomLen = w;
  if (remaining <= bottomLen) {
    ctx.lineTo(w - remaining, h);
    ctx.stroke();
    return;
  }
  ctx.lineTo(0, h);
  remaining -= bottomLen;

  // left
  const leftLen = h;
  if (remaining <= leftLen) {
    ctx.lineTo(0, h - remaining);
  } else {
    ctx.lineTo(0, 0);
  }

  ctx.stroke();
}
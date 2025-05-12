document.addEventListener("DOMContentLoaded", function () {
    const goButton = document.getElementById("go");
    const intentInput = document.getElementById("intent");
    const durationInput = document.getElementById("duration");

    // only lets user proceed if they input both their intent and meeting duration
    goButton.disabled = true;

    function validateInputs() {
        const intent = intentInput.value.trim();
        const duration = parseFloat(durationInput.value);
        const isValid = intent.length > 0 && !isNaN(duration) && duration > 0;

        goButton.disabled = !isValid;
    }

    intentInput.addEventListener("input", validateInputs); // listen to user intent field if user updated value
    durationInput.addEventListener("input", validateInputs); // listen to meeting duration field if user updated value

    // when inputs are valid and user clicks "Go", save data to local storage and open a new window
    goButton.addEventListener("click", function () {
        const intent = intentInput.value.trim();
        const duration = parseFloat(durationInput.value);

        // saves user intent and meeting duration to local storage so they can be accessed by the other window
        chrome.storage.local.set({ userIntent: intent, meetingDuration: duration }, () => { 
            // console.log("user intent saved:", intent);
            // console.log("meeting duration saved:", duration);
            
            // opens new window
            chrome.windows.create({ 
                url: 'monitor.html',
                type: 'popup',
                width: 250,
                height: 250,
                top: 50,
                left: 1200
            });
        });
    });
});
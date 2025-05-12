### Overview
The One Thing is a Chrome extension that helps users say what matters the most to them in a meeting, showing them a circle that gradually grows as time passes—representing the time they have left to speak up. This visual acts as a gentle countdown and a form of accountability, reminding the user that their opportunity to say what matters is slipping away. The tool continuously listens to the user's voice and, using OpenAI's models, transcribes what is being said and analyzes whether the stated intention has been clearly expressed during the meeting.

**General flow:**
1. The user enters: a) what they want to make sure they say during the meeting, and b) how long the meeting is expected to last.
2. The tool records their voice during the meeting with microphone access.
3. At every pre-defined interval, the tool sends the recorded audio to OpenAI for transcription and analysis, which returns a response of either ‘yes’ or ‘no’ to indicate whether the user has said what they intended to.
4. A growing circle shows time progression.
5. An animated border around the window visually represents the audio processing interval, letting users know that the system is actively listening and evaluating their speech at regular moments.
6. If the user says their "one thing," the screen turns green. If time runs out before they do, it turns red.

### File Structure
.env → stores the OpenAI API key
app.py → Python backend using Flask, with two routes connecting to OpenAI: one for transcription, another for analysis
manifest.json → Chrome extension configuration file
one.html / one.css / one.js → Frontend files for the initial setup popup shown when the extension is clicked
monitor.html / monitor.css / monitor.js → Frontend files for the secondary window that handles audio recording, backend communication, and visual feedback during the meeting

### 1. User Input
The Chrome Extension pop-up asks for two inputs: what the user wants to say in the meeting and how long the meeting will last.
- The system validates the input (ensuring both fields are completed and valid).
- It stores the data using chrome.storage.local, allowing the second screen (the visual monitor) to access it despite being in a separate window.
- Then it opens a new window called monitor.html — this is the screen that will track the user's progress.
- A new window is necessary because Chrome extensions are not allowed to record audio continuously from pop-ups. These pop-ups are considered unstable because they close automatically when the user clicks outside of them.

### 2. Microphone & Session Start
When the monitor window loads:
- It retrieves the user’s input (intent and duration) from local storage.
- It requests access to the microphone.
- When both are ready, audio recording begins, along with the other processes described below.

### 3.1. **Transcription + Analysis**
Every CHECK_INTERVAL (a constant variable) seconds, a new chunk of microphone audio is:
1. Recorded
2. Sent to the backend (app.py), where it is:
    - Transcribed using OpenAI Whisper
    - Analyzed using GPT to check if the user said their intent
        - Endpoints:
            - /transcribe: receives audio and returns text
            - /analyze: receives text and intent, returns "yes" or "no"
3. If the GPT response is "yes," the system:
    - Stops recording and analyzing
    - Freezes the growing visuals
    - Shows a success message on screen
4. If the GPT response is "no," the system continues running until the elapsed time exceeds the meeting duration entered by the user.

### 3.2. Circle Growth
The circle in the middle of the screen grows slowly from the center. The growth rate is calculated so that it fills the full screen when the elapsed time matches the user's input meeting duration.
At each interval, the circle's radius is recalculated in proportion to the time passed. Functions:
- drawCircle(): handles animation and text updates
- getMaxRadius(): calculates the final radius needed to fill the screen
- resizeCanvas(): ensures the visuals adapt to window size changes

### 3.3. Border animation
Since the system only analyzes audio at set intervals, the user might say their intent mid-interval, but the program will only detect it once the interval ends, creating the impression that it's not listening. The animated border that wraps around the screen acts like a progress bar and reassures the user that the system is actively listening and processing.
- last_check_time is updated every time a new audio recording starts.
- drawBorderProgress() calculates how much of the border to draw, based on how far into the interval we are.
- The border draws clockwise around the screen in segments (top → right → bottom → left).

### 4. Stopping the session
The sessi
1. **The user says their intent:**
- OpenAI responds “yes”
- stop_processing becomes true
- No more audio is recorded
- The circle stops growing
- Screen turns green with “You did it!”
1. **Time runs out before they say it:**
- The meeting time is reached
- If stop_grow is still false:
    - Screen turns red
    - The message says “It’s OK, try again next time”
let video;
let handPose;
let hands = [];
let painting;
let px = 0;
let py = 0;
let sw = 8;
let colors = [];
let selectedColor;
let scanX = 0;
let scanSpeed = 2;
let synth;
let prevTriggerY = {};
let osc;
let env;
let classifier;
let label = "";
let soundClassifier;
let isScanning = true;
let lastCommandTime = 0;
let cooldown = 1000;

function preload() {
  handPose = ml5.handPose({ flipped: true });
  classifier = ml5.imageClassifier("MobileNet");
  soundClassifier = ml5.soundClassifier("SpeechCommands18w", modelReady);
}

function modelReady() {
  console.log("SpeechCommands model ready.");
  soundClassifier.classifyStart(gotResult);
}

function gotResult(results) {
  let now = millis();
  if (now - lastCommandTime < cooldown) {
    return};

  lastCommandTime = now;

  label = results[0].label.toLowerCase();
  console.log(results);

  if (label === "stop") {
    isScanning = false;
    console.log("Scanning stopped");
  } else if (label === "go") {
    isScanning = true;
    console.log("Scanning resumed");
  }
}

function mousePressed() {
  console.log(hands);
}

function gotHands(results) {
  hands = results;
}

function setup() {
  createCanvas(640, 480);
  userStartAudio();
  colorMode(HSB);

  painting = createGraphics(640, 480);
  painting.colorMode(HSB);
  painting.clear();

  colors = [
    color(197, 82, 95),  // Index finger (stroke)
    color(283, 69, 63),  // Middle finger (purple)
    color(344, 100, 93), // Ring finger (red)
    color(32, 68, 97)    // Pinky finger (orange)
  ];
  selectedColor = colors[1]; // Start with middle finger color

  video = createCapture(VIDEO, { flipped: true });
  video.hide();

  classifier.classifyStart(video, gotResults);

  handPose.detectStart(video, gotHands);

  synth = new p5.MonoSynth();

  osc = new p5.Oscillator();
  env = new p5.Envelope();
  env.setADSR(0.01, 0.1, 0.1, 0.2);
  env.setRange(0.5, 0);

  osc.start();
  osc.amp(0);  // Silence until triggered
}

function gotResults(results) {
  console.log(results[0]);
  label = `${results[0].label} (${(results[0].confidence * 100).toFixed(1)}%)`;
}

function draw() {
  image(video, 0, 0);

  // Display label from image classifier
  fill(255);
  textSize(32);
  text(label, 20, 50);

  // Hand detection and drawing logic
  if (hands.length > 0) {
    let rightHand, leftHand;

    for (let hand of hands) {
      if (hand.handedness === "Right") {
        let index = hand.index_finger_tip;
        let thumb = hand.thumb_tip;
        rightHand = { index, thumb };
      }

      if (hand.handedness === "Left") {
        let thumb = hand.thumb_tip;
        let index = hand.index_finger_tip;
        let middle = hand.middle_finger_tip;
        let ring = hand.ring_finger_tip;
        let pinky = hand.pinky_finger_tip;
        let fingers = [index, middle, ring, pinky];

        let dIndex = dist(index.x, index.y, thumb.x, thumb.y);
        sw = dIndex;
        let x = (index.x + thumb.x) * 0.5;
        let y = (index.y + thumb.y) * 0.5;
        fill(255, 0, 255);
        noStroke();
        circle(x, y, sw);

        for (let i = 1; i < fingers.length; i++) {
          let finger = fingers[i];
          let d = dist(finger.x, finger.y, thumb.x, thumb.y);
          if (d < 30) {
            fill(colors[i]);
            noStroke();
            circle(finger.x, finger.y, 36);
            selectedColor = colors[i];
          }
        }
      }
    }

    if (rightHand) {
      let { index, thumb } = rightHand;
      let x = (index.x + thumb.x) * 0.5;
      let y = (index.y + thumb.y) * 0.5;

      let d = dist(index.x, index.y, thumb.x, thumb.y);
      if (d < 20) {
        painting.stroke(selectedColor);
        painting.strokeWeight(sw * 0.5);
        painting.line(px, py, x, y);
      }

      px = x;
      py = y;
    }
  }

  // Draw the semi-transparent painting layer
  tint(255, 127);
  image(painting, 0, 0);
  noTint();

  // Only run this part if scanning is active ===
  if (isScanning) {
    stroke(0, 0, 100);
    strokeWeight(2);
    line(scanX, 0, scanX, height);

    let playedNote = false;

    for (let y = 0; y < height; y += 8) {
      let c = painting.get(scanX, y);
      if (alpha(c) > 0 && !playedNote) {
        let h = hue(c);
        let pitch = map(y, 0, height, 1000, 200);

        let waveform;

        if (h > 120 && h < 130) {
          waveform = "square"; // purple
        } else if ((h >= 330 && h <= 360) || (h >= 0 && h <= 20)) {
          waveform = "triangle"; // red
        } else if (h > 245) {
          waveform = "sine"; // orange
        }

        if (waveform && (!prevTriggerY[y] || abs(scanX - prevTriggerY[y]) > 20)) {
          osc.setType(waveform);
          osc.freq(pitch);
          env.play(osc);
          prevTriggerY[y] = scanX;
          playedNote = true;
        }
      }
    }

    scanX += scanSpeed;
    if (scanX > width) {
      scanX = 0;
      prevTriggerY = {};
    }
  }

  fill(isScanning ? "green" : "red");
  noStroke();
  textSize(16);
  text(`Audio: ${isScanning ? "ON (say 'stop')" : "OFF (say 'go')"}`, 10, height - 40);
}

function keyPressed() {
  if (key === "e" || key === "E") {
    painting.clear();
  }
}

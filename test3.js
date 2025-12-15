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
let imageLabel = "";
let soundLabel = "";
let soundClassifier;
let isScanning = true;
let lastCommandTime = 0;
let cooldown = 1000;
let defaultColors;
let altColors;

function preload() {
  handPose = ml5.handPose({ flipped: true });
  classifier = ml5.imageClassifier("MobileNet");
  soundClassifier = ml5.soundClassifier("SpeechCommands18w", modelReady);
}

function modelReady() {
  console.log("SpeechCommands model ready.");
  soundClassifier.classifyStart(gotResultVoice);
}

function gotResultVoice(results) {
  let now = millis();
  if (now - lastCommandTime < cooldown) {
    return};

  lastCommandTime = now;

  soundLabel = results[0].label.toLowerCase();
  console.log(results);

  if (soundLabel === "stop") {
    isScanning = false;
    console.log("Scanning stopped");
  } else if (soundLabel === "go") {
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
  const w = 1152;
  const h = 864;

  createCanvas(w, h);
  userStartAudio();
  colorMode(HSB);

  painting = createGraphics(w, h);
  painting.colorMode(HSB);
  painting.clear();

  defaultColors = [
    color(197, 82, 95),  // Index finger (stroke)
    color(283, 69, 63),  // Middle finger (purple)
    color(344, 100, 93), // Ring finger (red)
    color(32, 68, 97)    // Pinky finger (orange)
  ];

  altColors = [
    color(197, 82, 95),
    color(220, 80, 90),  // Blue
    color(60, 80, 90),   // Yellow
    color(140, 80, 90)   // Green
  ]

  altColors2 = [
    color(197, 82, 95), // default white
    color(197, 82, 95), // default white
    color(0, 0, 0),      // black 
    color(128)
  ]

  colors = defaultColors;

  video = createCapture(VIDEO, () => {
    video.size(w, h);
  });

  //vide = createCapture(VIDEO, {flipped = true})
  video.hide();

  classifier.classifyStart(video, gotResultsItem);

  handPose.detectStart(video, gotHands);

  synth = new p5.MonoSynth();

  osc = new p5.Oscillator();
  env = new p5.Envelope();
  env.setADSR(0.01, 0.1, 0.1, 0.2);
  env.setRange(0.5, 0);

  osc.start();
  osc.amp(0);  // Silence until triggered
}

function gotResultsItem(results) {
  if (!results || results.length === 0) return;

  let result = results[0]; // ← Top prediction
  let confidence = result.confidence;
  let item = result.label.toLowerCase();

  imageLabel = `${result.label} (${(confidence * 100).toFixed(1)}%)`;
  console.log("Image result:", imageLabel);

  if (confidence > 0.80 && item.includes("paper towel")) {
    colors = altColors;
    console.log("Switched to alternate palette (blue, yellow, green)");
  } else if (confidence > 0.60 && item.includes("power drill")) {
    colors = altColors2;
    console.log("white, grey and black colors");
  } else {
    colors = defaultColors;
  }
}

function classifyVideo() {
  classifier.classify(video, (err, results) => {
    if (err) {
      console.error(err);
      return;
    }
    gotResultsItem(results);
    classifyVideo(); // loop again
  });
}

function draw() {
  push();
  translate(width, 0);
  scale(-1, 1);
  image(video, 0, 0, width, height);
  pop();
  

  // Display label from image classifier
  fill(0);
  textSize(32);
  text(imageLabel, 20, 50);

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

        for (let i = 1; i < min(fingers.length, colors.length); i++) {
            let finger = fingers[i];
            let d = dist(finger.x, finger.y, thumb.x, thumb.y);
            if (d < 30 && colors[i]) {
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
      if (d < 30) {
        painting.stroke(selectedColor);
        painting.strokeWeight(sw * 0.5);

        let steps = int(dist(px, py, x, y) / 2); // More steps = smoother
        for (let i = 0; i < steps; i++) {
          let t = i / steps;
          let ix = lerp(px, x, t);
          let iy = lerp(py, y, t);
          let jx = lerp(px, x, t + 1 / steps);
          let jy = lerp(py, y, t + 1 / steps);
          painting.line(ix, iy, jx, jy);
        }
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

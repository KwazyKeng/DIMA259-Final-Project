let video;
let handPose;
let hands = [];
let painting;
let px = 0;
let py = 0;
let sw = 8;
let colors = [];
let selectedColor;

function preload() {
  handPose = ml5.handPose({ flipped: true });
}

function mousePressed() {
  console.log(hands);
}

function gotHands(results) {
  hands = results;
}

function setup() {
  createCanvas(640, 480);
  colorMode(HSB);

  painting = createGraphics(640, 480);
  painting.colorMode(HSB);
  painting.clear();

  colors = [
    color(197, 82, 95),  // Index finger (stroke))
    color(283, 69, 63),  // Middle finger
    color(344, 100, 93), // Ring finger
    color(32, 68, 97)    // Pinky finger
  ];
  selectedColor = colors[1]; // Start with middle finger color

  video = createCapture(VIDEO, { flipped: true });
  video.hide();

  handPose.detectStart(video, gotHands);
}

function draw() {
  image(video, 0, 0);

  if (hands.length > 0) {
    let rightHand, leftHand;

    // Separate detected hands into left and right
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

        // Use index–thumb distance for stroke width
        let dIndex = dist(index.x, index.y, thumb.x, thumb.y);
        sw = dIndex;
        let x = (index.x + thumb.x) * 0.5;
        let y = (index.y + thumb.y) * 0.5;
        fill(255, 0, 255);
        noStroke();
        circle(x, y, sw);

        // Check other fingers for color selection
        for (let i = 1; i < fingers.length; i++) { // Skip index (i = 0)
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

    // Draw with right-hand pinch
    if (rightHand) {
      let { index, thumb } = rightHand;
      let x = (index.x + thumb.x) * 0.5;
      let y = (index.y + thumb.y) * 0.5;

      let d = dist(index.x, index.y, thumb.x, thumb.y);
      if (d < 20) {
        painting.stroke(selectedColor);
        painting.strokeWeight(sw * 0.5); // Scaled stroke width
        painting.line(px, py, x, y);
      }

      px = x;
      py = y;
    }
  }

  // Overlay painting on top of the video
  image(painting, 0, 0);
}

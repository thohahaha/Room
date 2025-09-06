// Hand Tracking Controls Component
AFRAME.registerComponent('ar-hand-tracking-controls', {
  schema: {
    hand: { type: 'string', default: 'left' }, // 'left' or 'right'
    model: { type: 'string', default: '' },
    smoothing: { type: 'number', default: 0.8 },
    scale: { type: 'number', default: 1 }
  },

  init: function () {
    this.handLandmarks = null;
    this.smoothedPosition = new THREE.Vector3();
    this.smoothedRotation = new THREE.Euler();
    this.previousPosition = new THREE.Vector3();
    this.previousRotation = new THREE.Euler();
    this.modelLoaded = false;
    
    console.log(`🖐️ Hand tracking initialized for ${this.data.hand} hand`);
    
    // Load hand model or create fallback
    if (this.data.model) {
      this.loadHandModel();
    } else {
      this.createFallbackHand();
    }
  },

  createFallbackHand: function () {
    console.log(`Creating fallback hand for ${this.data.hand}`);
    
    // Create a simple hand shape using basic geometry
    const handColor = this.data.hand === 'left' ? '#00FF00' : '#FF0000';
    
    // Create hand container
    const handContainer = document.createElement('a-entity');
    
    // Palm
    const palm = document.createElement('a-box');
    palm.setAttribute('width', '0.8');
    palm.setAttribute('height', '0.1');
    palm.setAttribute('depth', '1.2');
    palm.setAttribute('color', handColor);
    palm.setAttribute('position', '0 0 0');
    handContainer.appendChild(palm);
    
    // Fingers (simplified)
    for (let i = 0; i < 5; i++) {
      const finger = document.createElement('a-cylinder');
      finger.setAttribute('radius', '0.08');
      finger.setAttribute('height', '0.6');
      finger.setAttribute('color', handColor);
      finger.setAttribute('position', `${(i - 2) * 0.15} 0.05 0.5`);
      finger.setAttribute('rotation', '90 0 0');
      handContainer.appendChild(finger);
    }
    
    // Add to element
    this.el.appendChild(handContainer);
    this.el.setAttribute('scale', `${this.data.scale} ${this.data.scale} ${this.data.scale}`);
    
    this.modelLoaded = true;
    console.log(`✅ Fallback hand created for ${this.data.hand}`);
  },

  loadHandModel: function () {
    console.log(`🔄 Loading hand model for ${this.data.hand} hand: ${this.data.model}`);
    
    // First try using A-Frame's built-in GLTF loader
    this.el.setAttribute('gltf-model', this.data.model);
    this.el.setAttribute('scale', `${this.data.scale} ${this.data.scale} ${this.data.scale}`);
    
    // Set a timeout for loading
    const loadTimeout = setTimeout(() => {
      console.warn(`⏰ Model loading timeout for ${this.data.hand} hand, creating fallback`);
      if (!this.modelLoaded) {
        this.createFallbackHand();
      }
    }, 5000);
    
    // Listen for model load events
    this.el.addEventListener('model-loaded', () => {
      clearTimeout(loadTimeout);
      this.modelLoaded = true;
      console.log(`✅ ${this.data.hand} hand model loaded successfully via A-Frame`);
    });
    
    this.el.addEventListener('model-error', (event) => {
      clearTimeout(loadTimeout);
      console.error(`❌ ${this.data.hand} hand model failed to load via A-Frame:`, event);
      
      // Create fallback instead of trying THREE.js
      this.createFallbackHand();
    });
  },

  updateFromLandmarks: function (landmarks) {
    if (!landmarks || landmarks.length === 0) {
      this.el.setAttribute('visible', false);
      return;
    }

    this.el.setAttribute('visible', true);
    this.handLandmarks = landmarks;

    // Calculate hand position from wrist landmark (index 0)
    const wrist = landmarks[0];
    
    // Convert normalized coordinates to world coordinates
    const position = this.normalizedToWorld(wrist);
    
    // Smooth the movement
    this.smoothedPosition.lerp(position, 1 - this.data.smoothing);
    
    // Update position relative to camera
    const camera = document.querySelector('[camera]');
    if (camera) {
      const cameraPosition = camera.object3D.position;
      const relativePosition = this.smoothedPosition.clone();
      
      // Position hand relative to camera view
      relativePosition.add(cameraPosition);
      this.el.object3D.position.copy(relativePosition);
    } else {
      this.el.object3D.position.copy(this.smoothedPosition);
    }
    
    // Calculate and apply rotation
    const rotation = this.calculateHandRotation(landmarks);
    if (rotation) {
      this.el.object3D.rotation.copy(rotation);
    }
    
    console.log(`${this.data.hand} hand updated: position(${this.smoothedPosition.x.toFixed(2)}, ${this.smoothedPosition.y.toFixed(2)}, ${this.smoothedPosition.z.toFixed(2)})`);
  },

  normalizedToWorld: function (landmark) {
    // Convert MediaPipe normalized coordinates to A-Frame world coordinates
    // MediaPipe: x=[0,1], y=[0,1], z=depth (negative values closer)
    // A-Frame: x=[-2,2], y=[0,3], z=[-2,2]
    
    // Flip X coordinate for mirror effect and scale
    const x = (0.5 - landmark.x) * 3; // Mirror and scale: -1.5 to 1.5
    const y = (1 - landmark.y) * 2;   // Flip Y and scale: 0 to 2
    const z = -0.5 + (landmark.z || 0) * -1; // Move forward and add depth
    
    return new THREE.Vector3(x, y, z);
  },

  calculateHandRotation: function (landmarks) {
    // Calculate hand orientation using multiple landmarks
    const wrist = landmarks[0];
    const middleFinger = landmarks[9];
    const indexFinger = landmarks[5];
    
    const wristPos = this.normalizedToWorld(wrist);
    const middlePos = this.normalizedToWorld(middleFinger);
    const indexPos = this.normalizedToWorld(indexFinger);
    
    // Calculate forward direction (wrist to middle finger)
    const forward = middlePos.clone().sub(wristPos).normalize();
    
    // Calculate right direction (wrist to index finger)
    const right = indexPos.clone().sub(wristPos).normalize();
    
    // Calculate up direction (cross product)
    const up = forward.clone().cross(right).normalize();
    
    // Create rotation from directions
    const rotation = new THREE.Euler();
    rotation.setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward));
    
    return rotation;
  },

  tick: function (time, timeDelta) {
    // Any continuous updates can go here
  }
});

// Hand Tracking System Component
AFRAME.registerComponent('ar-hand-tracking-system', {
  schema: {
    enabled: { type: 'boolean', default: false },
    debug: { type: 'boolean', default: false }
  },

  init: function () {
    this.hands = null;
    this.camera = null;
    this.isActive = false;
    this.videoElement = null;
    this.canvasElement = null;
    this.lastLeftDetection = 0;
    this.lastRightDetection = 0;
    
    // Bind methods
    this.onResults = this.onResults.bind(this);
    
    console.log('Hand tracking system initialized');
  },

  update: function () {
    if (this.data.enabled && !this.isActive) {
      this.startHandTracking();
    } else if (!this.data.enabled && this.isActive) {
      this.stopHandTracking();
    }
  },

  startHandTracking: function () {
    console.log('Starting MediaPipe hand tracking...');
    
    this.videoElement = document.getElementById('input_video');
    this.canvasElement = document.getElementById('output_canvas');
    
    if (!this.videoElement || !this.canvasElement) {
      console.error('Video or canvas element not found');
      return;
    }

    // Check if MediaPipe is available
    if (typeof Hands === 'undefined') {
      console.error('MediaPipe Hands not loaded');
      this.startSimpleHandTracking();
      return;
    }

    try {
      // Initialize MediaPipe Hands
      this.hands = new Hands({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
        }
      });

      this.hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      this.hands.onResults(this.onResults);

      // Initialize camera if Camera class is available
      if (typeof Camera !== 'undefined') {
        this.camera = new Camera(this.videoElement, {
          onFrame: async () => {
            if (this.hands && this.videoElement && this.videoElement.readyState >= 2) {
              await this.hands.send({ image: this.videoElement });
            }
          },
          width: 640,
          height: 480
        });

        this.camera.start();
      } else {
        // Fallback: process video frames manually
        this.processVideoFrames();
      }

      this.isActive = true;
      
      // Show tracking indicator
      const indicator = document.getElementById('tracking-indicator');
      if (indicator) indicator.style.display = 'block';
      
      console.log('Hand tracking started successfully');
    } catch (error) {
      console.error('Error starting MediaPipe hand tracking:', error);
      this.startSimpleHandTracking();
    }
  },

  processVideoFrames: function () {
    if (!this.isActive || !this.hands || !this.videoElement) return;
    
    if (this.videoElement.readyState >= 2) {
      this.hands.send({ image: this.videoElement }).catch(console.error);
    }
    
    requestAnimationFrame(() => this.processVideoFrames());
  },

  startSimpleHandTracking: function () {
    console.log('Starting simple hand tracking fallback...');
    console.log('MediaPipe not available - using simple animation mode');
    
    // Simple fallback animation
    const leftHand = document.getElementById('leftHandTracking');
    const rightHand = document.getElementById('rightHandTracking');
    
    if (leftHand && rightHand) {
      leftHand.setAttribute('visible', true);
      rightHand.setAttribute('visible', true);
      
      console.log('Hand models set to visible, starting animation...');
      this.animateSimpleHands();
      this.isActive = true;
      
      // Show tracking indicator
      const indicator = document.getElementById('tracking-indicator');
      if (indicator) {
        indicator.style.display = 'block';
        indicator.innerHTML = '<div>🎯 Simple Hand Animation Active</div><div style="font-size: 10px;">MediaPipe not loaded - showing demo animation</div>';
      }
    } else {
      console.error('Hand tracking elements not found:', { leftHand, rightHand });
    }
  },

  animateSimpleHands: function () {
    if (!this.isActive) return;
    
    const time = Date.now() * 0.002;
    const leftHand = document.getElementById('leftHandTracking');
    const rightHand = document.getElementById('rightHandTracking');
    
    if (leftHand && rightHand) {
      // More dynamic animation
      const leftX = -0.5 + Math.sin(time) * 0.3;
      const leftY = 1.2 + Math.cos(time * 1.5) * 0.2;
      const leftZ = -0.5 + Math.sin(time * 0.8) * 0.2;
      
      const rightX = 0.5 + Math.sin(time + Math.PI) * 0.3;
      const rightY = 1.2 + Math.cos(time * 1.5 + Math.PI) * 0.2;
      const rightZ = -0.5 + Math.sin(time * 0.8 + Math.PI) * 0.2;
      
      // Apply positions
      leftHand.setAttribute('position', `${leftX} ${leftY} ${leftZ}`);
      rightHand.setAttribute('position', `${rightX} ${rightY} ${rightZ}`);
      
      // Add rotation for more realistic movement
      const leftRotY = Math.sin(time * 0.7) * 30;
      const rightRotY = Math.sin(time * 0.7 + Math.PI) * 30;
      
      leftHand.setAttribute('rotation', `0 ${leftRotY} 0`);
      rightHand.setAttribute('rotation', `0 ${rightRotY} 0`);
      
      // Update status
      this.updateHandStatus('left', true);
      this.updateHandStatus('right', true);
      
      console.log(`Animation frame: Left(${leftX.toFixed(2)}, ${leftY.toFixed(2)}, ${leftZ.toFixed(2)}) Right(${rightX.toFixed(2)}, ${rightY.toFixed(2)}, ${rightZ.toFixed(2)})`);
    }
    
    setTimeout(() => this.animateSimpleHands(), 50);
  },

  stopHandTracking: function () {
    console.log('Stopping hand tracking...');
    
    this.isActive = false;
    
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    
    if (this.hands) {
      this.hands.close();
      this.hands = null;
    }
    
    // Hide tracking indicator
    const indicator = document.getElementById('tracking-indicator');
    if (indicator) indicator.style.display = 'none';
    
    console.log('Hand tracking stopped');
  },

  onResults: function (results) {
    if (!this.canvasElement || !this.isActive) return;
    
    const canvasCtx = this.canvasElement.getContext('2d');
    
    // Clear and draw current frame
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, this.canvasElement.width, this.canvasElement.height);
    
    if (results.image) {
      canvasCtx.drawImage(results.image, 0, 0, this.canvasElement.width, this.canvasElement.height);
    }

    // Find hand tracking components
    const leftHandEl = document.getElementById('leftHandTracking');
    const rightHandEl = document.getElementById('rightHandTracking');
    
    let leftDetected = false;
    let rightDetected = false;

    if (results.multiHandLandmarks && results.multiHandedness) {
      for (let i = 0; i < results.multiHandLandmarks.length; i++) {
        const landmarks = results.multiHandLandmarks[i];
        const handedness = results.multiHandedness[i];
        const isLeft = handedness.label === 'Left';
        
        // Draw landmarks on canvas if debug mode
        if (this.data.debug && typeof drawConnectors !== 'undefined' && typeof drawLandmarks !== 'undefined') {
          try {
            drawConnectors(canvasCtx, landmarks, HAND_CONNECTIONS, { color: '#00FF00', lineWidth: 5 });
            drawLandmarks(canvasCtx, landmarks, { color: '#FF0000', lineWidth: 2 });
          } catch (e) {
            console.warn('Error drawing hand landmarks:', e);
          }
        }
        
        // Update appropriate hand component
        if (isLeft && leftHandEl) {
          const handTracking = leftHandEl.components['ar-hand-tracking-controls'];
          if (handTracking) {
            handTracking.updateFromLandmarks(landmarks);
            leftDetected = true;
            this.lastLeftDetection = Date.now();
          }
        } else if (!isLeft && rightHandEl) {
          const handTracking = rightHandEl.components['ar-hand-tracking-controls'];
          if (handTracking) {
            handTracking.updateFromLandmarks(landmarks);
            rightDetected = true;
            this.lastRightDetection = Date.now();
          }
        }
      }
    }
    
    // Hide hands if not detected for a while
    const now = Date.now();
    if (!leftDetected && now - this.lastLeftDetection > 500) {
      if (leftHandEl) leftHandEl.setAttribute('visible', false);
    }
    if (!rightDetected && now - this.lastRightDetection > 500) {
      if (rightHandEl) rightHandEl.setAttribute('visible', false);
    }
    
    // Update status indicators
    this.updateHandStatus('left', leftDetected);
    this.updateHandStatus('right', rightDetected);
    
    canvasCtx.restore();
  },

  updateHandStatus: function (hand, detected) {
    const statusEl = document.getElementById(`${hand}-hand-status`);
    if (statusEl) {
      const emoji = hand === 'left' ? '👈' : '👉';
      const status = detected ? 'Detected ✓' : 'Not detected';
      statusEl.textContent = `${emoji} ${hand.charAt(0).toUpperCase() + hand.slice(1)}: ${status}`;
      statusEl.style.color = detected ? '#4CAF50' : '#f44336';
    }
  },

  remove: function () {
    this.stopHandTracking();
  }
});

// Utility functions for gesture recognition
const HandGestures = {
  // Detect if hand is making a fist
  isFist: function (landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    
    // Check if fingertips are below their respective MCP joints
    const fingerTips = [4, 8, 12, 16, 20]; // Thumb, Index, Middle, Ring, Pinky tips
    const fingerMCPs = [3, 5, 9, 13, 17]; // Corresponding MCP joints
    
    let closedFingers = 0;
    for (let i = 0; i < fingerTips.length; i++) {
      if (landmarks[fingerTips[i]].y > landmarks[fingerMCPs[i]].y) {
        closedFingers++;
      }
    }
    
    return closedFingers >= 4; // At least 4 fingers closed
  },

  // Detect pointing gesture
  isPointing: function (landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    
    // Index finger extended, others closed
    const indexTip = landmarks[8];
    const indexMCP = landmarks[5];
    const middleTip = landmarks[12];
    const middleMCP = landmarks[9];
    
    const indexExtended = indexTip.y < indexMCP.y;
    const middleClosed = middleTip.y > middleMCP.y;
    
    return indexExtended && middleClosed;
  },

  // Detect open palm
  isOpenPalm: function (landmarks) {
    if (!landmarks || landmarks.length < 21) return false;
    
    const fingerTips = [4, 8, 12, 16, 20];
    const fingerMCPs = [3, 5, 9, 13, 17];
    
    let extendedFingers = 0;
    for (let i = 0; i < fingerTips.length; i++) {
      if (landmarks[fingerTips[i]].y < landmarks[fingerMCPs[i]].y) {
        extendedFingers++;
      }
    }
    
    return extendedFingers >= 4; // At least 4 fingers extended
  }
};

console.log('Hand tracking controls loaded successfully');

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { config } from './config.js';

// Basic Scene Setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x222222);
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);
const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(5, 10, 7.5);
scene.add(directionalLight);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
controls.dampingFactor = 0.05;
controls.screenSpacePanning = false;
controls.minDistance = 1;
controls.maxDistance = 50;
controls.maxPolarAngle = Math.PI / 2;

// Floor
const floorGeometry = new THREE.PlaneGeometry(50, 50);
const floorMaterial = new THREE.MeshStandardMaterial({ color: 0x888888, side: THREE.DoubleSide });
const floor = new THREE.Mesh(floorGeometry, floorMaterial);
floor.rotation.x = -Math.PI / 2; // Rotate floor to be horizontal
scene.add(floor);

// Central Cube (Example Object)
const geometry = new THREE.BoxGeometry(1, 1, 1);
const material = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Use MeshStandardMaterial for lighting
const cube = new THREE.Mesh(geometry, material);
cube.position.y = 0.5; // Place cube on top of the floor
scene.add(cube);

camera.position.set(5, 5, 5); // Adjusted initial camera position
controls.update(); // Required after camera position change

// Multiplayer Setup
const room = new WebsimSocket();
const players = {}; // Store player meshes: { clientId: mesh }
const playerListElement = document.getElementById('player-list');

function updatePlayerList() {
  playerListElement.innerHTML = ''; // Clear existing list
  if (!room.peers) return; // Guard against peers not being ready

  const sortedPeers = Object.entries(room.peers).sort(([,a], [,b]) => a.username.localeCompare(b.username));

  for (const [clientId, peer] of sortedPeers) {
    const playerDiv = document.createElement('div');
    playerDiv.classList.add('player-item');
    if (clientId === room.clientId) {
      playerDiv.classList.add('self');
    }

    const avatarImg = document.createElement('img');
    avatarImg.src = peer.avatarUrl;
    avatarImg.alt = `${peer.username}'s avatar`;
    avatarImg.classList.add('player-avatar');
    avatarImg.onerror = () => { avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(peer.username)}&background=random&size=32`; }; // Fallback avatar

    const usernameSpan = document.createElement('span');
    usernameSpan.textContent = peer.username;
    if (clientId === room.clientId) {
        usernameSpan.textContent += ' (You)';
    }

    playerDiv.appendChild(avatarImg);
    playerDiv.appendChild(usernameSpan);
    playerListElement.appendChild(playerDiv);
  }
}

function createPlayerMesh(clientId) {
    const playerColor = new THREE.Color(Math.random() * 0xffffff);
    const playerGeometry = new THREE.CapsuleGeometry(config.playerRadius, config.playerHeight - 2 * config.playerRadius, 4, 8); // Capsule shape
    const playerMaterial = new THREE.MeshStandardMaterial({ color: playerColor });
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    playerMesh.position.y = config.playerHeight / 2; // Adjust pivot to bottom

    // Add a simple indicator for forward direction (optional)
    const directionIndicatorGeometry = new THREE.ConeGeometry(config.playerRadius * 0.5, config.playerRadius, 4);
    const directionIndicatorMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const directionIndicator = new THREE.Mesh(directionIndicatorGeometry, directionIndicatorMaterial);
    directionIndicator.position.z = config.playerRadius * 0.8; // Position in front
    directionIndicator.position.y = config.playerHeight * 0.25; // Slightly lower than center
    directionIndicator.rotation.x = Math.PI / 2; // Point forward
    playerMesh.add(directionIndicator);

    scene.add(playerMesh);
    return playerMesh;
}

// Animation Loop
function animate() {
  requestAnimationFrame(animate);

  controls.update(); // Only required if controls.enableDamping = true, or if controls.autoRotate = true

  // Interpolate player positions for smoother movement (optional but recommended)
  for (const clientId in players) {
      const mesh = players[clientId];
      const presence = room.presence[clientId];
      if (presence?.position && mesh) {
          const targetPosition = new THREE.Vector3(presence.position.x, presence.position.y, presence.position.z);
          mesh.position.lerp(targetPosition, config.interpolationFactor); // Smooth movement
      }
      if (presence?.rotation && mesh) {
          const targetQuaternion = new THREE.Quaternion(presence.rotation._x, presence.rotation._y, presence.rotation._z, presence.rotation._w);
           mesh.quaternion.slerp(targetQuaternion, config.interpolationFactor); // Smooth rotation
      }
  }

  renderer.render(scene, camera);
}

// Initialize Multiplayer Connection and Scene Logic
async function initialize() {
  try {
    await room.initialize();
    console.log("Websim room initialized. Client ID:", room.clientId);
    console.log("Initial Peers:", room.peers);
    console.log("Initial Presence:", room.presence);
    console.log("Initial Room State:", room.roomState);

    // Initial player list update
    updatePlayerList();

    // Subscribe to presence changes (joins, leaves, updates)
    room.subscribePresence((currentPresence) => {
      console.log("Presence updated:", currentPresence);
      updatePlayerList(); // Update list when players join/leave

      // Add meshes for new players
      for (const clientId in room.peers) { // Iterate over peers to ensure we have avatar/username info
        if (!players[clientId] && clientId !== room.clientId) { // Don't create mesh for self initially
          console.log(`Player joined: ${room.peers[clientId]?.username} (${clientId})`);
          players[clientId] = createPlayerMesh(clientId);
        }
      }

       // Remove meshes for players who left
      for (const clientId in players) {
         if (!room.peers[clientId]) { // Check against peers list
           console.log(`Player left: ${clientId}`);
           if (players[clientId]) {
              scene.remove(players[clientId]);
              players[clientId].geometry.dispose(); // Dispose geometry
              players[clientId].material.dispose(); // Dispose material
           }
           delete players[clientId];
         }
      }

      // Handle self - create mesh if it doesn't exist yet
      if (!players[room.clientId] && room.peers[room.clientId]) {
         console.log("Creating self mesh");
         players[room.clientId] = createPlayerMesh(room.clientId);
         // Optionally make self slightly different (e.g., different color or wireframe)
         // players[room.clientId].material.wireframe = true;

         // Send initial presence only *after* self mesh is created locally
         const initialPosition = {
             x: (Math.random() - 0.5) * 10,
             y: config.playerHeight / 2, // Start on the floor
             z: (Math.random() - 0.5) * 10
         };
         const initialRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.random() * Math.PI * 2, 0));
         room.updatePresence({
             position: initialPosition,
             rotation: { _x: initialRotation.x, _y: initialRotation.y, _z: initialRotation.z, _w: initialRotation.w }
         });
      }

    });

    // Subscribe to room state changes (if needed later)
    room.subscribeRoomState((currentRoomState) => {
      console.log("Room state updated:", currentRoomState);
      // Example: Update central cube based on room state
      if (currentRoomState.cubeColor) {
        material.color.set(currentRoomState.cubeColor);
      }
    });

    // Example: Simulate own movement (replace with actual controls later)
    setInterval(() => {
        if (!players[room.clientId]) return; // Don't update if self mesh isn't ready

        const currentPresence = room.presence[room.clientId] || {};
        const currentPosition = currentPresence.position || { x: 0, y: config.playerHeight / 2, z: 0 };
        const currentRotation = currentPresence.rotation || { _x: 0, _y: 0, _z: 0, _w: 1 };

        // Simulate slight random walk and rotation
        const moveStep = 0.1;
        const angleStep = 0.05;
        const newPosition = {
            x: currentPosition.x + (Math.random() - 0.5) * moveStep,
            y: config.playerHeight / 2, // Stay on the floor
            z: currentPosition.z + (Math.random() - 0.5) * moveStep,
        };

        const currentQuat = new THREE.Quaternion(currentRotation._x, currentRotation._y, currentRotation._z, currentRotation._w);
        const rotationChange = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (Math.random() - 0.5) * angleStep, 0));
        currentQuat.multiply(rotationChange).normalize();

        room.updatePresence({
            position: newPosition,
            rotation: { _x: currentQuat.x, _y: currentQuat.y, _z: currentQuat.z, _w: currentQuat.w }
        });

    }, config.updateInterval); // Send updates periodically

    // Start the animation loop
    animate();

  } catch (error) {
    console.error("Failed to initialize Websim room:", error);
    playerListElement.textContent = "Error connecting.";
    // Handle initialization error (e.g., display message to user)
  }
}

// Window Resize Handler
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Start Initialization
initialize();

// --- Debugging / Example Room State Update ---
// Example: Allow changing the central cube's color by clicking it
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('click', (event) => {
    // Calculate mouse position in normalized device coordinates (-1 to +1) for both components
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = - (event.clientY / window.innerHeight) * 2 + 1;

    // Update the picking ray with the camera and mouse position
    raycaster.setFromCamera(mouse, camera);

    // Calculate objects intersecting the picking ray
    const intersects = raycaster.intersectObject(cube);

    if (intersects.length > 0) {
        console.log("Clicked the cube!");
        // Update room state with a random color for the cube
        const randomColor = `#${Math.floor(Math.random()*16777215).toString(16)}`;
        room.updateRoomState({
            cubeColor: randomColor
        });
        console.log("Sent room state update: cubeColor =", randomColor);
    }
});
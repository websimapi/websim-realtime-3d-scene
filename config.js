// Configuration file (optional for now, can be used later)
export const config = {
  // Example config values
  movementSpeed: 0.1,
};
`````` index.html
<!DOCTYPE html>
<html>
<head>
  <title>Realtime 3D Scene</title>
  <style>
    body { margin: 0; overflow: hidden; background-color: #222; }
    canvas { display: block; }
    #player-list {
      position: absolute;
      top: 10px;
      left: 10px;
      background: rgba(0,0,0,0.7);
      color: white;
      padding: 10px;
      border-radius: 8px;
      font-family: sans-serif;
      max-height: 200px;
      overflow-y: auto;
    }
    .player-item {
      display: flex;
      align-items: center;
      margin-bottom: 5px;
      padding: 3px;
    }
    .player-avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      margin-right: 8px;
      border: 1px solid #555;
    }
     .player-item.self {
       font-weight: bold;
       background-color: rgba(255, 255, 255, 0.1);
       border-radius: 4px;
     }
  </style>
</head>
<body>
  <div id="player-list">Loading players...</div>
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.161.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.161.0/examples/jsm/"
      }
    }
  </script>
  <script type="module" src="main.js"></script>
</body>
</html>

// Configuration file
export const config = {
  // Player appearance
  playerRadius: 0.3,
  playerHeight: 1.6,

  // Movement/Network
  updateInterval: 100, // ms between sending presence updates
  interpolationFactor: 0.15, // 0 = instant snap, 1 = no movement. Lower values = smoother but more laggy.
};


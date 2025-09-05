/* global AFRAME, THREE */

/**
 * A component to prevent the entity from passing through other entities with the 'collidable' class.
 * It works by casting rays in multiple directions and pushing the entity back if a collision is detected.
 */
AFRAME.registerComponent('simple-collider', {
  schema: {
    // The distance of the rays cast to check for collisions.
    distance: {type: 'number', default: 0.5},
    // Whether to show the debug rays.
    debug: {type: 'boolean', default: false}
  },

  init: function () {
    this.raycaster = new THREE.Raycaster();
    this.directions = [
      new THREE.Vector3(0, 0, -1), // Forward
      new THREE.Vector3(0, 0, 1),  // Backward
      new THREE.Vector3(-1, 0, 0), // Left
      new THREE.Vector3(1, 0, 0),   // Right
      new THREE.Vector3(-0.7, 0, -0.7), // Forward-Left
      new THREE.Vector3(0.7, 0, -0.7),  // Forward-Right
      new THREE.Vector3(-0.7, 0, 0.7),  // Backward-Left
      new THREE.Vector3(0.7, 0, 0.7)   // Backward-Right
    ];

    if (this.data.debug) {
      this.lines = {};
      for (let i = 0; i < this.directions.length; i++) {
        const material = new THREE.LineBasicMaterial({ color: 0xff0000 });
        const geometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
        const line = new THREE.Line(geometry, material);
        this.el.sceneEl.object3D.add(line);
        this.lines[i] = line;
      }
    }
  },

  tick: function () {
    const el = this.el;
    const center = new THREE.Vector3();
    el.object3D.getWorldPosition(center);

    // Find all collidable meshes in the scene
    const collidableEls = el.sceneEl.querySelectorAll('.collidable');
    const collidableMeshes = [];
    collidableEls.forEach(collidableEl => {
      const mesh = collidableEl.getObject3D('mesh');
      if (mesh) {
        collidableMeshes.push(mesh);
      }
    });

    if (collidableMeshes.length === 0) return;

    // Cast rays in all directions
    for (let i = 0; i < this.directions.length; i++) {
      const direction = this.directions[i].clone().applyQuaternion(el.object3D.quaternion);
      this.raycaster.set(center, direction);
      this.raycaster.far = this.data.distance;

      const intersects = this.raycaster.intersectObjects(collidableMeshes, true);

      if (intersects.length > 0) {
        const distance = intersects[0].distance;
        if (distance < this.data.distance) {
          // If a collision is detected, push the entity back.
          const overlap = this.data.distance - distance;
          const pushback = direction.clone().negate().multiplyScalar(overlap);
          el.object3D.position.add(pushback);
          break; // Only handle one collision at a time to prevent weird behavior
        }
      }
      
      if (this.data.debug) {
        const start = center.clone();
        const end = center.clone().add(direction.multiplyScalar(this.data.distance));
        this.lines[i].geometry.setFromPoints([start, end]);
        this.lines[i].geometry.verticesNeedUpdate = true;
      }
    }
  }
});

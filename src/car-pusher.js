AFRAME.registerComponent('car-pusher', {
  schema: {
    pushStrength: { default: 5 },
    radius: { default: 1.5 },
  },

  init: function () {
    this.playerPos = new THREE.Vector3();
    this.carPos = new THREE.Vector3();
    this.pushVector = new THREE.Vector3();
    this.carBody = null;
    this.physicsSystem = this.el.sceneEl.systems.physics;
  },

  tick: function (time, delta) {
    if (!this.carBody) {
      if (!this.physicsSystem) return;
      this.carBody = this.physicsSystem.getBodyById('ferrariBody');
      if (!this.carBody) return;
    }

    this.el.object3D.getWorldPosition(this.playerPos);
    this.carBody.el.object3D.getWorldPosition(this.carPos);

    const distance = this.playerPos.distanceTo(this.carPos);

    if (distance < this.data.radius) {
      const overlap = this.data.radius - distance;
      if (overlap <= 0) return;

      this.pushVector.subVectors(this.carPos, this.playerPos).normalize();

      const pushStrength = overlap * this.data.pushStrength;
      this.carBody.velocity.set(this.pushVector.x * pushStrength, 0, this.pushVector.z * pushStrength);
    }
  },
});

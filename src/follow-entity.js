
AFRAME.registerComponent('follow-entity', {
  schema: {
    target: { type: 'selector' }
  },

  tick: function () {
    if (!this.data.target) return;

    const targetPosition = this.data.target.object3D.position;
    const targetQuaternion = this.data.target.object3D.quaternion;

    this.el.object3D.position.copy(targetPosition);
    this.el.object3D.quaternion.copy(targetQuaternion);
  }
});

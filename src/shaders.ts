// Simple shaders for vertex colors (migrated from main/app)
export const vertexSrc = `
  precision mediump float;

  attribute vec2 aPosition;

  attribute vec4 aColor;

  varying vec4 vColor;

  void main() {
    vColor = aColor;
    // aPosition is provided in clip space already [-1,1]
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }`;

export const fragmentSrc = `
  precision mediump float;

  varying vec4 vColor;

  void main() {
    // Modulate emitted RGB by alpha so the slider affects intensity
    gl_FragColor = vec4(vColor.rgb * vColor.a, vColor.a);
  }`;

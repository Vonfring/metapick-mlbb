import { frameLoop, type Layer } from "./frame-loop";

/**
 * The hero's mesh gradient: five soft color fields drifting slowly, drawn
 * with WebGL at a third of the screen resolution (the fields are blurry, so
 * nobody sees the difference). The violet field leans toward the pointer.
 *
 * The canvas reaches past the hero into the tools section; `hf` is the
 * hero's share of its height. Fields are laid out on the hero, and below it
 * they darken smoothly into the page color.
 */

const VERTEX = "attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}";

const FRAGMENT = `precision mediump float;
uniform vec2 res; uniform float t; uniform vec2 m; uniform float hf;
vec3 field(vec2 uv, vec2 c, vec3 col, float r){ float d=length(uv-c); return col*exp(-d*d/(r*r)); }
void main(){
  vec2 uv=gl_FragCoord.xy/res; uv.y=(uv.y-1.)/hf+1.;
  float ar=res.x/(res.y*hf); uv.x*=ar;
  float y=uv.y;
  uv+=0.04*vec2(sin(uv.y*3.1+t*.23),cos(uv.x*2.7-t*.19));
  vec3 col=vec3(.039,.063,.09);
  col+=field(uv,vec2((.12+.06*sin(t*.11))*ar,.08+.06*cos(t*.13)),vec3(.31,.49,1.),.62);
  col+=field(uv,vec2((.35+.05*cos(t*.09))*ar,.30+.05*sin(t*.12)),vec3(.18,.30,.78),.42);
  vec2 v=mix(vec2((.55+.08*sin(t*.07))*ar,.52+.07*cos(t*.1)),vec2(m.x*ar,m.y),.45);
  col+=field(uv,v,vec3(.55,.36,.96),.38);
  col+=field(uv,vec2((.80+.05*cos(t*.12))*ar,.30+.06*sin(t*.08)),vec3(1.,.36,.54),.30);
  col+=field(uv,vec2((.92+.05*sin(t*.1))*ar,.92+.05*cos(t*.09)),vec3(1.,.42,.24),.58);
  float wide=smoothstep(.8,1.4,ar);
  col+=wide*field(uv,vec2((.6+.06*sin(t*.08))*ar,-.04),vec3(.42,.32,.9),.34);
  col+=wide*field(uv,vec2((.98+.04*cos(t*.11))*ar,.02),vec3(1.,.45,.38),.32);
  col*=mix(.62,1.,smoothstep(.55,1.1,ar));
  col=col/(1.+col*.55);
  col=max(col*smoothstep(1.-1./hf,0.,y),vec3(.039,.063,.09));
  gl_FragColor=vec4(col,1.);
}`;

export function startMesh(
  canvas: HTMLCanvasElement,
  hero: HTMLElement,
  {
    animate,
    finePointer,
    signal,
  }: { animate: boolean; finePointer: boolean; signal: AbortSignal },
): Layer | null {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false });
  if (!gl) return null;
  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram();
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  // Without a working shader the CSS gradient underneath stays in place.
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    gl.STATIC_DRAW,
  );
  const position = gl.getAttribLocation(program, "p");
  gl.enableVertexAttribArray(position);
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(program, "res");
  const uT = gl.getUniformLocation(program, "t");
  const uM = gl.getUniformLocation(program, "m");
  const uHf = gl.getUniformLocation(program, "hf");

  const target = { x: 0.55, y: 0.52 };
  const pointer = { x: 0.55, y: 0.52 };
  if (animate && finePointer) {
    hero.addEventListener(
      "pointermove",
      (e) => {
        const r = hero.getBoundingClientRect();
        target.x = (e.clientX - r.left) / r.width;
        target.y = 1 - (e.clientY - r.top) / r.height;
      },
      { signal },
    );
  }

  // Start half a minute into the drift, where the fields sit nicely apart.
  const t0 = performance.now() - 30000;
  const draw = (now: number) => {
    const t = (now - t0) / 1000;
    // On touch screens the violet field wanders on its own.
    if (!finePointer) {
      target.x = 0.55 + 0.18 * Math.sin(t * 0.35);
      target.y = 0.5 + 0.15 * Math.cos(t * 0.28);
    }
    pointer.x += (target.x - pointer.x) * 0.04;
    pointer.y += (target.y - pointer.y) * 0.04;
    gl.uniform1f(uT, t);
    gl.uniform2f(uM, pointer.x, pointer.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 2) / 3;
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(
      uHf,
      Math.min(1, hero.offsetHeight / Math.max(1, canvas.clientHeight)),
    );
    draw(performance.now());
  };
  resize();

  const loop = frameLoop(canvas, signal, animate, draw);
  return { resize, stop: loop.stop };
}

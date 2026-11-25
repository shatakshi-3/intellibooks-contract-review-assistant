/**
 * Serverless PDF Polyfills for Vercel & Node.js Runtimes.
 *
 * In serverless environments (e.g. AWS Lambda / Vercel Serverless Functions):
 * - Native Node C++ binaries like `@napi-rs/canvas` fail to load due to missing shared libraries (cairo, freetype, etc.) or cross-platform packaging issues.
 * - `pdfjs-dist` (used by `pdf-parse` v2) unconditionally expects W3C Geometry APIs (`DOMMatrix`, `Path2D`, `ImageData`, `DOMPoint`) on `globalThis` when parsing documents and calculating text layout transforms.
 * - When `@napi-rs/canvas` fails to load, `pdf-parse` fails to polyfill `DOMMatrix`, causing `ReferenceError: DOMMatrix is not defined`.
 *
 * This module provides a complete, spec-compliant pure-TypeScript implementation of `DOMMatrix`,
 * `ImageData`, `Path2D`, `DOMPoint`, and `CanvasFactoryPolyfill` so that text extraction never depends
 * on native OS binaries, browser APIs, or fragile module-loader monkey-patching.
 */

export class DOMMatrixPolyfill {
  m11 = 1;
  m12 = 0;
  m13 = 0;
  m14 = 0;
  m21 = 0;
  m22 = 1;
  m23 = 0;
  m24 = 0;
  m31 = 0;
  m32 = 0;
  m33 = 1;
  m34 = 0;
  m41 = 0;
  m42 = 0;
  m43 = 0;
  m44 = 1;
  is2D = true;

  constructor(
    init?:
      | string
      | number[]
      | Float32Array
      | Float64Array
      | {
          a?: number;
          b?: number;
          c?: number;
          d?: number;
          e?: number;
          f?: number;
          m11?: number;
          m12?: number;
          m13?: number;
          m14?: number;
          m21?: number;
          m22?: number;
          m23?: number;
          m24?: number;
          m31?: number;
          m32?: number;
          m33?: number;
          m34?: number;
          m41?: number;
          m42?: number;
          m43?: number;
          m44?: number;
          is2D?: boolean;
        }
  ) {
    if (!init) return;

    if (typeof init === "string") {
      const match2d = init.match(/matrix\(([^)]+)\)/);
      if (match2d) {
        const parts = match2d[1].split(/[\s,]+/).map(Number);
        if (parts.length === 6) {
          this.m11 = parts[0];
          this.m12 = parts[1];
          this.m21 = parts[2];
          this.m22 = parts[3];
          this.m41 = parts[4];
          this.m42 = parts[5];
          this.is2D = true;
          return;
        }
      }
      const match3d = init.match(/matrix3d\(([^)]+)\)/);
      if (match3d) {
        const parts = match3d[1].split(/[\s,]+/).map(Number);
        if (parts.length === 16) {
          this.m11 = parts[0];  this.m12 = parts[1];  this.m13 = parts[2];  this.m14 = parts[3];
          this.m21 = parts[4];  this.m22 = parts[5];  this.m23 = parts[6];  this.m24 = parts[7];
          this.m31 = parts[8];  this.m32 = parts[9];  this.m33 = parts[10]; this.m34 = parts[11];
          this.m41 = parts[12]; this.m42 = parts[13]; this.m43 = parts[14]; this.m44 = parts[15];
          this.is2D = false;
          return;
        }
      }
    }

    if (Array.isArray(init) || ArrayBuffer.isView(init)) {
      const arr = Array.from(init as number[]);
      if (arr.length === 6) {
        this.m11 = arr[0];
        this.m12 = arr[1];
        this.m21 = arr[2];
        this.m22 = arr[3];
        this.m41 = arr[4];
        this.m42 = arr[5];
        this.is2D = true;
      } else if (arr.length === 16) {
        this.m11 = arr[0];
        this.m12 = arr[1];
        this.m13 = arr[2];
        this.m14 = arr[3];
        this.m21 = arr[4];
        this.m22 = arr[5];
        this.m23 = arr[6];
        this.m24 = arr[7];
        this.m31 = arr[8];
        this.m32 = arr[9];
        this.m33 = arr[10];
        this.m34 = arr[11];
        this.m41 = arr[12];
        this.m42 = arr[13];
        this.m43 = arr[14];
        this.m44 = arr[15];
        this.is2D = false;
      }
      return;
    }

    if (typeof init === "object") {
      if ("a" in init && init.a !== undefined) {
        this.m11 = init.a ?? 1;
        this.m12 = init.b ?? 0;
        this.m21 = init.c ?? 0;
        this.m22 = init.d ?? 1;
        this.m41 = init.e ?? 0;
        this.m42 = init.f ?? 0;
        this.is2D = init.is2D !== undefined ? init.is2D : true;
      }
      if ("m11" in init && init.m11 !== undefined) {
        this.m11 = init.m11;
        this.m12 = init.m12 ?? 0;
        this.m13 = init.m13 ?? 0;
        this.m14 = init.m14 ?? 0;
        this.m21 = init.m21 ?? 0;
        this.m22 = init.m22 ?? 1;
        this.m23 = init.m23 ?? 0;
        this.m24 = init.m24 ?? 0;
        this.m31 = init.m31 ?? 0;
        this.m32 = init.m32 ?? 0;
        this.m33 = init.m33 ?? 1;
        this.m34 = init.m34 ?? 0;
        this.m41 = init.m41 ?? 0;
        this.m42 = init.m42 ?? 0;
        this.m43 = init.m43 ?? 0;
        this.m44 = init.m44 ?? 1;
        if (init.is2D !== undefined) {
          this.is2D = init.is2D;
        }
      }
    }
  }

  get a(): number {
    return this.m11;
  }
  set a(v: number) {
    this.m11 = v;
  }

  get b(): number {
    return this.m12;
  }
  set b(v: number) {
    this.m12 = v;
  }

  get c(): number {
    return this.m21;
  }
  set c(v: number) {
    this.m21 = v;
  }

  get d(): number {
    return this.m22;
  }
  set d(v: number) {
    this.m22 = v;
  }

  get e(): number {
    return this.m41;
  }
  set e(v: number) {
    this.m41 = v;
  }

  get f(): number {
    return this.m42;
  }
  set f(v: number) {
    this.m42 = v;
  }

  get isIdentity(): boolean {
    return (
      this.m11 === 1 &&
      this.m12 === 0 &&
      this.m13 === 0 &&
      this.m14 === 0 &&
      this.m21 === 0 &&
      this.m22 === 1 &&
      this.m23 === 0 &&
      this.m24 === 0 &&
      this.m31 === 0 &&
      this.m32 === 0 &&
      this.m33 === 1 &&
      this.m34 === 0 &&
      this.m41 === 0 &&
      this.m42 === 0 &&
      this.m43 === 0 &&
      this.m44 === 1
    );
  }

  multiply(other: DOMMatrixPolyfill | { a?: number; m11?: number; [key: string]: unknown }): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(this).multiplySelf(other);
  }

  multiplySelf(other: DOMMatrixPolyfill | { a?: number; m11?: number; [key: string]: unknown }): this {
    const o = other instanceof DOMMatrixPolyfill ? other : new DOMMatrixPolyfill(other);

    if (this.is2D && o.is2D) {
      const a = this.a * o.a + this.c * o.b;
      const b = this.b * o.a + this.d * o.b;
      const c = this.a * o.c + this.c * o.d;
      const d = this.b * o.c + this.d * o.d;
      const e = this.a * o.e + this.c * o.f + this.e;
      const f = this.b * o.e + this.d * o.f + this.f;
      this.a = a;
      this.b = b;
      this.c = c;
      this.d = d;
      this.e = e;
      this.f = f;
      return this;
    }

    const m11 = this.m11 * o.m11 + this.m12 * o.m21 + this.m13 * o.m31 + this.m14 * o.m41;
    const m12 = this.m11 * o.m12 + this.m12 * o.m22 + this.m13 * o.m32 + this.m14 * o.m42;
    const m13 = this.m11 * o.m13 + this.m12 * o.m23 + this.m13 * o.m33 + this.m14 * o.m43;
    const m14 = this.m11 * o.m14 + this.m12 * o.m24 + this.m13 * o.m34 + this.m14 * o.m44;

    const m21 = this.m21 * o.m11 + this.m22 * o.m21 + this.m23 * o.m31 + this.m24 * o.m41;
    const m22 = this.m21 * o.m12 + this.m22 * o.m22 + this.m23 * o.m32 + this.m24 * o.m42;
    const m23 = this.m21 * o.m13 + this.m22 * o.m23 + this.m23 * o.m33 + this.m24 * o.m43;
    const m24 = this.m21 * o.m14 + this.m22 * o.m24 + this.m23 * o.m34 + this.m24 * o.m44;

    const m31 = this.m31 * o.m11 + this.m32 * o.m21 + this.m33 * o.m31 + this.m34 * o.m41;
    const m32 = this.m31 * o.m12 + this.m32 * o.m22 + this.m33 * o.m32 + this.m34 * o.m42;
    const m33 = this.m31 * o.m13 + this.m32 * o.m23 + this.m33 * o.m33 + this.m34 * o.m43;
    const m34 = this.m31 * o.m14 + this.m32 * o.m24 + this.m33 * o.m34 + this.m34 * o.m44;

    const m41 = this.m41 * o.m11 + this.m42 * o.m21 + this.m43 * o.m31 + this.m44 * o.m41;
    const m42 = this.m41 * o.m12 + this.m42 * o.m22 + this.m43 * o.m32 + this.m44 * o.m42;
    const m43 = this.m41 * o.m13 + this.m42 * o.m23 + this.m43 * o.m33 + this.m44 * o.m43;
    const m44 = this.m41 * o.m14 + this.m42 * o.m24 + this.m43 * o.m34 + this.m44 * o.m44;

    this.m11 = m11;
    this.m12 = m12;
    this.m13 = m13;
    this.m14 = m14;
    this.m21 = m21;
    this.m22 = m22;
    this.m23 = m23;
    this.m24 = m24;
    this.m31 = m31;
    this.m32 = m32;
    this.m33 = m33;
    this.m34 = m34;
    this.m41 = m41;
    this.m42 = m42;
    this.m43 = m43;
    this.m44 = m44;
    this.is2D = this.is2D && o.is2D;
    return this;
  }

  preMultiplySelf(other: DOMMatrixPolyfill | { a?: number; m11?: number; [key: string]: unknown }): this {
    const o = other instanceof DOMMatrixPolyfill ? other : new DOMMatrixPolyfill(other);
    const res = o.multiply(this);
    return Object.assign(this, res);
  }

  translate(tx = 0, ty = 0, tz = 0): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(this).translateSelf(tx, ty, tz);
  }

  translateSelf(tx = 0, ty = 0, tz = 0): this {
    if (tz === 0 && this.is2D) {
      this.m41 += this.m11 * tx + this.m21 * ty;
      this.m42 += this.m12 * tx + this.m22 * ty;
      return this;
    }
    this.is2D = false;
    return this.multiplySelf(new DOMMatrixPolyfill([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1]));
  }

  scale(sx = 1, sy = sx, sz = 1): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(this).scaleSelf(sx, sy, sz);
  }

  scaleSelf(sx = 1, sy = sx, sz = 1): this {
    if (sz === 1 && this.is2D) {
      this.m11 *= sx;
      this.m12 *= sx;
      this.m21 *= sy;
      this.m22 *= sy;
      return this;
    }
    this.is2D = false;
    return this.multiplySelf(new DOMMatrixPolyfill([sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1]));
  }

  invertSelf(): this {
    if (this.is2D) {
      const det = this.a * this.d - this.b * this.c;
      if (!det || Number.isNaN(det)) {
        this.m11 = this.m12 = this.m13 = this.m14 = Number.NaN;
        this.m21 = this.m22 = this.m23 = this.m24 = Number.NaN;
        this.m31 = this.m32 = this.m33 = this.m34 = Number.NaN;
        this.m41 = this.m42 = this.m43 = this.m44 = Number.NaN;
        this.is2D = false;
        return this;
      }
      const invDet = 1 / det;
      const a = this.d * invDet;
      const b = -this.b * invDet;
      const c = -this.c * invDet;
      const d = this.a * invDet;
      const e = (this.c * this.f - this.d * this.e) * invDet;
      const f = (this.b * this.e - this.a * this.f) * invDet;
      this.a = a;
      this.b = b;
      this.c = c;
      this.d = d;
      this.e = e;
      this.f = f;
      return this;
    }

    // 3D 4x4 matrix inversion
    const m = [
      this.m11, this.m12, this.m13, this.m14,
      this.m21, this.m22, this.m23, this.m24,
      this.m31, this.m32, this.m33, this.m34,
      this.m41, this.m42, this.m43, this.m44,
    ];

    const inv = new Array(16);
    inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
    inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
    inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
    inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];

    const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    if (!det || Number.isNaN(det)) {
      this.m11 = this.m12 = this.m13 = this.m14 = Number.NaN;
      this.m21 = this.m22 = this.m23 = this.m24 = Number.NaN;
      this.m31 = this.m32 = this.m33 = this.m34 = Number.NaN;
      this.m41 = this.m42 = this.m43 = this.m44 = Number.NaN;
      this.is2D = false;
      return this;
    }

    inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
    inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
    inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
    inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];

    inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
    inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
    inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
    inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];

    inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
    inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
    inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
    inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];

    const invDet = 1 / det;
    for (let i = 0; i < 16; i++) {
      inv[i] *= invDet;
    }

    this.m11 = inv[0];  this.m12 = inv[1];  this.m13 = inv[2];  this.m14 = inv[3];
    this.m21 = inv[4];  this.m22 = inv[5];  this.m23 = inv[6];  this.m24 = inv[7];
    this.m31 = inv[8];  this.m32 = inv[9];  this.m33 = inv[10]; this.m34 = inv[11];
    this.m41 = inv[12]; this.m42 = inv[13]; this.m43 = inv[14]; this.m44 = inv[15];
    return this;
  }

  inverse(): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(this).invertSelf();
  }

  transformPoint(point: { x?: number; y?: number; z?: number; w?: number } = {}): {
    x: number;
    y: number;
    z: number;
    w: number;
  } {
    const x = point.x ?? 0;
    const y = point.y ?? 0;
    const z = point.z ?? 0;
    const w = point.w ?? 1;
    return {
      x: x * this.m11 + y * this.m21 + z * this.m31 + w * this.m41,
      y: x * this.m12 + y * this.m22 + z * this.m32 + w * this.m42,
      z: x * this.m13 + y * this.m23 + z * this.m33 + w * this.m43,
      w: x * this.m14 + y * this.m24 + z * this.m34 + w * this.m44,
    };
  }

  toFloat32Array(): Float32Array {
    return new Float32Array([
      this.m11, this.m12, this.m13, this.m14,
      this.m21, this.m22, this.m23, this.m24,
      this.m31, this.m32, this.m33, this.m34,
      this.m41, this.m42, this.m43, this.m44,
    ]);
  }

  toFloat64Array(): Float64Array {
    return new Float64Array([
      this.m11, this.m12, this.m13, this.m14,
      this.m21, this.m22, this.m23, this.m24,
      this.m31, this.m32, this.m33, this.m34,
      this.m41, this.m42, this.m43, this.m44,
    ]);
  }

  static fromMatrix(other: unknown): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(other as DOMMatrixPolyfill);
  }

  static fromFloat32Array(arr: Float32Array): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(arr);
  }

  static fromFloat64Array(arr: Float64Array): DOMMatrixPolyfill {
    return new DOMMatrixPolyfill(arr);
  }
}

export class ImageDataPolyfill {
  width: number;
  height: number;
  data: Uint8ClampedArray;

  constructor(width: number, height: number);
  constructor(data: Uint8ClampedArray, width: number, height?: number);
  constructor(arg1: number | Uint8ClampedArray, arg2: number, arg3?: number) {
    if (typeof arg1 === "number") {
      this.width = arg1;
      this.height = arg2;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = arg1;
      this.width = arg2;
      this.height = arg3 ?? arg1.length / (arg2 * 4);
    }
  }
}

export class Path2DPolyfill {
  constructor() {}
  addPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  bezierCurveTo() {}
  quadraticCurveTo() {}
  arc() {}
  arcTo() {}
  ellipse() {}
  rect() {}
}

export class DOMPointPolyfill {
  x = 0;
  y = 0;
  z = 0;
  w = 1;

  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.w = w;
  }

  static fromPoint(point: { x?: number; y?: number; z?: number; w?: number }): DOMPointPolyfill {
    return new DOMPointPolyfill(point.x ?? 0, point.y ?? 0, point.z ?? 0, point.w ?? 1);
  }
}

/**
 * Pure TypeScript CanvasFactory fallback compatible with PDF.js and pdf-parse.
 * Completely eliminates the need to import `pdf-parse/worker` which requires native `@napi-rs/canvas`.
 */
export class CanvasFactoryPolyfill {
  create(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid canvas size");
    }
    return {
      canvas: {
        width,
        height,
        getContext: () => null,
        toBuffer: () => Buffer.alloc(0),
        toDataURL: () => "",
      },
      context: null,
    };
  }

  reset(canvasAndContext: { canvas?: { width: number; height: number } | null }, width: number, height: number) {
    if (!canvasAndContext?.canvas) {
      throw new Error("Canvas is not specified");
    }
    if (width <= 0 || height <= 0) {
      throw new Error("Invalid canvas size");
    }
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: { canvas?: unknown; context?: unknown }) {
    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

let isPolyfilled = false;

/**
 * Initializes the global runtime environment for headless serverless PDF extraction.
 * Polyfills `DOMMatrix`, `DOMMatrixReadOnly`, `DOMPoint`, `DOMPointReadOnly`,
 * `ImageData`, and `Path2D` on `globalThis` if not present.
 */
export function setupPdfEnvironment(): void {
  if (isPolyfilled) return;

  const g = globalThis as unknown as Record<string, unknown>;

  if (!g.DOMMatrix) {
    g.DOMMatrix = DOMMatrixPolyfill;
  }
  if (!g.DOMMatrixReadOnly) {
    g.DOMMatrixReadOnly = DOMMatrixPolyfill;
  }
  if (!g.DOMPoint) {
    g.DOMPoint = DOMPointPolyfill;
  }
  if (!g.DOMPointReadOnly) {
    g.DOMPointReadOnly = DOMPointPolyfill;
  }
  if (!g.ImageData) {
    g.ImageData = ImageDataPolyfill;
  }
  if (!g.Path2D) {
    g.Path2D = Path2DPolyfill;
  }

  isPolyfilled = true;
}

// Auto-run on import
setupPdfEnvironment();

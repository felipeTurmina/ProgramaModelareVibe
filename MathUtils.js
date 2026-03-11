/**
 * MathUtils — Utilitários matemáticos para o sistema 3D
 *
 * Centraliza funções matemáticas usadas em múltiplos módulos,
 * eliminando duplicações e facilitando testes.
 */
const MathUtils = (function () {
  'use strict';

  /**
   * Arredonda valor para múltiplo de step (snapping)
   * Equivalente ao snV() original.
   * @param {number} value
   * @param {number} [step=50]
   * @returns {number}
   */
  function snapTo(value, step) {
    step = step || 50;
    return Math.round(value / step) * step;
  }

  /**
   * Clamp: restringe valor entre min e max
   * @param {number} value
   * @param {number} min
   * @param {number} max
   * @returns {number}
   */
  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Interpolação linear entre dois valores
   * @param {number} a
   * @param {number} b
   * @param {number} t - fator 0..1
   * @returns {number}
   */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Calcula bounding box de um objeto Three.js
   * Equivalente ao gBB() original.
   * @param {THREE.Object3D} obj
   * @returns {THREE.Box3}
   */
  function getBoundingBox(obj) {
    return new THREE.Box3().setFromObject(obj);
  }

  /**
   * Calcula centro do bounding box de um objeto
   * @param {THREE.Object3D} obj
   * @returns {THREE.Vector3}
   */
  function getCenter(obj) {
    return getBoundingBox(obj).getCenter(new THREE.Vector3());
  }

  /**
   * Calcula dimensões do bounding box
   * @param {THREE.Object3D} obj
   * @returns {{ width: number, height: number, depth: number }}
   */
  function getDimensions(obj) {
    var size = getBoundingBox(obj).getSize(new THREE.Vector3());
    return { width: size.x, height: size.y, depth: size.z };
  }

  /**
   * Verifica se dois bounding boxes se intersectam (para snap automático)
   * @param {THREE.Box3} a
   * @param {THREE.Box3} b
   * @param {number} [tolerance=5]
   * @returns {boolean}
   */
  function boxesNear(a, b, tolerance) {
    tolerance = tolerance || 5;
    var expanded = a.clone().expandByScalar(tolerance);
    return expanded.intersectsBox(b);
  }

  /**
   * Converte graus para radianos
   * @param {number} deg
   * @returns {number}
   */
  function degToRad(deg) {
    return deg * (Math.PI / 180);
  }

  /**
   * Converte radianos para graus
   * @param {number} rad
   * @returns {number}
   */
  function radToDeg(rad) {
    return rad * (180 / Math.PI);
  }

  /**
   * Calcula Y mínimo de um objeto (para clamp ao piso)
   * @param {THREE.Object3D} obj
   * @returns {number}
   */
  function getMinY(obj) {
    return getBoundingBox(obj).min.y;
  }

  /**
   * Garante que um objeto não está abaixo do piso (y=0)
   * @param {THREE.Object3D} obj
   */
  function clampToFloor(obj) {
    var minY = getMinY(obj);
    if (minY < 0) {
      obj.position.y -= minY;
    }
    if (obj.position.y < 0) {
      obj.position.y = 0;
    }
  }

  /**
   * Gera UUID simples para identificação de objetos
   * @returns {string}
   */
  function uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  /**
   * Formata número em mm com unidade
   * @param {number} v
   * @param {number} [decimals=0]
   * @returns {string}
   */
  function fmtMM(v, decimals) {
    return v.toFixed(decimals || 0) + 'mm';
  }

  /**
   * Formata área em m²
   * @param {number} mm2 - área em mm²
   * @returns {string}
   */
  function fmtM2(mm2) {
    return (mm2 / 1e6).toFixed(3) + ' m²';
  }

  /**
   * Distribui N posições uniformemente em um intervalo
   * Útil para calcular posição de prateleiras automaticamente.
   * @param {number} count  - número de posições
   * @param {number} start  - início do intervalo
   * @param {number} end    - fim do intervalo
   * @returns {number[]}
   */
  function distributePositions(count, start, end) {
    if (count <= 0) return [];
    var step = (end - start) / (count + 1);
    var positions = [];
    for (var i = 1; i <= count; i++) {
      positions.push(start + step * i);
    }
    return positions;
  }

  /**
   * Calcula distância entre dois pontos 3D
   * @param {THREE.Vector3} a
   * @param {THREE.Vector3} b
   * @returns {number}
   */
  function distance3D(a, b) {
    var dx = a.x - b.x;
    var dy = a.y - b.y;
    var dz = a.z - b.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }

  return {
    snapTo: snapTo,
    clamp: clamp,
    lerp: lerp,
    getBoundingBox: getBoundingBox,
    getCenter: getCenter,
    getDimensions: getDimensions,
    boxesNear: boxesNear,
    degToRad: degToRad,
    radToDeg: radToDeg,
    getMinY: getMinY,
    clampToFloor: clampToFloor,
    uuid: uuid,
    fmtMM: fmtMM,
    fmtM2: fmtM2,
    distributePositions: distributePositions,
    distance3D: distance3D,
  };
}());

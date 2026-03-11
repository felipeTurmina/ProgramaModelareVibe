/**
 * GeometryCache — Cache de geometrias Three.js
 *
 * Problema resolvido:
 *   BoxGeometry é recriada para cada peça mesmo quando as dimensões
 *   são idênticas. Em projetos com 50+ módulos, isso gera centenas
 *   de geometrias redundantes na GPU.
 *
 * Solução:
 *   Cache por dimensões (w×h×d). A mesma geometria é referenciada
 *   por múltiplos Meshes (prática recomendada Three.js).
 *
 * NOTA: Geometrias são imutáveis e seguras para compartilhar.
 *       Apenas materials precisam ser únicos por peça (se tiver cor diferente).
 */
const GeometryCache = (function () {
  'use strict';

  /** @type {Object.<string, THREE.BufferGeometry>} */
  const _cache = {};

  let _hits = 0;
  let _misses = 0;

  /**
   * Arredonda dimensão para reduzir fragmentação do cache.
   * Peças com 600.1mm e 600.3mm usam a mesma geometria de 600mm.
   * @param {number} v
   * @returns {number}
   */
  function _round(v) {
    return Math.round(v * 10) / 10; // 0.1mm de precisão
  }

  // ─── API Pública ───────────────────────────────────────────────────────

  /**
   * Retorna (ou cria) BoxGeometry cacheada para as dimensões dadas
   * @param {number} w - largura (mm)
   * @param {number} h - altura (mm)
   * @param {number} d - profundidade (mm)
   * @returns {THREE.BoxGeometry}
   */
  function getBox(w, h, d) {
    var rw = _round(w);
    var rh = _round(h);
    var rd = _round(d);
    var key = rw + 'x' + rh + 'x' + rd;

    if (_cache[key]) {
      _hits++;
      return _cache[key];
    }

    _misses++;
    var geo = new THREE.BoxGeometry(rw, rh, rd);
    _cache[key] = geo;
    return geo;
  }

  /**
   * Retorna geometria de cilindro (para puxadores, varas, etc.)
   * @param {number} radius
   * @param {number} length
   * @param {number} [segments=8]
   * @returns {THREE.CylinderGeometry}
   */
  function getCylinder(radius, length, segments) {
    segments = segments || 8;
    var key = 'cyl|' + radius + 'x' + length + 'x' + segments;

    if (_cache[key]) {
      _hits++;
      return _cache[key];
    }

    _misses++;
    var geo = new THREE.CylinderGeometry(radius, radius, length, segments);
    _cache[key] = geo;
    return geo;
  }

  /**
   * Retorna geometria de plano (para fundos finos, tampos)
   * @param {number} w
   * @param {number} h
   * @returns {THREE.PlaneGeometry}
   */
  function getPlane(w, h) {
    var key = 'plane|' + _round(w) + 'x' + _round(h);

    if (_cache[key]) {
      _hits++;
      return _cache[key];
    }

    _misses++;
    var geo = new THREE.PlaneGeometry(w, h);
    _cache[key] = geo;
    return geo;
  }

  /**
   * Descarta geometrias e libera memória GPU
   * Chamar apenas em reset total
   */
  function dispose() {
    Object.keys(_cache).forEach(function (key) {
      if (_cache[key] && _cache[key].dispose) {
        _cache[key].dispose();
      }
      delete _cache[key];
    });
    _hits = 0;
    _misses = 0;
  }

  /** @returns {Object} estatísticas de cache */
  function stats() {
    return {
      size: Object.keys(_cache).length,
      hits: _hits,
      misses: _misses,
      hitRate: _hits + _misses > 0
        ? Math.round((_hits / (_hits + _misses)) * 100) + '%'
        : '0%',
    };
  }

  // Limpa cache quando projeto é resetado
  EventBus.on('project:cleared', function () {
    dispose();
  });

  return { getBox: getBox, getCylinder: getCylinder, getPlane: getPlane, dispose: dispose, stats: stats };
}());

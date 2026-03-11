/**
 * MaterialCache — Cache centralizado de materiais Three.js
 *
 * Problema resolvido:
 *   O main.js original recriava MeshStandardMaterial a cada chamada gm(),
 *   gerando centenas de objetos duplicados na GPU e vazamentos de memória.
 *
 * Solução:
 *   Cache por chave composta (tipo + cor). Materiais são criados uma vez
 *   e reutilizados em todas as peças com os mesmos parâmetros.
 */
const MaterialCache = (function () {
  'use strict';

  /** @type {Object.<string, THREE.Material>} */
  const _cache = {};

  /** Contador para debug */
  let _hits = 0;
  let _misses = 0;

  // ─── Definições de materiais por tipo ─────────────────────────────────

  /**
   * Cria configuração de material baseada no tipo
   * @param {string} type - tipo do material
   * @param {string} colorHex - cor em hex (#rrggbb)
   * @returns {Object} configuração THREE.MeshStandardMaterial
   */
  function _buildConfig(type, colorHex) {
    var color = parseInt(colorHex.replace('#', '0x'), 16);

    switch (type) {
      case 'edge':
        // Fita de borda: ligeiramente mais escura, semi-brilhante
        return {
          color: _darken(color, 0.85),
          roughness: 0.5,
          metalness: 0.0,
        };

      case 'stone':
      case 'countertop':
        // Bancada de pedra/granito
        return {
          color: 0xd0c8bc,
          roughness: 0.3,
          metalness: 0.1,
        };

      case 'metal':
      case 'chrome':
        // Puxadores e ferragens metálicas
        return {
          color: color || 0xaaaaaa,
          roughness: 0.2,
          metalness: 0.9,
        };

      case 'glass':
        // Vidro temperado
        return {
          color: 0x99ccdd,
          roughness: 0.05,
          metalness: 0.1,
          transparent: true,
          opacity: 0.35,
        };

      default:
        // MDF/MDP/madeira — material padrão de painel
        return {
          color: color,
          roughness: 0.65,
          metalness: 0.0,
        };
    }
  }

  /**
   * Escurece uma cor por fator (0-1)
   * @param {number} color - cor como inteiro 0xRRGGBB
   * @param {number} factor - fator de escurecimento (0=preto, 1=original)
   * @returns {number}
   */
  function _darken(color, factor) {
    var r = Math.floor(((color >> 16) & 0xff) * factor);
    var g = Math.floor(((color >> 8) & 0xff) * factor);
    var b = Math.floor((color & 0xff) * factor);
    return (r << 16) | (g << 8) | b;
  }

  // ─── API Pública ───────────────────────────────────────────────────────

  /**
   * Retorna (ou cria) material cacheado para tipo + cor
   * Equivalente ao gm() do main.js original, mas com cache.
   *
   * @param {string} type   - tipo: '', 'edge', 'stone', 'metal', 'glass'
   * @param {string} [color] - cor hex, ex: '#d4b896'
   * @returns {THREE.MeshStandardMaterial}
   */
  function get(type, color) {
    var colorKey = color || '#d4b896';
    var cacheKey = type + '|' + colorKey;

    if (_cache[cacheKey]) {
      _hits++;
      return _cache[cacheKey];
    }

    _misses++;
    var config = _buildConfig(type, colorKey);
    var mat = new THREE.MeshStandardMaterial(config);
    _cache[cacheKey] = mat;
    return mat;
  }

  /**
   * Força atualização de cor de um material cacheado
   * Usado quando o usuário muda a cor de um módulo existente
   * @param {string} type
   * @param {string} color
   * @param {string} newColor
   */
  function updateColor(type, color, newColor) {
    var oldKey = type + '|' + color;
    if (_cache[oldKey]) {
      // Invalida o cache antigo para que seja recriado
      delete _cache[oldKey];
    }
    // Pré-aquece o novo
    return get(type, newColor);
  }

  /**
   * Descarta todos os materiais do cache e libera memória GPU
   * Chamar apenas em reset total do projeto
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

  /**
   * Informações de debug sobre o cache
   * @returns {Object}
   */
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

  return { get: get, updateColor: updateColor, dispose: dispose, stats: stats };
}());

/**
 * EventBus — Sistema de eventos pub/sub desacoplado
 * Elimina acoplamento direto entre módulos
 *
 * Uso:
 *   EventBus.on('module:selected', handler)
 *   EventBus.emit('module:selected', { module: g })
 *   EventBus.off('module:selected', handler)
 */
const EventBus = (function () {
  'use strict';

  /** @type {Object.<string, Function[]>} */
  const _listeners = {};

  /**
   * Registra um listener para um evento
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} unsubscribe helper
   */
  function on(event, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError('[EventBus] handler must be a function');
    }
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(handler);
    // Retorna função de remoção para facilitar cleanup
    return function () { off(event, handler); };
  }

  /**
   * Remove um listener específico
   * @param {string} event
   * @param {Function} handler
   */
  function off(event, handler) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(function (h) {
      return h !== handler;
    });
  }

  /**
   * Emite um evento para todos os listeners registrados
   * @param {string} event
   * @param {*} [data]
   */
  function emit(event, data) {
    var handlers = _listeners[event];
    if (!handlers || handlers.length === 0) return;
    // Cópia defensiva: evita problemas se handler mutar a lista
    handlers.slice().forEach(function (h) {
      try {
        h(data);
      } catch (err) {
        console.error('[EventBus] Error in handler for "' + event + '":', err);
      }
    });
  }

  /**
   * Remove todos os listeners de um evento (ou todos os eventos)
   * @param {string} [event]
   */
  function clear(event) {
    if (event) {
      delete _listeners[event];
    } else {
      Object.keys(_listeners).forEach(function (k) { delete _listeners[k]; });
    }
  }

  /** Debug: lista eventos registrados */
  function debug() {
    var result = {};
    Object.keys(_listeners).forEach(function (k) {
      result[k] = _listeners[k].length;
    });
    return result;
  }

  return { on: on, off: off, emit: emit, clear: clear, debug: debug };
}());

// ─── Catálogo de eventos (documentação + autocompletar) ───────────────────
/**
 * Eventos disponíveis no sistema:
 *
 * SELEÇÃO
 *   'selection:changed'     { module: THREE.Group | null }
 *   'selection:piece'       { mesh: THREE.Mesh | null }
 *
 * MÓDULOS
 *   'module:added'          { module: THREE.Group }
 *   'module:removed'        { module: THREE.Group }
 *   'module:rebuilt'        { old: THREE.Group, next: THREE.Group }
 *   'module:duplicated'     { source: THREE.Group, copy: THREE.Group }
 *   'module:transformed'    { module: THREE.Group }
 *
 * PROJETO
 *   'project:saved'
 *   'project:loaded'        { data: Object }
 *   'project:cleared'
 *
 * UI
 *   'ui:props:refresh'
 *   'ui:list:refresh'
 *   'ui:toast'              { message: string, type: 's'|'e'|'w' }
 *
 * EXPORTAÇÃO
 *   'export:cutlist:request'
 *   'export:budget:request'
 */

/**
 * ToastManager — Sistema de notificações toast
 *
 * Desacoplado do restante do sistema via EventBus.
 * Qualquer módulo pode emitir um toast com:
 *   EventBus.emit('ui:toast', { message: 'Salvo!', type: 's' })
 */
const ToastManager = (function () {
  'use strict';

  let _container = null;
  const _queue   = [];
  let _showing   = false;

  /**
   * Inicializa o container de toasts
   */
  function init() {
    _container = document.getElementById('tct');
    if (!_container) {
      _container = document.createElement('div');
      _container.id = 'tct';
      document.body.appendChild(_container);
    }

    // Escuta eventos de toast do EventBus
    EventBus.on('ui:toast', function (data) {
      show(data.message, data.type);
    });

    console.log('[ToastManager] Inicializado');
  }

  /**
   * Exibe uma notificação toast
   * @param {string} message - texto da notificação
   * @param {'s'|'e'|'w'|'i'} [type='s'] - success | error | warning | info
   * @param {number} [duration=2200] - duração em ms
   */
  function show(message, type, duration) {
    type     = type     || 's';
    duration = duration || 2200;

    _queue.push({ message: message, type: type, duration: duration });
    _processQueue();
  }

  /**
   * Processa a fila de toasts sequencialmente
   */
  function _processQueue() {
    if (_showing || _queue.length === 0) return;
    _showing = true;

    var item = _queue.shift();
    _render(item);
  }

  /**
   * Renderiza um toast no DOM
   * @param {{ message: string, type: string, duration: number }} item
   */
  function _render(item) {
    if (!_container) return;

    var el = document.createElement('div');
    el.className = 'toast toast--' + item.type;

    var icons = { s: '✓', e: '✕', w: '⚠', i: 'ℹ' };
    el.innerHTML = '<span class="toast__icon">' + (icons[item.type] || '•') + '</span>'
      + '<span class="toast__msg">' + item.message + '</span>';

    _container.appendChild(el);

    // Animação de entrada
    requestAnimationFrame(function () {
      el.classList.add('toast--visible');
    });

    // Remove após duration
    setTimeout(function () {
      el.classList.remove('toast--visible');
      el.classList.add('toast--hiding');

      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
        _showing = false;
        _processQueue(); // processa próximo na fila
      }, 300);
    }, item.duration);
  }

  /**
   * Atalhos semânticos
   */
  function success(msg, duration) { show(msg, 's', duration); }
  function error(msg, duration)   { show(msg, 'e', duration); }
  function warning(msg, duration) { show(msg, 'w', duration); }
  function info(msg, duration)    { show(msg, 'i', duration); }

  return { init: init, show: show, success: success, error: error, warning: warning, info: info };
}());

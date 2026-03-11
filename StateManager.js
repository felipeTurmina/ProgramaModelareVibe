/**
 * StateManager — Estado global centralizado
 * Única fonte de verdade para o estado da aplicação.
 * Emite eventos via EventBus quando o estado muda.
 */
const StateManager = (function () {
  'use strict';

  /** Estado inicial da aplicação */
  const _state = {
    // Módulos na cena
    modules: [],

    // Seleção atual
    selectedModule: null,
    selectedPieceMesh: null,
    selectedHardwareMesh: null,

    // Configurações de edição
    snapEnabled: true,
    transformMode: 'translate', // 'translate' | 'rotate' | 'scale'
    viewMode: '3d',             // '3d' | 'front' | 'top' | 'side'

    // UI
    activeSidePanel: 'left',    // 'left' | 'right'
    activeLeftTab: 'lib',       // 'lib' | 'proj'

    // Projeto
    projectName: 'Novo Projeto',
    isDirty: false,             // tem alterações não salvas
  };

  /**
   * Lê um valor do estado
   * @param {string} key
   * @returns {*}
   */
  function get(key) {
    return _state[key];
  }

  /**
   * Atualiza um ou mais valores no estado e emite evento de mudança
   * @param {Object} patch - objeto com chaves/valores a atualizar
   * @param {boolean} [silent] - se true, não emite eventos
   */
  function set(patch, silent) {
    var changed = [];

    Object.keys(patch).forEach(function (key) {
      if (_state[key] !== patch[key]) {
        _state[key] = patch[key];
        changed.push(key);
      }
    });

    if (silent || changed.length === 0) return;

    // Emite evento específico para cada chave alterada
    changed.forEach(function (key) {
      EventBus.emit('state:changed:' + key, { key: key, value: _state[key] });
    });

    // Emite evento geral de mudança
    EventBus.emit('state:changed', { keys: changed });
  }

  // ─── Ações de alto nível ──────────────────────────────────────────────

  /**
   * Adiciona um módulo à lista e emite evento
   * @param {THREE.Group} mod
   */
  function addModule(mod) {
    _state.modules.push(mod);
    _state.isDirty = true;
    EventBus.emit('module:added', { module: mod });
    EventBus.emit('state:changed:modules', { value: _state.modules });
  }

  /**
   * Remove um módulo da lista e emite evento
   * @param {THREE.Group} mod
   */
  function removeModule(mod) {
    var idx = _state.modules.indexOf(mod);
    if (idx === -1) return;
    _state.modules.splice(idx, 1);
    _state.isDirty = true;

    // Limpa seleção se era o módulo removido
    if (_state.selectedModule === mod) {
      _state.selectedModule = null;
      _state.selectedPieceMesh = null;
      EventBus.emit('selection:changed', { module: null });
    }

    EventBus.emit('module:removed', { module: mod });
    EventBus.emit('state:changed:modules', { value: _state.modules });
  }

  /**
   * Seleciona um módulo (ou deseleciona se null)
   * @param {THREE.Group|null} mod
   */
  function selectModule(mod) {
    var prev = _state.selectedModule;
    if (prev === mod) return;

    _state.selectedModule = mod;
    _state.selectedPieceMesh = null;
    _state.selectedHardwareMesh = null;

    EventBus.emit('selection:changed', { module: mod, previous: prev });
  }

  /**
   * Seleciona uma peça específica (mesh filho de um módulo)
   * @param {THREE.Mesh|null} mesh
   */
  function selectPiece(mesh) {
    _state.selectedPieceMesh = mesh;
    EventBus.emit('selection:piece', { mesh: mesh });
  }

  /**
   * Retorna cópia superficial do estado (readonly)
   * @returns {Object}
   */
  function snapshot() {
    return Object.assign({}, _state);
  }

  /**
   * Reseta o estado do projeto (mantém configs de UI)
   */
  function resetProject() {
    _state.modules = [];
    _state.selectedModule = null;
    _state.selectedPieceMesh = null;
    _state.selectedHardwareMesh = null;
    _state.isDirty = false;
    EventBus.emit('project:cleared');
    EventBus.emit('selection:changed', { module: null });
    EventBus.emit('state:changed:modules', { value: [] });
  }

  return {
    get: get,
    set: set,
    addModule: addModule,
    removeModule: removeModule,
    selectModule: selectModule,
    selectPiece: selectPiece,
    snapshot: snapshot,
    resetProject: resetProject,
  };
}());

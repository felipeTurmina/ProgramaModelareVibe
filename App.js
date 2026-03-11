/**
 * App.js — Ponto de entrada da aplicação
 *
 * Orquestra a inicialização de todos os módulos na ordem correta.
 * Nenhuma lógica de negócio aqui — apenas bootstrap.
 *
 * Ordem de inicialização:
 *   1. Core (EventBus, StateManager) — sem dependências
 *   2. Rendering (SceneManager, CameraManager) — dependem de DOM
 *   3. Managers (Material, Geometry, Animation) — dependem de SceneManager
 *   4. Editor (Selection, Project) — dependem de todos acima
 *   5. UI (Toast, PropertiesPanel, Panels, List) — dependem de tudo  ← [PATCH]
 *   6. Start loop
 */
const App = (function () {
  'use strict';

  /**
   * Inicializa toda a aplicação
   * Chamado no DOMContentLoaded
   */
  function init() {
    console.log('[App] Inicializando Marcenaria 3D...');

    try {
      // ── 1. Core ──────────────────────────────────────────────────────
      // EventBus e StateManager são IIFEs, já inicializados
      console.log('[App] Core: OK');

      // ── 2. Rendering ─────────────────────────────────────────────────
      SceneManager.init('c', 'vp');
      CameraManager.init(SceneManager.getCanvas());
      console.log('[App] Rendering: OK');

      // ── 3. Managers ───────────────────────────────────────────────────
      // MaterialCache e GeometryCache são IIFEs, já prontos
      AnimationManager.init();
      console.log('[App] Managers: OK');

      // ── 4. Editor ────────────────────────────────────────────────────
      SelectionManager.init(SceneManager.getCanvas());
      // ProjectManager não tem init() — funções puras
      console.log('[App] Editor: OK');

      // ── 5. UI ────────────────────────────────────────────────────────
      ToastManager.init();
      PropertiesPanel.init();   // [PATCH] painel de propriedades completo
      _bindUIEvents();
      _renderInitialUI();
      console.log('[App] UI: OK');

      // ── 6. Start loop ─────────────────────────────────────────────────
      SceneManager.startLoop();
      console.log('[App] Loop iniciado');

      // ── 7. Bindings globais legados (compatibilidade com main.js) ──────
      _exposeLegacyGlobals();

      console.log('[App] ✅ Inicialização completa');

    } catch (err) {
      console.error('[App] ❌ Erro na inicialização:', err);
    }
  }

  // ─── Bindings de eventos da UI ────────────────────────────────────────

  function _bindUIEvents() {
    // ── Toolbar: modos de transformação ────────────────────────────────
    _bindBtn('btn-translate', function () {
      SelectionManager.setTransformMode('translate');
    });
    _bindBtn('btn-rotate', function () {
      SelectionManager.setTransformMode('rotate');
    });
    _bindBtn('btn-scale', function () {
      SelectionManager.setTransformMode('scale');
    });

    // ── Toolbar: snap ───────────────────────────────────────────────────
    _bindBtn('btn-snap', function () {
      var snap = !StateManager.get('snapEnabled');
      StateManager.set({ snapEnabled: snap });
      var btn = document.getElementById('btn-snap');
      if (btn) btn.classList.toggle('active', snap);
    });

    // ── Toolbar: views ──────────────────────────────────────────────────
    ['perspective', 'front', 'top', 'left', 'right'].forEach(function (view) {
      _bindBtn('view-' + view, function () {
        CameraManager.setView(view);
      });
    });

    // ── Toolbar: foco no selecionado ────────────────────────────────────
    _bindBtn('btn-focus', function () {
      var mod = StateManager.get('selectedModule');
      if (mod) CameraManager.focusOn(mod);
    });

    // ── Toolbar: salvar / carregar ──────────────────────────────────────
    _bindBtn('btn-save', function () {
      ProjectManager.saveToFile();
    });

    _bindBtn('btn-load', function () {
      var fi = document.getElementById('fi');
      if (fi) ProjectManager.loadFromFileInput(fi);
    });

    // ── Toolbar: limpar cena ────────────────────────────────────────────
    _bindBtn('btn-clear', function () {
      ProjectManager.clearSceneWithConfirm();
    });

    // ── Toolbar: duplicar ────────────────────────────────────────────────
    _bindBtn('btn-duplicate', function () {
      ProjectManager.duplicateSelected();
    });

    // ── Toolbar: deletar ────────────────────────────────────────────────
    _bindBtn('btn-delete', function () {
      var mod = StateManager.get('selectedModule');
      if (mod) ProjectManager.removeModule(mod);
    });

    // ── Teclas de atalho ────────────────────────────────────────────────
    document.addEventListener('keydown', _onKeyDown);

    // ── Resize de painéis (esconde/mostra) ──────────────────────────────
    EventBus.on('ui:panel:toggled', function () {
      // Aguarda reflow antes de atualizar tamanho do canvas
      setTimeout(function () { SceneManager.resize(); }, 50);
    });
  }

  /**
   * Atalhos de teclado globais
   * @param {KeyboardEvent} e
   */
  function _onKeyDown(e) {
    // Ignora quando foco está em input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key) {
      case 'Delete':
      case 'Backspace': {
        var mod = StateManager.get('selectedModule');
        if (mod) {
          ProjectManager.removeModule(mod);
          e.preventDefault();
        }
        break;
      }
      case 'g':
      case 'G':
        SelectionManager.setTransformMode('translate');
        break;
      case 'r':
      case 'R':
        SelectionManager.setTransformMode('rotate');
        break;
      case 's':
      case 'S':
        if (e.ctrlKey || e.metaKey) {
          ProjectManager.saveToFile();
          e.preventDefault();
        } else {
          SelectionManager.setTransformMode('scale');
        }
        break;
      case 'Escape': {
        var sel = StateManager.get('selectedModule');
        if (sel) SelectionManager.selectModule(null);
        break;
      }
      case 'f':
      case 'F': {
        var focused = StateManager.get('selectedModule');
        if (focused) CameraManager.focusOn(focused);
        break;
      }
      case 'd':
      case 'D':
        if (e.ctrlKey || e.metaKey) {
          ProjectManager.duplicateSelected();
          e.preventDefault();
        }
        break;
    }
  }

  /**
   * Renderiza estado inicial da UI
   */
  function _renderInitialUI() {
    EventBus.emit('ui:list:refresh');
    EventBus.emit('ui:nosel');
  }

  /**
   * Expõe globais para compatibilidade com código legado do main.js
   * durante período de migração incremental
   */
  function _exposeLegacyGlobals() {
    window._App = {
      EventBus: EventBus,
      StateManager: StateManager,
      SceneManager: SceneManager,
      CameraManager: CameraManager,
      MaterialCache: MaterialCache,
      GeometryCache: GeometryCache,
      ModuleBuilder: ModuleBuilder,
      SelectionManager: SelectionManager,
      ProjectManager: ProjectManager,
      AnimationManager: AnimationManager,
      MathUtils: MathUtils,
      MaterialLibrary: MaterialLibrary,
      ToastManager: ToastManager,
      PropertiesPanel: PropertiesPanel,  // [PATCH] exposto para debug
    };

    // Performance stats (desenvolvimento)
    window._AppStats = function () {
      console.group('App Stats');
      console.log('Modules:', StateManager.get('modules').length);
      console.log('MaterialCache:', MaterialCache.stats());
      console.log('GeometryCache:', GeometryCache.stats());
      console.groupEnd();
    };
  }

  // ─── Helper privado ───────────────────────────────────────────────────

  function _bindBtn(id, handler) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', handler);
  }

  // ─── Inicialização no DOMContentLoaded ───────────────────────────────

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // DOM já carregado
    init();
  }

  return { init: init };
}());

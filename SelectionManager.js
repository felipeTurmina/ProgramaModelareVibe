/**
 * SelectionManager — Gerencia seleção de módulos e peças via raycasting
 *
 * Responsabilidades:
 *   - Detecção de clique via raycasting
 *   - Highlight visual do módulo selecionado
 *   - Highlight de peça individual
 *   - TransformControls (gizmo de transformação)
 *   - Duplo clique para animação de portas/gavetas
 */
const SelectionManager = (function () {
  'use strict';

  let _tc = null;           // TransformControls
  let _raycaster = null;
  let _mouse = null;
  let _canvas = null;
  let _wasDragging = false;

  // Emissive intensity para highlight
  const HL_MODULE = { color: 0x112244, intensity: 0.25 };
  const HL_PIECE  = { color: 0x0044aa, intensity: 0.55 };

  /**
   * Inicializa o sistema de seleção
   * @param {HTMLCanvasElement} canvas
   */
  function init(canvas) {
    _canvas   = canvas;
    _raycaster = new THREE.Raycaster();
    _mouse     = new THREE.Vector2();

    var camera = CameraManager.getCamera();
    var scene  = SceneManager.getScene();

    // TransformControls
    _tc = new THREE.TransformControls(camera, canvas);
    _tc.setSpace('world');
    _tc.setSize(0.8);
    scene.add(_tc);

    _bindTransformEvents();
    _bindCanvasEvents();
    _bindStateEvents();

    console.log('[SelectionManager] Inicializado');
  }

  // ─── Eventos de TransformControls ────────────────────────────────────

  function _bindTransformEvents() {
    // Desabilita orbit durante drag do gizmo
    _tc.addEventListener('dragging-changed', function (e) {
      CameraManager.enableOrbit(!e.value);
      if (!e.value) {
        _wasDragging = true; // swallow next click
      }
    });

    // Atualiza posição durante transformação
    _tc.addEventListener('objectChange', function () {
      var mod = StateManager.get('selectedModule');
      if (!mod) return;

      MathUtils.clampToFloor(mod);

      if (StateManager.get('snapEnabled')) {
        _autoAlign(mod);
      }

      EventBus.emit('module:transformed', { module: mod });
    });

    // Atualiza painel após soltar o gizmo
    _tc.addEventListener('mouseUp', function () {
      var mod = StateManager.get('selectedModule');
      if (mod) {
        MathUtils.clampToFloor(mod);
        EventBus.emit('ui:props:refresh');
      }
    });
  }

  // ─── Eventos de clique no canvas ─────────────────────────────────────

  function _bindCanvasEvents() {
    _canvas.addEventListener('click',     _onCanvasClick);
    _canvas.addEventListener('dblclick',  _onCanvasDblClick);
  }

  function _onCanvasClick(e) {
    // Swallow click após drag do transform
    if (_wasDragging) {
      _wasDragging = false;
      return;
    }

    _updateMousePos(e);

    var modules = StateManager.get('modules');
    var camera  = CameraManager.getCamera();

    _raycaster.setFromCamera(_mouse, camera);
    var intersects = _raycaster.intersectObjects(modules, true);

    if (intersects.length === 0) {
      // Clique no vazio: deseleciona
      selectModule(null);
      return;
    }

    // Encontra o módulo raiz (Group)
    var hit = intersects[0].object;
    var mod = _findModuleRoot(hit, modules);

    if (!mod) {
      selectModule(null);
      return;
    }

    var currentSel = StateManager.get('selectedModule');

    // Se clicou no módulo já selecionado, tenta selecionar a peça
    if (mod === currentSel) {
      if (hit.userData && hit.userData.pieceName) {
        _selectPiece(hit);
      }
    } else {
      selectModule(mod);
    }
  }

  function _onCanvasDblClick(e) {
    _updateMousePos(e);

    var modules = StateManager.get('modules');
    var camera  = CameraManager.getCamera();

    _raycaster.setFromCamera(_mouse, camera);
    var intersects = _raycaster.intersectObjects(modules, true);

    if (intersects.length === 0) return;

    var hit = intersects[0].object;

    // Verifica se é ferragem (hardware)
    if (hit.userData && hit.userData.isHardware) {
      StateManager.set({ selectedHardwareMesh: hit });
      EventBus.emit('selection:hardware', { mesh: hit });
      AnimationManager.showHint();
      return;
    }

    // Procura porta animável subindo na hierarquia
    var obj = hit;
    while (obj) {
      if (_isDoor(obj)) {
        AnimationManager.toggleDoor(obj);
        AnimationManager.showHint();
        return;
      }
      if (_isDrawer(obj)) {
        AnimationManager.toggleDrawer(obj);
        AnimationManager.showHint();
        return;
      }
      obj = obj.parent;
    }
  }

  /**
   * Verifica se objeto é uma porta animável
   */
  function _isDoor(obj) {
    return obj && obj.userData &&
      (obj.userData.closeAngle !== undefined || obj.userData.closePosX !== undefined);
  }

  /**
   * Verifica se objeto é um grupo de gaveta
   */
  function _isDrawer(obj) {
    return obj && obj.userData &&
      obj.userData.closePosZ !== undefined &&
      obj.userData.openPosZ !== undefined;
  }

  // ─── Seleção de módulo ────────────────────────────────────────────────

  /**
   * Seleciona um módulo (ou deseleciona se null)
   * @param {THREE.Group|null} mod
   */
  function selectModule(mod) {
    var prev = StateManager.get('selectedModule');

    // Limpa highlight do anterior
    if (prev) {
      _highlightModule(prev, false);
      var prevPiece = StateManager.get('selectedPieceMesh');
      if (prevPiece) {
        _highlightPiece(prevPiece, false);
      }
    }

    StateManager.selectModule(mod);

    if (mod) {
      _highlightModule(mod, true);
      _tc.attach(mod);
      EventBus.emit('ui:props:refresh');
    } else {
      _tc.detach();
      EventBus.emit('ui:nosel');
    }

    EventBus.emit('ui:list:refresh');
  }

  /**
   * Seleciona uma peça específica dentro do módulo selecionado
   * @param {THREE.Mesh} mesh
   */
  function _selectPiece(mesh) {
    var prevPiece = StateManager.get('selectedPieceMesh');
    if (prevPiece === mesh) {
      // Toggle: deseleciona peça
      _highlightPiece(prevPiece, false);
      var mod = StateManager.get('selectedModule');
      if (mod) _highlightModule(mod, true);
      StateManager.selectPiece(null);
      return;
    }

    if (prevPiece) {
      _highlightPiece(prevPiece, false);
    }

    StateManager.selectPiece(mesh);
    _highlightPiece(mesh, true);
    EventBus.emit('selection:piece', { mesh: mesh });
  }

  // ─── Highlight ────────────────────────────────────────────────────────

  /**
   * Aplica/remove highlight em um módulo completo
   * @param {THREE.Group} g
   * @param {boolean} on
   */
  function _highlightModule(g, on) {
    g.traverse(function (o) {
      if (!o.isMesh) return;
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(function (m) {
        if (m && m.emissive !== undefined) {
          m.emissive.set(on ? HL_MODULE.color : 0);
          m.emissiveIntensity = on ? HL_MODULE.intensity : 0;
        }
      });
    });
  }

  /**
   * Aplica/remove highlight em uma peça específica
   * @param {THREE.Mesh} mesh
   * @param {boolean} on
   */
  function _highlightPiece(mesh, on) {
    if (!mesh || !mesh.isMesh) return;
    var mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(function (m) {
      if (m && m.emissive !== undefined) {
        m.emissive.set(on ? HL_PIECE.color : (StateManager.get('selectedModule') ? HL_MODULE.color : 0));
        m.emissiveIntensity = on ? HL_PIECE.intensity : (StateManager.get('selectedModule') ? HL_MODULE.intensity : 0);
      }
    });
  }

  // ─── Utilitários ─────────────────────────────────────────────────────

  function _updateMousePos(e) {
    var rect = _canvas.getBoundingClientRect();
    _mouse.x = ((e.clientX - rect.left) / rect.width)  *  2 - 1;
    _mouse.y = ((e.clientY - rect.top)  / rect.height) * -2 + 1;
  }

  /**
   * Encontra o módulo raiz (Group de nível 1 na lista de módulos)
   * dado um mesh filho
   */
  function _findModuleRoot(mesh, modules) {
    var obj = mesh;
    while (obj) {
      if (modules.indexOf(obj) !== -1) return obj;
      obj = obj.parent;
    }
    return null;
  }

  /**
   * Auto-alinhamento: aproxima módulo de vizinhos adjacentes
   * @param {THREE.Group} mod
   */
  function _autoAlign(mod) {
    if (!mod) return;

    var modules = StateManager.get('modules');
    var bb1 = MathUtils.getBoundingBox(mod);
    var SNAP_DIST = 30; // mm de tolerância para snap

    modules.forEach(function (other) {
      if (other === mod) return;
      var bb2 = MathUtils.getBoundingBox(other);

      // Snap lateral (X): alinha face direita de 'other' com face esquerda de 'mod'
      var gap_x = Math.abs(bb1.min.x - bb2.max.x);
      if (gap_x < SNAP_DIST) {
        mod.position.x += bb2.max.x - bb1.min.x;
        bb1 = MathUtils.getBoundingBox(mod);
      }

      // Snap lateral (X): alinha face esquerda de 'other' com face direita de 'mod'
      gap_x = Math.abs(bb1.max.x - bb2.min.x);
      if (gap_x < SNAP_DIST) {
        mod.position.x += bb2.min.x - bb1.max.x;
        bb1 = MathUtils.getBoundingBox(mod);
      }
    });
  }

  // ─── Eventos do StateManager ──────────────────────────────────────────

  function _bindStateEvents() {
    // Quando módulo é removido, deseleciona
    EventBus.on('module:removed', function (data) {
      if (StateManager.get('selectedModule') === data.module) {
        selectModule(null);
      }
    });

    // Modo de transformação
    EventBus.on('editor:transform:mode', function (data) {
      if (_tc) _tc.setMode(data.mode);
    });
  }

  // ─── API pública ──────────────────────────────────────────────────────

  /**
   * Define modo do TransformControls
   * @param {'translate'|'rotate'|'scale'} mode
   */
  function setTransformMode(mode) {
    if (_tc) {
      _tc.setMode(mode);
      StateManager.set({ transformMode: mode }, true);
    }
  }

  /**
   * Expõe highlight para uso externo (ex: lista de objetos)
   */
  function highlightModule(g, on) { _highlightModule(g, on); }
  function highlightPiece(mesh, on) { _highlightPiece(mesh, on); }

  /** @returns {THREE.TransformControls} */
  function getTransformControls() { return _tc; }

  return {
    init: init,
    selectModule: selectModule,
    setTransformMode: setTransformMode,
    highlightModule: highlightModule,
    highlightPiece: highlightPiece,
    getTransformControls: getTransformControls,
  };
}());

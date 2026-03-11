/**
 * CameraManager — Gerencia câmera perspectiva, OrbitControls e views
 *
 * Responsabilidades:
 *   - Câmera perspectiva principal
 *   - OrbitControls com damping
 *   - Views predefinidas: frontal, lateral, topo, perspectiva
 *   - Animação suave de transição entre views
 */
const CameraManager = (function () {
  'use strict';

  let _camera  = null;
  let _orbit   = null;
  let _canvas  = null;
  let _isAnimating = false;

  // Views predefinidas
  const VIEWS = {
    perspective: {
      position: { x: 1800, y: 1400, z: 2200 },
      target:   { x: 0,    y: 600,  z: 0    },
    },
    front: {
      position: { x: 0,    y: 900,  z: 4000 },
      target:   { x: 0,    y: 900,  z: 0    },
    },
    top: {
      position: { x: 0,    y: 5000, z: 1    },
      target:   { x: 0,    y: 0,    z: 0    },
    },
    left: {
      position: { x: -4000, y: 900, z: 0    },
      target:   { x: 0,     y: 900, z: 0    },
    },
    right: {
      position: { x: 4000, y: 900,  z: 0    },
      target:   { x: 0,    y: 900,  z: 0    },
    },
  };

  /**
   * Inicializa câmera e orbit controls
   * @param {HTMLCanvasElement} canvas
   */
  function init(canvas) {
    _canvas = canvas;

    // Câmera perspectiva com FOV e clipping adequados para marcenaria
    _camera = new THREE.PerspectiveCamera(45, 1, 10, 200000);
    _camera.position.set(1800, 1400, 2200);
    _camera.lookAt(0, 600, 0);

    // Orbit Controls com damping suave
    _orbit = new THREE.OrbitControls(_camera, canvas);
    _orbit.target.set(0, 600, 0);
    _orbit.minDistance  = 200;
    _orbit.maxDistance  = 50000;
    _orbit.maxPolarAngle = Math.PI / 2 - 0.02; // evita girar abaixo do piso
    _orbit.enableDamping = true;
    _orbit.dampingFactor = 0.08;

    // Registra câmera no SceneManager
    SceneManager.setCamera(_camera);

    // Registra tick para orbit damping
    SceneManager.onTick(function () {
      _orbit.update();
    });

    console.log('[CameraManager] Inicializado');
  }

  /**
   * Anima câmera suavemente para uma view predefinida
   * @param {string} viewName - 'perspective' | 'front' | 'top' | 'left' | 'right'
   * @param {number} [duration=600] - duração em ms
   */
  function setView(viewName, duration) {
    var view = VIEWS[viewName];
    if (!view) {
      console.warn('[CameraManager] View desconhecida:', viewName);
      return;
    }

    duration = duration || 600;
    _animateToView(view.position, view.target, duration);
    StateManager.set({ viewMode: viewName }, true);
    EventBus.emit('camera:view:changed', { view: viewName });
  }

  /**
   * Anima câmera para enquadrar um objeto específico
   * @param {THREE.Object3D} obj
   * @param {number} [padding=1.3] - fator de padding
   */
  function focusOn(obj, padding) {
    if (!obj) return;
    padding = padding || 1.3;

    var bb  = new THREE.Box3().setFromObject(obj);
    var center = bb.getCenter(new THREE.Vector3());
    var size   = bb.getSize(new THREE.Vector3());
    var maxDim = Math.max(size.x, size.y, size.z) * padding;

    var targetPos = {
      x: center.x + maxDim * 0.8,
      y: center.y + maxDim * 0.6,
      z: center.z + maxDim * 0.8,
    };

    _animateToView(targetPos, { x: center.x, y: center.y, z: center.z }, 500);
  }

  /**
   * Animação suave de câmera (lerp)
   * @param {Object} toPos   - { x, y, z }
   * @param {Object} toTarget - { x, y, z }
   * @param {number} duration
   */
  function _animateToView(toPos, toTarget, duration) {
    if (_isAnimating) return;
    _isAnimating = true;

    var startPos    = _camera.position.clone();
    var startTarget = _orbit.target.clone();
    var endPos    = new THREE.Vector3(toPos.x, toPos.y, toPos.z);
    var endTarget = new THREE.Vector3(toTarget.x, toTarget.y, toTarget.z);

    var startTime = performance.now();

    // Usa easing cúbico para suavidade
    function _easeInOut(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    var removeTickCb = SceneManager.onTick(function () {
      var elapsed = performance.now() - startTime;
      var t = Math.min(elapsed / duration, 1);
      var e = _easeInOut(t);

      _camera.position.lerpVectors(startPos, endPos, e);
      _orbit.target.lerpVectors(startTarget, endTarget, e);
      _orbit.update();

      if (t >= 1) {
        _isAnimating = false;
        removeTickCb();
      }
    });
  }

  /**
   * Atualiza aspect ratio (chamado pelo SceneManager no resize)
   * @param {number} aspect
   */
  function setAspect(aspect) {
    if (_camera) {
      _camera.aspect = aspect;
      _camera.updateProjectionMatrix();
    }
  }

  /** @returns {THREE.PerspectiveCamera} */
  function getCamera() { return _camera; }

  /** @returns {THREE.OrbitControls} */
  function getOrbit() { return _orbit; }

  /** Desabilita orbit durante drag de transform */
  function enableOrbit(enabled) {
    if (_orbit) _orbit.enabled = enabled;
  }

  return {
    init: init,
    setView: setView,
    focusOn: focusOn,
    getCamera: getCamera,
    getOrbit: getOrbit,
    enableOrbit: enableOrbit,
    VIEWS: VIEWS,
  };
}());

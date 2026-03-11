/**
 * SceneManager — Gerencia a cena Three.js, renderer, luzes e viewport
 *
 * Responsabilidades:
 *   - Inicialização da cena, renderer e iluminação
 *   - Resize responsivo do canvas
 *   - Loop de animação principal
 *   - Grid e piso
 */
const SceneManager = (function () {
  'use strict';

  // ─── Referências internas ──────────────────────────────────────────────
  let _scene    = null;
  let _renderer = null;
  let _camera   = null;
  let _canvas   = null;
  let _vpEl     = null;
  let _animId   = null;

  // Callbacks do loop de animação (registrados por outros módulos)
  const _tickCallbacks = [];

  // ─── Inicialização ─────────────────────────────────────────────────────

  /**
   * Inicializa toda a infraestrutura de renderização
   * @param {string} canvasId  - id do elemento canvas
   * @param {string} viewportId - id do elemento container do viewport
   */
  function init(canvasId, viewportId) {
    _canvas = document.getElementById(canvasId);
    _vpEl   = document.getElementById(viewportId);

    if (!_canvas || !_vpEl) {
      throw new Error('[SceneManager] Canvas ou viewport não encontrado');
    }

    _initScene();
    _initRenderer();
    _initLights();
    _initGrid();

    window.addEventListener('resize', _doResize);
    _doResize();

    console.log('[SceneManager] Inicializado');
  }

  /**
   * Configura cena Three.js
   */
  function _initScene() {
    _scene = new THREE.Scene();
    _scene.background = new THREE.Color(0x1a1d26);
  }

  /**
   * Configura renderer com qualidade otimizada
   */
  function _initRenderer() {
    _renderer = new THREE.WebGLRenderer({
      canvas: _canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });

    // Limita pixel ratio para performance em telas de alta densidade
    _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // Sombras com qualidade balanceada
    _renderer.shadowMap.enabled = true;
    _renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Tone mapping cinematográfico
    _renderer.toneMapping = THREE.ACESFilmicToneMapping;
    _renderer.toneMappingExposure = 1.6;

    // Encoding de output correto para sRGB
    _renderer.outputEncoding = THREE.sRGBEncoding;
  }

  /**
   * Configura iluminação da cena
   * 3 fontes: ambiente + 2 direcionais para profundidade
   */
  function _initLights() {
    // Luz ambiente suave
    _scene.add(new THREE.AmbientLight(0xffffff, 0.8));

    // Luz principal com sombra
    var dL = new THREE.DirectionalLight(0xffffff, 1.6);
    dL.position.set(2000, 3000, 2000);
    dL.castShadow = true;
    dL.shadow.mapSize.width  = 2048;
    dL.shadow.mapSize.height = 2048;
    dL.shadow.camera.left   = -4000;
    dL.shadow.camera.right  =  4000;
    dL.shadow.camera.top    =  4000;
    dL.shadow.camera.bottom = -4000;
    dL.shadow.camera.near   = 100;
    dL.shadow.camera.far    = 12000;
    _scene.add(dL);

    // Luz de preenchimento (fill light)
    var dL2 = new THREE.DirectionalLight(0x8899bb, 0.6);
    dL2.position.set(-2000, 1000, -500);
    _scene.add(dL2);

    // Luz traseira (rim light) para profundidade
    var dL3 = new THREE.DirectionalLight(0xf0c060, 0.35);
    dL3.position.set(0, 500, -3000);
    _scene.add(dL3);
  }

  /**
   * Configura grid e piso da cena
   */
  function _initGrid() {
    // Grid fino (100 divisões)
    var gr1 = new THREE.GridHelper(10000, 100, 0x1e2530, 0x1e2530);
    gr1.material.transparent = true;
    gr1.material.opacity = 0.8;
    _scene.add(gr1);

    // Grid grosso (20 divisões) — referência visual de metros
    var gr2 = new THREE.GridHelper(10000, 20, 0x2a3040, 0x252a38);
    gr2.position.y = 0.5;
    gr2.material.transparent = true;
    gr2.material.opacity = 0.5;
    _scene.add(gr2);

    // Piso
    var flr = new THREE.Mesh(
      new THREE.PlaneGeometry(20000, 20000),
      new THREE.MeshStandardMaterial({
        color: 0x0c0e11,
        roughness: 0.9,
        metalness: 0.1,
      })
    );
    flr.rotation.x = -Math.PI / 2;
    flr.receiveShadow = true;
    _scene.add(flr);

    // Axes helper para referência (pode ser ocultado em produção)
    _scene.add(new THREE.AxesHelper(300));
  }

  /**
   * Redimensiona renderer ao tamanho atual do viewport
   */
  function _doResize() {
    if (!_vpEl || !_renderer || !_camera) return;
    var w = _vpEl.clientWidth;
    var h = _vpEl.clientHeight;
    if (w < 1 || h < 1) return;

    _renderer.setSize(w, h);
    _camera.aspect = w / h;
    _camera.updateProjectionMatrix();
  }

  // ─── Loop de animação ──────────────────────────────────────────────────

  /**
   * Inicia o loop de animação
   */
  function startLoop() {
    if (_animId !== null) return; // já rodando
    var lastTime = 0;

    function loop(now) {
      _animId = requestAnimationFrame(loop);
      var dt = now ? Math.min(now - lastTime, 100) : 16;
      lastTime = now || 0;

      // Executa todos os callbacks registrados (animações, orbit, etc.)
      for (var i = 0; i < _tickCallbacks.length; i++) {
        try {
          _tickCallbacks[i](dt);
        } catch (err) {
          console.error('[SceneManager] Erro no tick callback:', err);
        }
      }

      // Renderiza a cena
      try {
        _renderer.render(_scene, _camera);
      } catch (err) {
        console.error('[SceneManager] Erro de renderização:', err);
      }
    }

    requestAnimationFrame(loop);
  }

  /**
   * Para o loop de animação
   */
  function stopLoop() {
    if (_animId !== null) {
      cancelAnimationFrame(_animId);
      _animId = null;
    }
  }

  /**
   * Registra callback para execução a cada frame
   * @param {Function} fn - recebe (deltaTime: number)
   * @returns {Function} função para remover o callback
   */
  function onTick(fn) {
    _tickCallbacks.push(fn);
    return function () {
      var idx = _tickCallbacks.indexOf(fn);
      if (idx !== -1) _tickCallbacks.splice(idx, 1);
    };
  }

  // ─── API de acesso às referências ─────────────────────────────────────

  /** @returns {THREE.Scene} */
  function getScene() { return _scene; }

  /** @returns {THREE.WebGLRenderer} */
  function getRenderer() { return _renderer; }

  /** @returns {HTMLCanvasElement} */
  function getCanvas() { return _canvas; }

  /**
   * Define a câmera (chamado pelo CameraManager após inicialização)
   * @param {THREE.Camera} camera
   */
  function setCamera(camera) {
    _camera = camera;
    _doResize(); // atualiza aspect ratio
  }

  /**
   * Adiciona objeto à cena
   * @param {THREE.Object3D} obj
   */
  function add(obj) {
    _scene.add(obj);
  }

  /**
   * Remove objeto da cena e descarta geometrias/materiais
   * @param {THREE.Object3D} obj
   * @param {boolean} [disposeResources=true]
   */
  function remove(obj, disposeResources) {
    _scene.remove(obj);

    if (disposeResources !== false) {
      obj.traverse(function (child) {
        if (!child.isMesh) return;

        // Não descarta geometrias cacheadas
        // (GeometryCache gerencia seu próprio ciclo de vida)

        // Descarta apenas materiais não-cacheados (ex: stone, metal)
        var mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        mats.forEach(function (m) {
          if (m && m.userData && m.userData._notCached) {
            m.dispose();
          }
        });
      });
    }
  }

  /**
   * Força resize (útil ao mostrar/ocultar painéis)
   */
  function resize() { _doResize(); }

  return {
    init: init,
    startLoop: startLoop,
    stopLoop: stopLoop,
    onTick: onTick,
    getScene: getScene,
    getRenderer: getRenderer,
    getCanvas: getCanvas,
    setCamera: setCamera,
    add: add,
    remove: remove,
    resize: resize,
  };
}());

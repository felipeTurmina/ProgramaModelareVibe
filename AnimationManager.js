/**
 * AnimationManager — Animações de portas e gavetas
 *
 * Responsabilidades:
 *   - Sistema de tweening próprio (sem dependência externa)
 *   - Animação de portas (rotação em Y)
 *   - Animação de gavetas (translação em Z)
 *   - Toggle abrir/fechar com duplo clique
 */
const AnimationManager = (function () {
  'use strict';

  /** @type {Array<{obj, prop, from, to, elapsed, duration, done}>} */
  const _tweens = [];

  /** Hint de animação (tooltip visual) */
  let _hintEl = null;
  let _hintTimer = null;

  /**
   * Inicializa o manager e registra tick no loop principal
   */
  function init() {
    _createHintElement();

    // Registra processamento de tweens no loop de animação
    SceneManager.onTick(function (dt) {
      _tickTweens(dt);
    });

    console.log('[AnimationManager] Inicializado');
  }

  /**
   * Cria o elemento de hint visual
   */
  function _createHintElement() {
    _hintEl = document.createElement('div');
    _hintEl.id = 'animhint';
    _hintEl.style.cssText = [
      'position:fixed',
      'bottom:48px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(240,165,0,.15)',
      'border:1px solid rgba(240,165,0,.4)',
      'color:#f0a500',
      'font-size:11px',
      'padding:5px 14px',
      'border-radius:20px',
      'pointer-events:none',
      'opacity:0',
      'transition:opacity .3s',
      'z-index:50',
    ].join(';');
    _hintEl.textContent = '⟵ Duplo-clique para abrir/fechar portas e gavetas ⟶';
    document.body.appendChild(_hintEl);
  }

  /**
   * Exibe o hint por 2.4 segundos
   */
  function showHint() {
    if (!_hintEl) return;
    _hintEl.style.opacity = '1';
    clearTimeout(_hintTimer);
    _hintTimer = setTimeout(function () {
      if (_hintEl) _hintEl.style.opacity = '0';
    }, 2400);
  }

  // ─── Engine de tweening ───────────────────────────────────────────────

  /**
   * Anima uma propriedade de um objeto de from → to
   * @param {Object} obj       - objeto com a propriedade
   * @param {string} prop      - nome da propriedade
   * @param {number} from      - valor inicial
   * @param {number} to        - valor final
   * @param {number} [duration=420] - duração em ms
   * @returns {Object} tween (pode ser cancelado com tween.cancel())
   */
  function animateProp(obj, prop, from, to, duration) {
    duration = duration || 420;

    // Cancela tween existente para o mesmo objeto/prop
    _cancelExisting(obj, prop);

    var tween = {
      obj: obj,
      prop: prop,
      from: from,
      to: to,
      elapsed: 0,
      duration: duration,
      done: false,
      cancel: function () { this.done = true; },
    };

    _tweens.push(tween);
    return tween;
  }

  /**
   * Cancela tweens existentes para um objeto/prop específico
   */
  function _cancelExisting(obj, prop) {
    _tweens.forEach(function (t) {
      if (t.obj === obj && t.prop === prop) t.done = true;
    });
  }

  /**
   * Easing: ease-in-out cúbico
   * @param {number} t - progresso 0..1
   * @returns {number}
   */
  function _easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  /**
   * Processa todos os tweens ativos
   * @param {number} dt - delta time em ms
   */
  function _tickTweens(dt) {
    var i = _tweens.length;
    while (i--) {
      var tw = _tweens[i];
      if (tw.done) {
        _tweens.splice(i, 1);
        continue;
      }

      tw.elapsed += dt;
      var progress = Math.min(tw.elapsed / tw.duration, 1);
      var eased    = _easeInOut(progress);

      tw.obj[tw.prop] = tw.from + (tw.to - tw.from) * eased;

      if (progress >= 1) {
        tw.obj[tw.prop] = tw.to; // garante valor exato no final
        tw.done = true;
      }
    }
  }

  // ─── Toggle de portas e gavetas ───────────────────────────────────────

  /**
   * Alterna estado aberto/fechado de uma porta
   * @param {THREE.Object3D} pivot - objeto pivot da porta (com userData)
   */
  function toggleDoor(pivot) {
    if (!pivot || !pivot.userData) return;

    var isOpen = !!pivot.userData.isOpen;

    if (pivot.userData._slideDoor) {
      // Porta de correr: anima posição X
      var fromX = pivot.position.x;
      var toX   = isOpen ? pivot.userData.closePosX : pivot.userData.openPosX;
      pivot.userData.isOpen = !isOpen;
      animateProp(pivot.position, 'x', fromX, toX, 400);
    } else {
      // Porta de abrir: anima rotação Y
      var fromAngle = pivot.rotation.y;
      var toAngle   = isOpen ? pivot.userData.closeAngle : pivot.userData.openAngle;
      pivot.userData.isOpen = !isOpen;
      animateProp(pivot.rotation, 'y', fromAngle, toAngle, 420);
    }
  }

  /**
   * Alterna estado aberto/fechado de uma gaveta
   * @param {THREE.Group} drawerGroup - grupo da gaveta com userData
   */
  function toggleDrawer(drawerGroup) {
    if (!drawerGroup || !drawerGroup.userData) return;

    var isOpen = !!drawerGroup.userData.isOpen;
    var fromZ  = drawerGroup.position.z;
    var toZ    = isOpen
      ? drawerGroup.userData.closePosZ
      : drawerGroup.userData.openPosZ;

    drawerGroup.userData.isOpen = !isOpen;
    animateProp(drawerGroup.position, 'z', fromZ, toZ, 420);
  }

  /**
   * Marca um objeto Three.js e seus filhos para animação
   * (configura userData.closePosZ / openPosZ para gavetas, etc.)
   * @param {THREE.Group} moduleGroup
   */
  function tagAnimatables(moduleGroup) {
    moduleGroup.traverse(function (child) {
      if (!child.userData) return;

      // Gavetas: configura posições de animação
      if (child.userData._isDrawerGroup) {
        var depth = child.userData.moduleDepth || 550;
        child.userData.closePosZ = 0;
        child.userData.openPosZ  = depth * 0.7;
        child.userData.isOpen    = false;
      }

      // Portas: ângulos já configurados durante construção do módulo
    });
  }

  /**
   * Fecha todas as portas e gavetas de um módulo
   * @param {THREE.Group} moduleGroup
   */
  function closeAll(moduleGroup) {
    if (!moduleGroup) return;

    moduleGroup.traverse(function (child) {
      if (!child.userData) return;

      if (child.userData.isOpen) {
        if (child.userData._isDrawerGroup) {
          toggleDrawer(child);
        } else if (child.userData.closeAngle !== undefined
                || child.userData.closePosX !== undefined) {
          toggleDoor(child);
        }
      }
    });
  }

  return {
    init: init,
    showHint: showHint,
    animateProp: animateProp,
    toggleDoor: toggleDoor,
    toggleDrawer: toggleDrawer,
    tagAnimatables: tagAnimatables,
    closeAll: closeAll,
  };
}());

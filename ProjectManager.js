/**
 * ProjectManager — Gerencia salvar/carregar/limpar projetos
 *
 * Responsabilidades:
 *   - Serialização do projeto para JSON
 *   - Carregamento de projeto a partir de JSON
 *   - Limpar cena
 *   - Controle de "projeto modificado" (isDirty)
 */
const ProjectManager = (function () {
  'use strict';

  const CURRENT_VERSION = '2.1';

  // ─── Serialização ─────────────────────────────────────────────────────

  /**
   * Serializa o projeto atual para objeto JSON
   * @returns {Object} dados do projeto
   */
  function serialize() {
    var modules = StateManager.get('modules');

    return {
      version: CURRENT_VERSION,
      savedAt: new Date().toISOString(),
      name: StateManager.get('projectName') || 'Projeto',
      modules: modules.map(function (m) {
        return {
          type:       m.userData.type,
          params:     _deepClone(m.userData.params),
          customName: m.userData.customName || null,
          position:   { x: m.position.x, y: m.position.y, z: m.position.z },
          rotation:   { x: m.rotation.x,  y: m.rotation.y,  z: m.rotation.z  },
          scale:      { x: m.scale.x,     y: m.scale.y,     z: m.scale.z     },
        };
      }),
    };
  }

  /**
   * Salva o projeto como arquivo JSON no computador do usuário
   */
  function saveToFile() {
    var data     = serialize();
    var json     = JSON.stringify(data, null, 2);
    var blob     = new Blob([json], { type: 'application/json' });
    var url      = URL.createObjectURL(blob);
    var filename = 'projeto_' + Date.now() + '.json';

    var a      = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();

    URL.revokeObjectURL(url);
    StateManager.set({ isDirty: false });

    EventBus.emit('project:saved');
    EventBus.emit('ui:toast', { message: 'Projeto salvo!', type: 's' });
  }

  // ─── Carregamento ─────────────────────────────────────────────────────

  /**
   * Abre diálogo de arquivo e carrega projeto JSON
   * @param {HTMLInputElement} fileInput - input[type=file]
   */
  function loadFromFileInput(fileInput) {
    fileInput.value = '';
    fileInput.onchange = function () {
      var file = fileInput.files[0];
      if (!file) return;

      var reader = new FileReader();
      reader.onload = function (e) {
        try {
          var data = JSON.parse(e.target.result);
          loadFromData(data);
        } catch (err) {
          console.error('[ProjectManager] Erro ao carregar projeto:', err);
          EventBus.emit('ui:toast', { message: 'Erro ao carregar projeto', type: 'e' });
        }
      };
      reader.readAsText(file);
    };
    fileInput.click();
  }

  /**
   * Carrega projeto a partir de dados JSON
   * @param {Object} data - dados serializados
   */
  function loadFromData(data) {
    if (!data || !data.modules) {
      EventBus.emit('ui:toast', { message: 'Arquivo inválido', type: 'e' });
      return;
    }

    // Limpa cena atual
    clearScene();

    var scene = SceneManager.getScene();

    // Reconstrói cada módulo
    data.modules.forEach(function (md) {
      try {
        var g = ModuleBuilder.buildMod(md.type, md.params || {});

        if (md.position) {
          g.position.set(md.position.x, md.position.y, md.position.z);
        }
        if (md.rotation) {
          g.rotation.set(md.rotation.x, md.rotation.y, md.rotation.z);
        }
        if (md.scale) {
          g.scale.set(md.scale.x, md.scale.y, md.scale.z);
        }
        if (md.customName) {
          g.userData.customName = md.customName;
        }

        // Garante que não está abaixo do piso
        MathUtils.clampToFloor(g);

        scene.add(g);
        StateManager.addModule(g);
        AnimationManager.tagAnimatables(g);
      } catch (err) {
        console.error('[ProjectManager] Erro ao reconstruir módulo:', md.type, err);
      }
    });

    if (data.name) {
      StateManager.set({ projectName: data.name, isDirty: false });
    }

    EventBus.emit('project:loaded', { data: data });
    EventBus.emit('ui:list:refresh');
    EventBus.emit('ui:toast', {
      message: 'Projeto carregado (' + data.modules.length + ' módulos)',
      type: 's',
    });
  }

  // ─── Gerenciamento da cena ────────────────────────────────────────────

  /**
   * Remove todos os módulos da cena e reseta o estado
   */
  function clearScene() {
    var modules = StateManager.get('modules').slice(); // cópia para iterar
    var scene   = SceneManager.getScene();

    modules.forEach(function (mod) {
      SceneManager.remove(mod, true);
      StateManager.removeModule(mod);
    });

    StateManager.resetProject();

    EventBus.emit('ui:list:refresh');
    EventBus.emit('ui:nosel');
  }

  /**
   * Limpa cena com confirmação do usuário (se projeto tiver módulos)
   * @returns {boolean} true se limpou
   */
  function clearSceneWithConfirm() {
    var modules = StateManager.get('modules');

    if (modules.length > 0) {
      var ok = confirm('Limpar projeto? Todos os módulos serão removidos.');
      if (!ok) return false;
    }

    clearScene();
    EventBus.emit('ui:toast', { message: 'Projeto limpo', type: 'i' });
    return true;
  }

  /**
   * Adiciona um módulo à cena e ao estado
   * @param {string} type   - tipo do módulo
   * @param {Object} [params] - parâmetros opcionais
   * @returns {THREE.Group}
   */
  function addModule(type, params) {
    var g = ModuleBuilder.buildMod(type, params || {});

    // Posição inicial: próximo ao último módulo na fila
    var modules = StateManager.get('modules');
    if (modules.length > 0) {
      var last   = modules[modules.length - 1];
      var lastBB = MathUtils.getBoundingBox(last);
      g.position.x = lastBB.max.x + (g.userData.params
        ? (g.userData.params.width || 600) / 2 + 10
        : 310);
    }

    MathUtils.clampToFloor(g);
    SceneManager.add(g);
    StateManager.addModule(g);
    AnimationManager.tagAnimatables(g);

    SelectionManager.selectModule(g);
    EventBus.emit('ui:list:refresh');
    EventBus.emit('ui:toast', { message: g.userData.moduleType + ' adicionado', type: 's' });

    return g;
  }

  /**
   * Remove um módulo da cena
   * @param {THREE.Group} mod
   * @param {boolean} [withToast=true]
   */
  function removeModule(mod, withToast) {
    if (!mod) return;

    SceneManager.remove(mod, true);
    StateManager.removeModule(mod);

    EventBus.emit('ui:list:refresh');

    if (withToast !== false) {
      EventBus.emit('ui:toast', { message: 'Módulo removido', type: 'i' });
    }
  }

  /**
   * Reconstrói um módulo com novos parâmetros (preservando posição/rotação)
   * @param {THREE.Group} old
   * @param {Object} newParams
   * @returns {THREE.Group}
   */
  function rebuildModule(old, newParams) {
    if (!old) return null;

    var type = old.userData.type;
    var pos  = old.position.clone();
    var rot  = old.rotation.clone();
    var cn   = old.userData.customName;

    // Preserva ferragens se não definidas nos novos params
    if (!newParams.hardwareItems) {
      newParams.hardwareItems = (old.userData.hardwareItems || []).map(function (h) {
        return Object.assign({}, h);
      });
    }

    removeModule(old, false);

    var g = ModuleBuilder.buildMod(type, newParams);
    g.position.copy(pos);
    g.rotation.copy(rot);
    if (cn) g.userData.customName = cn;

    MathUtils.clampToFloor(g);
    SceneManager.add(g);
    StateManager.addModule(g);
    AnimationManager.tagAnimatables(g);

    SelectionManager.selectModule(g);
    EventBus.emit('module:rebuilt', { old: old, next: g });
    EventBus.emit('ui:list:refresh');

    return g;
  }

  /**
   * Duplica o módulo selecionado
   * @returns {THREE.Group|null}
   */
  function duplicateSelected() {
    var mod = StateManager.get('selectedModule');
    if (!mod) return null;

    var p = _deepClone(mod.userData.params);

    var g = ModuleBuilder.buildMod(mod.userData.type, p);
    g.position.copy(mod.position);
    g.position.x += (p.width || 600) + 20;
    g.position.x = Math.max(-8000, Math.min(8000, g.position.x));

    MathUtils.clampToFloor(g);
    if (mod.userData.customName) {
      g.userData.customName = mod.userData.customName + ' (cópia)';
    }

    SceneManager.add(g);
    StateManager.addModule(g);
    AnimationManager.tagAnimatables(g);
    SelectionManager.selectModule(g);

    EventBus.emit('module:duplicated', { source: mod, copy: g });
    EventBus.emit('ui:list:refresh');
    EventBus.emit('ui:toast', { message: 'Módulo duplicado', type: 's' });

    return g;
  }

  // ─── Utilitários privados ─────────────────────────────────────────────

  function _deepClone(obj) {
    if (!obj) return {};
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (e) {
      return Object.assign({}, obj);
    }
  }

  return {
    serialize: serialize,
    saveToFile: saveToFile,
    loadFromFileInput: loadFromFileInput,
    loadFromData: loadFromData,
    clearScene: clearScene,
    clearSceneWithConfirm: clearSceneWithConfirm,
    addModule: addModule,
    removeModule: removeModule,
    rebuildModule: rebuildModule,
    duplicateSelected: duplicateSelected,
  };
}());

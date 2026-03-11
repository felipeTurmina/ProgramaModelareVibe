/**
 * PropertiesPanel.js — Painel de propriedades com editor interno completo
 *
 * Funcionalidades:
 *   - Editar dimensões (W, H, D)
 *   - Gerenciar prateleiras: adicionar, remover, mover individualmente
 *   - Gerenciar divisórias verticais: adicionar, remover, mover
 *   - Alterar material e cor
 *   - Preview em tempo real (rebuild ao confirmar)
 *
 * Depende de: EventBus, StateManager, ProjectManager, MaterialLibrary
 */
const PropertiesPanel = (function () {
  'use strict';

  let _container = null;  // #props-body
  let _titleEl   = null;  // #props-title

  // Estado local do editor (cópia dos params editáveis)
  let _draft  = null;   // objeto params sendo editado
  let _mod    = null;   // módulo selecionado atual

  // ─── Inicialização ────────────────────────────────────────────────

  function init() {
    _container = document.getElementById('props-body');
    _titleEl   = document.getElementById('props-title');

    if (!_container) {
      console.error('[PropertiesPanel] #props-body não encontrado');
      return;
    }

    // Escuta seleção de módulo
    EventBus.on('selection:changed', function (data) {
      if (data.module) {
        _onSelect(data.module);
      } else {
        _onDeselect();
      }
    });

    // Refresh solicitado (ex: após rebuild)
    EventBus.on('ui:props:refresh', function () {
      var mod = StateManager.get('selectedModule');
      if (mod) _onSelect(mod);
    });

    _onDeselect();
    console.log('[PropertiesPanel] Inicializado');
  }

  // ─── Handlers de seleção ──────────────────────────────────────────

  function _onSelect(mod) {
    _mod   = mod;
    _draft = _deepClone(mod.userData.params || {});
    _render();
  }

  function _onDeselect() {
    _mod   = null;
    _draft = null;
    if (_titleEl) _titleEl.textContent = 'Nenhuma seleção';
    if (_container) {
      _container.innerHTML = `
        <div class="nosel-msg">
          <span class="nosel-icon">◻</span>
          Selecione um módulo na cena<br>para editar propriedades.
        </div>`;
    }
  }

  // ─── Renderização Principal ────────────────────────────────────────

  function _render() {
    if (!_mod || !_draft || !_container) return;

    var type  = _mod.userData.type || '';
    var label = _mod.userData.moduleType || type;

    if (_titleEl) _titleEl.textContent = _mod.userData.customName || label;

    // Decide quais seções mostrar por tipo
    var isAppliance = ['geladeira','microondas','forno_eletrico','pia','lava_loucas'].includes(type);
    var hasInternal = !isAppliance && type !== 'prateleira';
    var hasDoor     = ['cabinet_base','cabinet_upper','torre','balcao'].includes(type);
    var hasCountertop = type === 'balcao';

    _container.innerHTML = `
      <div class="props-content">

        ${_sectionDimensions()}

        ${hasInternal ? _sectionShelves() : ''}

        ${hasInternal ? _sectionDividers() : ''}

        ${hasDoor ? _sectionDoors() : ''}

        ${hasCountertop ? _sectionCountertop() : ''}

        ${_sectionMaterial()}

        ${_sectionActions()}

      </div>
    `;

    _bindEvents();
  }

  // ─── Seção: Dimensões ──────────────────────────────────────────────

  function _sectionDimensions() {
    var d = _draft;
    return `
      <div class="prop-section">
        <div class="prop-section-title">Dimensões</div>

        <div class="prop-row">
          <div class="prop-label">Largura <span>${d.width || 600}mm</span></div>
          <input class="prop-input" type="range"
            min="200" max="2400" step="50"
            value="${d.width || 600}"
            data-bind="width" data-display="Largura">
        </div>

        <div class="prop-row">
          <div class="prop-label">Altura <span>${d.height || 720}mm</span></div>
          <input class="prop-input" type="range"
            min="200" max="2800" step="50"
            value="${d.height || 720}"
            data-bind="height" data-display="Altura">
        </div>

        <div class="prop-row">
          <div class="prop-label">Profundidade <span>${d.depth || 550}mm</span></div>
          <input class="prop-input" type="range"
            min="150" max="900" step="25"
            value="${d.depth || 550}"
            data-bind="depth" data-display="Profundidade">
        </div>

        <div class="prop-row">
          <div class="prop-label">Espessura <span>${d.thickness || 18}mm</span></div>
          <select class="prop-select" data-bind="thickness">
            ${[6,9,12,15,18,25].map(v =>
              `<option value="${v}" ${(d.thickness||18)==v?'selected':''}>${v}mm</option>`
            ).join('')}
          </select>
        </div>

      </div>`;
  }

  // ─── Seção: Prateleiras ────────────────────────────────────────────

  function _sectionShelves() {
    var d       = _draft;
    var H       = d.height   || 720;
    var T       = d.thickness || 18;
    var maxSlots = Math.floor((H - T * 2) / 80); // 80mm mínimo por slot

    // Se não tem customShelves, inicializa
    if (!d.customShelves) {
      var count = d.shelves || 1;
      d.customShelves = MathUtils.distributePositions(count, T, H - T).map(function (y) {
        return Math.round(y);
      });
    }

    var shelvesHTML = d.customShelves.map(function (yPos, i) {
      var pct = Math.round(((yPos - T) / (H - T * 2)) * 100);
      return `
        <div class="shelf-row" data-shelf-idx="${i}">
          <span class="shelf-label">P${i + 1}</span>
          <div class="shelf-slider-wrap">
            <input type="range"
              class="prop-input shelf-y-slider"
              min="${T + 20}"
              max="${H - T - 20}"
              step="10"
              value="${yPos}"
              data-shelf-idx="${i}">
          </div>
          <span class="shelf-val">${yPos}mm</span>
          <button class="shelf-del-btn" data-shelf-idx="${i}" title="Remover">✕</button>
        </div>`;
    }).join('');

    return `
      <div class="prop-section">
        <div class="prop-section-title">Prateleiras
          <button class="inline-add-btn" id="btn-add-shelf"
            ${d.customShelves.length >= maxSlots ? 'disabled title="Máximo atingido"' : ''}>
            + Adicionar
          </button>
        </div>

        <div id="shelves-list">
          ${shelvesHTML || '<div class="empty-hint">Sem prateleiras</div>'}
        </div>

        <div class="prop-row" style="margin-top:6px">
          <div class="prop-label">Distribuir uniformemente</div>
          <div class="prop-grid">
            <input class="prop-input" type="number"
              id="shelf-auto-count"
              min="0" max="${maxSlots}"
              value="${d.customShelves.length}"
              style="text-align:center">
            <button class="prop-btn" id="btn-shelf-distribute">Distribuir</button>
          </div>
        </div>

      </div>`;
  }

  // ─── Seção: Divisórias ─────────────────────────────────────────────

  function _sectionDividers() {
    var d  = _draft;
    var W  = d.width    || 600;
    var T  = d.thickness || 18;
    var iW = W - T * 2;
    var maxDivs = Math.floor(iW / 100); // mín 100mm de espaço

    if (!d.customDividers) d.customDividers = [];

    var divsHTML = d.customDividers.map(function (xPos, i) {
      return `
        <div class="shelf-row" data-div-idx="${i}">
          <span class="shelf-label">D${i + 1}</span>
          <div class="shelf-slider-wrap">
            <input type="range"
              class="prop-input div-x-slider"
              min="${T + 20}"
              max="${iW - 20}"
              step="10"
              value="${xPos}"
              data-div-idx="${i}">
          </div>
          <span class="shelf-val">${xPos}mm</span>
          <button class="shelf-del-btn" data-div-idx="${i}" title="Remover">✕</button>
        </div>`;
    }).join('');

    return `
      <div class="prop-section">
        <div class="prop-section-title">Divisórias Verticais
          <button class="inline-add-btn" id="btn-add-divider"
            ${d.customDividers.length >= maxDivs ? 'disabled' : ''}>
            + Adicionar
          </button>
        </div>

        <div id="dividers-list">
          ${divsHTML || '<div class="empty-hint">Sem divisórias</div>'}
        </div>

      </div>`;
  }

  // ─── Seção: Portas ─────────────────────────────────────────────────

  function _sectionDoors() {
    var d = _draft;
    return `
      <div class="prop-section">
        <div class="prop-section-title">Portas</div>

        <div class="prop-row">
          <div class="prop-label">Estilo de porta</div>
          <select class="prop-select" data-bind="doorStyle">
            <option value="single"  ${(d.doorStyle||'single')==='single' ?'selected':''}>Simples</option>
            <option value="double"  ${d.doorStyle==='double'             ?'selected':''}>Dupla</option>
            <option value="none"    ${d.doorStyle==='none'               ?'selected':''}>Sem porta</option>
          </select>
        </div>

        <div class="prop-row">
          <div class="prop-label">Porta ativa</div>
          <label class="toggle-wrap">
            <input type="checkbox" data-bind-bool="hasDoor"
              ${d.hasDoor !== false ? 'checked' : ''}>
            <span class="toggle-label">Mostrar porta</span>
          </label>
        </div>

      </div>`;
  }

  // ─── Seção: Tampo (Balcão) ─────────────────────────────────────────

  function _sectionCountertop() {
    var d = _draft;
    return `
      <div class="prop-section">
        <div class="prop-section-title">Tampo</div>
        <div class="prop-row">
          <div class="prop-label">Balanço <span>${d.countertopOverhang || 30}mm</span></div>
          <input class="prop-input" type="range"
            min="0" max="100" step="5"
            value="${d.countertopOverhang || 30}"
            data-bind="countertopOverhang" data-display="Balanço">
        </div>
        <div class="prop-row">
          <div class="prop-label">Cor do tampo</div>
          <div class="swatch-grid" id="countertop-swatches">
            ${[
              {hex:'#d0c8bc',label:'Mármore Claro'},
              {hex:'#a09080',label:'Granito Cinza'},
              {hex:'#e8ddd0',label:'Travertino'},
              {hex:'#2a2a2a',label:'Granito Preto'},
              {hex:'#c4b8a8',label:'Quartzito'},
              {hex:'#8a7060',label:'Pedra Rústica'},
            ].map(c => `<div class="swatch${(d.countertopColor||'#d0c8bc')===c.hex?' active':''}"
              style="background:${c.hex}" title="${c.label}"
              data-countertop-color="${c.hex}"></div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  // ─── Seção: Material ───────────────────────────────────────────────

  function _sectionMaterial() {
    var d        = _draft;
    var allMats  = MaterialLibrary.getAllMaterials();
    var palette  = MaterialLibrary.getColorPalette();

    var matOptions = allMats.map(function (m) {
      return `<option value="${m.id}" ${d.material === m.id ? 'selected' : ''}>${m.label}</option>`;
    }).join('');

    // Swatches de cores agrupados
    var swatchHTML = Object.keys(palette).map(function (cat) {
      return palette[cat].map(function (c) {
        var active = (d.color || '#d4b896').toLowerCase() === c.hex.toLowerCase() ? ' active' : '';
        return `<div class="swatch${active}" style="background:${c.hex}"
          title="${c.label}" data-color="${c.hex}"></div>`;
      }).join('');
    }).join('');

    return `
      <div class="prop-section">
        <div class="prop-section-title">Material & Cor</div>

        <div class="prop-row">
          <div class="prop-label">Material</div>
          <select class="prop-select" data-bind="material">${matOptions}</select>
        </div>

        <div class="prop-row">
          <div class="prop-label">Cor</div>
          <div class="swatch-grid">${swatchHTML}</div>
        </div>

        <div class="prop-row">
          <div class="prop-label">Cor personalizada</div>
          <input type="color" class="prop-input"
            value="${d.color || '#d4b896'}" data-bind="color"
            style="height:32px;padding:2px 4px;cursor:pointer">
        </div>

      </div>`;
  }

  // ─── Seção: Ações ──────────────────────────────────────────────────

  function _sectionActions() {
    return `
      <div class="prop-section">
        <button class="prop-btn" id="btn-apply-props">✓ Aplicar alterações</button>
        <button class="prop-btn" id="btn-reset-props" style="margin-top:4px;background:transparent;border-color:var(--border);color:var(--text-mid)">↺ Resetar</button>
        <button class="prop-btn danger" id="btn-delete-mod" style="margin-top:4px">✕ Remover módulo</button>
      </div>`;
  }

  // ─── Bind de Eventos ──────────────────────────────────────────────

  function _bindEvents() {
    if (!_container) return;

    // ── Sliders e selects com data-bind ────────────────────────────
    _container.querySelectorAll('[data-bind]').forEach(function (el) {
      el.addEventListener('input', function () {
        var key = el.dataset.bind;
        var val = el.type === 'number' ? parseInt(el.value) : (isNaN(+el.value) ? el.value : +el.value);
        _draft[key] = val;

        // Atualiza label ao lado do slider
        var label = el.closest('.prop-row') && el.closest('.prop-row').querySelector('.prop-label span');
        if (label && el.dataset.display) label.textContent = val + 'mm';

        // Se mudou dimensão, re-clampea posições de prateleiras e divisórias
        if (['width','height','depth'].includes(key)) _reclampInternals();
      });
    });

    // ── Checkboxes booleanos ───────────────────────────────────────
    _container.querySelectorAll('[data-bind-bool]').forEach(function (el) {
      el.addEventListener('change', function () {
        _draft[el.dataset.bindBool] = el.checked;
      });
    });

    // ── Swatches de cor ───────────────────────────────────────────
    _container.querySelectorAll('.swatch[data-color]').forEach(function (sw) {
      sw.addEventListener('click', function () {
        _container.querySelectorAll('.swatch[data-color]').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        _draft.color = sw.dataset.color;
        // Sincroniza o input color
        var ci = _container.querySelector('input[data-bind="color"]');
        if (ci) ci.value = sw.dataset.color;
      });
    });

    // ── Swatches de tampo ─────────────────────────────────────────
    _container.querySelectorAll('[data-countertop-color]').forEach(function (sw) {
      sw.addEventListener('click', function () {
        _container.querySelectorAll('[data-countertop-color]').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        _draft.countertopColor = sw.dataset.countertopColor;
      });
    });

    // ── Prateleiras: slider de posição ────────────────────────────
    _container.querySelectorAll('.shelf-y-slider').forEach(function (sl) {
      sl.addEventListener('input', function () {
        var i = +sl.dataset.shelfIdx;
        _draft.customShelves[i] = +sl.value;
        var valEl = sl.closest('.shelf-row').querySelector('.shelf-val');
        if (valEl) valEl.textContent = sl.value + 'mm';
      });
    });

    // ── Prateleiras: remover ──────────────────────────────────────
    _container.querySelectorAll('.shelf-del-btn[data-shelf-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = +btn.dataset.shelfIdx;
        _draft.customShelves.splice(i, 1);
        _renderSection('shelves');
      });
    });

    // ── Prateleiras: adicionar ────────────────────────────────────
    var btnAddShelf = document.getElementById('btn-add-shelf');
    if (btnAddShelf) {
      btnAddShelf.addEventListener('click', function () {
        var H = _draft.height  || 720;
        var T = _draft.thickness || 18;
        var existing = _draft.customShelves || [];
        // Insere no ponto médio do maior espaço livre
        var midY = _findBestShelfInsert(existing, T, H - T);
        existing.push(Math.round(midY));
        existing.sort((a, b) => a - b);
        _draft.customShelves = existing;
        _renderSection('shelves');
      });
    }

    // ── Prateleiras: distribuir uniformemente ─────────────────────
    var btnDistrib = document.getElementById('btn-shelf-distribute');
    if (btnDistrib) {
      btnDistrib.addEventListener('click', function () {
        var countEl = document.getElementById('shelf-auto-count');
        var n = parseInt(countEl ? countEl.value : 1) || 0;
        var H = _draft.height   || 720;
        var T = _draft.thickness || 18;
        _draft.customShelves = MathUtils.distributePositions(n, T, H - T).map(y => Math.round(y));
        _renderSection('shelves');
      });
    }

    // ── Divisórias: slider de posição ─────────────────────────────
    _container.querySelectorAll('.div-x-slider').forEach(function (sl) {
      sl.addEventListener('input', function () {
        var i = +sl.dataset.divIdx;
        _draft.customDividers[i] = +sl.value;
        var valEl = sl.closest('.shelf-row').querySelector('.shelf-val');
        if (valEl) valEl.textContent = sl.value + 'mm';
      });
    });

    // ── Divisórias: remover ───────────────────────────────────────
    _container.querySelectorAll('.shelf-del-btn[data-div-idx]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var i = +btn.dataset.divIdx;
        _draft.customDividers.splice(i, 1);
        _renderSection('dividers');
      });
    });

    // ── Divisórias: adicionar ─────────────────────────────────────
    var btnAddDiv = document.getElementById('btn-add-divider');
    if (btnAddDiv) {
      btnAddDiv.addEventListener('click', function () {
        var W  = _draft.width    || 600;
        var T  = _draft.thickness || 18;
        var iW = W - T * 2;
        if (!_draft.customDividers) _draft.customDividers = [];
        var existing = _draft.customDividers;
        var midX = _findBestShelfInsert(existing, 0, iW);
        existing.push(Math.round(midX));
        existing.sort((a, b) => a - b);
        _renderSection('dividers');
      });
    }

    // ── Botão Aplicar ─────────────────────────────────────────────
    var btnApply = document.getElementById('btn-apply-props');
    if (btnApply) {
      btnApply.addEventListener('click', function () {
        _apply();
      });
    }

    // ── Botão Resetar ─────────────────────────────────────────────
    var btnReset = document.getElementById('btn-reset-props');
    if (btnReset) {
      btnReset.addEventListener('click', function () {
        _draft = _deepClone(_mod.userData.params || {});
        _render();
        EventBus.emit('ui:toast', { message: 'Propriedades resetadas', type: 'i' });
      });
    }

    // ── Botão Deletar ─────────────────────────────────────────────
    var btnDel = document.getElementById('btn-delete-mod');
    if (btnDel) {
      btnDel.addEventListener('click', function () {
        if (confirm('Remover este módulo?')) {
          ProjectManager.removeModule(_mod);
        }
      });
    }
  }

  // ─── Re-renderiza apenas uma seção ────────────────────────────────

  function _renderSection(section) {
    var wrapper  = section === 'shelves'
      ? document.getElementById('shelves-list')
      : document.getElementById('dividers-list');

    if (!wrapper) { _render(); return; }

    if (section === 'shelves') {
      // Substitui o conteúdo da lista + o botão adicionar
      var sectionEl = wrapper.closest('.prop-section');
      if (sectionEl) {
        var H        = _draft.height   || 720;
        var T        = _draft.thickness || 18;
        var maxSlots = Math.floor((H - T * 2) / 80);
        var btnAdd   = sectionEl.querySelector('#btn-add-shelf');
        if (btnAdd) btnAdd.disabled = _draft.customShelves.length >= maxSlots;

        wrapper.innerHTML = _buildShelfRows();
        _container.querySelectorAll('.shelf-y-slider').forEach(function (sl) {
          sl.addEventListener('input', function () {
            var i = +sl.dataset.shelfIdx;
            _draft.customShelves[i] = +sl.value;
            var v = sl.closest('.shelf-row').querySelector('.shelf-val');
            if (v) v.textContent = sl.value + 'mm';
          });
        });
        _container.querySelectorAll('.shelf-del-btn[data-shelf-idx]').forEach(function (btn) {
          btn.addEventListener('click', function () {
            _draft.customShelves.splice(+btn.dataset.shelfIdx, 1);
            _renderSection('shelves');
          });
        });
      }
    } else {
      wrapper.innerHTML = _buildDividerRows();
      _container.querySelectorAll('.div-x-slider').forEach(function (sl) {
        sl.addEventListener('input', function () {
          var i = +sl.dataset.divIdx;
          _draft.customDividers[i] = +sl.value;
          var v = sl.closest('.shelf-row').querySelector('.shelf-val');
          if (v) v.textContent = sl.value + 'mm';
        });
      });
      _container.querySelectorAll('.shelf-del-btn[data-div-idx]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          _draft.customDividers.splice(+btn.dataset.divIdx, 1);
          _renderSection('dividers');
        });
      });
    }
  }

  // ─── Builders de HTML de listas ───────────────────────────────────

  function _buildShelfRows() {
    if (!_draft.customShelves || !_draft.customShelves.length) {
      return '<div class="empty-hint">Sem prateleiras — clique em Adicionar</div>';
    }
    var H = _draft.height   || 720;
    var T = _draft.thickness || 18;
    return _draft.customShelves.map(function (yPos, i) {
      return `
        <div class="shelf-row" data-shelf-idx="${i}">
          <span class="shelf-label">P${i + 1}</span>
          <div class="shelf-slider-wrap">
            <input type="range" class="prop-input shelf-y-slider"
              min="${T + 20}" max="${H - T - 20}" step="10"
              value="${yPos}" data-shelf-idx="${i}">
          </div>
          <span class="shelf-val">${yPos}mm</span>
          <button class="shelf-del-btn" data-shelf-idx="${i}" title="Remover">✕</button>
        </div>`;
    }).join('');
  }

  function _buildDividerRows() {
    if (!_draft.customDividers || !_draft.customDividers.length) {
      return '<div class="empty-hint">Sem divisórias — clique em Adicionar</div>';
    }
    var W  = _draft.width    || 600;
    var T  = _draft.thickness || 18;
    var iW = W - T * 2;
    return _draft.customDividers.map(function (xPos, i) {
      return `
        <div class="shelf-row" data-div-idx="${i}">
          <span class="shelf-label">D${i + 1}</span>
          <div class="shelf-slider-wrap">
            <input type="range" class="prop-input div-x-slider"
              min="${T + 20}" max="${iW - 20}" step="10"
              value="${xPos}" data-div-idx="${i}">
          </div>
          <span class="shelf-val">${xPos}mm</span>
          <button class="shelf-del-btn" data-div-idx="${i}" title="Remover">✕</button>
        </div>`;
    }).join('');
  }

  // ─── Aplicar alterações → rebuild ─────────────────────────────────

  function _apply() {
    if (!_mod || !_draft) return;

    // Converte customShelves → shelves count (mantém compatibilidade)
    var newParams = _deepClone(_draft);
    if (newParams.customShelves) {
      newParams.shelves = newParams.customShelves.length;
    }

    var rebuilt = ProjectManager.rebuildModule(_mod, newParams);
    if (rebuilt) {
      _mod   = rebuilt;
      _draft = _deepClone(rebuilt.userData.params);
      EventBus.emit('ui:toast', { message: 'Módulo atualizado', type: 's' });
    }
  }

  // ─── Utilitários ──────────────────────────────────────────────────

  /**
   * Encontra o melhor ponto para inserir uma prateleira/divisória
   * (centro do maior espaço livre)
   */
  function _findBestShelfInsert(existing, min, max) {
    if (!existing || !existing.length) return min + (max - min) / 2;

    var pts = [min].concat(existing.slice().sort((a,b)=>a-b)).concat([max]);
    var bestGap = 0, bestPos = min + (max - min) / 2;

    for (var i = 0; i < pts.length - 1; i++) {
      var gap = pts[i + 1] - pts[i];
      if (gap > bestGap) {
        bestGap = gap;
        bestPos = pts[i] + gap / 2;
      }
    }
    return bestPos;
  }

  /**
   * Garante que prateleiras e divisórias estão dentro dos limites
   * após mudança de dimensão
   */
  function _reclampInternals() {
    var H  = _draft.height   || 720;
    var T  = _draft.thickness || 18;
    var W  = _draft.width    || 600;
    var iW = W - T * 2;

    if (_draft.customShelves) {
      _draft.customShelves = _draft.customShelves
        .map(y => Math.max(T + 20, Math.min(H - T - 20, y)))
        .filter((y, i, arr) => arr.indexOf(y) === i); // remove duplicatas
    }
    if (_draft.customDividers) {
      _draft.customDividers = _draft.customDividers
        .map(x => Math.max(T + 20, Math.min(iW - 20, x)))
        .filter((x, i, arr) => arr.indexOf(x) === i);
    }
  }

  function _deepClone(obj) {
    if (!obj) return {};
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return Object.assign({}, obj); }
  }

  return { init };
}());


// ══════════════════════════════════════════════════════════════════════════
//  CSS INJETADO — adicione ao seu <style> global ou deixe ser injetado aqui
// ══════════════════════════════════════════════════════════════════════════
(function _injectStyles() {
  var css = `
    /* Props Panel */
    .props-content { padding: 0 0 16px; }
    .nosel-msg { padding: 32px 16px; text-align: center; color: var(--text-lo); font-size: 11px; line-height: 1.9; }
    .nosel-icon { font-size: 28px; display: block; margin-bottom: 8px; opacity: .3; }

    .prop-section { padding: 10px 12px 4px; border-bottom: 1px solid var(--border); }
    .prop-section:last-child { border-bottom: none; }
    .prop-section-title {
      font-size: 9px; font-weight: 700; letter-spacing: .1em; color: var(--text-lo);
      text-transform: uppercase; margin-bottom: 8px;
      display: flex; align-items: center; gap: 8px;
    }
    .prop-section-title::after { content: ''; flex: 1; height: 1px; background: var(--border); }

    .prop-row { margin-bottom: 8px; }
    .prop-label { font-size: 10px; color: var(--text-mid); margin-bottom: 3px; display: flex; justify-content: space-between; }
    .prop-label span { color: var(--accent); font-family: monospace; font-size: 9px; }

    .prop-input {
      width: 100%; height: 28px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 4px;
      color: var(--text-hi); font-size: 12px; padding: 0 8px; outline: none; transition: border-color .15s;
    }
    .prop-input:focus { border-color: var(--accent-dim); }
    .prop-input[type=range] {
      -webkit-appearance: none; height: 4px; padding: 0; cursor: pointer;
      background: var(--border); border: none; border-radius: 2px; width: 100%;
    }
    .prop-input[type=range]::-webkit-slider-thumb {
      -webkit-appearance: none; width: 12px; height: 12px;
      background: var(--accent); border-radius: 50%; cursor: pointer;
    }
    .prop-select {
      width: 100%; height: 28px; background: var(--bg-card);
      border: 1px solid var(--border); border-radius: 4px;
      color: var(--text-hi); font-size: 11px; padding: 0 8px; outline: none; cursor: pointer;
    }
    .prop-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }

    .prop-btn {
      width: 100%; height: 32px; margin-top: 4px;
      background: var(--accent-dim); border: 1px solid var(--accent);
      border-radius: 5px; color: var(--accent-glow); font-size: 11px;
      font-weight: 700; cursor: pointer; letter-spacing: .05em;
      text-transform: uppercase; transition: all .15s;
    }
    .prop-btn:hover { background: var(--accent); color: #fff; }
    .prop-btn.danger { background: transparent; border-color: var(--error); color: var(--error); }
    .prop-btn.danger:hover { background: var(--error); color: #fff; }

    /* Shelf rows */
    .shelf-row {
      display: flex; align-items: center; gap: 6px;
      padding: 4px 0; border-bottom: 1px solid var(--border);
    }
    .shelf-row:last-child { border-bottom: none; }
    .shelf-label { font-size: 9px; color: var(--accent); font-weight: 700; width: 18px; flex-shrink: 0; }
    .shelf-slider-wrap { flex: 1; }
    .shelf-val { font-size: 9px; color: var(--text-lo); width: 36px; text-align: right; flex-shrink: 0; font-family: monospace; }
    .shelf-del-btn {
      width: 18px; height: 18px; background: transparent; border: 1px solid var(--border);
      border-radius: 3px; color: var(--text-lo); cursor: pointer; font-size: 9px;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
      transition: all .12s;
    }
    .shelf-del-btn:hover { background: var(--error); border-color: var(--error); color: #fff; }

    .inline-add-btn {
      background: transparent; border: 1px solid var(--accent-dim); border-radius: 3px;
      color: var(--accent); font-size: 9px; font-weight: 700; cursor: pointer;
      padding: 2px 7px; transition: all .12s; margin-left: auto;
    }
    .inline-add-btn:hover { background: var(--accent-dim); }
    .inline-add-btn:disabled { opacity: .35; cursor: not-allowed; }

    .empty-hint { font-size: 10px; color: var(--text-lo); padding: 6px 0; text-align: center; }

    /* Swatches */
    .swatch-grid { display: flex; flex-wrap: wrap; gap: 4px; }
    .swatch {
      width: 20px; height: 20px; border-radius: 3px; cursor: pointer;
      border: 2px solid transparent; transition: all .12s;
    }
    .swatch:hover { transform: scale(1.15); }
    .swatch.active { border-color: #fff; }

    /* Toggle */
    .toggle-wrap { display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .toggle-wrap input { accent-color: var(--accent); cursor: pointer; }
    .toggle-label { font-size: 11px; color: var(--text-mid); }
  `;
  var el  = document.createElement('style');
  el.id   = 'props-panel-styles';
  el.textContent = css;
  if (!document.getElementById('props-panel-styles')) {
    document.head.appendChild(el);
  }
}());

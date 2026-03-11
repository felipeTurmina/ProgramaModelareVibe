/**
 * ModuleBuilder — Funções base de construção de peças e dispatcher
 *
 * Centraliza:
 *   - mkP()      → cria Mesh de peça com sombra e borda
 *   - addPiece() → cria + posiciona + registra peça no grupo
 *   - regPiece() → registra peça na lista de corte do grupo
 *   - buildTop() → tampa sólida ou ripada
 *   - buildMod() → dispatcher para todos os tipos de módulos
 *
 * Usa MaterialCache e GeometryCache para performance.
 */
const ModuleBuilder = (function () {
  'use strict';

  // ─── Primitivos de construção ─────────────────────────────────────────

  /**
   * Cria um Mesh de painel (box) com material principal + borda
   * Equivalente ao mkP() original, mas com cache.
   *
   * @param {number} w       - largura
   * @param {number} h       - altura
   * @param {number} d       - profundidade
   * @param {THREE.Material} mat      - material da face
   * @param {THREE.Material} edgeMat  - material da borda
   * @returns {THREE.Mesh}
   */
  function mkP(w, h, d, mat, edgeMat) {
    var geo = GeometryCache.getBox(w, h, d);

    // 6 faces: direita, esquerda, topo, fundo, frente, verso
    // Faces 0-3: face e verso recebem mat
    // Faces 4-5: laterais recebem edgeMat (simulação de fita de borda)
    var materials = [
      edgeMat || mat,  // +X (direita)
      edgeMat || mat,  // -X (esquerda)
      edgeMat || mat,  // +Y (topo)
      edgeMat || mat,  // -Y (fundo)
      mat,             // +Z (frente)
      mat,             // -Z (verso)
    ];

    var mesh = new THREE.Mesh(geo, materials);
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    return mesh;
  }

  /**
   * Registra uma peça na lista de corte do grupo
   * Equivalente ao regPiece() original
   *
   * @param {THREE.Group} g
   * @param {string} pieceName
   * @param {number} w
   * @param {number} h
   * @param {number} d
   * @param {string} matKey
   * @param {string} colorHex
   */
  function regPiece(g, pieceName, w, h, d, matKey, colorHex) {
    if (!g.userData.cutPieces) g.userData.cutPieces = [];
    g.userData.cutPieces.push({
      name:     pieceName,
      w:        Math.round(w),
      h:        Math.round(h),
      d:        Math.round(d),
      material: matKey  || 'mdf_branco',
      color:    colorHex || '#d4b896',
    });
  }

  /**
   * Cria uma peça, posiciona no grupo e registra na lista de corte
   * Equivalente ao addPiece() original
   *
   * @param {THREE.Group} g
   * @param {string} pieceName
   * @param {number} w, h, d - dimensões
   * @param {number} x, y, z - posição local no grupo
   * @param {THREE.Material} mat
   * @param {THREE.Material} edgeMat
   * @param {string} matKey
   * @param {string} colorHex
   * @returns {THREE.Mesh}
   */
  function addPiece(g, pieceName, w, h, d, x, y, z, mat, edgeMat, matKey, colorHex) {
    var m = mkP(w, h, d, mat, edgeMat);
    m.position.set(x, y, z);
    m.userData.pieceName = pieceName;
    g.add(m);
    regPiece(g, pieceName, w, h, d, matKey, colorHex);
    return m;
  }

  /**
   * Constrói a tampa superior: sólida ou ripada (nicho aberto)
   *
   * @param {THREE.Group} g
   * @param {Function} ap    - addPiece bound para o grupo atual
   * @param {string} topStyle - 'solid' | 'slatted'
   * @param {number} iW      - largura interna
   * @param {number} T       - espessura do painel
   * @param {number} Dp      - profundidade
   * @param {number} topY    - posição Y do centro da tampa
   * @param {number} railWidth - largura das ripas (mm)
   */
  function buildTop(g, ap, topStyle, iW, T, Dp, topY, railWidth) {
    var rW = Math.max(20, Math.min(railWidth || 60, Dp * 0.4));

    if (topStyle === 'slatted') {
      ap('Ripa Topo Frente', iW, T, rW, 0, topY,  Dp / 2 - rW / 2);
      ap('Ripa Topo Fundo',  iW, T, rW, 0, topY, -Dp / 2 + rW / 2);
    } else {
      ap('Tampa Sup.', iW, T, Dp, 0, topY, 0);
    }
  }

  /**
   * Constrói divisórias verticais (colunas internas)
   * Segmentadas entre prateleiras — não passa por dentro de prateleiras.
   *
   * @param {THREE.Group} g
   * @param {Function} ap
   * @param {number[]} dividerPositions - posições X a partir da borda esquerda interna
   * @param {number} iW, iH, T, Dp, bk, yBase
   * @param {number[]} shelfPositions  - posições Y das prateleiras
   */
  function buildDividers(g, ap, dividerPositions, iW, iH, T, Dp, bk, yBase, shelfPositions) {
    if (!dividerPositions || dividerPositions.length === 0) return;
    yBase = yBase || 0;

    var backOffset = bk ? Dp / 2 - bk - (Dp - bk) / 2 : 0;

    dividerPositions.forEach(function (xFromLeft, dIdx) {
      var xPos = -iW / 2 + xFromLeft;

      // Quebra a divisória em segmentos entre as prateleiras
      var yPoints = [yBase + T];
      if (shelfPositions) {
        shelfPositions.forEach(function (sy) {
          yPoints.push(sy - T / 2);  // abaixo da prateleira
          yPoints.push(sy + T / 2);  // acima da prateleira
        });
      }
      yPoints.push(yBase + iH + T);  // até o topo

      for (var i = 0; i < yPoints.length - 1; i += 2) {
        var y0 = yPoints[i];
        var y1 = yPoints[i + 1];
        if (y1 - y0 < 1) continue;

        var segH  = y1 - y0;
        var segYC = y0 + segH / 2;
        var segD  = bk ? (Dp - bk) : Dp;

        ap(
          'Divisória ' + (dIdx + 1) + (yPoints.length > 2 ? '-' + (i / 2 + 1) : ''),
          T, segH, segD,
          xPos, segYC,
          bk ? backOffset : 0
        );
      }
    });
  }

  // ─── Dispatcher ───────────────────────────────────────────────────────

  /**
   * Constrói um módulo a partir do tipo e parâmetros
   * Equivalente ao buildMod() original
   *
   * @param {string} type  - tipo do módulo
   * @param {Object} params - parâmetros de construção
   * @returns {THREE.Group}
   */
  function buildMod(type, params) {
    params = params || {};

    var builders = {
      cabinet_base:    function () { return Cabinet.build(params, false); },
      cabinet_upper:   function () { return Cabinet.build(params, true);  },
      drawer:          function () { return Drawer.build(params);          },
      shelf:           function () { return Shelf.build(params);           },
      torre:           function () { return Torre.build(params);           },
      balcao:          function () { return Balcao.build(params);          },
      armario_aberto:  function () { return ArmarioAberto.build(params);   },
      prateleira:      function () { return Prateleira.build(params);      },
      geladeira:       function () { return Appliances.buildGeladeira(params);    },
      microondas:      function () { return Appliances.buildMicroondas(params);   },
      forno_eletrico:  function () { return Appliances.buildFornoEletrico(params);},
      pia:             function () { return Appliances.buildPia(params);          },
      lava_loucas:     function () { return Appliances.buildLavaLoucas(params);   },
    };

    var builder = builders[type];
    if (!builder) {
      console.warn('[ModuleBuilder] Tipo desconhecido:', type, '— usando cabinet_base');
      return Cabinet.build(params, false);
    }

    return builder();
  }

  /**
   * Cria parâmetros com defaults aplicados
   * Utilitário para builders de módulos
   *
   * @param {Object} params    - parâmetros passados pelo usuário
   * @param {Object} defaults  - valores padrão
   * @returns {Object}
   */
  function applyDefaults(params, defaults) {
    var result = {};
    Object.keys(defaults).forEach(function (k) {
      result[k] = params[k] !== undefined ? params[k] : defaults[k];
    });
    return result;
  }

  /**
   * Cria um THREE.Group com userData padronizado
   *
   * @param {string} type       - tipo do módulo
   * @param {string} moduleType - label legível
   * @param {Object} params     - parâmetros finais (com defaults)
   * @returns {THREE.Group}
   */
  function createModuleGroup(type, moduleType, params) {
    var g = new THREE.Group();
    g.userData = {
      type:          type,
      moduleType:    moduleType,
      params:        Object.assign({}, params),
      cutPieces:     [],
      hardwareItems: params.hardwareItems || [],
    };
    return g;
  }

  /**
   * Helper: retorna material do cache para módulo
   * @param {string} materialId
   * @param {string} colorHex
   * @returns {THREE.Material}
   */
  function getMat(materialId, colorHex) {
    return MaterialCache.get(materialId || '', colorHex || '#d4b896');
  }

  /**
   * Helper: retorna material de borda do cache
   * @param {string} colorHex
   * @returns {THREE.Material}
   */
  function getEdgeMat(colorHex) {
    return MaterialCache.get('edge', colorHex || '#d4b896');
  }

  return {
    mkP: mkP,
    regPiece: regPiece,
    addPiece: addPiece,
    buildTop: buildTop,
    buildDividers: buildDividers,
    buildMod: buildMod,
    applyDefaults: applyDefaults,
    createModuleGroup: createModuleGroup,
    getMat: getMat,
    getEdgeMat: getEdgeMat,
  };
}());

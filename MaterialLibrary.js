/**
 * MaterialLibrary — Catálogo de materiais e cores disponíveis
 *
 * Centraliza TODAS as definições de materiais do sistema.
 * Separado do MaterialCache para separar "o que existe" de "como renderiza".
 */
const MaterialLibrary = (function () {
  'use strict';

  /**
   * Definições de materiais disponíveis para painéis
   * Cada material tem: id, label, preço base por m², roughness
   */
  const PANEL_MATERIALS = {
    mdf_branco: {
      id: 'mdf_branco',
      label: 'MDF Branco',
      pricePerM2: 180,
      roughness: 0.65,
      category: 'mdf',
    },
    mdf_preto: {
      id: 'mdf_preto',
      label: 'MDF Preto',
      pricePerM2: 220,
      roughness: 0.65,
      category: 'mdf',
    },
    mdf_cinza: {
      id: 'mdf_cinza',
      label: 'MDF Cinza',
      pricePerM2: 200,
      roughness: 0.65,
      category: 'mdf',
    },
    mdp_branco: {
      id: 'mdp_branco',
      label: 'MDP Branco',
      pricePerM2: 120,
      roughness: 0.7,
      category: 'mdp',
    },
    compensado: {
      id: 'compensado',
      label: 'Compensado',
      pricePerM2: 90,
      roughness: 0.75,
      category: 'madeira',
    },
    noce: {
      id: 'noce',
      label: 'Noce',
      pricePerM2: 280,
      roughness: 0.6,
      category: 'madeira',
    },
    carvalho: {
      id: 'carvalho',
      label: 'Carvalho',
      pricePerM2: 260,
      roughness: 0.6,
      category: 'madeira',
    },
    freijo: {
      id: 'freijo',
      label: 'Freijó',
      pricePerM2: 250,
      roughness: 0.6,
      category: 'madeira',
    },
    lacquer: {
      id: 'lacquer',
      label: 'Laca Brilhante',
      pricePerM2: 350,
      roughness: 0.1,
      category: 'laca',
    },
    lacquer_preto: {
      id: 'lacquer_preto',
      label: 'Laca Preta',
      pricePerM2: 350,
      roughness: 0.1,
      category: 'laca',
    },
  };

  /**
   * Paleta de cores predefinidas por categoria
   * Usadas nos color pickers do painel de propriedades
   */
  const COLOR_PALETTE = {
    neutros: [
      { label: 'Off White',    hex: '#f5f0e8' },
      { label: 'Branco Neve',  hex: '#ffffff' },
      { label: 'Creme',        hex: '#f0e6d3' },
      { label: 'Areia',        hex: '#d4b896' },
      { label: 'Cinza Claro',  hex: '#c8c8c8' },
      { label: 'Cinza Médio',  hex: '#888888' },
      { label: 'Cinza Escuro', hex: '#444444' },
      { label: 'Preto',        hex: '#1a1a1a' },
    ],
    madeiras: [
      { label: 'Noce Claro',   hex: '#c8a96e' },
      { label: 'Noce Médio',   hex: '#a07840' },
      { label: 'Carvalho',     hex: '#b8905a' },
      { label: 'Freijó',       hex: '#c0954a' },
      { label: 'Ipê',          hex: '#7a5530' },
      { label: 'Cedro',        hex: '#d4896a' },
      { label: 'Pinheiro',     hex: '#e0c090' },
      { label: 'Teca',         hex: '#9a7040' },
    ],
    contemporaneos: [
      { label: 'Azul Petróleo', hex: '#2d4a5a' },
      { label: 'Verde Sage',    hex: '#6b7c6a' },
      { label: 'Terracota',     hex: '#c4724a' },
      { label: 'Mostarda',      hex: '#c8a030' },
      { label: 'Vinho',         hex: '#6a2030' },
      { label: 'Azul Navy',     hex: '#1a2a4a' },
      { label: 'Verde Musgo',   hex: '#4a5a3a' },
      { label: 'Rosé',          hex: '#c8907a' },
    ],
  };

  /**
   * Espessuras padrão disponíveis por tipo de material (mm)
   */
  const STANDARD_THICKNESSES = {
    mdf: [6, 9, 12, 15, 18, 25],
    mdp: [15, 18],
    compensado: [6, 9, 12, 15, 18],
    lacquer: [15, 18],
    madeira: [15, 18, 25, 30],
  };

  // ─── API Pública ───────────────────────────────────────────────────────

  /**
   * Retorna definição de um material por ID
   * @param {string} id
   * @returns {Object|null}
   */
  function getMaterial(id) {
    return PANEL_MATERIALS[id] || null;
  }

  /**
   * Retorna todos os materiais como array
   * @returns {Object[]}
   */
  function getAllMaterials() {
    return Object.values(PANEL_MATERIALS);
  }

  /**
   * Retorna materiais por categoria
   * @param {string} category - 'mdf' | 'mdp' | 'madeira' | 'laca'
   * @returns {Object[]}
   */
  function getMaterialsByCategory(category) {
    return Object.values(PANEL_MATERIALS).filter(function (m) {
      return m.category === category;
    });
  }

  /**
   * Retorna preço por m² de um material
   * @param {string} id
   * @returns {number}
   */
  function getMaterialPrice(id) {
    var mat = PANEL_MATERIALS[id];
    return mat ? mat.pricePerM2 : 180; // fallback para mdf_branco
  }

  /**
   * Retorna label legível de um material
   * @param {string} id
   * @returns {string}
   */
  function getMaterialLabel(id) {
    var mat = PANEL_MATERIALS[id];
    return mat ? mat.label : id;
  }

  /**
   * Retorna paleta de cores completa ou por categoria
   * @param {string} [category]
   * @returns {Object[]|Object}
   */
  function getColorPalette(category) {
    if (category) return COLOR_PALETTE[category] || [];
    return COLOR_PALETTE;
  }

  /**
   * Retorna todas as cores como array flat
   * @returns {Object[]}
   */
  function getAllColors() {
    return Object.values(COLOR_PALETTE).reduce(function (acc, arr) {
      return acc.concat(arr);
    }, []);
  }

  /**
   * Retorna espessuras padrão para um material
   * @param {string} materialId
   * @returns {number[]}
   */
  function getThicknesses(materialId) {
    var mat = PANEL_MATERIALS[materialId];
    if (!mat) return STANDARD_THICKNESSES.mdf;
    return STANDARD_THICKNESSES[mat.category] || STANDARD_THICKNESSES.mdf;
  }

  /**
   * Gera HTML do seletor de cores para uso em painéis
   * @param {string} selectedHex - cor atualmente selecionada
   * @param {string} onchangeAttr - atributo onchange ou data para binding
   * @returns {string} HTML string
   */
  function buildColorSwatchesHTML(selectedHex, onchangeAttr) {
    var html = '<div class="color-swatches">';
    Object.keys(COLOR_PALETTE).forEach(function (cat) {
      html += '<div class="swatch-group">';
      COLOR_PALETTE[cat].forEach(function (c) {
        var active = c.hex.toLowerCase() === (selectedHex || '').toLowerCase()
          ? ' active' : '';
        html += '<div class="swatch' + active + '" '
          + 'style="background:' + c.hex + '" '
          + 'title="' + c.label + '" '
          + 'data-color="' + c.hex + '" '
          + (onchangeAttr || '')
          + '></div>';
      });
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  return {
    getMaterial: getMaterial,
    getAllMaterials: getAllMaterials,
    getMaterialsByCategory: getMaterialsByCategory,
    getMaterialPrice: getMaterialPrice,
    getMaterialLabel: getMaterialLabel,
    getColorPalette: getColorPalette,
    getAllColors: getAllColors,
    getThicknesses: getThicknesses,
    buildColorSwatchesHTML: buildColorSwatchesHTML,
    PANEL_MATERIALS: PANEL_MATERIALS,
    COLOR_PALETTE: COLOR_PALETTE,
  };
}());

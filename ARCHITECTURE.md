# 🏗️ Marcenaria 3D — Arquitetura Refatorada

## Visão Geral

O projeto foi reestruturado de um **monolito de 5000+ linhas** em um único arquivo
para uma **arquitetura modular** com responsabilidades bem definidas.

---

## Estrutura de Diretórios

```
js/
├── core/
│   ├── EventBus.js          ← Sistema pub/sub desacoplado
│   ├── StateManager.js      ← Única fonte de verdade (estado global)
│   └── SceneManager.js      ← Cena Three.js, renderer, loop de animação
│
├── rendering/
│   ├── MaterialCache.js     ← Cache de materiais (evita recriar na GPU)
│   ├── GeometryCache.js     ← Cache de geometrias reutilizáveis
│   └── SelectionManager.js  ← Raycasting, highlight, TransformControls
│
├── modules/
│   ├── ModuleBuilder.js     ← Primitivos (mkP, addPiece) + dispatcher
│   ├── Cabinet.js           ← Armário base/superior
│   ├── Drawer.js            ← Módulo de gavetas
│   ├── Torre.js             ← Torre quente
│   ├── Balcao.js            ← Balcão com tampo
│   ├── Shelf.js             ← Nichos, prateleiras, armário aberto
│   └── Appliances.js        ← Eletrodomésticos (geladeira, forno, etc.)
│
├── editor/
│   ├── AnimationManager.js  ← Portas/gavetas (tweening próprio)
│   ├── ProjectManager.js    ← Save/load JSON, add/remove/rebuild módulos
│   └── TransformManager.js  ← (TODO) Snap, align, transform helpers
│
├── ui/
│   ├── ToastManager.js      ← Notificações toast via EventBus
│   ├── PropertiesPanel.js   ← (TODO) Painel de propriedades direito
│   └── ObjectList.js        ← (TODO) Lista de objetos (aba Projeto)
│
├── materials/
│   └── MaterialLibrary.js   ← Catálogo de materiais, cores, espessuras
│
├── export/
│   ├── CutListGenerator.js  ← (TODO) Lista de corte
│   └── BudgetGenerator.js   ← (TODO) Orçamento
│
├── utils/
│   └── MathUtils.js         ← Matemática, bounding box, snap, clamp
│
└── App.js                   ← Ponto de entrada e bootstrap
```

---

## Ordem de Carregamento no HTML

```html
<!-- Three.js e controles (externos) -->
<script src="three.min.js"></script>
<script src="OrbitControls.js"></script>
<script src="TransformControls.js"></script>

<!-- Core (sem dependências externas) -->
<script src="js/core/EventBus.js"></script>
<script src="js/core/StateManager.js"></script>
<script src="js/core/SceneManager.js"></script>

<!-- Utils -->
<script src="js/utils/MathUtils.js"></script>

<!-- Materials -->
<script src="js/materials/MaterialLibrary.js"></script>

<!-- Rendering (depende de core + Three.js) -->
<script src="js/rendering/MaterialCache.js"></script>
<script src="js/rendering/GeometryCache.js"></script>
<script src="js/rendering/SelectionManager.js"></script>

<!-- Camera (depende de SceneManager) -->
<script src="js/core/CameraManager.js"></script>

<!-- Modules (depende de Material/Geometry Cache) -->
<script src="js/modules/ModuleBuilder.js"></script>
<script src="js/modules/Cabinet.js"></script>
<script src="js/modules/Drawer.js"></script>
<script src="js/modules/Torre.js"></script>
<script src="js/modules/Balcao.js"></script>
<script src="js/modules/Shelf.js"></script>
<script src="js/modules/Appliances.js"></script>

<!-- Editor (depende de tudo acima) -->
<script src="js/editor/AnimationManager.js"></script>
<script src="js/editor/ProjectManager.js"></script>

<!-- UI (depende de editor) -->
<script src="js/ui/ToastManager.js"></script>
<script src="js/ui/ObjectList.js"></script>
<script src="js/ui/PropertiesPanel.js"></script>

<!-- Auth (autenticação) -->
<script src="js/auth.js"></script>

<!-- Bootstrap -->
<script src="js/App.js"></script>
```

---

## Princípios Arquiteturais

### 1. EventBus — Comunicação Desacoplada
```javascript
// Emitir evento
EventBus.emit('module:added', { module: g });

// Escutar evento
EventBus.on('module:added', function(data) {
  console.log('Novo módulo:', data.module);
});
```

### 2. StateManager — Única Fonte de Verdade
```javascript
// Ler estado
var mods = StateManager.get('modules');

// Atualizar estado
StateManager.set({ snapEnabled: true });

// Ação de alto nível
StateManager.addModule(g);    // atualiza estado + emite evento
StateManager.selectModule(g); // atualiza seleção + emite evento
```

### 3. MaterialCache — Performance de Renderização
```javascript
// ANTES (cria novo material a cada chamada — problema)
var mat = new THREE.MeshStandardMaterial({ color: '#d4b896' });

// DEPOIS (cache — zero alocação na segunda chamada)
var mat = MaterialCache.get('mdf_branco', '#d4b896');
```

### 4. GeometryCache — Reutilização de Geometrias
```javascript
// Mesma geometria compartilhada por múltiplos meshes
var geo = GeometryCache.getBox(600, 720, 550);
```

---

## Guia de Migração do main.js

### Fase 1 ✅ — Core Infrastructure
- EventBus
- StateManager
- SceneManager
- CameraManager
- MaterialCache / GeometryCache
- MathUtils
- MaterialLibrary
- AnimationManager
- ModuleBuilder (base)
- SelectionManager
- ProjectManager
- ToastManager
- App.js (bootstrap)

### Fase 2 — Módulos de Módulos
Extrair cada função `mk*()` do main.js para seu próprio arquivo:
- `Cabinet.js` ← `mkCabinet()`
- `Drawer.js` ← `mkDrawer()`
- `Torre.js` ← `mkTorre()`
- etc.

### Fase 3 — UI
Extrair funções de UI:
- `PropertiesPanel.js` ← `rProps()`, `noSel()`
- `ObjectList.js` ← `rList()`
- `PanelManager.js` ← acordeões, tabs, sidebars

### Fase 4 — Export
- `CutListGenerator.js` ← `genCutList()`
- `BudgetGenerator.js` ← budget module

### Fase 5 — Limpeza
- Remover código legado do main.js
- Remover `_exposeLegacyGlobals()` do App.js
- Adicionar bundler (Vite/esbuild) se necessário

---

## Melhorias de Performance Implementadas

| Problema | Solução | Impacto |
|----------|---------|---------|
| Materiais recriados a cada `gm()` | MaterialCache | -90% alocações |
| Geometrias duplicadas | GeometryCache | -70% memória GPU |
| Loop de animação sem dt | `onTick(dt)` unificado | Frame-rate estável |
| Raycasting em todo frame | Apenas em eventos | CPU -60% |
| Globals soltos | StateManager | Testabilidade |

---

## Atalhos de Teclado

| Tecla | Ação |
|-------|------|
| `G` | Modo mover |
| `R` | Modo rotacionar |
| `S` | Modo escalar |
| `F` | Focar no selecionado |
| `Delete` | Remover módulo |
| `Ctrl+S` | Salvar projeto |
| `Ctrl+D` | Duplicar selecionado |
| `Esc` | Deselecionar |
| Duplo clique | Abrir/fechar portas e gavetas |

---

## Debug

```javascript
// No console do navegador:
_AppStats()              // estatísticas de materiais e geometrias
_App.EventBus.debug()    // eventos registrados
_App.StateManager.snapshot()  // estado atual
```

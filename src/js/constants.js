(function (global) {
  'use strict';

  var Gladiadores = (global.Gladiadores = global.Gladiadores || {});

  // Ordem oficial de cima para baixo no Tabuleiro Lado A
  var SUITS = ['gladio', 'tridente', 'mangual', 'machado'];

  var SUIT_META = {
    gladio: {
      id: 'gladio',
      name: 'Gládio',
      colorName: 'Verde',
      hex: '#2ea043',
      softHex: '#dff6e4',
      darkHex: '#196127',
      borderHex: '#43c45b',
      textHex: '#ffffff'
    },
    tridente: {
      id: 'tridente',
      name: 'Tridente',
      colorName: 'Vermelho',
      hex: '#d94141',
      softHex: '#fde2e2',
      darkHex: '#8d2020',
      borderHex: '#f06464',
      textHex: '#ffffff'
    },
    mangual: {
      id: 'mangual',
      name: 'Mangual',
      colorName: 'Preto',
      hex: '#2d3139',
      softHex: '#e3e5e9',
      darkHex: '#15181d',
      borderHex: '#636b7a',
      textHex: '#ffffff'
    },
    machado: {
      id: 'machado',
      name: 'Machado',
      colorName: 'Azul',
      hex: '#1b85c9',
      softHex: '#ddf0fc',
      darkHex: '#0f517d',
      borderHex: '#43a8eb',
      textHex: '#ffffff'
    },
    leao: {
      id: 'leao',
      name: 'Leão',
      colorName: 'Neutro',
      hex: '#c48b3b',
      softHex: '#fbf0dc',
      darkHex: '#7c5218',
      borderHex: '#e3ab58',
      textHex: '#ffffff'
    }
  };

  var PLAYER_COLOR_ORDER = ['cinza', 'laranja', 'branco', 'amarelo'];

  var PLAYER_COLORS = {
    cinza: {
      id: 'cinza',
      name: 'Cinza',
      top: '#969a9f',
      front: '#6e7278',
      side: '#4d5055',
      accent: '#a9adb2',
      border: '#323539',
      textColor: '#ffffff'
    },
    laranja: {
      id: 'laranja',
      name: 'Laranja',
      top: '#f47b2a',
      front: '#d95814',
      side: '#a33c09',
      accent: '#ff8a3d',
      border: '#6f2604',
      textColor: '#ffffff'
    },
    branco: {
      id: 'branco',
      name: 'Branco',
      top: '#fbfaf7',
      front: '#e2dfd7',
      side: '#b8b3a8',
      accent: '#f5f2ea',
      border: '#767168',
      textColor: '#2a241d'
    },
    amarelo: {
      id: 'amarelo',
      name: 'Amarelo',
      top: '#f9d438',
      front: '#dfb012',
      side: '#ad8308',
      accent: '#ffd845',
      border: '#755603',
      textColor: '#2a1f04'
    }
  };

  // Ícones vetoriais inspirados na tabela de naipes do verso do manual (pág. 16)
  var SUIT_ICON_PATHS = {
    gladio:
      '<path d="M21 3c-1.8.4-5.2 2.1-7.8 4.7L8.8 12.1l-1.5-1.4-1.6 1.6 1.8 1.8-3.4 3.4a1.5 1.5 0 0 0 2.1 2.1l3.4-3.4 1.8 1.8 1.6-1.6-1.4-1.5 4.4-4.4C18.6 8.1 20.6 4.8 21 3z" fill="currentColor"/>',
    tridente:
      '<path d="M12 2.5L9.8 6h1.2v4.6c-1.6-.2-2.6-.9-2.8-2.2V6H9.2L7.3 3 5.4 6h1v2.6c0 2.4 1.9 4.1 4.6 4.4V21.5h2V13c2.7-.3 4.6-2 4.6-4.4V6h1l-1.9-3-1.9 3h1v2.4c-.2 1.3-1.2 2-2.8 2.2V6h1.2L12 2.5z" fill="currentColor"/>',
    mangual:
      '<path d="M12 2.2l1.4 3.2 3.3-.9-1.1 3.3 3 1.8-3 1.8 1.1 3.3-3.3-.9L12 17l-1.4-3.2-3.3.9 1.1-3.3-3-1.8 3-1.8-1.1-3.3 3.3.9L12 2.2zm-.9 15.1h1.8v2.4h-1.8v-2.4zm-.6 2.8h3v1.9h-3v-1.9z" fill="currentColor"/>',
    machado:
      '<path d="M10.8 2.5h2.4v2.1c2.5-.2 5-1.1 6.8-2.3.9 2.7 1 7.6 0 10.6-1.8-1.2-4.3-2.1-6.8-2.3v10.9h-2.4V10.6c-2.5.2-5 1.1-6.8 2.3-1-3-.9-7.9 0-10.6 1.8 1.2 4.3 2.1 6.8 2.3V2.5z" fill="currentColor"/>',
    leao:
      '<path d="M7.2 6.8c.9 0 1.6 1.1 1.6 2.3s-.7 2.1-1.6 2.1-1.6-.9-1.6-2.1.7-2.3 1.6-2.3zm3.2-2.4c1 0 1.7 1.2 1.7 2.6s-.7 2.4-1.7 2.4-1.7-1.1-1.7-2.4.7-2.6 1.7-2.6zm3.3 0c1 0 1.7 1.2 1.7 2.6s-.7 2.4-1.7 2.4-1.7-1.1-1.7-2.4.7-2.6 1.7-2.6zm3.1 2.4c.9 0 1.6 1.1 1.6 2.3s-.7 2.1-1.6 2.1-1.6-.9-1.6-2.1.7-2.3 1.6-2.3zM12 11.4c3.4 0 5.9 2.5 5.9 5.3 0 1.7-1.3 2.8-2.8 2.8-1.1 0-2-.5-3.1-.5s-2 .5-3.1.5c-1.5 0-2.8-1.1-2.8-2.8 0-2.8 2.5-5.3 5.9-5.3z" fill="currentColor"/>'
  };

  function getSuitSvg(suitId, isDamaged, extraClass) {
    var meta = SUIT_META[suitId] || SUIT_META.leao;
    var path = SUIT_ICON_PATHS[suitId] || SUIT_ICON_PATHS.leao;
    var cls = 'suit-svg' + (extraClass ? ' ' + extraClass : '');
    if (!isDamaged) {
      return (
        '<svg class="' + cls + '" viewBox="0 0 24 24" aria-hidden="true" style="color:' + meta.hex + '">' +
        path +
        '</svg>'
      );
    }
    return (
      '<svg class="' + cls + ' is-damaged" viewBox="0 0 24 24" aria-hidden="true" style="color:' + meta.hex + '">' +
      '<circle cx="12" cy="12" r="10.2" fill="#ffffff" stroke="' + meta.hex + '" stroke-width="1.9"/>' +
      '<g transform="translate(3.6 3.6) scale(0.7)">' + path + '</g>' +
      '<line x1="4.5" y1="4.5" x2="19.5" y2="19.5" stroke="#ffffff" stroke-width="3.6" stroke-linecap="round"/>' +
      '<line x1="4.5" y1="4.5" x2="19.5" y2="19.5" stroke="' + meta.hex + '" stroke-width="1.6" stroke-linecap="round"/>' +
      '</svg>'
    );
  }

  // Catálogo oficial das 50 cartas de jogo (GL001 a GL050)
  var CARD_CATALOG = [];
  var CARD_BY_ID = {};

  function registerCard(card) {
    CARD_CATALOG.push(card);
    CARD_BY_ID[card.id] = card;
  }

  // GL001-GL010: Tridente 1..10
  for (var i = 1; i <= 10; i++) {
    var num1 = ('00' + i).slice(-3);
    registerCard({
      id: 'GL' + num1,
      type: 'combat',
      suit: 'tridente',
      value: i,
      name: i + ' de Tridente',
      img: 'assets/cards/GL' + num1 + '.jpg'
    });
  }

  // GL011-GL020: Mangual 1..10
  for (var j = 1; j <= 10; j++) {
    var num2 = ('00' + (10 + j)).slice(-3);
    registerCard({
      id: 'GL' + num2,
      type: 'combat',
      suit: 'mangual',
      value: j,
      name: j + ' de Mangual',
      img: 'assets/cards/GL' + num2 + '.jpg'
    });
  }

  // GL021-GL030: Gládio 1..10
  for (var k = 1; k <= 10; k++) {
    var num3 = ('00' + (20 + k)).slice(-3);
    registerCard({
      id: 'GL' + num3,
      type: 'combat',
      suit: 'gladio',
      value: k,
      name: k + ' de Gládio',
      img: 'assets/cards/GL' + num3 + '.jpg'
    });
  }

  // GL031-GL040: Machado 1..10
  for (var m = 1; m <= 10; m++) {
    var num4 = ('00' + (30 + m)).slice(-3);
    registerCard({
      id: 'GL' + num4,
      type: 'combat',
      suit: 'machado',
      value: m,
      name: m + ' de Machado',
      img: 'assets/cards/GL' + num4 + '.jpg'
    });
  }

  // GL041-GL046: 6 Cartas duplas de Arma Danificada
  var damagedSpecs = [
    { id: 'GL041', topSuit: 'machado', bottomSuit: 'gladio' },
    { id: 'GL042', topSuit: 'machado', bottomSuit: 'mangual' },
    { id: 'GL043', topSuit: 'machado', bottomSuit: 'tridente' },
    { id: 'GL044', topSuit: 'gladio', bottomSuit: 'mangual' },
    { id: 'GL045', topSuit: 'gladio', bottomSuit: 'tridente' },
    { id: 'GL046', topSuit: 'mangual', bottomSuit: 'tridente' }
  ];
  for (var d = 0; d < damagedSpecs.length; d++) {
    var ds = damagedSpecs[d];
    registerCard({
      id: ds.id,
      type: 'damaged',
      suit: null,
      topSuit: ds.topSuit,
      bottomSuit: ds.bottomSuit,
      value: 0,
      name: 'Arma Danificada (' + SUIT_META[ds.topSuit].name + ' / ' + SUIT_META[ds.bottomSuit].name + ')',
      img: 'assets/cards/' + ds.id + '.jpg'
    });
  }

  // GL047-GL050: 4 Cartas de Leão (valor 11, naipe neutro)
  for (var l = 47; l <= 50; l++) {
    var lid = 'GL0' + l;
    registerCard({
      id: lid,
      type: 'lion',
      suit: 'leao',
      value: 11,
      name: 'Leão (11)',
      img: 'assets/cards/' + lid + '.jpg'
    });
  }

  function getCardById(id) {
    return CARD_BY_ID[id] || null;
  }

  // Coordenadas percentuais exatas medidas sobre os tabuleiros recortados (1512x530)
  var BOARD_A_COORDS = {
    aspectRatio: 1512 / 530,
    rowY: {
      gladio: 25.19,
      tridente: 44.34,
      mangual: 63.63,
      machado: 83.44
    },
    colX: [4.73, 10.68, 16.63, 22.52, 28.42, 34.26, 40.18, 46.00, 51.92, 57.71, 63.56],
    scoreColX: [77.51, 83.43, 89.25, 95.14],
    cellW: 5.22,
    cellH: 14.91
  };

  var BOARD_B_COORDS = {
    aspectRatio: 1512 / 530,
    rowY: [27.92, 55.66, 83.30],
    colX: [5.69, 15.59, 25.36, 35.25, 45.17, 55.06, 64.86, 74.74, 84.49, 94.15],
    cellW: 6.88,
    cellH: 19.43
  };

  function getBoardASpaceCoord(suitId, colIndex0To10) {
    var col = Math.max(0, Math.min(10, colIndex0To10));
    return {
      x: BOARD_A_COORDS.colX[col],
      y: BOARD_A_COORDS.rowY[suitId]
    };
  }

  function getBoardAScoreSlotCoord(suitId, slotIndex0To3) {
    var col = Math.max(0, Math.min(3, slotIndex0To3));
    return {
      x: BOARD_A_COORDS.scoreColX[col],
      y: BOARD_A_COORDS.rowY[suitId]
    };
  }

  function getBoardBSpaceCoord(space1To30) {
    var clamped = Math.max(1, Math.min(30, space1To30));
    var idx = clamped - 1;
    var row = Math.floor(idx / 10);
    var col = row % 2 === 0 ? idx % 10 : 9 - (idx % 10);
    return {
      x: BOARD_B_COORDS.colX[col],
      y: BOARD_B_COORDS.rowY[row],
      row: row,
      col: col,
      clamped: clamped,
      overflow: Math.max(0, space1To30 - 30)
    };
  }

  Gladiadores.CONSTANTS = {
    SUITS: SUITS,
    SUIT_META: SUIT_META,
    PLAYER_COLOR_ORDER: PLAYER_COLOR_ORDER,
    PLAYER_COLORS: PLAYER_COLORS,
    CARD_CATALOG: CARD_CATALOG,
    CARD_BY_ID: CARD_BY_ID,
    FIRST_PLAYER_IMG: 'assets/cards/first_player.jpg',
    CARD_BACK_IMG: 'assets/cards/card_back.jpg',
    BOARD_A_IMG: 'assets/boards/board_a.jpg',
    BOARD_B_IMG: 'assets/boards/board_b.jpg',
    BOARD_A_COORDS: BOARD_A_COORDS,
    BOARD_B_COORDS: BOARD_B_COORDS,
    getSuitSvg: getSuitSvg,
    getCardById: getCardById,
    getBoardASpaceCoord: getBoardASpaceCoord,
    getBoardAScoreSlotCoord: getBoardAScoreSlotCoord,
    getBoardBSpaceCoord: getBoardBSpaceCoord
  };
})(window);

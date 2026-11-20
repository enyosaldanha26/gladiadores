(function (global) {
  'use strict';

  var Gladiadores = (global.Gladiadores = global.Gladiadores || {});

  function C() { return Gladiadores.CONSTANTS; }
  function E() { return Gladiadores.Engine; }

  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function cubeStyleAttr(colorId) {
    var col = C().PLAYER_COLORS[colorId] || C().PLAYER_COLORS.cinza;
    return (
      '--cube-top:' + col.top +
      ';--cube-front:' + col.front +
      ';--cube-side:' + col.side +
      ';--cube-border:' + col.border
    );
  }

  function renderCubeChip(colorId, isLg) {
    var col = C().PLAYER_COLORS[colorId] || C().PLAYER_COLORS.cinza;
    return (
      '<span class="cube-chip' + (isLg ? ' is-lg' : '') + '" ' +
      'style="' + cubeStyleAttr(colorId) + '" ' +
      'title="Cor: ' + esc(col.name) + '"></span>'
    );
  }

  var prevBattleTag = '';
  var prevArenaLen = 0;

  function getSeatLayout(state, viewerIdx) {
    var n = state.numPlayers;
    if (n === 3) {
      return {
        bl: viewerIdx,
        tl: (viewerIdx + 1) % 3,
        tr: (viewerIdx + 2) % 3,
        br: null
      };
    }
    return {
      bl: viewerIdx,
      tl: (viewerIdx + 1) % 4,
      tr: (viewerIdx + 2) % 4,
      br: (viewerIdx + 3) % 4
    };
  }

  function getClusterOffsets(count, isBoardB) {
    if (count <= 1) return [{ dx: 0, dy: 0 }];
    var xStep = isBoardB ? 1.55 : 1.15;
    var yStep = isBoardB ? 3.5 : 2.6;
    if (count === 2) {
      return [
        { dx: -xStep, dy: 0 },
        { dx: xStep, dy: 0 }
      ];
    }
    if (count === 3) {
      return [
        { dx: -xStep, dy: -yStep },
        { dx: xStep, dy: -yStep },
        { dx: 0, dy: yStep }
      ];
    }
    return [
      { dx: -xStep, dy: -yStep },
      { dx: xStep, dy: -yStep },
      { dx: -xStep, dy: yStep },
      { dx: xStep, dy: yStep }
    ];
  }

  /**
   * Renderiza os cubos 3D no Tabuleiro de Glória (reutilizando nós DOM para transição suave).
   * Aceita `animState.boardOverride` durante animações ao vivo de fim de rodada e fim de jogo.
   */
  function renderBoardCubes(layerEl, state, animState) {
    var expectedTag = state.boardSide + ':' + state.numPlayers;
    if (layerEl.getAttribute('data-layout-key') !== expectedTag) {
      layerEl.innerHTML = '';
      layerEl.setAttribute('data-layout-key', expectedTag);
    }

    var override = animState && animState.boardOverride;
    var descriptors = [];

    if (state.boardSide === 'A') {
      C().SUITS.forEach(function (suit) {
        var leftGroups = {};
        var scoreGroups = {};

        state.players.forEach(function (p) {
          var scoreRank =
            override &&
            override.scoreSlotsA &&
            override.scoreSlotsA[suit] &&
            override.scoreSlotsA[suit][p.index];

          if (typeof scoreRank === 'number') {
            if (!scoreGroups[scoreRank]) scoreGroups[scoreRank] = [];
            scoreGroups[scoreRank].push(p);
          } else {
            var pos =
              override && override.tracksA && override.tracksA[p.index]
                ? override.tracksA[p.index][suit]
                : p.tracksA[suit];
            if (!leftGroups[pos]) leftGroups[pos] = [];
            leftGroups[pos].push(p);
          }
        });

        Object.keys(leftGroups).forEach(function (posStr) {
          var pos = Number(posStr);
          var list = leftGroups[posStr];
          var offsets = getClusterOffsets(list.length, false);
          var base = C().getBoardASpaceCoord(suit, pos);
          list.forEach(function (p, idx) {
            descriptors.push({
              key: 'A-' + suit + '-' + p.index,
              player: p,
              x: base.x + offsets[idx].dx,
              y: base.y + offsets[idx].dy,
              overflow: 0,
              title: p.name + ' (' + C().SUIT_META[suit].name + '): casa ' + (pos + 1) + '/11'
            });
          });
        });

        var slotPts = state.numPlayers === 3 ? [5, 3, 2] : [5, 3, 2, 1];
        Object.keys(scoreGroups).forEach(function (rankStr) {
          var rank = Number(rankStr);
          var listS = scoreGroups[rankStr];
          var offsetsS = getClusterOffsets(listS.length, false);
          var baseS = C().getBoardAScoreSlotCoord(suit, rank);
          var ptsVal = slotPts[rank] || 0;
          listS.forEach(function (p, idx) {
            descriptors.push({
              key: 'A-' + suit + '-' + p.index,
              player: p,
              x: baseS.x + offsetsS[idx].dx,
              y: baseS.y + offsetsS[idx].dy,
              overflow: 0,
              title: p.name + ' (' + C().SUIT_META[suit].name + '): ' + ptsVal + ' pontos!'
            });
          });
        });
      });
    } else {
      var groupsB = {};
      var getVisualTrackB = function (p) {
        return override && override.trackB && typeof override.trackB[p.index] === 'number'
          ? override.trackB[p.index]
          : p.trackB;
      };
      state.players.forEach(function (p) {
        var val = getVisualTrackB(p);
        var clamped = Math.max(1, Math.min(30, val));
        if (!groupsB[clamped]) groupsB[clamped] = [];
        groupsB[clamped].push({ player: p, val: val });
      });
      Object.keys(groupsB).forEach(function (spStr) {
        var listB = groupsB[spStr];
        var offsetsB = getClusterOffsets(listB.length, true);
        listB.forEach(function (item, idx) {
          var baseB = C().getBoardBSpaceCoord(item.val);
          descriptors.push({
            key: 'B-' + item.player.index,
            player: item.player,
            x: baseB.x + offsetsB[idx].dx,
            y: baseB.y + offsetsB[idx].dy,
            overflow: baseB.overflow,
            exactScore: item.val,
            title: item.player.name + ': ' + item.val + ' ponto(s)'
          });
        });
      });
    }

    var highlights = (override && override.cubeHighlights) || {};
    var isStepWalk = !!(override && override.stepWalk);

    descriptors.forEach(function (desc) {
      var el = layerEl.querySelector('[data-cube-key="' + desc.key + '"]');
      if (!el) {
        el = document.createElement('div');
        el.className = 'board-cube';
        el.setAttribute('data-cube-key', desc.key);
        layerEl.appendChild(el);
      }
      var cls = 'board-cube';
      if (isStepWalk) cls += ' is-step-walk';
      if (highlights[desc.key]) cls += ' ' + highlights[desc.key];
      el.className = cls;

      el.setAttribute('style', cubeStyleAttr(desc.player.color) + ';left:' + desc.x.toFixed(2) + '%;top:' + desc.y.toFixed(2) + '%;');
      el.title = desc.title;
      if (desc.overflow > 0) {
        el.innerHTML = '<span class="board-cube-overflow">' + desc.exactScore + '</span>';
      } else {
        el.innerHTML = '';
      }
    });
  }

  function getPendingPlayAreaElimsForPlayer(state, playerIdx, animState) {
    if (!animState || !state.pendingResolution || !state.pendingResolution.eliminations) return [];
    var completed = animState.completedElims || 0;
    return state.pendingResolution.eliminations.slice(completed).filter(function (el) {
      return el.source === 'playArea' && el.fromPlayerIdx === playerIdx && el.eliminatedCard;
    });
  }

  function renderPlayAreaGrid(state, player, animState) {
    var suits = C().SUITS;
    var pendingPlayAreaElims = getPendingPlayAreaElimsForPlayer(state, player.index, animState);
    var arrivedIds = (animState && animState.arrivedCardIds) || {};
    var receivingSuits = {};
    if (
      animState &&
      (animState.stage === 'STEP_3_COLLECT_HIGHLIGHT' || animState.stage === 'STEP_3_COLLECT_FLY') &&
      state.pendingResolution &&
      state.pendingResolution.winnerIdx === player.index
    ) {
      state.pendingResolution.leadCards.forEach(function (lc) {
        receivingSuits[lc.card.suit] = true;
      });
      if (state.pendingResolution.chosenOffsuitPlayOrder !== null) {
        var offP = state.pendingResolution.offSuitCards.find(function (o) {
          return o.playOrder === state.pendingResolution.chosenOffsuitPlayOrder;
        });
        if (offP) receivingSuits[offP.card.suit] = true;
      }
    }

    var html = '<div class="play-area-grid">';
    suits.forEach(function (suit) {
      var meta = C().SUIT_META[suit];
      var baseCards = player.playArea[suit] || [];
      var restoredForSuit = pendingPlayAreaElims
        .filter(function (el) { return el.suit === suit; })
        .map(function (el) {
          return { card: el.eliminatedCard, isPendingBreak: el.weaponPlayOrder === animState.activeWeaponOrder };
        });

      var displayItems = baseCards.map(function (c) {
        return { card: c, isPendingBreak: false };
      }).concat(restoredForSuit);

      displayItems.sort(function (a, b) {
        return a.card.value - b.card.value;
      });

      var isScoringSuit = animState && animState.scoringSuit === suit;
      var colCls = 'suit-col' +
        (receivingSuits[suit] ? ' is-receiving' : '') +
        (isScoringSuit ? ' is-scoring-focus' : '');
      html +=
        '<div class="' + colCls + '" data-suit-col="' + suit + '" ' +
        (isScoringSuit ? 'style="--focus-suit-color:' + meta.borderHex + '" ' : '') +
        'title="' + esc(meta.name) + ': ' + displayItems.length + ' carta(s)">';
      html += '<div class="suit-col-head">' + C().getSuitSvg(suit, false) + '<span>' + displayItems.length + '</span></div>';
      html += '<div class="suit-col-cards">';
      if (displayItems.length === 0) {
        html += '<span class="play-area-empty">—</span>';
      } else {
        displayItems.forEach(function (item) {
          var c = item.card;
          var chipCls = 'mini-val-chip';
          if (arrivedIds[c.id]) chipCls += ' is-arrived';
          if (item.isPendingBreak) chipCls += ' is-pending-break';
          html +=
            '<button type="button" class="' + chipCls + '" ' +
            'style="--chip-bg:' + meta.hex + '" ' +
            (item.isPendingBreak || restoredForSuit.length > 0 ? 'data-pending-elim-card="' + c.id + '" ' : '') +
            'data-inspect-card="' + c.id + '" ' +
            'title="Clique para ampliar ' + esc(c.name) + '">' +
            c.value +
            '</button>';
        });
      }
      html += '</div></div>';
    });
    html += '</div>';
    return html;
  }

  function renderPlayerBox(state, player, isViewer, animState) {
    var pColor = C().PLAYER_COLORS[player.color] || C().PLAYER_COLORS.cinza;
    var isTurn =
      (state.phase === 'PLAYING_BATTLE' && state.currentPlayerIdx === player.index) ||
      (state.phase === 'CHOOSE_OFFSUIT_CARD' &&
        (!animState || animState.stage === 'CHOOSE_OFFSUIT') &&
        state.pendingResolution &&
        state.pendingResolution.winnerIdx === player.index) ||
      (animState && animState.scoringPlayerIdx === player.index);

    var isResolvingVisual = !!state.pendingResolution && state.phase !== 'PLAYING_BATTLE' &&
      (!animState || animState.stage !== 'CHOOSE_OFFSUIT');
    var isWinner =
      (isResolvingVisual || state.phase === 'BATTLE_RESOLVED') &&
      state.pendingResolution &&
      state.pendingResolution.winnerIdx === player.index;

    var classes =
      'player-box' +
      (isViewer ? ' is-viewer' : '') +
      (isTurn ? ' is-turn' : '') +
      (isWinner ? ' is-winner' : '');

    var isSelfNamed = player.name.trim().toLowerCase() === 'você';
    var displayName = isViewer
      ? (isSelfNamed ? 'Você' : esc(player.name) + ' (Você)')
      : esc(player.name);

    var roleBase = isViewer
      ? 'Sua Área'
      : player.isHuman
        ? 'Humano'
        : player.difficulty === 'casual'
          ? 'Bot Casual'
          : 'Bot Estratégico';

    var override = animState && animState.boardOverride;
    var visualTrackB =
      override && override.trackB && typeof override.trackB[player.index] === 'number'
        ? override.trackB[player.index]
        : player.trackB;

    var roleText = pColor.name + ' • ' + roleBase;
    if (!isViewer && state.boardSide === 'B') {
      roleText += ' • ' + visualTrackB + ' pts';
    }

    var isFirst = state.firstPlayerIdx === player.index;
    var stateBadge = '';
    if (isWinner) {
      stateBadge = '<span class="winner-pill">🏆 Venceu!</span>';
    } else if (isTurn) {
      var turnTxt =
        animState && animState.scoringPlayerIdx === player.index
          ? '★ Pontuando'
          : state.phase === 'CHOOSE_OFFSUIT_CARD'
            ? '★ Escolhendo'
            : isViewer
              ? '● Sua vez'
              : '● Na vez';
      stateBadge = '<span class="turn-pill">' + turnTxt + '</span>';
    }

    var pendingPlayAreaCount = getPendingPlayAreaElimsForPlayer(state, player.index, animState).length;
    var footerHtml = isViewer
      ? (animState && (animState.stage === 'ROUND_SCORING' || animState.stage === 'GAME_OVER_SCORING') && state.boardSide === 'B'
          ? 'Posição na Trilha B: <strong>' + visualTrackB + ' ponto(s)</strong>'
          : computePlayerTacticalSummary(state, player))
      : 'Coletadas: <strong>' + (E().getTotalPlayAreaCount(player) + pendingPlayAreaCount) + '</strong> carta(s)' +
        (state.boardSide === 'B' ? ' • Trilha B: <strong>' + visualTrackB + ' pts</strong>' : '');

    return (
      '<div class="' + classes + '" data-player-box="' + player.index + '">' +
        '<div class="opp-head" style="--player-accent:' + pColor.front + '">' +
          '<div class="opp-identity">' +
            renderCubeChip(player.color, false) +
            '<div class="opp-name-wrap">' +
              '<div class="opp-name">' + displayName + '</div>' +
              '<div class="opp-meta">' + esc(roleText) + '</div>' +
            '</div>' +
          '</div>' +
          '<div class="opp-badges">' +
            stateBadge +
            (isFirst
              ? '<span class="fp-helm-badge" title="Carta de Primeiro Jogador desta rodada"><img src="' + C().FIRST_PLAYER_IMG + '" alt="1º" />1º</span>'
              : '') +
            '<span class="opp-hand-pill" title="Cartas na mão"><img src="' + C().CARD_BACK_IMG + '" alt="Mão" />' + player.hand.length + '</span>' +
          '</div>' +
        '</div>' +
        renderPlayAreaGrid(state, player, animState) +
        '<div class="player-box-footer">' + footerHtml + '</div>' +
      '</div>'
    );
  }

  function computePlayerTacticalSummary(state, player) {
    var suits = C().SUITS;
    if (state.boardSide === 'A') {
      var parts = [];
      suits.forEach(function (suit) {
        var myC = player.playArea[suit].length;
        var maxC = 0;
        state.players.forEach(function (p) {
          maxC = Math.max(maxC, p.playArea[suit].length);
        });
        var delta = 0;
        if (maxC > 0) {
          if (myC === maxC) delta = 1;
          else if (myC === 0) delta = 0;
          else delta = maxC - myC >= 4 ? -2 : -1;
        }
        var label = delta > 0 ? '+1' : delta < 0 ? String(delta) : '0';
        var cls = delta > 0 ? 'delta-pos' : delta < 0 ? 'delta-neg' : 'delta-zero';
        parts.push(C().SUIT_META[suit].name.slice(0, 3) + ': <span class="' + cls + '">' + label + '</span>');
      });
      return 'Previsão da rodada: ' + parts.join(' • ');
    }

    // Lado B
    var present = [];
    suits.forEach(function (s) {
      if (player.playArea[s].length > 0) present.push(player.playArea[s].length);
    });
    if (present.length === 0) {
      return 'Posição atual: <strong>' + player.trackB + '</strong> • Sem cartas (Caso D: iguala ao maior da rodada)';
    }
    if (present.length === 1) {
      return 'Posição atual: <strong>' + player.trackB + '</strong> • Previsão: <span class="delta-pos">+' + present[0] + '</span> (Naipe único)';
    }
    var mx = Math.max.apply(null, present);
    var mn = Math.min.apply(null, present);
    var dB = 0;
    var caso = 'Caso A';
    if (mx === mn) {
      dB = present.reduce(function (a, b) { return a + b; }, 0);
      caso = 'Caso B (iguais)';
    } else {
      var bSum = present.filter(function (v) { return v === mx; }).reduce(function (a, b) { return a + b; }, 0);
      var wSum = present.filter(function (v) { return v === mn; }).reduce(function (a, b) { return a + b; }, 0);
      dB = bSum - wSum;
    }
    var signCls = dB > 0 ? 'delta-pos' : dB < 0 ? 'delta-neg' : 'delta-zero';
    var dTxt = (dB > 0 ? '+' : '') + dB;
    return 'Posição atual: <strong>' + player.trackB + '</strong> • Previsão: <span class="' + signCls + '">' + dTxt + '</span> (' + caso + ')';
  }

  function renderArenaStepper(state, animState) {
    var stepperEl = document.getElementById('arena-stepper');
    if (animState && (animState.stage === 'ROUND_SCORING' || animState.stage === 'GAME_OVER_SCORING')) {
      var pills = animState.stepperPills || [];
      if (pills.length === 0) {
        stepperEl.hidden = true;
        stepperEl.innerHTML = '';
        return;
      }
      stepperEl.hidden = false;
      stepperEl.innerHTML = pills
        .map(function (p) {
          var cls = 'step-pill' + (p.status === 'active' ? ' is-active' : p.status === 'done' ? ' is-done' : '');
          return '<span class="' + cls + '">' + esc(p.label) + '</span>';
        })
        .join('');
      return;
    }

    if (!state.pendingResolution || !animState || !animState.stage) {
      stepperEl.hidden = true;
      stepperEl.innerHTML = '';
      return;
    }

    var hasWeapons = state.pendingResolution.eliminations && state.pendingResolution.eliminations.length > 0;
    var stage = animState.stage;

    var s1Cls = 'step-pill ' + (stage === 'STEP_1_WINNER' ? 'is-active' : 'is-done');
    var s2Cls = 'step-pill ' + (
      stage === 'STEP_2_WEAPONS'
        ? 'is-active'
        : stage === 'STEP_1_WINNER'
          ? ''
          : 'is-done'
    );
    var s3Cls = 'step-pill ' + (
      stage === 'STEP_3_COLLECT_HIGHLIGHT' || stage === 'STEP_3_COLLECT_FLY' || stage === 'CHOOSE_OFFSUIT'
        ? 'is-active'
        : ''
    );

    stepperEl.hidden = false;
    stepperEl.innerHTML =
      '<span class="' + s1Cls + '">1. Vencedor</span>' +
      (hasWeapons ? '<span class="' + s2Cls + '">2. Armas</span>' : '<span class="' + s2Cls + '">2. Sem armas</span>') +
      '<span class="' + s3Cls + '">3. Coleta</span>';
  }

  function renderArenaNarration(state, animState) {
    var leadEl = document.getElementById('arena-lead-status');
    var rowEl = document.getElementById('arena-cards-row');
    var narrEl = document.getElementById('arena-narration');
    var narr = animState && animState.narration;

    if (!narr) {
      leadEl.hidden = false;
      rowEl.hidden = false;
      narrEl.hidden = true;
      narrEl.innerHTML = '';
      return false;
    }

    leadEl.hidden = true;
    rowEl.hidden = true;
    narrEl.hidden = false;

    var iconHtml = narr.suit ? C().getSuitSvg(narr.suit, false) : '🏆';
    var rowsHtml = (narr.rows || [])
      .map(function (r) {
        var player = state.players[r.playerIdx];
        var badgeCls = 'narration-badge ' + (r.badgeType || 'is-zero');
        return (
          '<div class="narration-row' + (r.active ? ' is-active-row' : '') + '">' +
            '<div class="narration-row-left">' +
              renderCubeChip(player.color, false) +
              '<span class="narration-row-name">' + esc(player.name) + '</span>' +
              '<span class="narration-row-detail">' + esc(r.detail || '') + '</span>' +
            '</div>' +
            '<span class="' + badgeCls + '">' + esc(r.badgeText || '') + '</span>' +
          '</div>'
        );
      })
      .join('');

    narrEl.innerHTML =
      '<div class="narration-head">' +
        '<div class="narration-title">' + iconHtml + '<span>' + esc(narr.title || '') + '</span></div>' +
        (narr.progress ? '<span class="narration-progress">' + esc(narr.progress) + '</span>' : '') +
      '</div>' +
      '<div class="narration-headline">' + esc(narr.headline || '') + '</div>' +
      '<div class="narration-rows">' + rowsHtml + '</div>';

    return true;
  }

  function renderArena(state, animState) {
    renderArenaStepper(state, animState);
    document.getElementById('discard-count').textContent = state.discardPile.length + ' descarte';

    if (
      animState &&
      (animState.stage === 'ROUND_SCORING' || animState.stage === 'GAME_OVER_SCORING') &&
      renderArenaNarration(state, animState)
    ) {
      return;
    }

    // Garante arena normal visível fora da narração de pontuação
    renderArenaNarration(state, null);

    var leadEl = document.getElementById('arena-lead-status');
    if (state.leadSuit) {
      var meta = C().SUIT_META[state.leadSuit];
      leadEl.innerHTML =
        C().getSuitSvg(state.leadSuit, false) +
        '<span>Naipe Líder: <strong>' + esc(meta.name) + ' (' + esc(meta.colorName) + ')</strong></span>';
    } else {
      var hasLionOnly = state.arena.length > 0;
      leadEl.innerHTML = hasLionOnly
        ? '<span>🦁 Leão jogado — próxima carta define o naipe líder</span>'
        : '<span>Aguardando a primeira carta definir o naipe líder</span>';
    }

    var res = state.pendingResolution;
    var uncompletedElimsCount = 0;
    if (res && animState && res.eliminations) {
      var done = animState.completedElims || 0;
      res.eliminations.slice(done).forEach(function (el) {
        if (el.source !== 'none') uncompletedElimsCount++;
      });
    }
    var visibleDiscard = Math.max(0, state.discardPile.length - uncompletedElimsCount);
    document.getElementById('discard-count').textContent = visibleDiscard + ' descarte';

    var rowEl = document.getElementById('arena-cards-row');
    rowEl.classList.toggle('is-3p', state.numPlayers === 3);

    var arenaByPlayer = {};
    state.arena.forEach(function (play) {
      arenaByPlayer[play.playerIdx] = play;
    });

    var stage = animState && animState.stage;
    var hiddenOrders = (animState && animState.hiddenArenaOrders) || {};
    var completedElims = (animState && animState.completedElims) || 0;

    var elimSet = {};
    var leadCollectSet = {};
    if (res) {
      var elimList = animState ? res.eliminations.slice(0, completedElims) : res.eliminations;
      elimList.forEach(function (el) {
        if (el.source === 'arena' && el.targetPlayOrder !== null) {
          elimSet[el.targetPlayOrder] = true;
        }
      });
      res.leadCards.forEach(function (lc) { leadCollectSet[lc.playOrder] = true; });
    }

    var curBattleTag = state.round + ':' + state.battleNumber;
    var justPlayedOrder = -1;
    if (curBattleTag !== prevBattleTag) {
      justPlayedOrder = state.arena.length === 1 ? 0 : -1;
    } else if (state.arena.length > prevArenaLen) {
      justPlayedOrder = state.arena.length - 1;
    }
    prevBattleTag = curBattleTag;
    prevArenaLen = state.arena.length;

    var showWinnerVisual = !!res && stage !== 'CHOOSE_OFFSUIT';
    var showCollectVisual =
      !!res &&
      (!animState || stage === 'STEP_3_COLLECT_HIGHLIGHT' || stage === 'STEP_3_COLLECT_FLY');

    var slotsHtml = '';
    for (var slotIdx = 0; slotIdx < state.numPlayers; slotIdx++) {
      var pIdx = (state.leaderIdx + slotIdx) % state.numPlayers;
      var player = state.players[pIdx];
      var pColor = C().PLAYER_COLORS[player.color] || C().PLAYER_COLORS.cinza;
      var play = arenaByPlayer[pIdx];
      var orderBadge = '<span class="arena-order-num">' + (slotIdx + 1) + 'º</span>';

      if (!play) {
        var isNext = state.phase === 'PLAYING_BATTLE' && state.currentPlayerIdx === pIdx;
        var nextLabel = isNext
          ? (player.name.trim().toLowerCase() === 'você' ? 'Sua vez' : 'Vez de ' + esc(player.name))
          : esc(player.name);
        slotsHtml +=
          '<div class="arena-slot">' +
            '<div class="arena-slot-placeholder' + (isNext ? ' is-next' : '') + '">' +
              orderBadge +
              renderCubeChip(player.color, false) +
              '<span>' + nextLabel + '</span>' +
            '</div>' +
          '</div>';
        continue;
      }

      var card = play.card;
      var isDamaged = card.type === 'damaged';
      var isRotated = isDamaged && play.declaredSuit === card.bottomSuit;
      var isWinnerCard = showWinnerVisual && res.winnerPlayOrder === play.playOrder;
      var isEliminated = !!elimSet[play.playOrder];
      var isCollectedLead = !!leadCollectSet[play.playOrder];
      var isChosenOff = res && res.chosenOffsuitPlayOrder === play.playOrder;
      var willBeCollected = !isEliminated && (isCollectedLead || isChosenOff);
      var isHiddenAnim = !!hiddenOrders[play.playOrder];

      var isOffsuitChoice =
        state.phase === 'CHOOSE_OFFSUIT_CARD' &&
        res &&
        (!animState || stage === 'CHOOSE_OFFSUIT') &&
        res.offSuitCards.some(function (o) { return o.playOrder === play.playOrder; }) &&
        state.players[res.winnerIdx].isHuman;

      var boxCls = 'arena-card-box';
      if (play.playOrder === justPlayedOrder && !res) boxCls += ' is-just-played';
      if (isHiddenAnim) boxCls += ' is-hidden-for-anim';
      if (isWinnerCard) boxCls += ' is-winner';
      if (isEliminated) boxCls += ' is-eliminated';
      else if (isOffsuitChoice) boxCls += ' is-offsuit-choice';
      else if (showCollectVisual && willBeCollected) boxCls += ' is-collected';
      else if (showCollectVisual && !willBeCollected && !isWinnerCard) boxCls += ' is-discard-dim';

      var badgeHtml = '';
      if (isWinnerCard && showCollectVisual && willBeCollected) {
        badgeHtml =
          '<span class="arena-status-pill is-win">🏆 Vencedora</span>' +
          '<span class="arena-status-pill arena-status-pill-bottom is-pick">✓ Coletada</span>';
      } else if (isWinnerCard) {
        badgeHtml = '<span class="arena-status-pill is-win">🏆 Vencedora</span>';
      } else if (isEliminated) {
        badgeHtml = '<span class="arena-status-pill is-elim">✖ Eliminada</span>';
      } else if (isOffsuitChoice) {
        badgeHtml = '<span class="arena-status-pill is-pick">Clique p/ pegar</span>';
      } else if (showCollectVisual && willBeCollected) {
        badgeHtml = '<span class="arena-status-pill arena-status-pill-bottom is-pick">✓ Coletada</span>';
      } else if (showCollectVisual && !willBeCollected) {
        badgeHtml = '<span class="arena-status-pill arena-status-pill-bottom is-discard">Descarte</span>';
      } else if (stage === 'CHOOSE_OFFSUIT' && isCollectedLead) {
        badgeHtml = '<span class="arena-status-pill arena-status-pill-bottom is-pick">✓ Coletada</span>';
      }

      var tagHtml = '';
      if (isDamaged && play.declaredSuit) {
        tagHtml =
          orderBadge +
          C().getSuitSvg(play.declaredSuit, true) +
          '<span>' + esc(player.name) + ' • ' + esc(C().SUIT_META[play.declaredSuit].name) + '</span>';
      } else {
        tagHtml = orderBadge + renderCubeChip(player.color, false) + '<span>' + esc(player.name) + '</span>';
      }

      var actionAttr = isOffsuitChoice
        ? 'data-choose-offsuit="' + card.id + '"'
        : 'data-inspect-card="' + card.id + '"' + (play.declaredSuit ? ' data-inspect-suit="' + play.declaredSuit + '"' : '');

      slotsHtml +=
        '<div class="arena-slot">' +
          '<div class="' + boxCls + '" data-play-order="' + play.playOrder + '">' +
            '<div class="arena-card-img-wrap' + (isRotated ? ' is-rotated-180' : '') + '" style="--player-accent:' + pColor.front + '" ' + actionAttr + '>' +
              badgeHtml +
              '<img src="' + card.img + '" alt="' + esc(card.name) + '" />' +
            '</div>' +
            '<div class="arena-slot-tag">' + tagHtml + '</div>' +
          '</div>' +
        '</div>';
    }

    rowEl.innerHTML = slotsHtml;
  }

  function formatCollectedCardsText(state, res) {
    var names = [];
    var elimSet = {};
    res.eliminatedPlayOrders.forEach(function (po) { elimSet[po] = true; });
    state.arena.forEach(function (pl) {
      if (elimSet[pl.playOrder] || pl.card.type !== 'combat') return;
      var isLead = state.leadSuit !== null && pl.card.suit === state.leadSuit;
      var isOff = res.chosenOffsuitPlayOrder !== null && pl.playOrder === res.chosenOffsuitPlayOrder;
      if (isLead || isOff) names.push(pl.card.name);
    });
    return names.length > 0 ? names.join(', ') : 'Nenhuma carta de combate';
  }

  function renderArenaBanner(state, handlers, animState) {
    var banner = document.getElementById('arena-banner');
    var textEl = document.getElementById('arena-banner-text');
    var actionsEl = document.getElementById('arena-banner-actions');
    actionsEl.innerHTML = '';
    banner.classList.remove('is-highlight');

    if (animState && (animState.stage === 'ROUND_SCORING' || animState.stage === 'GAME_OVER_SCORING')) {
      banner.classList.add('is-highlight');
      textEl.innerHTML = esc(animState.bannerText || 'Pontuação acontecendo ao vivo no Tabuleiro de Glória.');

      if (animState.canSkip && handlers.onSkipAnimation) {
        var skipBtn = document.createElement('button');
        skipBtn.type = 'button';
        skipBtn.className = 'btn btn-secondary';
        skipBtn.textContent = 'Pular Animação';
        skipBtn.addEventListener('click', handlers.onSkipAnimation);
        actionsEl.appendChild(skipBtn);
      }

      if (animState.readyNextRound && handlers.onContinueRound) {
        var roundBtn = document.createElement('button');
        roundBtn.type = 'button';
        roundBtn.className = 'btn btn-primary';
        roundBtn.textContent = 'Iniciar Rodada ' + (state.round + 1) + ' (Espaço)';
        roundBtn.addEventListener('click', handlers.onContinueRound);
        actionsEl.appendChild(roundBtn);
      }

      if (animState.readyGameOver && handlers.onShowGameOver) {
        var goBtn = document.createElement('button');
        goBtn.type = 'button';
        goBtn.className = 'btn btn-primary';
        goBtn.textContent = 'Ver Pódio Final (Espaço)';
        goBtn.addEventListener('click', handlers.onShowGameOver);
        actionsEl.appendChild(goBtn);
      }
      return;
    }

    if (state.phase === 'PLAYING_BATTLE') {
      var cur = state.players[state.currentPlayerIdx];
      if (cur.isHuman) {
        banner.classList.add('is-highlight');
        if (state.leadSuit) {
          textEl.innerHTML =
            'Sua vez, <strong>' + esc(cur.name) + '</strong>: siga o naipe <strong>' +
            esc(C().SUIT_META[state.leadSuit].name) + '</strong> ou jogue Leão / Arma Danificada.';
        } else {
          textEl.innerHTML =
            'Sua vez, <strong>' + esc(cur.name) + '</strong>: escolha qualquer carta para iniciar/definir o naipe líder.';
        }
      } else {
        textEl.innerHTML = 'Aguardando jogada de <strong>' + esc(cur.name) + '</strong>...';
      }
      return;
    }

    var res = state.pendingResolution;
    if (!res) return;
    var winner = state.players[res.winnerIdx];
    var stage = animState && animState.stage;

    if (state.phase === 'CHOOSE_OFFSUIT_CARD' && (!animState || stage === 'CHOOSE_OFFSUIT')) {
      banner.classList.add('is-highlight');
      if (winner.isHuman) {
        textEl.innerHTML =
          '<strong>' + esc(winner.name) + ' venceu a batalha!</strong> Clique em <strong>1 carta de outro naipe</strong> destacada na arena para coletá-la.';
      } else {
        textEl.innerHTML =
          '<strong>' + esc(winner.name) + '</strong> venceu e está escolhendo 1 carta extra na arena...';
      }
      return;
    }

    banner.classList.add('is-highlight');

    var reasonMsg = '';
    if (res.winReason === 'one_beats_ten') reasonMsg = '1 venceu o 10 do mesmo naipe!';
    else if (res.winReason === 'last_lion') reasonMsg = 'Último Leão jogado vence a vaza!';
    else if (res.winReason === 'lion') reasonMsg = 'Carta de Leão (11) vence a vaza!';
    else if (res.winReason === 'damaged_lead') reasonMsg = 'Última Arma Danificada no naipe líder vence!';
    else reasonMsg = 'Maior carta do naipe líder vence!';

    if (stage === 'STEP_1_WINNER') {
      textEl.innerHTML = '<strong>Etapa 1 — Vencedor da Vaza:</strong> <strong>' + esc(winner.name) + '</strong> (' + reasonMsg + ')';
      return;
    }

    if (stage === 'STEP_2_WEAPONS') {
      var activeEl = res.eliminations.find(function (e) { return e.weaponPlayOrder === animState.activeWeaponOrder; });
      if (activeEl) {
        var weaponOwner = state.players[activeEl.byPlayerIdx].name;
        if (activeEl.source === 'arena') {
          textEl.innerHTML =
            '<strong>Etapa 2 — Arma Danificada (' + esc(weaponOwner) + '):</strong> Quebrando <strong>' +
            esc(activeEl.eliminatedCard.name) + '</strong> da arena e descartando ambas!';
        } else if (activeEl.source === 'playArea') {
          textEl.innerHTML =
            '<strong>Etapa 2 — Arma Danificada (' + esc(weaponOwner) + '):</strong> Quebrando <strong>' +
            esc(activeEl.eliminatedCard.name) + '</strong> da área de <strong>' + esc(winner.name) +
            '</strong>' + (activeEl.selfHarm ? ' (próprio vencedor!)' : '') + '!';
        } else {
          textEl.innerHTML =
            '<strong>Etapa 2 — Arma Danificada (' + esc(weaponOwner) + '):</strong> Nenhuma carta de <strong>' +
            esc(C().SUIT_META[activeEl.suit].name) + '</strong> encontrada — indo para o descarte.';
        }
      } else {
        textEl.innerHTML = '<strong>Etapa 2 — Ativando Armas Danificadas...</strong>';
      }
      return;
    }

    if (stage === 'STEP_3_COLLECT_HIGHLIGHT' || stage === 'STEP_3_COLLECT_FLY') {
      var colTxt = formatCollectedCardsText(state, res);
      textEl.innerHTML =
        '<strong>Etapa 3 — Coleta para ' + esc(winner.name) + ':</strong> <span style="color:#8cf2a3">' +
        esc(colTxt) + '</span>';
      if (stage === 'STEP_3_COLLECT_HIGHLIGHT') {
        var btnCollect = document.createElement('button');
        btnCollect.type = 'button';
        btnCollect.className = 'btn btn-primary';
        btnCollect.textContent = 'Coletar Cartas (Espaço)';
        btnCollect.addEventListener('click', handlers.onAdvanceBattle);
        actionsEl.appendChild(btnCollect);
      }
      return;
    }

    if (state.phase === 'BATTLE_RESOLVED') {
      textEl.innerHTML =
        '<strong>' + esc(winner.name) + '</strong> venceu — ' + reasonMsg +
        ' • Coleta: <span style="color:#8cf2a3">' + esc(formatCollectedCardsText(state, res)) + '</span>';
      var nextBtn = document.createElement('button');
      nextBtn.type = 'button';
      nextBtn.className = 'btn btn-primary';
      nextBtn.textContent = 'Continuar (Espaço)';
      nextBtn.addEventListener('click', handlers.onAdvanceBattle);
      actionsEl.appendChild(nextBtn);
    }
  }

  function previewDamagedImpact(state, suit, viewerIdx) {
    var suitName = C().SUIT_META[suit].name;
    var arenaMatches = state.arena.filter(function (p) {
      return p.card.type === 'combat' && p.card.suit === suit;
    });
    if (arenaMatches.length > 0) {
      var has1 = arenaMatches.some(function (c) { return c.card.value === 1; });
      var has10 = arenaMatches.some(function (c) { return c.card.value === 10; });
      var hasPair = has1 && has10;
      var minP = arenaMatches[0];
      var minVal = E().getCombatEffectiveValue(minP.card.value, hasPair);
      for (var i = 1; i < arenaMatches.length; i++) {
        var ev = E().getCombatEffectiveValue(arenaMatches[i].card.value, hasPair);
        if (ev < minVal) {
          minVal = ev;
          minP = arenaMatches[i];
        }
      }
      return 'Eliminará na arena: <strong>' + esc(minP.card.name) + '</strong> (' + esc(state.players[minP.playerIdx].name) + ')';
    }

    var mySuitCards = state.players[viewerIdx].playArea[suit];
    if (state.arena.length === 0 && mySuitCards.length > 0) {
      return 'Se você vencer sem cartas de ' + esc(suitName) + ' na arena, eliminará seu <strong>' + esc(mySuitCards[0].name) + '</strong>.';
    }
    return 'Se não houver ' + esc(suitName) + ' na arena, eliminará a menor carta de ' + esc(suitName) + ' da área de jogo do vencedor.';
  }

  function renderDamagedPicker(state, cardId, viewerIdx, onConfirmSuit, onCancel) {
    var picker = document.getElementById('damaged-picker');
    if (!cardId) {
      picker.hidden = true;
      picker.innerHTML = '';
      return;
    }
    var card = C().getCardById(cardId);
    if (!card || card.type !== 'damaged') {
      picker.hidden = true;
      return;
    }

    var topMeta = C().SUIT_META[card.topSuit];
    var botMeta = C().SUIT_META[card.bottomSuit];

    picker.innerHTML =
      '<div class="damaged-picker-head">' +
        '<strong>Escolha qual naipe declarar nesta Arma Danificada:</strong>' +
        '<button type="button" class="btn btn-ghost" id="btn-cancel-damaged" style="padding:4px 10px;font-size:0.78rem;">Cancelar</button>' +
      '</div>' +
      '<div class="damaged-options">' +
        '<button type="button" class="damaged-opt-btn" data-declare-suit="' + card.topSuit + '">' +
          '<div class="damaged-opt-preview"><img src="' + card.img + '" alt="' + esc(topMeta.name) + '" /></div>' +
          '<div class="damaged-opt-meta">' +
            '<div class="damaged-opt-title">' + C().getSuitSvg(card.topSuit, true) + '<span>' + esc(topMeta.name) + ' (' + esc(topMeta.colorName) + ')</span></div>' +
            '<div class="damaged-opt-impact">' + previewDamagedImpact(state, card.topSuit, viewerIdx) + '</div>' +
          '</div>' +
        '</button>' +
        '<button type="button" class="damaged-opt-btn" data-declare-suit="' + card.bottomSuit + '">' +
          '<div class="damaged-opt-preview is-rotated-180"><img src="' + card.img + '" alt="' + esc(botMeta.name) + '" /></div>' +
          '<div class="damaged-opt-meta">' +
            '<div class="damaged-opt-title">' + C().getSuitSvg(card.bottomSuit, true) + '<span>' + esc(botMeta.name) + ' (' + esc(botMeta.colorName) + ')</span></div>' +
            '<div class="damaged-opt-impact">' + previewDamagedImpact(state, card.bottomSuit, viewerIdx) + '</div>' +
          '</div>' +
        '</button>' +
      '</div>';

    picker.hidden = false;
    picker.querySelector('#btn-cancel-damaged').addEventListener('click', onCancel);
    var btns = picker.querySelectorAll('[data-declare-suit]');
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        onConfirmSuit(card.id, b.getAttribute('data-declare-suit'));
      });
    });
  }

  function renderHand(state, viewerIdx, selectedDamagedId) {
    var player = state.players[viewerIdx];
    var isMyTurn = state.phase === 'PLAYING_BATTLE' && state.currentPlayerIdx === viewerIdx && player.isHuman;
    var isChoosingOffsuit =
      state.phase === 'CHOOSE_OFFSUIT_CARD' &&
      state.pendingResolution &&
      state.pendingResolution.winnerIdx === viewerIdx &&
      player.isHuman;

    document.getElementById('hand-stage').classList.toggle('is-my-turn', !!(isMyTurn || isChoosingOffsuit));

    var handTitle = document.getElementById('hand-title');
    var handSub = document.getElementById('hand-subtitle');
    handTitle.textContent =
      (player.name.trim().toLowerCase() === 'você' ? 'Sua Mão' : 'Mão de ' + player.name) +
      ' (' + player.hand.length + ' carta' + (player.hand.length === 1 ? '' : 's') + ')';

    if (isMyTurn) {
      handSub.textContent = state.leadSuit
        ? 'Naipe líder: ' + C().SUIT_META[state.leadSuit].name + ' • Clique em uma carta destacada para jogar'
        : 'Você define o naipe líder desta batalha';
    } else if (isChoosingOffsuit) {
      handSub.textContent = 'Escolha 1 carta extra destacada na arena';
    } else {
      handSub.textContent = 'Clique na lupa (🔍) em qualquer carta para ampliar';
    }

    var handEl = document.getElementById('hand-cards');
    handEl.innerHTML = '';
    handEl.classList.toggle('is-crowded', player.hand.length > 10);

    player.hand.forEach(function (card) {
      var restriction = isMyTurn ? E().getCardPlayRestriction(state, viewerIdx, card.id) : 'Aguarde seu turno.';
      var isLegal = isMyTurn && restriction === null;
      var cls = 'hand-card';
      if (isMyTurn) {
        cls += isLegal ? ' is-playable' : ' is-illegal';
      } else {
        cls += ' is-waiting';
      }
      if (selectedDamagedId === card.id) cls += ' is-selected';

      var btn = document.createElement('div');
      btn.className = cls;
      btn.setAttribute('role', 'button');
      btn.setAttribute('tabindex', isLegal ? '0' : '-1');
      btn.setAttribute('data-card-id', card.id);
      btn.title = isMyTurn ? (restriction || 'Jogar ' + card.name) : card.name;
      btn.innerHTML =
        '<img src="' + card.img + '" alt="' + esc(card.name) + '" />' +
        '<button type="button" class="card-zoom-trigger" data-inspect-card="' + card.id + '" title="Ampliar carta">🔍</button>';

      handEl.appendChild(btn);
    });
  }

  function renderGameScreen(state, viewerIdx, selectedDamagedId, handlers, animState) {
    // HUD
    document.getElementById('hud-round').textContent = 'Rodada ' + state.round + '/' + state.totalRounds;
    var totalBattles = state.numPlayers === 3 ? 12 : 11;
    document.getElementById('hud-battle').textContent = 'Batalha ' + state.battleNumber + '/' + totalBattles;
    document.getElementById('hud-board').textContent =
      state.boardSide === 'A' ? 'Lado A' : 'Lado B (Meta ' + state.sideBTarget + ' pts)';

    var turnPlayer = state.players[state.currentPlayerIdx];
    var turnEl = document.getElementById('hud-turn-indicator');
    var stage = animState && animState.stage;
    if (state.phase === 'CHOOSE_OFFSUIT_CARD' && (!animState || stage === 'CHOOSE_OFFSUIT') && state.pendingResolution) {
      turnEl.textContent = state.players[state.pendingResolution.winnerIdx].name + ' escolhendo carta extra';
    } else if (stage === 'GAME_OVER_SCORING' || state.phase === 'GAME_OVER') {
      turnEl.textContent = 'Pontuação Final — Coliseu';
    } else if (stage === 'ROUND_SCORING' || state.phase === 'ROUND_SUMMARY') {
      turnEl.textContent = 'Pontuação da Rodada ' + state.round;
    } else if (state.pendingResolution && (stage || state.phase === 'BATTLE_RESOLVED')) {
      turnEl.textContent = state.players[state.pendingResolution.winnerIdx].name + ' venceu a batalha!';
    } else {
      turnEl.textContent = turnPlayer.name.trim().toLowerCase() === 'você' ? 'Sua vez' : 'Turno de ' + turnPlayer.name;
    }

    // Tabuleiro
    var boardImg = state.boardSide === 'A' ? C().BOARD_A_IMG : C().BOARD_B_IMG;
    document.getElementById('glory-board-img').src = boardImg;
    document.getElementById('zoomed-board-img').src = boardImg;

    var show3pMask = state.boardSide === 'A' && state.numPlayers === 3;
    document.getElementById('board-3p-mask').hidden = !show3pMask;
    document.getElementById('zoomed-board-3p-mask').hidden = !show3pMask;

    renderBoardCubes(document.getElementById('glory-cubes-layer'), state, animState);
    if (!document.getElementById('modal-board-zoom').hidden) {
      renderBoardCubes(document.getElementById('zoomed-cubes-layer'), state, animState);
      renderBoardZoomStandings(state);
    }

    // 4 quadros simétricos de jogadores (sentido horário: BL -> TL -> TR -> BR)
    var layout = getSeatLayout(state, viewerIdx);
    document.getElementById('seat-tl').innerHTML = renderPlayerBox(state, state.players[layout.tl], false, animState);
    document.getElementById('seat-bl').innerHTML = renderPlayerBox(state, state.players[layout.bl], true, animState);
    document.getElementById('seat-tr').innerHTML = renderPlayerBox(state, state.players[layout.tr], false, animState);

    var brEl = document.getElementById('seat-br');
    if (layout.br !== null) {
      brEl.classList.remove('is-empty-seat');
      brEl.innerHTML = renderPlayerBox(state, state.players[layout.br], false, animState);
    } else {
      brEl.classList.add('is-empty-seat');
      brEl.innerHTML = '';
    }

    renderArena(state, animState);
    renderArenaBanner(state, handlers, animState);
    renderHand(state, viewerIdx, selectedDamagedId);
    renderDamagedPicker(state, selectedDamagedId, viewerIdx, handlers.onConfirmDamaged, handlers.onCancelDamaged);
    renderHistoryDrawer(state);
  }

  // =========================================================
  // HELPERS DE ANIMAÇÃO (ETAPAS 2 e 3)
  // =========================================================
  function clearAnimations() {
    var layer = document.getElementById('anim-layer');
    if (layer) layer.innerHTML = '';
  }

  function createFlyingClone(card, fromRect, isRotated180, extraClass) {
    var layer = document.getElementById('anim-layer');
    if (!layer || !fromRect || !card) return null;
    var el = document.createElement('div');
    el.className = 'flying-card' + (isRotated180 ? ' is-rotated-180' : '') + (extraClass ? ' ' + extraClass : '');
    el.style.left = fromRect.left + 'px';
    el.style.top = fromRect.top + 'px';
    el.style.width = fromRect.width + 'px';
    el.style.height = fromRect.height + 'px';
    el.style.transform = 'translate3d(0px, 0px, 0px) scale(1)';
    el.style.opacity = '1';
    el.innerHTML = '<img src="' + card.img + '" alt="" />';
    layer.appendChild(el);
    return el;
  }

  function flyElementToRect(el, fromRect, toRect, durationMs, endScale, endOpacity) {
    if (!el || !fromRect || !toRect) return;
    var dx = (toRect.left + toRect.width / 2) - (fromRect.left + fromRect.width / 2);
    var dy = (toRect.top + toRect.height / 2) - (fromRect.top + fromRect.height / 2);
    var scale = typeof endScale === 'number'
      ? endScale
      : Math.min(toRect.width / Math.max(1, fromRect.width), toRect.height / Math.max(1, fromRect.height));

    // Força layout inicial antes de iniciar transição CSS
    void el.offsetWidth;
    el.style.transition =
      'transform ' + durationMs + 'ms cubic-bezier(0.22, 1, 0.36, 1), ' +
      'opacity ' + durationMs + 'ms ease';
    el.style.transform = 'translate3d(' + dx.toFixed(1) + 'px, ' + dy.toFixed(1) + 'px, 0px) scale(' + scale.toFixed(3) + ')';
    if (typeof endOpacity === 'number') {
      el.style.opacity = String(endOpacity);
    }
  }

  function showImpactBurstAtRect(rect) {
    var layer = document.getElementById('anim-layer');
    if (!layer || !rect) return null;
    var burst = document.createElement('div');
    burst.className = 'impact-burst';
    burst.style.left = (rect.left + rect.width / 2) + 'px';
    burst.style.top = (rect.top + rect.height / 2) + 'px';
    burst.textContent = '💥';
    layer.appendChild(burst);
    return burst;
  }

  function sleepMs(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function rectCopy(r) {
    return { left: r.left, top: r.top, width: r.width, height: r.height };
  }

  /**
   * Etapa 2: Anima a Arma Danificada indo em cima da carta alvo e depois as duas indo para o descarte.
   */
  function animateWeaponStrike(weaponPlay, elim, flyMs, holdMs, onImpact, isCancelled) {
    var weaponWrap = document.querySelector('[data-play-order="' + weaponPlay.playOrder + '"] .arena-card-img-wrap');
    var discardEl = document.getElementById('pile-discard');
    if (!weaponWrap || !discardEl) {
      return Promise.resolve();
    }

    var weaponRect = rectCopy(weaponWrap.getBoundingClientRect());
    var discardRect = rectCopy(discardEl.getBoundingClientRect());
    var isRotated = weaponPlay.declaredSuit === weaponPlay.card.bottomSuit;
    var weaponClone = createFlyingClone(weaponPlay.card, weaponRect, isRotated, '');
    if (!weaponClone) return Promise.resolve();

    // Esconde o slot original da arma enquanto o clone voa
    var weaponBox = document.querySelector('[data-play-order="' + weaponPlay.playOrder + '"]');
    if (weaponBox) weaponBox.classList.add('is-hidden-for-anim');

    if (elim.source === 'none') {
      return sleepMs(20).then(function () {
        if (isCancelled && isCancelled()) return;
        flyElementToRect(weaponClone, weaponRect, discardRect, flyMs, 0.25, 0.2);
        return sleepMs(flyMs + 30);
      }).then(function () {
        clearAnimations();
      });
    }

    var targetEl = null;
    if (elim.source === 'arena') {
      targetEl = document.querySelector('[data-play-order="' + elim.targetPlayOrder + '"] .arena-card-img-wrap');
    } else if (elim.source === 'playArea') {
      targetEl =
        document.querySelector('[data-player-box="' + elim.fromPlayerIdx + '"] [data-pending-elim-card="' + elim.eliminatedCard.id + '"]') ||
        document.querySelector('[data-player-box="' + elim.fromPlayerIdx + '"] [data-suit-col="' + elim.suit + '"]');
    }

    if (!targetEl) {
      flyElementToRect(weaponClone, weaponRect, discardRect, flyMs, 0.25, 0.2);
      return sleepMs(flyMs + 30).then(clearAnimations);
    }

    var targetRect = rectCopy(targetEl.getBoundingClientRect());
    // Posição final da arma: em cima da carta quebrada (ligeiramente inclinada/sobreposta)
    var strikeRect = elim.source === 'arena'
      ? { left: targetRect.left + 8, top: targetRect.top - 10, width: targetRect.width, height: targetRect.height }
      : {
          left: (targetRect.left + targetRect.width / 2) - weaponRect.width * 0.35,
          top: (targetRect.top + targetRect.height / 2) - weaponRect.height * 0.35,
          width: weaponRect.width * 0.7,
          height: weaponRect.height * 0.7
        };

    var victimClone = null;
    var victimStartRect = null;

    return sleepMs(20).then(function () {
      if (isCancelled && isCancelled()) return;
      flyElementToRect(
        weaponClone,
        weaponRect,
        strikeRect,
        flyMs,
        elim.source === 'arena' ? 0.96 : 0.65,
        1
      );
      return sleepMs(flyMs + 25);
    }).then(function () {
      if (isCancelled && isCancelled()) return;
      if (onImpact) onImpact();
      showImpactBurstAtRect(targetRect);
      if (elim.source === 'arena') {
        var targetBox = document.querySelector('[data-play-order="' + elim.targetPlayOrder + '"]');
        if (targetBox) targetBox.classList.add('is-hidden-for-anim');
        victimStartRect = targetRect;
        victimClone = createFlyingClone(elim.eliminatedCard, targetRect, false, 'is-victim');
      } else {
        targetEl.style.opacity = '0';
        var popW = Math.max(46, targetRect.width);
        var popH = popW * (530 / 380);
        victimStartRect = {
          left: (targetRect.left + targetRect.width / 2) - popW / 2,
          top: (targetRect.top + targetRect.height / 2) - popH / 2,
          width: popW,
          height: popH
        };
        victimClone = createFlyingClone(elim.eliminatedCard, victimStartRect, false, 'is-victim');
      }
      // Garante ordem visual: arma ligeiramente acima da vítima ao irem juntas para o descarte
      weaponClone.style.zIndex = '83';
      if (victimClone) victimClone.style.zIndex = '82';
      return sleepMs(holdMs);
    }).then(function () {
      if (isCancelled && isCancelled()) return;
      // Atualiza referência a partir da posição atual (strikeRect) usando novo clone limpo para o trajeto até o descarte
      var layer = document.getElementById('anim-layer');
      var curWeaponRect = rectCopy(weaponClone.getBoundingClientRect());
      if (weaponClone.parentNode) weaponClone.parentNode.removeChild(weaponClone);
      var weaponFly2 = createFlyingClone(weaponPlay.card, curWeaponRect, isRotated, '');
      weaponFly2.style.zIndex = '83';
      flyElementToRect(weaponFly2, curWeaponRect, discardRect, flyMs, 0.22, 0.25);
      if (victimClone) {
        flyElementToRect(victimClone, victimStartRect, discardRect, flyMs, 0.25, 0.25);
      }
      void layer;
      return sleepMs(flyMs + 35);
    }).then(function () {
      clearAnimations();
    });
  }

  /**
   * Etapa 3: Anima cartas coletadas voando da arena para a coluna do naipe do vencedor
   * e sobras (Leão / off-suit não escolhidas) voando para o descarte.
   */
  function animateCollectCards(state, winnerIdx, collectedPlays, discardPlays, flyMs, isCancelled) {
    var discardEl = document.getElementById('pile-discard');
    var discardRect = discardEl ? rectCopy(discardEl.getBoundingClientRect()) : null;
    var flights = [];

    collectedPlays.forEach(function (play) {
      var wrap = document.querySelector('[data-play-order="' + play.playOrder + '"] .arena-card-img-wrap');
      var targetCol = document.querySelector('[data-player-box="' + winnerIdx + '"] [data-suit-col="' + play.card.suit + '"]');
      var box = document.querySelector('[data-play-order="' + play.playOrder + '"]');
      if (wrap && targetCol) {
        var rFrom = rectCopy(wrap.getBoundingClientRect());
        var rTo = rectCopy(targetCol.getBoundingClientRect());
        var clone = createFlyingClone(play.card, rFrom, false, 'is-collect');
        if (box) box.classList.add('is-hidden-for-anim');
        flights.push({ clone: clone, from: rFrom, to: rTo, scale: 0.34, opacity: 0.35 });
      }
    });

    discardPlays.forEach(function (play) {
      var wrap = document.querySelector('[data-play-order="' + play.playOrder + '"] .arena-card-img-wrap');
      var box = document.querySelector('[data-play-order="' + play.playOrder + '"]');
      if (wrap && discardRect) {
        var rFrom = rectCopy(wrap.getBoundingClientRect());
        var isRot = play.card.type === 'damaged' && play.declaredSuit === play.card.bottomSuit;
        var clone = createFlyingClone(play.card, rFrom, isRot, '');
        if (box) box.classList.add('is-hidden-for-anim');
        flights.push({ clone: clone, from: rFrom, to: discardRect, scale: 0.22, opacity: 0.2 });
      }
    });

    if (flights.length === 0) return Promise.resolve();

    return sleepMs(20).then(function () {
      if (isCancelled && isCancelled()) return;
      flights.forEach(function (f) {
        flyElementToRect(f.clone, f.from, f.to, flyMs, f.scale, f.opacity);
      });
      return sleepMs(flyMs + 35);
    }).then(function () {
      clearAnimations();
    });
  }

  function renderBoardZoomStandings(state) {
    var box = document.getElementById('board-zoom-standings');
    var standings = E().computeFinalStandings(state);
    if (state.boardSide === 'A') {
      var html = '<table class="summary-table"><thead><tr><th>Jogador</th>';
      C().SUITS.forEach(function (s) {
        html += '<th>' + C().getSuitSvg(s, false) + ' ' + C().SUIT_META[s].name + '</th>';
      });
      html += '<th>Total Projetado</th></tr></thead><tbody>';
      standings.rows.forEach(function (r) {
        html += '<tr><td>' + renderCubeChip(r.color, false) + ' ' + esc(r.name) + '</td>';
        C().SUITS.forEach(function (s) {
          var tr = r.trackResults[s];
          html += '<td>Casa ' + (tr.position + 1) + ' (' + tr.points + ' pts)</td>';
        });
        html += '<td><strong>' + r.totalPoints + ' pts</strong></td></tr>';
      });
      html += '</tbody></table>';
      box.innerHTML = html;
    } else {
      var htmlB = '<table class="summary-table"><thead><tr><th>Jogador</th><th>Pontos na Trilha B</th><th>Meta</th></tr></thead><tbody>';
      standings.rows.forEach(function (r) {
        htmlB +=
          '<tr><td>' + renderCubeChip(r.color, false) + ' ' + esc(r.name) + '</td>' +
          '<td><strong>' + r.totalPoints + '</strong></td>' +
          '<td>' + state.sideBTarget + ' pts</td></tr>';
      });
      htmlB += '</tbody></table>';
      box.innerHTML = htmlB;
    }
  }

  function renderRoundSummaryModal(state) {
    var summary = state.lastRoundSummary;
    document.getElementById('round-summary-title').textContent = 'Pontuação — Fim da Rodada ' + summary.round;

    var html = '';
    if (state.lastDiscardedCards && state.lastDiscardedCards.length > 0) {
      html += '<div class="discard-last-strip"><strong>Última carta descartada da mão:</strong>';
      state.lastDiscardedCards.forEach(function (d) {
        var p = state.players[d.playerIdx];
        html += '<span class="discard-last-item">' + renderCubeChip(p.color, false) + esc(p.name) + ': ' + esc(d.card.name) + '</span>';
      });
      html += '</div>';
    }

    if (summary.boardSide === 'A') {
      html += '<table class="summary-table"><thead><tr><th>Naipe</th><th>Maioria</th><th>Movimentação dos Cubos</th></tr></thead><tbody>';
      summary.suitBreakdowns.forEach(function (sb) {
        var meta = C().SUIT_META[sb.suit];
        var movesHtml = sb.entries
          .map(function (en) {
            var p = state.players[en.playerIdx];
            var dCls = en.delta > 0 ? 'delta-pos' : en.delta < 0 ? 'delta-neg' : 'delta-zero';
            var dTxt = (en.delta > 0 ? '+' : '') + en.delta;
            return (
              '<div style="display:flex;align-items:center;gap:6px;margin:2px 0;">' +
              renderCubeChip(p.color, false) +
              '<span>' + esc(p.name) + ' (' + en.count + ' cartas): </span>' +
              '<span class="' + dCls + '">' + dTxt + '</span>' +
              '<span style="color:#bda98b;"> (casa ' + (en.before + 1) + ' → ' + (en.after + 1) + ')</span>' +
              '</div>'
            );
          })
          .join('');
        html +=
          '<tr>' +
            '<td>' + C().getSuitSvg(sb.suit, false) + ' <strong>' + esc(meta.name) + '</strong></td>' +
            '<td>' + sb.maxCount + ' carta(s)</td>' +
            '<td>' + movesHtml + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    } else {
      var caseDesc = {
        A: 'Caso A (Maior − Menor)',
        B: 'Caso B (Todos presentes iguais)',
        C: 'Caso C (Naipe único)',
        D: 'Caso D (Sem cartas — iguala maior)'
      };
      html += '<table class="summary-table"><thead><tr><th>Jogador</th><th>Cartas na Área</th><th>Regra</th><th>Pontuação</th><th>Trilha B</th></tr></thead><tbody>';
      summary.playerEntries.forEach(function (en) {
        var p = state.players[en.playerIdx];
        var countsTxt = C().SUITS
          .map(function (s) { return C().SUIT_META[s].name.slice(0, 3) + ':' + en.suitCounts[s]; })
          .join(' • ');
        var dCls = en.delta > 0 ? 'delta-pos' : en.delta < 0 ? 'delta-neg' : 'delta-zero';
        var dTxt = (en.delta > 0 ? '+' : '') + en.delta;
        html +=
          '<tr>' +
            '<td>' + renderCubeChip(p.color, false) + ' <strong>' + esc(p.name) + '</strong></td>' +
            '<td>' + countsTxt + '</td>' +
            '<td>' + caseDesc[en.ruleCase] + '</td>' +
            '<td><span class="' + dCls + '">' + dTxt + '</span></td>' +
            '<td>' + en.before + ' → <strong>' + en.after + '</strong></td>' +
          '</tr>';
      });
      html += '</tbody></table>';
      if (summary.targetReached) {
        html += '<div class="victory-banner" style="margin-top:12px;">Meta de <strong>' + state.sideBTarget + ' pontos</strong> atingida! A partida será encerrada.</div>';
      }
    }

    document.getElementById('round-summary-body').innerHTML = html;
    document.getElementById('btn-round-continue').textContent = summary.triggersGameOver
      ? 'Ver Pontuação Final'
      : 'Iniciar Rodada ' + (state.round + 1);
    document.getElementById('modal-round-summary').hidden = false;
  }

  function renderGameOverModal(state) {
    var standings = state.finalStandings || E().computeFinalStandings(state);
    var winnerNames = standings.winners.map(function (idx) { return state.players[idx].name; });
    var bannerText = standings.sharedVictory
      ? 'Vitória compartilhada entre <strong>' + esc(winnerNames.join(' e ')) + '</strong> com ' + standings.rows[0].totalPoints + ' pontos!'
      : '<strong>' + esc(winnerNames[0]) + '</strong> é o grande campeão do Coliseu com <strong>' + standings.rows[0].totalPoints + ' pontos</strong>!' +
        (standings.tiebreakApplied
          ? (standings.boardSide === 'A'
              ? ' (Desempate: à frente em mais trilhas de glória)'
              : ' (Desempate: maior avanço na última rodada)')
          : '');

    var html = '<div class="victory-banner">' + bannerText + '</div><div class="podium-grid">';
    standings.rows.forEach(function (row) {
      html +=
        '<div class="podium-card' + (row.rank === 1 ? ' is-first' : '') + '">' +
          '<div class="podium-rank">' + row.rank + 'º</div>' +
          renderCubeChip(row.color, true) +
          '<strong>' + esc(row.name) + '</strong>' +
          '<div class="podium-pts">' + row.totalPoints + ' pts</div>' +
        '</div>';
    });
    html += '</div>';

    if (standings.boardSide === 'A') {
      html += '<table class="summary-table"><thead><tr><th>Pos.</th><th>Gladiador</th>';
      C().SUITS.forEach(function (s) {
        html += '<th>' + C().getSuitSvg(s, false) + ' ' + C().SUIT_META[s].name + '</th>';
      });
      html += '<th>Total</th></tr></thead><tbody>';
      standings.rows.forEach(function (row) {
        html += '<tr><td><strong>' + row.rank + 'º</strong></td><td>' + renderCubeChip(row.color, false) + ' ' + esc(row.name) + '</td>';
        C().SUITS.forEach(function (s) {
          var tr = row.trackResults[s];
          html += '<td>' + tr.points + ' pts <span style="color:#a9997d">(casa ' + (tr.position + 1) + ')</span></td>';
        });
        html += '<td><strong>' + row.totalPoints + ' pts</strong></td></tr>';
      });
      html += '</tbody></table>';
    } else {
      html += '<table class="summary-table"><thead><tr><th>Pos.</th><th>Gladiador</th><th>Pontuação Final</th><th>Avanço na Última Rodada</th></tr></thead><tbody>';
      standings.rows.forEach(function (row) {
        var dTxt = (row.lastRoundDelta > 0 ? '+' : '') + row.lastRoundDelta;
        html +=
          '<tr>' +
            '<td><strong>' + row.rank + 'º</strong></td>' +
            '<td>' + renderCubeChip(row.color, false) + ' ' + esc(row.name) + '</td>' +
            '<td><strong>' + row.totalPoints + ' pts</strong></td>' +
            '<td>' + dTxt + '</td>' +
          '</tr>';
      });
      html += '</tbody></table>';
    }

    document.getElementById('game-over-body').innerHTML = html;
    document.getElementById('modal-game-over').hidden = false;
  }

  function renderHistoryDrawer(state) {
    var listEl = document.getElementById('history-list');
    if (state.battleHistory.length === 0) {
      listEl.innerHTML = '<p style="color:#bca98c;font-size:0.86rem;">Nenhuma batalha concluída ainda nesta partida.</p>';
      return;
    }

    var html = '';
    for (var i = state.battleHistory.length - 1; i >= 0; i--) {
      var item = state.battleHistory[i];
      var winner = state.players[item.winnerIdx];
      var leadName = item.leadSuit ? C().SUIT_META[item.leadSuit].name : 'Neutro (Leões)';
      var playsStr = item.plays
        .map(function (pl) {
          var pName = state.players[pl.playerIdx].name;
          var txt = pl.card.name;
          if (pl.card.type === 'damaged' && pl.declaredSuit) {
            txt = 'Arma Danificada [' + C().SUIT_META[pl.declaredSuit].name + ']';
          }
          return esc(pName) + ': ' + esc(txt);
        })
        .join(' • ');

      var elimsStr = item.eliminations
        .filter(function (e) { return e.source !== 'none'; })
        .map(function (e) {
          return '✖ ' + e.eliminatedCard.name + (e.source === 'playArea' ? ' (área de ' + winner.name + ')' : ' (arena)');
        })
        .join(' | ');

      html +=
        '<div class="history-entry">' +
          '<div class="history-entry-head">' +
            '<span>R' + item.round + ' • Batalha ' + item.battleNumber + '</span>' +
            '<span>Vencedor: ' + esc(winner.name) + '</span>' +
          '</div>' +
          '<div style="color:#d6c5a7;">Líder: ' + esc(leadName) + ' • ' + playsStr + '</div>' +
          (elimsStr ? '<div style="color:#ff9c92;">' + esc(elimsStr) + '</div>' : '') +
        '</div>';
    }
    listEl.innerHTML = html;
  }

  function openCardInspect(cardId, declaredSuit) {
    var card = C().getCardById(cardId);
    if (!card) return;
    document.getElementById('card-zoom-title').textContent = card.name;
    document.getElementById('card-zoom-img').src = card.img;
    var wrap = document.querySelector('.card-zoom-img-wrap');
    wrap.classList.toggle('is-rotated-180', card.type === 'damaged' && declaredSuit === card.bottomSuit);

    var info = '';
    if (card.type === 'combat') {
      var meta = C().SUIT_META[card.suit];
      info =
        '<p>' + C().getSuitSvg(card.suit, false) + ' <strong>Carta de Combate</strong> — Naipe <strong>' + esc(meta.name) + ' (' + esc(meta.colorName) + ')</strong>, valor <strong>' + card.value + '</strong>.</p>' +
        (card.value === 1
          ? '<p><strong>Regra Especial (1 vence 10):</strong> quando as cartas 1 e 10 do mesmo naipe forem jogadas na mesma batalha, a carta 1 torna-se a mais alta daquele naipe!</p>'
          : card.value === 10
            ? '<p><strong>Atenção:</strong> embora seja o maior valor normal, perde para o 1 do mesmo naipe se ambos estiverem na mesma batalha.</p>'
            : '<p>Ao seguir o naipe líder, vence a carta de maior valor (exceto contra Leão ou 1+10).</p>');
    } else if (card.type === 'damaged') {
      info =
        '<p><strong>Carta Dupla de Arma Danificada</strong> — Naipes: <strong>' +
        esc(C().SUIT_META[card.topSuit].name) + '</strong> e <strong>' +
        esc(C().SUIT_META[card.bottomSuit].name) + '</strong>.</p>' +
        '<p>Pode ser jogada a qualquer momento, mesmo possuindo o naipe líder. Ao jogar, declare qual dos dois naipes utilizar.</p>' +
        '<p>Na Etapa 3 (em ordem de jogada), elimina a menor carta do naipe escolhido na arena; se não houver, elimina a menor da área de jogo do vencedor da batalha (inclusive se o vencedor tiver jogado a arma!).</p>';
    } else {
      info =
        '<p>' + C().getSuitSvg('leao', false) + ' <strong>Carta de Leão (Valor 11 — Neutro)</strong>.</p>' +
        '<p>Pode ser jogada em qualquer turno, mesmo possuindo o naipe líder. Se iniciar a batalha, o próximo jogador a jogar combate ou arma danificada define o naipe líder.</p>' +
        '<p>Vence todas as cartas de combate de 1 a 10. Se houver mais de um Leão na mesma batalha, o <strong>último Leão jogado</strong> vence!</p>';
    }

    document.getElementById('card-zoom-info').innerHTML = info;
    document.getElementById('modal-card-zoom').hidden = false;
  }

  var RULES_CONTENT = {
    prep:
      '<h3>Componentes e Preparação</h3>' +
      '<ul>' +
        '<li><strong>Baralho (50 cartas):</strong> 40 cartas de combate (1 a 10 de Gládio, Tridente, Mangual e Machado), 6 cartas duplas de Arma Danificada e 4 cartas de Leão (11).</li>' +
        '<li><strong>Para 3 jogadores:</strong> removem-se todos os <strong>2 e 3</strong> dos quatro naipes (8 cartas) e <strong>1 Leão</strong>. Cada jogador recebe <strong>13 cartas</strong> e <strong>2 cartas</strong> ficam fora da rodada. Partida em <strong>3 rodadas</strong>.</li>' +
        '<li><strong>Para 4 jogadores:</strong> usam-se todas as <strong>50 cartas</strong>. Cada jogador recebe <strong>12 cartas</strong> e <strong>2 cartas</strong> ficam fora da rodada. Partida em <strong>4 rodadas</strong>.</li>' +
        '<li><strong>Tabuleiro Lado A:</strong> 1 cubo de cada jogador na <strong>7ª coluna</strong> demarcada de cada uma das 4 trilhas.</li>' +
        '<li><strong>Tabuleiro Lado B:</strong> 1 cubo de cada jogador no <strong>espaço 5</strong>.</li>' +
      '</ul>' +
      '<p>Cada rodada termina quando todos ficam com apenas <strong>1 carta na mão</strong> (ela é descartada antes da pontuação).</p>',
    battle:
      '<h3>Estrutura de uma Batalha (4 Etapas)</h3>' +
      '<ol>' +
        '<li><strong>Jogar cartas na arena (sentido horário):</strong> o líder inicia. Se o naipe líder já estiver definido, quem tiver carta de combate daquele naipe deve segui-lo — <em>ou</em> escolher jogar uma carta especial (Leão ou Arma Danificada) a qualquer momento.</li>' +
        '<li><strong>Verificar o vencedor:</strong> vence quem jogou a maior carta de combate do naipe líder (salvo regras de Leão, 1 vence 10 ou Arma Danificada no naipe líder).</li>' +
        '<li><strong>Aplicar efeitos das Armas Danificadas:</strong> na ordem em que foram jogadas.</li>' +
        '<li><strong>Recolher cartas:</strong> o vencedor coleta <strong>todas</strong> as cartas de combate do naipe líder restantes na arena, <strong>mais 1 carta de combate à sua escolha</strong> (se houver de outro naipe). Leões, Armas Danificadas e sobras vão para a pilha única de descarte.</li>' +
      '</ol>' +
      '<div class="rule-callout"><strong>Regra 1 vence 10:</strong> quando as cartas <strong>1</strong> e <strong>10</strong> do mesmo naipe são jogadas na mesma batalha, a carta <strong>1</strong> torna-se a carta mais alta daquele naipe!</div>',
    special:
      '<h3>Cartas Especiais</h3>' +
      '<p><strong>Carta de Leão (11 — Neutro):</strong> vence todas as cartas de combate (1 a 10). Se mais de um Leão for jogado, vence o <strong>último</strong> Leão jogado. Se o líder da batalha começar com Leão, o primeiro jogador seguinte a jogar Combate ou Arma Danificada define o naipe líder.</p>' +
      '<p><strong>Carta Dupla de Arma Danificada:</strong> possui dois naipes; declare qual utilizar ao jogá-la. O naipe escolhido fica na parte superior da carta.</p>' +
      '<ul>' +
        '<li><strong>Efeito (Etapa 3):</strong> elimina da batalha a <strong>menor carta</strong> de combate do naipe escolhido. Caso não haja nenhuma na arena, elimina a menor carta daquele naipe que já esteja na <strong>área de jogo do vencedor da batalha</strong>.</li>' +
        '<li><strong>Atenção:</strong> se o próprio jogador que jogou a Arma Danificada vencer a batalha e não houver alvo na arena, o efeito se aplica mesmo contra a própria área de jogo!</li>' +
        '<li><strong>Naipe líder sem combate:</strong> se o naipe líder foi definido por uma Arma Danificada e ninguém jogou Leão nem combate daquele naipe, vence a última Arma Danificada declarada no naipe líder.</li>' +
      '</ul>',
    sideA:
      '<h3>Pontuação — Tabuleiro Lado A</h3>' +
      '<p><strong>Fim de cada rodada (por naipe):</strong></p>' +
      '<ul>' +
        '<li><strong>Maior quantidade de cartas do naipe:</strong> avança <strong>+1</strong> espaço à direita (empates na maioria avançam igualmente).</li>' +
        '<li><strong>Nenhuma carta do naipe:</strong> permanece onde está (<strong>0</strong>).</li>' +
        '<li><strong>Menos cartas que a maioria (pelo menos 1):</strong> diferença ≤ 3 recua <strong>-1</strong>; diferença ≥ 4 recua <strong>-2</strong>.</li>' +
      '</ul>' +
      '<p><strong>Fim de jogo (após 3 rodadas em 3J / 4 rodadas em 4J):</strong></p>' +
      '<p>Em cada trilha, os cubos pontuam da direita para a esquerda: <strong>5, 3, 2, 1</strong> pontos (em 3 jogadores não se usa a coluna 1). Em caso de empate na trilha, todos dividem a mesma casa de pontos e o próximo distinto ocupa o espaço seguinte.</p>' +
      '<p><strong>Desempate final:</strong> quem estiver à frente em mais trilhas vence; se persistir, vitória compartilhada!</p>',
    sideB:
      '<h3>Pontuação — Tabuleiro Lado B</h3>' +
      '<p>Ao fim da rodada, cada jogador pontua individualmente com base nas suas cartas por naipe (ignorando naipes com 0 cartas):</p>' +
      '<ul>' +
        '<li><strong>Caso A — Quantidades diferentes:</strong> soma todos os naipes empatados na maior quantidade <em>menos</em> todos os naipes empatados na menor quantidade presente. Se negativo, recua na trilha (mínimo 1).</li>' +
        '<li><strong>Caso B — Todos os naipes presentes com quantidade igual:</strong> soma todas as cartas da sua área de jogo.</li>' +
        '<li><strong>Caso C — Apenas 1 naipe na área:</strong> pontua igual ao número de cartas desse naipe.</li>' +
        '<li><strong>Caso D — Nenhuma carta na área:</strong> pontua igual ao jogador que mais pontuou nessa rodada!</li>' +
      '</ul>' +
      '<p><strong>Fim de jogo:</strong> quando alguém atingir <strong>15+ pts</strong> (3J) ou <strong>20+ pts</strong> (4J), ou ao fim de 3/4 rodadas. Desempate: maior avanço na última rodada.</p>',
    credits:
      '<h3>Gladiadores — Créditos Oficiais</h3>' +
      '<ul>' +
        '<li><strong>Game Designers:</strong> Ênyo Saldanha, Lucas Medeiros</li>' +
        '<li><strong>Desenvolvedores do Jogo:</strong> Augusto Barbosa, Eurico Cunha, Gustavo Silveira</li>' +
        '<li><strong>Ilustrador:</strong> Arthur Mask</li>' +
        '<li><strong>Diretor de Arte:</strong> Filipe Castro</li>' +
        '<li><strong>Designers Gráficos:</strong> Bruno Marquez, João Victor Cramonez (JVC_ARTZ)</li>' +
        '<li><strong>Escritora de Regras:</strong> Bianca Melyna</li>' +
        '<li><strong>Revisão de Regras:</strong> Augusto Barbosa, Claudinei Mendonça, Gustavo Lopes, Gustavo Silveira</li>' +
        '<li><strong>Validação Final (QA):</strong> Alexandre Reis, Paulo “Bandana” Matos, João Victor Cramonez, Maria Julia Ronzani</li>' +
        '<li><strong>Publicação Original:</strong> Games ForFun LLC</li>' +
        '<li><strong>Edição Brasileira:</strong> Calamity Jogos de Tabuleiro e Acessórios Ltda.</li>' +
      '</ul>'
  };

  function openRulesModal(tabId) {
    var tab = tabId || 'prep';
    var tabs = document.querySelectorAll('#rules-tabs .rules-tab');
    tabs.forEach(function (t) {
      t.classList.toggle('is-active', t.getAttribute('data-tab') === tab);
    });
    document.getElementById('rules-body').innerHTML = RULES_CONTENT[tab] || RULES_CONTENT.prep;
    document.getElementById('modal-rules').hidden = false;
  }

  Gladiadores.UI = {
    esc: esc,
    renderCubeChip: renderCubeChip,
    getSeatLayout: getSeatLayout,
    renderBoardCubes: renderBoardCubes,
    renderBoardZoomStandings: renderBoardZoomStandings,
    renderHistoryDrawer: renderHistoryDrawer,
    renderGameScreen: renderGameScreen,
    renderRoundSummaryModal: renderRoundSummaryModal,
    renderGameOverModal: renderGameOverModal,
    openCardInspect: openCardInspect,
    openRulesModal: openRulesModal,
    clearAnimations: clearAnimations,
    animateWeaponStrike: animateWeaponStrike,
    animateCollectCards: animateCollectCards
  };
})(window);

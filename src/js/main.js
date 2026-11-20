(function (global) {
  'use strict';

  var Gladiadores = (global.Gladiadores = global.Gladiadores || {});
  var C = Gladiadores.CONSTANTS;
  var E = Gladiadores.Engine;
  var AI = Gladiadores.AI;
  var AudioFX = Gladiadores.Audio;
  var UI = Gladiadores.UI;

  var MENU_DEFAULTS = [
    { name: 'Você', color: 'cinza', type: 'human' },
    { name: 'Marco', color: 'laranja', type: 'estrategico' },
    { name: 'Lívia', color: 'branco', type: 'estrategico' },
    { name: 'Caio', color: 'amarelo', type: 'casual' }
  ];

  var menuConfig = {
    numPlayers: 4,
    boardSide: 'A',
    seats: JSON.parse(JSON.stringify(MENU_DEFAULTS))
  };

  var gameState = null;
  var lastGameConfig = null;
  var sessionToken = 0;
  var speedMode = 'normal'; // 'normal' | 'fast' | 'manual'
  var selectedDamagedId = null;
  var viewerIdx = 0;
  var revealedHumanIdx = null;
  var privacyPendingForIdx = null;
  var animState = null;
  var recentArrivedCardIds = {};

  var SPEED_LABELS = {
    normal: 'Velocidade: Normal',
    fast: 'Velocidade: Rápida',
    manual: 'Velocidade: Manual'
  };

  function getSpeedTimings() {
    if (speedMode === 'fast') {
      return {
        botMs: 440,
        stageGapMs: 300,
        flyMs: 280,
        impactHoldMs: 160,
        weaponPauseMs: 150,
        roundStepMs: 650,
        scoreJumpMs: 480,
        walkStepMs: 85
      };
    }
    if (speedMode === 'manual') {
      return {
        botMs: 840,
        stageGapMs: 500,
        flyMs: 450,
        impactHoldMs: 240,
        weaponPauseMs: 250,
        roundStepMs: 1200,
        scoreJumpMs: 850,
        walkStepMs: 140
      };
    }
    return {
      botMs: 1100,
      stageGapMs: 500,
      flyMs: 450,
      impactHoldMs: 240,
      weaponPauseMs: 250,
      roundStepMs: 1200,
      scoreJumpMs: 850,
      walkStepMs: 140
    };
  }

  function delayMs(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function nextToken() {
    sessionToken += 1;
    return sessionToken;
  }

  // =========================================================
  // MENU DE CONFIGURAÇÃO
  // =========================================================
  function renderMenuSeats() {
    var listEl = document.getElementById('cfg-seats-list');
    listEl.innerHTML = '';

    for (var i = 0; i < menuConfig.numPlayers; i++) {
      (function (idx) {
        var seat = menuConfig.seats[idx];
        var row = document.createElement('div');
        row.className = 'seat-row';

        var badge = document.createElement('span');
        badge.className = 'seat-badge';
        badge.textContent = 'J' + (idx + 1);

        var nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.className = 'seat-input';
        nameInput.maxLength = 18;
        nameInput.value = seat.name;
        nameInput.setAttribute('aria-label', 'Nome do Jogador ' + (idx + 1));
        nameInput.addEventListener('input', function () {
          menuConfig.seats[idx].name = nameInput.value.trim() || 'Jogador ' + (idx + 1);
        });

        var typeSelect = document.createElement('select');
        typeSelect.className = 'seat-select';
        typeSelect.setAttribute('aria-label', 'Tipo do Jogador ' + (idx + 1));
        typeSelect.innerHTML =
          '<option value="human">Humano</option>' +
          '<option value="estrategico">Bot Estratégico</option>' +
          '<option value="casual">Bot Casual</option>';
        typeSelect.value = seat.type;
        typeSelect.addEventListener('change', function () {
          menuConfig.seats[idx].type = typeSelect.value;
          syncPresetHighlight();
        });

        var dots = document.createElement('div');
        dots.className = 'seat-color-dots';
        C.PLAYER_COLOR_ORDER.forEach(function (colId) {
          var colMeta = C.PLAYER_COLORS[colId];
          var dot = document.createElement('button');
          dot.type = 'button';
          dot.className = 'color-dot-btn' + (seat.color === colId ? ' is-selected' : '');
          dot.style.setProperty('--dot-bg', colMeta.front);
          dot.title = colMeta.name;
          dot.addEventListener('click', function () {
            if (seat.color === colId) return;
            var oldCol = seat.color;
            // Troca de cor sem duplicar entre assentos
            for (var s = 0; s < menuConfig.seats.length; s++) {
              if (s !== idx && menuConfig.seats[s].color === colId) {
                menuConfig.seats[s].color = oldCol;
              }
            }
            seat.color = colId;
            renderMenuSeats();
          });
          dots.appendChild(dot);
        });

        row.appendChild(badge);
        row.appendChild(nameInput);
        row.appendChild(typeSelect);
        row.appendChild(dots);
        listEl.appendChild(row);
      })(i);
    }

    syncPresetHighlight();
  }

  function syncPresetHighlight() {
    var activeSeats = menuConfig.seats.slice(0, menuConfig.numPlayers);
    var humanCount = activeSeats.filter(function (s) { return s.type === 'human'; }).length;
    document.getElementById('btn-preset-solo').classList.toggle('is-active', humanCount === 1 && activeSeats[0].type === 'human');
    document.getElementById('btn-preset-pass').classList.toggle('is-active', humanCount === menuConfig.numPlayers);
  }

  function applySoloPreset() {
    for (var i = 0; i < 4; i++) {
      menuConfig.seats[i].type = i === 0 ? 'human' : i === 3 ? 'casual' : 'estrategico';
      if (i === 0 && menuConfig.seats[0].name === 'Jogador 1') menuConfig.seats[0].name = 'Você';
    }
    renderMenuSeats();
  }

  function applyPassPreset() {
    for (var i = 0; i < 4; i++) {
      menuConfig.seats[i].type = 'human';
      if (i === 0 && menuConfig.seats[0].name === 'Você') menuConfig.seats[0].name = 'Jogador 1';
    }
    renderMenuSeats();
  }

  function bindMenuEvents() {
    document.querySelectorAll('#cfg-num-players .seg-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var n = Number(btn.getAttribute('data-players'));
        menuConfig.numPlayers = n;
        document.querySelectorAll('#cfg-num-players .seg-btn').forEach(function (b) {
          b.classList.toggle('is-active', Number(b.getAttribute('data-players')) === n);
        });
        document.getElementById('cfg-players-hint').textContent =
          n === 3
            ? '41 cartas (sem 2 e 3, e menos 1 Leão) • 13 cartas por jogador • 3 rodadas'
            : '50 cartas completas • 12 cartas por jogador • 4 rodadas';
        renderMenuSeats();
      });
    });

    document.querySelectorAll('#cfg-board-side .board-option').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var side = btn.getAttribute('data-side');
        menuConfig.boardSide = side;
        document.querySelectorAll('#cfg-board-side .board-option').forEach(function (b) {
          b.classList.toggle('is-active', b.getAttribute('data-side') === side);
        });
      });
    });

    document.getElementById('btn-preset-solo').addEventListener('click', applySoloPreset);
    document.getElementById('btn-preset-pass').addEventListener('click', applyPassPreset);
    document.getElementById('btn-menu-rules').addEventListener('click', function () { UI.openRulesModal('prep'); });
    document.getElementById('btn-menu-credits').addEventListener('click', function () { UI.openRulesModal('credits'); });
    document.getElementById('btn-start-game').addEventListener('click', startNewGameFromMenu);
  }

  // =========================================================
  // CONTROLE DE PARTIDA & TURNOS
  // =========================================================
  function buildConfigFromMenu() {
    var players = [];
    for (var i = 0; i < menuConfig.numPlayers; i++) {
      var s = menuConfig.seats[i];
      players.push({
        name: s.name && s.name.trim() ? s.name.trim() : 'Jogador ' + (i + 1),
        color: s.color,
        isHuman: s.type === 'human',
        difficulty: s.type === 'casual' ? 'casual' : 'estrategico'
      });
    }
    return {
      numPlayers: menuConfig.numPlayers,
      boardSide: menuConfig.boardSide,
      players: players
    };
  }

  function showScreen(screenId) {
    document.getElementById('screen-menu').classList.toggle('is-active', screenId === 'menu');
    document.getElementById('screen-game').classList.toggle('is-active', screenId === 'game');
  }

  function closeAllGameModals() {
    [
      'modal-privacy',
      'modal-board-zoom',
      'modal-card-zoom',
      'modal-round-summary',
      'modal-game-over',
      'modal-rules'
    ].forEach(function (id) {
      document.getElementById(id).hidden = true;
    });
    document.getElementById('drawer-history').hidden = true;
  }

  function countHumans(state) {
    return state.players.filter(function (p) { return p.isHuman; }).length;
  }

  function getFirstHumanIdx(state) {
    var h = state.players.find(function (p) { return p.isHuman; });
    return h ? h.index : 0;
  }

  function startNewGame(cfg) {
    nextToken();
    UI.clearAnimations();
    closeAllGameModals();
    lastGameConfig = JSON.parse(JSON.stringify(cfg));
    gameState = E.createGame(cfg);
    selectedDamagedId = null;
    privacyPendingForIdx = null;
    animState = null;
    recentArrivedCardIds = {};

    var humanCount = countHumans(gameState);
    viewerIdx = getFirstHumanIdx(gameState);
    revealedHumanIdx = humanCount === 1 ? viewerIdx : null;

    showScreen('game');
    AudioFX.deal();
    updateSoundButton();
    updateSpeedButton();
    refreshAndDrive();
  }

  function startNewGameFromMenu() {
    startNewGame(buildConfigFromMenu());
  }

  function goToMenu() {
    nextToken();
    UI.clearAnimations();
    closeAllGameModals();
    gameState = null;
    selectedDamagedId = null;
    privacyPendingForIdx = null;
    animState = null;
    recentArrivedCardIds = {};
    showScreen('menu');
  }

  function showPrivacyCurtain(targetPlayerIdx) {
    privacyPendingForIdx = targetPlayerIdx;
    var p = gameState.players[targetPlayerIdx];
    document.getElementById('privacy-cube-holder').innerHTML = UI.renderCubeChip(p.color, true);
    document.getElementById('privacy-title').textContent = 'Vez de ' + p.name;
    document.getElementById('privacy-desc').textContent =
      'Passe o computador para ' + p.name + ' antes de revelar as cartas da mão.';
    document.getElementById('modal-privacy').hidden = false;
  }

  function revealHandAfterPrivacy() {
    if (privacyPendingForIdx === null) return;
    revealedHumanIdx = privacyPendingForIdx;
    viewerIdx = privacyPendingForIdx;
    privacyPendingForIdx = null;
    document.getElementById('modal-privacy').hidden = true;
    if (animState && animState.stage === 'CHOOSE_OFFSUIT') {
      refreshUI();
      return;
    }
    refreshAndDrive();
  }

  function maskHandForPrivacy() {
    var handEl = document.getElementById('hand-cards');
    var p = gameState.players[viewerIdx];
    handEl.innerHTML = '';
    for (var i = 0; i < p.hand.length; i++) {
      var back = document.createElement('div');
      back.className = 'hand-card is-waiting';
      back.innerHTML = '<img src="' + C.CARD_BACK_IMG + '" alt="Carta oculta" />';
      handEl.appendChild(back);
    }
    document.getElementById('hand-title').textContent = 'Mão protegida';
    document.getElementById('hand-subtitle').textContent = 'Aguardando confirmação do jogador...';
  }

  function playSoundsForMove(card) {
    if (card.type === 'lion') {
      AudioFX.lionRoar();
    } else {
      AudioFX.cardPlay();
    }
  }

  function refreshUI() {
    if (!gameState) return;
    var uiAnim = animState
      ? animState
      : Object.keys(recentArrivedCardIds).length > 0
        ? { stage: null, arrivedCardIds: recentArrivedCardIds }
        : null;

    UI.renderGameScreen(
      gameState,
      viewerIdx,
      selectedDamagedId,
      {
        onAdvanceBattle: handleAdvanceBattle,
        onConfirmDamaged: handleConfirmDamaged,
        onCancelDamaged: function () {
          selectedDamagedId = null;
          refreshUI();
        },
        onSkipAnimation: handleSkipScoringAnimation,
        onContinueRound: handleProceedAfterRound,
        onShowGameOver: handleShowGameOverModal
      },
      uiAnim
    );
    if (privacyPendingForIdx !== null) {
      maskHandForPrivacy();
    }
  }

  function computeStep3Plays() {
    var res = gameState.pendingResolution;
    var elimSet = {};
    res.eliminatedPlayOrders.forEach(function (po) { elimSet[po] = true; });
    var hiddenSet = (animState && animState.hiddenArenaOrders) || {};
    var collected = [];
    var discarded = [];

    gameState.arena.forEach(function (pl) {
      if (elimSet[pl.playOrder] || hiddenSet[pl.playOrder]) return;
      if (pl.card.type === 'combat') {
        var isLead = gameState.leadSuit !== null && pl.card.suit === gameState.leadSuit;
        var isOff = res.chosenOffsuitPlayOrder !== null && pl.playOrder === res.chosenOffsuitPlayOrder;
        if (isLead || isOff) collected.push(pl);
        else discarded.push(pl);
      } else {
        discarded.push(pl);
      }
    });

    return { collected: collected, discarded: discarded };
  }

  function executeStep3Flight(tok) {
    if (tok !== sessionToken || !gameState || !gameState.pendingResolution) return;
    var res = gameState.pendingResolution;
    var timings = getSpeedTimings();
    var step3 = computeStep3Plays();

    if (!animState) {
      animState = { stage: 'STEP_3_COLLECT_FLY', completedElims: res.eliminations.length, hiddenArenaOrders: {}, activeWeaponOrder: null };
    } else {
      animState.stage = 'STEP_3_COLLECT_FLY';
    }
    refreshUI();

    var isCancelled = function () { return tok !== sessionToken || !gameState; };

    UI.animateCollectCards(gameState, res.winnerIdx, step3.collected, step3.discarded, timings.flyMs, isCancelled)
      .then(function () {
        if (tok !== sessionToken || !gameState) return;
        recentArrivedCardIds = {};
        step3.collected.forEach(function (pl) {
          recentArrivedCardIds[pl.card.id] = true;
        });

        AudioFX.cardPlay();
        E.finalizeBattle(gameState);
        animState = null;

        if (gameState.phase === 'PLAYING_BATTLE' && countHumans(gameState) >= 2) {
          revealedHumanIdx = revealedHumanIdx === gameState.currentPlayerIdx ? revealedHumanIdx : null;
        }

        if (gameState.phase === 'ROUND_SUMMARY') {
          refreshUI();
          return delayMs(timings.stageGapMs).then(function () {
            if (tok !== sessionToken || !gameState) return;
            recentArrivedCardIds = {};
            refreshAndDrive();
          });
        }

        refreshAndDrive();
        setTimeout(function () {
          if (Object.keys(recentArrivedCardIds).length > 0 && gameState && gameState.phase === 'PLAYING_BATTLE') {
            recentArrivedCardIds = {};
            refreshUI();
          }
        }, 650);
      });
  }

  function runStep3Collection(tok) {
    if (tok !== sessionToken || !gameState || !gameState.pendingResolution) return;
    var timings = getSpeedTimings();
    animState.stage = 'STEP_3_COLLECT_HIGHLIGHT';
    refreshUI();

    if (speedMode === 'manual') {
      return;
    }

    delayMs(timings.stageGapMs).then(function () {
      if (tok !== sessionToken || !gameState) return;
      executeStep3Flight(tok);
    });
  }

  function finishPostWeaponsResolution(tok) {
    if (tok !== sessionToken || !gameState || !gameState.pendingResolution) return;
    var res = gameState.pendingResolution;
    var timings = getSpeedTimings();

    if (gameState.phase === 'CHOOSE_OFFSUIT_CARD') {
      animState.stage = 'CHOOSE_OFFSUIT';
      var winner = gameState.players[res.winnerIdx];
      if (countHumans(gameState) >= 2 && winner.isHuman && winner.index !== revealedHumanIdx) {
        refreshUI();
        showPrivacyCurtain(winner.index);
        return;
      }
      refreshUI();
      if (!winner.isHuman) {
        delayMs(timings.stageGapMs).then(function () {
          if (tok !== sessionToken || !gameState || gameState.phase !== 'CHOOSE_OFFSUIT_CARD') return;
          var cardId = AI.chooseOffsuitCard(gameState, winner.index, winner.difficulty);
          if (!cardId) return;
          E.chooseOffsuitCard(gameState, winner.index, cardId);
          runStep3Collection(tok);
        });
      }
      return;
    }

    runStep3Collection(tok);
  }

  function startBattleResolutionSequence() {
    var tok = nextToken();
    var res = gameState.pendingResolution;
    if (!res) return;
    var timings = getSpeedTimings();

    animState = {
      stage: 'STEP_1_WINNER',
      completedElims: 0,
      hiddenArenaOrders: {},
      activeWeaponOrder: null
    };
    refreshUI();
    AudioFX.battleWin();

    // Etapa 1 -> meio segundo antes da Etapa 2 (ou Etapa 3)
    delayMs(timings.stageGapMs).then(function () {
      if (tok !== sessionToken || !gameState || !gameState.pendingResolution) return;

      if (res.eliminations.length === 0) {
        finishPostWeaponsResolution(tok);
        return;
      }

      // Etapa 2: Ativar Armas Danificadas em ordem de jogada
      animState.stage = 'STEP_2_WEAPONS';
      var idx = 0;

      function nextWeapon() {
        if (tok !== sessionToken || !gameState || !gameState.pendingResolution) return;
        if (idx >= res.eliminations.length) {
          animState.activeWeaponOrder = null;
          delayMs(timings.stageGapMs).then(function () {
            if (tok !== sessionToken || !gameState) return;
            finishPostWeaponsResolution(tok);
          });
          return;
        }

        var el = res.eliminations[idx];
        var weaponPlay = gameState.arena.find(function (p) { return p.playOrder === el.weaponPlayOrder; });
        animState.activeWeaponOrder = el.weaponPlayOrder;
        refreshUI();

        var isCancelled = function () { return tok !== sessionToken || !gameState; };

        UI.animateWeaponStrike(
          weaponPlay,
          el,
          timings.flyMs,
          timings.impactHoldMs,
          function () {
            if (!isCancelled()) AudioFX.damagedBreak();
          },
          isCancelled
        ).then(function () {
          if (tok !== sessionToken || !gameState) return;
          animState.hiddenArenaOrders[el.weaponPlayOrder] = true;
          if (el.source === 'arena' && el.targetPlayOrder !== null) {
            animState.hiddenArenaOrders[el.targetPlayOrder] = true;
          }
          animState.completedElims = idx + 1;
          animState.activeWeaponOrder = null;
          refreshUI();
          idx += 1;
          if (idx < res.eliminations.length) {
            delayMs(timings.weaponPauseMs).then(nextWeapon);
          } else {
            nextWeapon();
          }
        });
      }

      nextWeapon();
    });
  }

  function refreshAndDrive() {
    if (!gameState) return;
    var humanCount = countHumans(gameState);

    if (humanCount >= 2) {
      var activeHumanTarget = null;
      if (gameState.phase === 'PLAYING_BATTLE' && gameState.players[gameState.currentPlayerIdx].isHuman) {
        activeHumanTarget = gameState.currentPlayerIdx;
      } else if (
        gameState.phase === 'CHOOSE_OFFSUIT_CARD' &&
        gameState.pendingResolution &&
        gameState.players[gameState.pendingResolution.winnerIdx].isHuman
      ) {
        activeHumanTarget = gameState.pendingResolution.winnerIdx;
      }

      if (activeHumanTarget !== null && activeHumanTarget !== revealedHumanIdx) {
        refreshUI();
        showPrivacyCurtain(activeHumanTarget);
        return;
      }
    } else if (humanCount === 1) {
      viewerIdx = getFirstHumanIdx(gameState);
    } else {
      viewerIdx = 0;
    }

    refreshUI();

    var tok = sessionToken;
    var timings = getSpeedTimings();

    if (gameState.phase === 'PLAYING_BATTLE') {
      var curPlayer = gameState.players[gameState.currentPlayerIdx];
      if (!curPlayer.isHuman) {
        setTimeout(function () {
          if (tok !== sessionToken || !gameState || gameState.phase !== 'PLAYING_BATTLE') return;
          var mv = AI.chooseMove(gameState, curPlayer.index, curPlayer.difficulty);
          if (!mv) return;
          var playedCard = C.getCardById(mv.cardId);
          E.playCard(gameState, curPlayer.index, mv.cardId, mv.declaredSuit);
          playSoundsForMove(playedCard);
          if (gameState.phase === 'BATTLE_RESOLVED' || gameState.phase === 'CHOOSE_OFFSUIT_CARD') {
            startBattleResolutionSequence();
            return;
          }
          refreshAndDrive();
        }, timings.botMs);
      }
      return;
    }

    if (gameState.phase === 'CHOOSE_OFFSUIT_CARD' || gameState.phase === 'BATTLE_RESOLVED') {
      if (!animState) {
        startBattleResolutionSequence();
      }
      return;
    }

    if (gameState.phase === 'ROUND_SUMMARY') {
      if (!animState) {
        startRoundScoringSequence();
      }
      return;
    }

    if (gameState.phase === 'GAME_OVER') {
      UI.renderGameOverModal(gameState);
    }
  }

  // =========================================================
  // ANIMAÇÕES AO VIVO NA ARENA E TABULEIRO (RODADA E FIM DE JOGO)
  // =========================================================
  function startRoundScoringSequence() {
    if (!gameState || !gameState.lastRoundSummary) return;
    var tok = nextToken();
    var summary = gameState.lastRoundSummary;
    var timings = getSpeedTimings();

    AudioFX.roundEnd();

    if (summary.boardSide === 'A') {
      runRoundScoringSideA(tok, summary, timings);
    } else {
      runRoundScoringSideB(tok, summary, timings);
    }
  }

  function runRoundScoringSideA(tok, summary, timings) {
    var displayTracksA = [];
    for (var i = 0; i < gameState.numPlayers; i++) {
      displayTracksA.push({ gladio: 6, tridente: 6, mangual: 6, machado: 6 });
    }
    summary.suitBreakdowns.forEach(function (sb) {
      sb.entries.forEach(function (en) {
        displayTracksA[en.playerIdx][sb.suit] = en.before;
      });
    });

    var discardedRows = (gameState.lastDiscardedCards || []).map(function (d) {
      return {
        playerIdx: d.playerIdx,
        detail: 'Descartou ' + d.card.name,
        badgeText: 'Fim da mão',
        badgeType: 'is-zero',
        active: false
      };
    });

    function makeSuitsStepper(activeIdx) {
      return C.SUITS.map(function (st, idx) {
        return {
          label: (idx + 1) + '. ' + C.SUIT_META[st].name,
          status: idx < activeIdx ? 'done' : idx === activeIdx ? 'active' : ''
        };
      });
    }

    animState = {
      stage: 'ROUND_SCORING',
      canSkip: true,
      readyNextRound: false,
      readyGameOver: false,
      scoringSuit: null,
      scoringPlayerIdx: null,
      bannerText: 'Fim da Rodada ' + summary.round + ' — Últimas cartas descartadas. Pontuando naipes...',
      stepperPills: makeSuitsStepper(-1),
      boardOverride: { tracksA: displayTracksA, cubeHighlights: {} },
      narration: {
        title: 'Fim da Rodada ' + summary.round,
        suit: null,
        progress: 'Lado A',
        headline: 'Última carta de cada mão descartada. Resolvendo cada naipe no Tabuleiro de Glória...',
        rows: discardedRows
      }
    };
    refreshUI();

    delayMs(Math.round(timings.roundStepMs * 0.85)).then(function () {
      var sIdx = 0;

      function nextSuit() {
        if (tok !== sessionToken || !gameState) return;
        if (sIdx >= C.SUITS.length) {
          finishRoundScoringAnimation(tok, summary);
          return;
        }

        var suit = C.SUITS[sIdx];
        var suitMeta = C.SUIT_META[suit];
        var sb = summary.suitBreakdowns.find(function (b) { return b.suit === suit; });
        var revealed = {};

        function buildRows(activeSet) {
          return sb.entries.map(function (en) {
            var isRev = !!revealed[en.playerIdx];
            var dTxt = en.delta > 0 ? '+' + en.delta + ' espaço' : en.delta < 0 ? en.delta + ' espaço' + (Math.abs(en.delta) > 1 ? 's' : '') : 'Parado (0)';
            var dType = en.delta > 0 ? 'is-pos' : en.delta < 0 ? 'is-neg' : 'is-zero';
            return {
              playerIdx: en.playerIdx,
              detail: en.count + ' carta(s) • casa ' + (displayTracksA[en.playerIdx][suit] + 1),
              badgeText: isRev ? dTxt : 'Aguardando...',
              badgeType: isRev ? dType : 'is-zero',
              active: !!(activeSet && activeSet[en.playerIdx])
            };
          });
        }

        function setSuitNarration(headline, highlights, activeSet) {
          animState = {
            stage: 'ROUND_SCORING',
            canSkip: true,
            readyNextRound: false,
            readyGameOver: false,
            scoringSuit: suit,
            scoringPlayerIdx: null,
            bannerText: 'Resolvendo trilha de ' + suitMeta.name + ' (' + suitMeta.colorName + ')...',
            stepperPills: makeSuitsStepper(sIdx),
            boardOverride: { tracksA: displayTracksA, cubeHighlights: highlights || {} },
            narration: {
              title: 'Naipe ' + suitMeta.name + ' (' + suitMeta.colorName + ')',
              suit: suit,
              progress: (sIdx + 1) + ' / 4',
              headline: headline,
              rows: buildRows(activeSet)
            }
          };
          refreshUI();
        }

        if (sb.maxCount === 0) {
          var stayAll = {};
          sb.entries.forEach(function (en) {
            revealed[en.playerIdx] = true;
            stayAll['A-' + suit + '-' + en.playerIdx] = 'is-staying';
          });
          setSuitNarration(
            'Naipe ' + suitMeta.name + ' (' + suitMeta.colorName + '): nenhum jogador possui cartas — todos os cubos permanecem parados.',
            stayAll,
            {}
          );
          delayMs(Math.round(timings.roundStepMs * 0.9)).then(function () {
            sIdx += 1;
            nextSuit();
          });
          return;
        }

        var winners = sb.entries.filter(function (e) { return e.delta > 0; });
        var zeroes = sb.entries.filter(function (e) { return e.delta === 0; });
        var retreaters = sb.entries.filter(function (e) { return e.delta < 0; });

        // 1) Maioria avança +1
        var hlWin = {};
        var actWin = {};
        winners.forEach(function (e) {
          displayTracksA[e.playerIdx][suit] = e.after;
          revealed[e.playerIdx] = true;
          hlWin['A-' + suit + '-' + e.playerIdx] = 'is-moving-up';
          actWin[e.playerIdx] = true;
        });
        var winNames = winners.map(function (e) { return gameState.players[e.playerIdx].name; }).join(' e ');
        AudioFX.cubeMove();
        setSuitNarration(
          'Naipe ' + suitMeta.name + ' (' + suitMeta.colorName + ') — Jogador' +
            (winners.length > 1 ? 'es' : '') + ' com mais cartas (' + sb.maxCount + '): ' +
            winNames + (winners.length > 1 ? ' avançam o cubo +1 espaço!' : ' avança o seu cubo 1 espaço na trilha de ' + suitMeta.name + '!'),
          hlWin,
          actWin
        );

        delayMs(timings.roundStepMs).then(function () {
          if (tok !== sessionToken || !gameState) return;

          function processRetreaters(rIdx) {
            if (tok !== sessionToken || !gameState) return;
            if (rIdx >= retreaters.length) {
              sIdx += 1;
              nextSuit();
              return;
            }
            var re = retreaters[rIdx];
            displayTracksA[re.playerIdx][suit] = re.after;
            revealed[re.playerIdx] = true;
            var hlRet = {};
            hlRet['A-' + suit + '-' + re.playerIdx] = 'is-moving-down';
            var actRet = {};
            actRet[re.playerIdx] = true;
            var diff = sb.maxCount - re.count;
            var absDelta = Math.abs(re.delta);
            AudioFX.cubeMove();
            setSuitNarration(
              'Naipe ' + suitMeta.name + ': ' + gameState.players[re.playerIdx].name +
                ' (' + re.count + ' carta' + (re.count > 1 ? 's' : '') + ', diferença ' + diff + ') recua ' +
                absDelta + ' espaço' + (absDelta > 1 ? 's' : '') + ' na trilha de ' + suitMeta.name + '.',
              hlRet,
              actRet
            );
            delayMs(Math.round(timings.roundStepMs * 0.9)).then(function () {
              processRetreaters(rIdx + 1);
            });
          }

          if (zeroes.length > 0) {
            var hlZ = {};
            var actZ = {};
            zeroes.forEach(function (e) {
              revealed[e.playerIdx] = true;
              hlZ['A-' + suit + '-' + e.playerIdx] = 'is-staying';
              actZ[e.playerIdx] = true;
            });
            var zNames = zeroes.map(function (e) { return gameState.players[e.playerIdx].name; }).join(' e ');
            setSuitNarration(
              'Naipe ' + suitMeta.name + ': ' + zNames +
                (zeroes.length > 1 ? ' sem cartas — cubos permanecem parados.' : ' sem cartas — o cubo permanece parado.'),
              hlZ,
              actZ
            );
            delayMs(Math.round(timings.roundStepMs * 0.8)).then(function () {
              processRetreaters(0);
            });
          } else {
            processRetreaters(0);
          }
        });
      }

      nextSuit();
    });
  }

  function runRoundScoringSideB(tok, summary, timings) {
    var displayTrackB = {};
    summary.playerEntries.forEach(function (en) {
      displayTrackB[en.playerIdx] = en.before;
    });

    // Casos A/B/C primeiro, depois Caso D para mostrar qual pontuação foi igualada
    var ordered = summary.playerEntries
      .filter(function (e) { return e.ruleCase !== 'D'; })
      .concat(summary.playerEntries.filter(function (e) { return e.ruleCase === 'D'; }));

    var revealed = {};

    function makeStepper(idxDone) {
      return ordered.map(function (en, idx) {
        return {
          label: gameState.players[en.playerIdx].name,
          status: idx < idxDone ? 'done' : idx === idxDone ? 'active' : ''
        };
      });
    }

    function buildRows(activeIdx) {
      return summary.playerEntries.map(function (en) {
        var isRev = !!revealed[en.playerIdx];
        var dTxt = en.delta > 0 ? '+' + en.delta + ' pts' : en.delta < 0 ? en.delta + ' pts' : '0 pts';
        var dType = en.delta > 0 ? 'is-pos' : en.delta < 0 ? 'is-neg' : 'is-zero';
        return {
          playerIdx: en.playerIdx,
          detail: 'Caso ' + en.ruleCase + ' • espaço ' + displayTrackB[en.playerIdx],
          badgeText: isRev ? dTxt : 'Aguardando...',
          badgeType: isRev ? dType : 'is-zero',
          active: en.playerIdx === activeIdx
        };
      });
    }

    animState = {
      stage: 'ROUND_SCORING',
      canSkip: true,
      readyNextRound: false,
      readyGameOver: false,
      scoringSuit: null,
      scoringPlayerIdx: null,
      bannerText: 'Fim da Rodada ' + summary.round + ' — Calculando pontos no Tabuleiro Lado B...',
      stepperPills: makeStepper(-1),
      boardOverride: { trackB: displayTrackB, stepWalk: false, cubeHighlights: {} },
      narration: {
        title: 'Pontuação da Rodada ' + summary.round + ' (Lado B)',
        suit: null,
        progress: 'Lado B',
        headline: 'Última carta descartada! Calculando o movimento de cada jogador na trilha...',
        rows: buildRows(null)
      }
    };
    refreshUI();

    delayMs(Math.round(timings.roundStepMs * 0.8)).then(function () {
      var oIdx = 0;

      function nextEntry() {
        if (tok !== sessionToken || !gameState) return;
        if (oIdx >= ordered.length) {
          finishRoundScoringAnimation(tok, summary);
          return;
        }

        var en = ordered[oIdx];
        var pName = gameState.players[en.playerIdx].name;
        var dTxt = (en.delta > 0 ? '+' : '') + en.delta;
        var ruleHeadline = '';
        if (en.ruleCase === 'A') {
          ruleHeadline = pName + ' (Caso A — maior menos menor naipe): move ' + dTxt + ' espaço(s) na trilha de glória!';
        } else if (en.ruleCase === 'B') {
          ruleHeadline = pName + ' (Caso B — todos os naipes iguais): soma tudo e avança ' + dTxt + ' espaços!';
        } else if (en.ruleCase === 'C') {
          ruleHeadline = pName + ' (Caso C — naipe único): avança ' + dTxt + ' espaços!';
        } else {
          ruleHeadline = pName + ' (Caso D — nenhuma carta na área): iguala a maior pontuação da rodada (' + dTxt + ')!';
        }

        revealed[en.playerIdx] = true;
        var hl = {};
        hl['B-' + en.playerIdx] = en.after > en.before ? 'is-moving-up' : en.after < en.before ? 'is-moving-down' : 'is-staying';

        animState = {
          stage: 'ROUND_SCORING',
          canSkip: true,
          readyNextRound: false,
          readyGameOver: false,
          scoringSuit: null,
          scoringPlayerIdx: en.playerIdx,
          bannerText: ruleHeadline,
          stepperPills: makeStepper(oIdx),
          boardOverride: { trackB: displayTrackB, stepWalk: true, cubeHighlights: hl },
          narration: {
            title: 'Pontuação — ' + pName,
            suit: null,
            progress: (oIdx + 1) + ' / ' + ordered.length,
            headline: ruleHeadline,
            rows: buildRows(en.playerIdx)
          }
        };
        refreshUI();

        function walkSteps() {
          if (tok !== sessionToken || !gameState) return;
          if (displayTrackB[en.playerIdx] === en.after) {
            delayMs(Math.round(timings.roundStepMs * 0.7)).then(function () {
              oIdx += 1;
              nextEntry();
            });
            return;
          }
          var stepDir = en.after > displayTrackB[en.playerIdx] ? 1 : -1;
          displayTrackB[en.playerIdx] += stepDir;
          AudioFX.cubeMove();
          animState.narration.rows = buildRows(en.playerIdx);
          refreshUI();
          delayMs(timings.walkStepMs).then(walkSteps);
        }

        delayMs(Math.round(timings.roundStepMs * 0.4)).then(walkSteps);
      }

      nextEntry();
    });
  }

  function finishRoundScoringAnimation(tok, summary) {
    if (tok !== sessionToken || !gameState) return;
    if (summary.triggersGameOver) {
      startGameOverScoringSequence(tok);
      return;
    }

    var nextR = gameState.round + 1;
    animState = {
      stage: 'ROUND_SCORING',
      canSkip: false,
      readyNextRound: true,
      readyGameOver: false,
      scoringSuit: null,
      scoringPlayerIdx: null,
      bannerText: 'Rodada ' + summary.round + ' encerrada! Cubos posicionados no tabuleiro.',
      stepperPills: [{ label: 'Rodada ' + summary.round + ' concluída', status: 'done' }],
      boardOverride: animState ? animState.boardOverride : null,
      narration: animState && animState.narration
        ? Object.assign({}, animState.narration, {
            headline: 'Rodada ' + summary.round + ' concluída! Embaralhando todas as cartas para a Rodada ' + nextR + '...'
          })
        : null
    };
    refreshUI();

    if (speedMode !== 'manual') {
      delayMs(1100).then(function () {
        if (tok !== sessionToken || !gameState || gameState.phase !== 'ROUND_SUMMARY') return;
        handleProceedAfterRound();
      });
    }
  }

  function startGameOverScoringSequence(tok) {
    if (tok !== sessionToken || !gameState) return;
    var timings = getSpeedTimings();
    var standings = gameState.finalStandings || E.computeFinalStandings(gameState);

    if (gameState.boardSide === 'B') {
      AudioFX.gameOver();
      var winNamesB = standings.winners.map(function (idx) { return gameState.players[idx].name; }).join(' e ');
      animState = {
        stage: 'GAME_OVER_SCORING',
        canSkip: false,
        readyNextRound: false,
        readyGameOver: true,
        scoringSuit: null,
        scoringPlayerIdx: null,
        bannerText: 'Fim de Partida! Vencedor: ' + winNamesB + '!',
        stepperPills: [{ label: 'Fim de Partida', status: 'done' }],
        boardOverride: null,
        narration: {
          title: 'Fim de Jogo — Tabuleiro Lado B',
          suit: null,
          progress: 'Final',
          headline: (standings.sharedVictory ? 'Vitória compartilhada: ' : 'Campeão do Coliseu: ') + winNamesB + ' com ' + standings.rows[0].totalPoints + ' pontos!',
          rows: standings.rows.map(function (r) {
            return {
              playerIdx: r.playerIdx,
              detail: r.rank + 'º lugar • último avanço: ' + (r.lastRoundDelta > 0 ? '+' : '') + r.lastRoundDelta,
              badgeText: r.totalPoints + ' pts',
              badgeType: r.rank === 1 ? 'is-pos' : 'is-pts',
              active: r.rank === 1
            };
          })
        }
      };
      refreshUI();
      if (speedMode !== 'manual') {
        delayMs(1400).then(function () {
          if (tok !== sessionToken || !gameState) return;
          handleShowGameOverModal();
        });
      }
      return;
    }

    // Lado A: animar cubos saindo das trilhas da esquerda para as casas 5 / 3 / 2 / 1 da direita!
    var displayTracksA = gameState.players.map(function (p) { return Object.assign({}, p.tracksA); });
    var scoreSlotsA = { gladio: {}, tridente: {}, mangual: {}, machado: {} };
    var runningTotals = [];
    for (var i = 0; i < gameState.numPlayers; i++) runningTotals.push(0);

    function makeFinalStepper(sIdx) {
      return C.SUITS.map(function (st, idx) {
        return {
          label: (idx + 1) + '. ' + C.SUIT_META[st].name,
          status: idx < sIdx ? 'done' : idx === sIdx ? 'active' : ''
        };
      });
    }

    function buildScoreRows(activePlayers) {
      return gameState.players.map(function (p) {
        return {
          playerIdx: p.index,
          detail: 'Pontuação acumulada',
          badgeText: runningTotals[p.index] + ' pts',
          badgeType: activePlayers && activePlayers[p.index] ? 'is-pos' : 'is-pts',
          active: !!(activePlayers && activePlayers[p.index])
        };
      });
    }

    animState = {
      stage: 'GAME_OVER_SCORING',
      canSkip: true,
      readyNextRound: false,
      readyGameOver: false,
      scoringSuit: null,
      scoringPlayerIdx: null,
      bannerText: 'Fim da última rodada! Movendo cubos para as casas de pontuação final (5 / 3 / 2 / 1)...',
      stepperPills: makeFinalStepper(-1),
      boardOverride: { tracksA: displayTracksA, scoreSlotsA: scoreSlotsA, cubeHighlights: {} },
      narration: {
        title: 'Pontuação Final — Lado A',
        suit: null,
        progress: 'Final',
        headline: 'Movendo os cubos de cada trilha para as casas de pontuação à direita (5, 3, 2, 1)!',
        rows: buildScoreRows(null)
      }
    };
    refreshUI();

    delayMs(Math.round(timings.scoreJumpMs * 0.9)).then(function () {
      var sIdx = 0;

      function nextScoreSuit() {
        if (tok !== sessionToken || !gameState) return;
        if (sIdx >= C.SUITS.length) {
          AudioFX.gameOver();
          var winNamesA = standings.winners.map(function (idx) { return gameState.players[idx].name; }).join(' e ');
          var winSet = {};
          standings.winners.forEach(function (idx) { winSet[idx] = true; });
          animState = {
            stage: 'GAME_OVER_SCORING',
            canSkip: false,
            readyNextRound: false,
            readyGameOver: true,
            scoringSuit: null,
            scoringPlayerIdx: null,
            bannerText: 'Pontuação final concluída! Vencedor: ' + winNamesA + '!',
            stepperPills: makeFinalStepper(4),
            boardOverride: { tracksA: displayTracksA, scoreSlotsA: scoreSlotsA, cubeHighlights: {} },
            narration: {
              title: 'Campeão do Coliseu',
              suit: null,
              progress: '4 / 4',
              headline: '🏆 ' + (standings.sharedVictory ? 'Vitória compartilhada: ' : 'Grande Campeão: ') + winNamesA + ' com ' + standings.rows[0].totalPoints + ' pontos!',
              rows: buildScoreRows(winSet)
            }
          };
          refreshUI();
          if (speedMode !== 'manual') {
            delayMs(1700).then(function () {
              if (tok !== sessionToken || !gameState) return;
              handleShowGameOverModal();
            });
          }
          return;
        }

        var suit = C.SUITS[sIdx];
        var suitMeta = C.SUIT_META[suit];
        var rankGroups = {};
        standings.rows.forEach(function (r) {
          var tr = r.trackResults[suit];
          if (!rankGroups[tr.denseRank]) rankGroups[tr.denseRank] = [];
          rankGroups[tr.denseRank].push({ playerIdx: r.playerIdx, points: tr.points, denseRank: tr.denseRank });
        });
        var ranks = Object.keys(rankGroups).map(Number).sort(function (a, b) { return a - b; });
        var rPos = 0;

        function nextRankGroup() {
          if (tok !== sessionToken || !gameState) return;
          if (rPos >= ranks.length) {
            sIdx += 1;
            nextScoreSuit();
            return;
          }

          var rank = ranks[rPos];
          var group = rankGroups[rank];
          var pts = group[0].points;
          var hl = {};
          var act = {};
          group.forEach(function (item) {
            scoreSlotsA[suit][item.playerIdx] = rank;
            runningTotals[item.playerIdx] += item.points;
            hl['A-' + suit + '-' + item.playerIdx] = 'is-scoring-jump';
            act[item.playerIdx] = true;
          });
          var names = group.map(function (item) { return gameState.players[item.playerIdx].name; }).join(' e ');
          AudioFX.cubeMove();
          animState = {
            stage: 'GAME_OVER_SCORING',
            canSkip: true,
            readyNextRound: false,
            readyGameOver: false,
            scoringSuit: suit,
            scoringPlayerIdx: null,
            bannerText: 'Pontuação Final — ' + suitMeta.name + ': ' + names + ' na casa de ' + pts + ' pontos!',
            stepperPills: makeFinalStepper(sIdx),
            boardOverride: { tracksA: displayTracksA, scoreSlotsA: scoreSlotsA, cubeHighlights: hl },
            narration: {
              title: 'Pontuação Final — ' + suitMeta.name,
              suit: suit,
              progress: (sIdx + 1) + ' / 4',
              headline: 'Trilha de ' + suitMeta.name + ': ' + names + (group.length > 1 ? ' vão juntos para a casa de ' : ' move o cubo para a casa de ') + pts + ' pontos!',
              rows: buildScoreRows(act)
            }
          };
          refreshUI();

          delayMs(timings.scoreJumpMs).then(function () {
            rPos += 1;
            nextRankGroup();
          });
        }

        nextRankGroup();
      }

      nextScoreSuit();
    });
  }

  function handleSkipScoringAnimation() {
    if (!gameState || !animState) return;
    var isGameOver = gameState.lastRoundSummary && gameState.lastRoundSummary.triggersGameOver;
    if (isGameOver) {
      handleShowGameOverModal();
    } else {
      handleProceedAfterRound();
    }
  }

  function handleProceedAfterRound() {
    if (!gameState || gameState.phase !== 'ROUND_SUMMARY') return;
    nextToken();
    animState = null;
    document.getElementById('modal-round-summary').hidden = true;
    E.proceedAfterRoundSummary(gameState);
    if (gameState.phase === 'PLAYING_BATTLE') {
      AudioFX.deal();
      if (countHumans(gameState) >= 2) {
        revealedHumanIdx = null;
      }
    }
    refreshAndDrive();
  }

  function handleShowGameOverModal() {
    if (!gameState) return;
    nextToken();
    animState = null;
    if (gameState.phase === 'ROUND_SUMMARY') {
      E.proceedAfterRoundSummary(gameState);
    }
    refreshUI();
    UI.renderGameOverModal(gameState);
  }

  function handleHumanCardClick(cardId) {
    if (!gameState || gameState.phase !== 'PLAYING_BATTLE' || privacyPendingForIdx !== null) return;
    if (gameState.currentPlayerIdx !== viewerIdx || !gameState.players[viewerIdx].isHuman) return;

    var restriction = E.getCardPlayRestriction(gameState, viewerIdx, cardId);
    if (restriction !== null) {
      var bannerText = document.getElementById('arena-banner-text');
      bannerText.innerHTML = '<span style="color:#ff9c92;">' + UI.esc(restriction) + '</span>';
      return;
    }

    var card = C.getCardById(cardId);
    if (!card) return;

    if (card.type === 'damaged') {
      selectedDamagedId = selectedDamagedId === cardId ? null : cardId;
      refreshUI();
      return;
    }

    selectedDamagedId = null;
    nextToken();
    recentArrivedCardIds = {};
    E.playCard(gameState, viewerIdx, cardId, null);
    playSoundsForMove(card);
    if (gameState.phase === 'BATTLE_RESOLVED' || gameState.phase === 'CHOOSE_OFFSUIT_CARD') {
      startBattleResolutionSequence();
      return;
    }
    refreshAndDrive();
  }

  function handleConfirmDamaged(cardId, declaredSuit) {
    if (!gameState || gameState.phase !== 'PLAYING_BATTLE') return;
    selectedDamagedId = null;
    nextToken();
    recentArrivedCardIds = {};
    var card = C.getCardById(cardId);
    E.playCard(gameState, viewerIdx, cardId, declaredSuit);
    playSoundsForMove(card);
    if (gameState.phase === 'BATTLE_RESOLVED' || gameState.phase === 'CHOOSE_OFFSUIT_CARD') {
      startBattleResolutionSequence();
      return;
    }
    refreshAndDrive();
  }

  function handleChooseOffsuitClick(cardId) {
    if (!gameState || gameState.phase !== 'CHOOSE_OFFSUIT_CARD' || !gameState.pendingResolution) return;
    var wIdx = gameState.pendingResolution.winnerIdx;
    if (!gameState.players[wIdx].isHuman) return;
    var tok = nextToken();
    E.chooseOffsuitCard(gameState, wIdx, cardId);
    AudioFX.cardPlay();
    if (!animState) {
      animState = { stage: 'STEP_3_COLLECT_HIGHLIGHT', completedElims: gameState.pendingResolution.eliminations.length, hiddenArenaOrders: {}, activeWeaponOrder: null };
    }
    runStep3Collection(tok);
  }

  function handleAdvanceBattle() {
    if (!gameState || gameState.phase !== 'BATTLE_RESOLVED') return;
    if (animState && animState.stage === 'STEP_3_COLLECT_HIGHLIGHT') {
      executeStep3Flight(nextToken());
      return;
    }
    if (animState) return;
    nextToken();
    UI.clearAnimations();
    E.finalizeBattle(gameState);
    if (gameState.phase === 'PLAYING_BATTLE' && countHumans(gameState) >= 2) {
      revealedHumanIdx = revealedHumanIdx === gameState.currentPlayerIdx ? revealedHumanIdx : null;
    }
    refreshAndDrive();
  }

  function handleContinueRoundSummary() {
    handleProceedAfterRound();
  }

  // =========================================================
  // HUD & EVENTOS GLOBAIS
  // =========================================================
  function updateSpeedButton() {
    document.getElementById('btn-speed').textContent = SPEED_LABELS[speedMode];
  }

  function updateSoundButton() {
    document.getElementById('btn-sound').textContent = AudioFX.isMuted() ? 'Som: Mudo' : 'Som: Ligado';
  }

  function bindGameEvents() {
    // Delegação na mão de cartas
    document.getElementById('hand-cards').addEventListener('click', function (ev) {
      var zoomBtn = ev.target.closest('[data-inspect-card]');
      if (zoomBtn) {
        ev.stopPropagation();
        UI.openCardInspect(zoomBtn.getAttribute('data-inspect-card'));
        return;
      }
      var cardEl = ev.target.closest('[data-card-id]');
      if (cardEl) {
        handleHumanCardClick(cardEl.getAttribute('data-card-id'));
      }
    });

    // Clique direito para ampliar carta na mão
    document.getElementById('hand-cards').addEventListener('contextmenu', function (ev) {
      var cardEl = ev.target.closest('[data-card-id]');
      if (cardEl) {
        ev.preventDefault();
        UI.openCardInspect(cardEl.getAttribute('data-card-id'));
      }
    });

    // Delegação na arena e áreas de jogo (escolher offsuit ou inspecionar carta)
    document.getElementById('screen-game').addEventListener('click', function (ev) {
      var offBtn = ev.target.closest('[data-choose-offsuit]');
      if (offBtn) {
        handleChooseOffsuitClick(offBtn.getAttribute('data-choose-offsuit'));
        return;
      }
      var inspectBtn = ev.target.closest('[data-inspect-card]');
      if (inspectBtn && !ev.target.closest('#hand-cards')) {
        UI.openCardInspect(
          inspectBtn.getAttribute('data-inspect-card'),
          inspectBtn.getAttribute('data-inspect-suit')
        );
      }
    });

    document.getElementById('btn-privacy-reveal').addEventListener('click', revealHandAfterPrivacy);
    document.getElementById('btn-round-continue').addEventListener('click', handleContinueRoundSummary);
    document.getElementById('btn-gameover-menu').addEventListener('click', goToMenu);
    document.getElementById('btn-gameover-rematch').addEventListener('click', function () {
      if (lastGameConfig) startNewGame(lastGameConfig);
    });

    document.getElementById('btn-speed').addEventListener('click', function () {
      speedMode = speedMode === 'normal' ? 'fast' : speedMode === 'fast' ? 'manual' : 'normal';
      updateSpeedButton();
      // Se alternou para modo normal/rápido enquanto aguardava em pausa manual, prosseguir
      if (gameState && gameState.phase === 'BATTLE_RESOLVED' && animState && animState.stage === 'STEP_3_COLLECT_HIGHLIGHT' && speedMode !== 'manual') {
        executeStep3Flight(nextToken());
      } else if (gameState && animState && animState.readyNextRound && speedMode !== 'manual') {
        handleProceedAfterRound();
      } else if (gameState && animState && animState.readyGameOver && speedMode !== 'manual') {
        handleShowGameOverModal();
      }
    });

    document.getElementById('btn-sound').addEventListener('click', function () {
      AudioFX.toggleMuted();
      updateSoundButton();
    });

    document.getElementById('btn-history').addEventListener('click', function () {
      var drawer = document.getElementById('drawer-history');
      drawer.hidden = !drawer.hidden;
    });
    document.getElementById('btn-close-history').addEventListener('click', function () {
      document.getElementById('drawer-history').hidden = true;
    });

    document.getElementById('btn-game-rules').addEventListener('click', function () {
      UI.openRulesModal(gameState && gameState.boardSide === 'B' ? 'sideB' : 'battle');
    });

    document.getElementById('btn-back-menu').addEventListener('click', goToMenu);

    // Fechar modais genéricos
    document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.getElementById(btn.getAttribute('data-close-modal')).hidden = true;
      });
    });

    document.querySelectorAll('.modal-backdrop').forEach(function (bd) {
      bd.addEventListener('click', function (ev) {
        if (ev.target !== bd) return;
        // Não fechar modais obrigatórios (privacidade, fim de rodada, fim de jogo) ao clicar fora
        if (
          bd.id === 'modal-board-zoom' ||
          bd.id === 'modal-card-zoom' ||
          bd.id === 'modal-rules'
        ) {
          bd.hidden = true;
        }
      });
    });

    // Abas do manual
    document.querySelectorAll('#rules-tabs .rules-tab').forEach(function (tabBtn) {
      tabBtn.addEventListener('click', function () {
        UI.openRulesModal(tabBtn.getAttribute('data-tab'));
      });
    });

    // Atalhos de teclado
    document.addEventListener('keydown', function (ev) {
      if (ev.target && (ev.target.tagName === 'INPUT' || ev.target.tagName === 'SELECT' || ev.target.tagName === 'TEXTAREA')) {
        return;
      }

      if (ev.key === 'Escape') {
        document.getElementById('modal-board-zoom').hidden = true;
        document.getElementById('modal-card-zoom').hidden = true;
        document.getElementById('modal-rules').hidden = true;
        document.getElementById('drawer-history').hidden = true;
        if (selectedDamagedId) {
          selectedDamagedId = null;
          refreshUI();
        }
        return;
      }

      if (ev.key === ' ' || ev.key === 'Enter') {
        if (!document.getElementById('modal-privacy').hidden) {
          ev.preventDefault();
          revealHandAfterPrivacy();
          return;
        }
        if (gameState && animState && animState.readyNextRound) {
          ev.preventDefault();
          handleProceedAfterRound();
          return;
        }
        if (gameState && animState && animState.readyGameOver) {
          ev.preventDefault();
          handleShowGameOverModal();
          return;
        }
        if (gameState && gameState.phase === 'BATTLE_RESOLVED' && document.getElementById('modal-round-summary').hidden) {
          ev.preventDefault();
          handleAdvanceBattle();
          return;
        }
        if (gameState && gameState.phase === 'ROUND_SUMMARY' && !document.getElementById('modal-round-summary').hidden) {
          ev.preventDefault();
          handleContinueRoundSummary();
        }
      }
    });
  }

  function init() {
    renderMenuSeats();
    bindMenuEvents();
    bindGameEvents();
    updateSoundButton();
    updateSpeedButton();
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);

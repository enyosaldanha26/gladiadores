(function (global) {
  'use strict';

  var Gladiadores = (global.Gladiadores = global.Gladiadores || {});

  function C() {
    return Gladiadores.CONSTANTS;
  }

  function makeEmptyPlayArea() {
    return {
      gladio: [],
      tridente: [],
      mangual: [],
      machado: []
    };
  }

  function shuffleArray(arr, rng) {
    var randomFn = typeof rng === 'function' ? rng : Math.random;
    var copy = arr.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(randomFn() * (i + 1));
      var tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function cardSortComparator(a, b) {
    var order = { gladio: 0, tridente: 1, mangual: 2, machado: 3, damaged: 4, lion: 5 };
    var ka = a.type === 'combat' ? order[a.suit] : order[a.type];
    var kb = b.type === 'combat' ? order[b.suit] : order[b.type];
    if (ka !== kb) return ka - kb;
    if (a.type === 'combat' && b.type === 'combat') return a.value - b.value;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  }

  function buildDeckForPlayers(numPlayers) {
    var catalog = C().CARD_CATALOG;
    if (numPlayers === 3) {
      // 3 jogadores: remover todos os 2 e 3 de todos os naipes (8 cartas) e 1 carta de leão (GL050)
      return catalog.filter(function (card) {
        if (card.type === 'combat' && (card.value === 2 || card.value === 3)) return false;
        if (card.id === 'GL050') return false;
        return true;
      });
    }
    return catalog.slice();
  }

  function dealCardsIntoState(state, cardsPool, rng) {
    var shuffled = shuffleArray(cardsPool, rng || state._rng);
    var perPlayer = state.numPlayers === 3 ? 13 : 12;
    var cursor = 0;

    for (var i = 0; i < state.numPlayers; i++) {
      var hand = shuffled.slice(cursor, cursor + perPlayer);
      hand.sort(cardSortComparator);
      state.players[i].hand = hand;
      state.players[i].playArea = makeEmptyPlayArea();
      cursor += perPlayer;
    }

    state.unusedCards = shuffled.slice(cursor);
    state.discardPile = [];
    state.arena = [];
    state.leadSuit = null;
    state.pendingResolution = null;
    state.lastDiscardedCards = [];
  }

  function cloneState(state) {
    var rng = state._rng;
    var cloned = JSON.parse(JSON.stringify(state));
    if (rng) {
      Object.defineProperty(cloned, '_rng', {
        value: rng,
        enumerable: false,
        writable: true,
        configurable: true
      });
    }
    return cloned;
  }

  function getHandCount(player) {
    return player.hand.length;
  }

  function getPlayAreaCount(player, suit) {
    return player.playArea[suit].length;
  }

  function getTotalPlayAreaCount(player) {
    var suits = C().SUITS;
    var total = 0;
    for (var i = 0; i < suits.length; i++) {
      total += player.playArea[suits[i]].length;
    }
    return total;
  }

  /**
   * Cria o estado inicial de uma partida de Gladiadores (3 ou 4 jogadores, Lado A ou B).
   */
  function createGame(config) {
    var numPlayers = config.numPlayers === 3 ? 3 : 4;
    var boardSide = config.boardSide === 'B' ? 'B' : 'A';
    var rng = typeof config.rng === 'function' ? config.rng : Math.random;
    var defaultColors = C().PLAYER_COLOR_ORDER;

    var players = [];
    for (var i = 0; i < numPlayers; i++) {
      var pCfg = (config.players && config.players[i]) || {};
      players.push({
        index: i,
        name: pCfg.name || 'Jogador ' + (i + 1),
        color: pCfg.color || defaultColors[i],
        isHuman: pCfg.isHuman !== undefined ? !!pCfg.isHuman : i === 0,
        difficulty: pCfg.difficulty || 'estrategico',
        hand: [],
        playArea: makeEmptyPlayArea(),
        tracksA: { gladio: 6, tridente: 6, mangual: 6, machado: 6 },
        trackB: 5,
        lastRoundDelta: 0
      });
    }

    var firstPlayerIdx =
      typeof config.firstPlayerIdx === 'number' &&
      config.firstPlayerIdx >= 0 &&
      config.firstPlayerIdx < numPlayers
        ? config.firstPlayerIdx
        : Math.floor(rng() * numPlayers);

    var state = {
      numPlayers: numPlayers,
      boardSide: boardSide,
      totalRounds: numPlayers === 3 ? 3 : 4,
      sideBTarget: numPlayers === 3 ? 15 : 20,
      round: 1,
      battleNumber: 1,
      firstPlayerIdx: firstPlayerIdx,
      leaderIdx: firstPlayerIdx,
      currentPlayerIdx: firstPlayerIdx,
      leadSuit: null,
      phase: 'PLAYING_BATTLE',
      players: players,
      arena: [],
      discardPile: [],
      unusedCards: [],
      lastDiscardedCards: [],
      pendingResolution: null,
      lastRoundSummary: null,
      finalStandings: null,
      battleHistory: [],
      roundHistory: []
    };

    Object.defineProperty(state, '_rng', {
      value: rng,
      enumerable: false,
      writable: true,
      configurable: true
    });

    if (!config.skipInitialDeal) {
      var deck = buildDeckForPlayers(numPlayers);
      dealCardsIntoState(state, deck, rng);
    }

    return state;
  }

  /**
   * Retorna todas as jogadas legais para `playerIdx` na batalha atual.
   */
  function getLegalMoves(state, playerIdx) {
    if (state.phase !== 'PLAYING_BATTLE' || state.currentPlayerIdx !== playerIdx) {
      return [];
    }
    var hand = state.players[playerIdx].hand;
    var leadSuit = state.leadSuit;
    var hasLeadCombat =
      leadSuit !== null &&
      hand.some(function (c) {
        return c.type === 'combat' && c.suit === leadSuit;
      });

    var moves = [];
    for (var i = 0; i < hand.length; i++) {
      var card = hand[i];
      if (card.type === 'lion') {
        moves.push({ cardId: card.id, card: card });
      } else if (card.type === 'damaged') {
        moves.push({
          cardId: card.id,
          card: card,
          declaredSuits: [card.topSuit, card.bottomSuit]
        });
      } else if (card.type === 'combat') {
        if (leadSuit === null || !hasLeadCombat || card.suit === leadSuit) {
          moves.push({ cardId: card.id, card: card });
        }
      }
    }
    return moves;
  }

  /**
   * Retorna null se a carta pode ser jogada agora, ou uma mensagem PT-BR explicando a restrição.
   */
  function getCardPlayRestriction(state, playerIdx, cardId) {
    if (state.phase !== 'PLAYING_BATTLE') {
      return 'Aguarde a resolução da etapa atual.';
    }
    if (state.currentPlayerIdx !== playerIdx) {
      return 'Não é o turno deste jogador.';
    }
    var player = state.players[playerIdx];
    var card = player.hand.find(function (c) {
      return c.id === cardId;
    });
    if (!card) return 'Carta não encontrada na mão.';

    if (card.type === 'lion' || card.type === 'damaged') return null;
    if (state.leadSuit === null) return null;

    var hasLeadCombat = player.hand.some(function (c) {
      return c.type === 'combat' && c.suit === state.leadSuit;
    });
    if (!hasLeadCombat || card.suit === state.leadSuit) return null;

    var leadName = C().SUIT_META[state.leadSuit].name;
    return (
      'Você possui cartas de combate de ' +
      leadName +
      ' e deve seguir o naipe líder (ou jogar Leão / Arma Danificada).'
    );
  }

  function isMoveLegal(state, playerIdx, cardId, declaredSuit) {
    var moves = getLegalMoves(state, playerIdx);
    for (var i = 0; i < moves.length; i++) {
      if (moves[i].cardId === cardId) {
        if (moves[i].card.type === 'damaged') {
          return declaredSuit === moves[i].card.topSuit || declaredSuit === moves[i].card.bottomSuit;
        }
        return true;
      }
    }
    return false;
  }

  /**
   * Calcula força efetiva considerando a regra oficial:
   * quando 1 e 10 do mesmo naipe estão na mesma batalha, 1 torna-se a mais alta.
   */
  function getCombatEffectiveValue(value, hasOneAndTen) {
    if (hasOneAndTen && value === 1) return 10.5;
    return value;
  }

  /**
   * Executa Etapa 2 (vencedor), Etapa 3 (efeitos das armas danificadas em ordem de jogada)
   * e prepara Etapa 4 (coleta pelo vencedor).
   */
  function resolveBattleSteps2And3(state) {
    var arena = state.arena;
    var leadSuit = state.leadSuit;

    // Etapa 2: Determinar o vencedor da batalha
    var winnerPlay = null;
    var winReason = 'highest_lead';

    var lions = arena.filter(function (p) {
      return p.card.type === 'lion';
    });

    if (lions.length > 0) {
      winnerPlay = lions[lions.length - 1];
      winReason = lions.length > 1 ? 'last_lion' : 'lion';
    } else {
      var leadCombats = arena.filter(function (p) {
        return p.card.type === 'combat' && p.card.suit === leadSuit;
      });
      if (leadCombats.length > 0) {
        var has1 = leadCombats.some(function (p) { return p.card.value === 1; });
        var has10 = leadCombats.some(function (p) { return p.card.value === 10; });
        var hasOneAndTen = has1 && has10;

        winnerPlay = leadCombats[0];
        var bestStrength = getCombatEffectiveValue(winnerPlay.card.value, hasOneAndTen);
        for (var i = 1; i < leadCombats.length; i++) {
          var s = getCombatEffectiveValue(leadCombats[i].card.value, hasOneAndTen);
          if (s > bestStrength) {
            bestStrength = s;
            winnerPlay = leadCombats[i];
          }
        }
        winReason = hasOneAndTen && winnerPlay.card.value === 1 ? 'one_beats_ten' : 'highest_lead';
      } else {
        // Nenhuma carta de leão nem combate do naipe líder -> vence a última Arma Danificada do naipe líder
        var damagedLead = arena.filter(function (p) {
          return p.card.type === 'damaged' && p.declaredSuit === leadSuit;
        });
        winnerPlay = damagedLead[damagedLead.length - 1];
        winReason = 'damaged_lead';
      }
    }

    var winnerIdx = winnerPlay.playerIdx;

    // Etapa 3: Aplicar efeitos das cartas de Arma Danificada na ordem exata em que foram jogadas
    var eliminatedPlayOrders = {};
    var eliminations = [];

    for (var j = 0; j < arena.length; j++) {
      var play = arena[j];
      if (play.card.type !== 'damaged') continue;

      var targetSuit = play.declaredSuit;
      var arenaCandidates = arena.filter(function (aPlay) {
        return (
          aPlay.card.type === 'combat' &&
          aPlay.card.suit === targetSuit &&
          !eliminatedPlayOrders[aPlay.playOrder]
        );
      });

      if (arenaCandidates.length > 0) {
        var suitHas1 = arenaCandidates.some(function (c) { return c.card.value === 1; });
        var suitHas10 = arenaCandidates.some(function (c) { return c.card.value === 10; });
        var suitHasPair = suitHas1 && suitHas10;

        var targetPlay = arenaCandidates[0];
        var lowestStrength = getCombatEffectiveValue(targetPlay.card.value, suitHasPair);
        for (var k = 1; k < arenaCandidates.length; k++) {
          var candStrength = getCombatEffectiveValue(arenaCandidates[k].card.value, suitHasPair);
          if (candStrength < lowestStrength) {
            lowestStrength = candStrength;
            targetPlay = arenaCandidates[k];
          }
        }

        eliminatedPlayOrders[targetPlay.playOrder] = true;
        state.discardPile.push(targetPlay.card);
        eliminations.push({
          byPlayerIdx: play.playerIdx,
          weaponPlayOrder: play.playOrder,
          damagedCardId: play.card.id,
          suit: targetSuit,
          source: 'arena',
          fromPlayerIdx: targetPlay.playerIdx,
          targetPlayOrder: targetPlay.playOrder,
          eliminatedCard: targetPlay.card,
          selfHarm: false
        });
      } else {
        var winnerAreaCards = state.players[winnerIdx].playArea[targetSuit];
        if (winnerAreaCards.length > 0) {
          // Área de jogo guarda cartas de combate fora da batalha: eliminar menor valor numérico
          var minIdx = 0;
          for (var w = 1; w < winnerAreaCards.length; w++) {
            if (winnerAreaCards[w].value < winnerAreaCards[minIdx].value) {
              minIdx = w;
            }
          }
          var removedCard = winnerAreaCards.splice(minIdx, 1)[0];
          state.discardPile.push(removedCard);
          eliminations.push({
            byPlayerIdx: play.playerIdx,
            weaponPlayOrder: play.playOrder,
            damagedCardId: play.card.id,
            suit: targetSuit,
            source: 'playArea',
            fromPlayerIdx: winnerIdx,
            targetPlayOrder: null,
            eliminatedCard: removedCard,
            selfHarm: play.playerIdx === winnerIdx
          });
        } else {
          eliminations.push({
            byPlayerIdx: play.playerIdx,
            weaponPlayOrder: play.playOrder,
            damagedCardId: play.card.id,
            suit: targetSuit,
            source: 'none',
            fromPlayerIdx: null,
            targetPlayOrder: null,
            eliminatedCard: null,
            selfHarm: false
          });
        }
      }
    }

    // Etapa 4: Preparar coleta das cartas sobreviventes
    var survivingCombat = arena.filter(function (aPlay) {
      return aPlay.card.type === 'combat' && !eliminatedPlayOrders[aPlay.playOrder];
    });
    var leadCards =
      leadSuit !== null
        ? survivingCombat.filter(function (aPlay) { return aPlay.card.suit === leadSuit; })
        : [];
    var offSuitCards =
      leadSuit !== null
        ? survivingCombat.filter(function (aPlay) { return aPlay.card.suit !== leadSuit; })
        : survivingCombat.slice();

    var chosenOffsuitPlayOrder = null;
    if (offSuitCards.length === 1) {
      chosenOffsuitPlayOrder = offSuitCards[0].playOrder;
    }

    state.pendingResolution = {
      winnerIdx: winnerIdx,
      winnerPlayOrder: winnerPlay.playOrder,
      winReason: winReason,
      eliminatedPlayOrders: Object.keys(eliminatedPlayOrders).map(Number),
      eliminations: eliminations,
      leadCards: leadCards,
      offSuitCards: offSuitCards,
      chosenOffsuitPlayOrder: chosenOffsuitPlayOrder
    };

    if (offSuitCards.length >= 2) {
      state.phase = 'CHOOSE_OFFSUIT_CARD';
      state.currentPlayerIdx = winnerIdx;
    } else {
      state.phase = 'BATTLE_RESOLVED';
    }
  }

  /**
   * Joga uma carta da mão de `playerIdx` na arena.
   */
  function playCard(state, playerIdx, cardId, declaredSuit) {
    if (state.phase !== 'PLAYING_BATTLE') {
      throw new Error('Não é possível jogar carta fora da fase PLAYING_BATTLE (atual: ' + state.phase + ').');
    }
    if (state.currentPlayerIdx !== playerIdx) {
      throw new Error('Não é o turno do jogador ' + playerIdx + '.');
    }
    if (!isMoveLegal(state, playerIdx, cardId, declaredSuit || null)) {
      throw new Error('Jogada ilegal: ' + cardId + ' (' + declaredSuit + ') para jogador ' + playerIdx + '.');
    }

    var hand = state.players[playerIdx].hand;
    var cardIdx = -1;
    for (var i = 0; i < hand.length; i++) {
      if (hand[i].id === cardId) {
        cardIdx = i;
        break;
      }
    }
    var card = hand.splice(cardIdx, 1)[0];
    var finalDeclaredSuit = card.type === 'damaged' ? declaredSuit : null;

    state.arena.push({
      playerIdx: playerIdx,
      card: card,
      declaredSuit: finalDeclaredSuit,
      playOrder: state.arena.length
    });

    if (state.leadSuit === null) {
      if (card.type === 'combat') {
        state.leadSuit = card.suit;
      } else if (card.type === 'damaged') {
        state.leadSuit = finalDeclaredSuit;
      }
    }

    if (state.arena.length < state.numPlayers) {
      state.currentPlayerIdx = (state.currentPlayerIdx + 1) % state.numPlayers;
    } else {
      resolveBattleSteps2And3(state);
    }

    return state;
  }

  /**
   * Escolhe a 1 carta extra de naipe diferente do naipe líder na Etapa 4 (quando há 2+ disponíveis).
   */
  function chooseOffsuitCard(state, playerIdx, cardId) {
    if (state.phase !== 'CHOOSE_OFFSUIT_CARD' || !state.pendingResolution) {
      throw new Error('Estado inválido para escolha de carta extra.');
    }
    if (state.pendingResolution.winnerIdx !== playerIdx) {
      throw new Error('Apenas o vencedor da batalha pode escolher a carta extra.');
    }
    var match = state.pendingResolution.offSuitCards.find(function (p) {
      return p.card.id === cardId;
    });
    if (!match) {
      throw new Error('Carta ' + cardId + ' não está disponível para coleta extra.');
    }
    state.pendingResolution.chosenOffsuitPlayOrder = match.playOrder;
    state.phase = 'BATTLE_RESOLVED';
    return state;
  }

  /**
   * Pontua o final da rodada atual para o Lado A ou Lado B.
   */
  function scoreRound(state) {
    var suits = C().SUITS;
    var players = state.players;
    var numPlayers = state.numPlayers;

    if (state.boardSide === 'A') {
      var suitBreakdowns = [];

      for (var s = 0; s < suits.length; s++) {
        var suit = suits[s];
        var counts = players.map(function (p) { return p.playArea[suit].length; });
        var maxCount = Math.max.apply(null, counts);
        var entries = [];

        for (var i = 0; i < numPlayers; i++) {
          var count = counts[i];
          var delta = 0;
          if (maxCount > 0) {
            if (count === maxCount) {
              delta = 1;
            } else if (count === 0) {
              delta = 0;
            } else {
              var diff = maxCount - count;
              delta = diff >= 4 ? -2 : -1;
            }
          }
          var before = players[i].tracksA[suit];
          var after = Math.max(0, Math.min(10, before + delta));
          players[i].tracksA[suit] = after;
          entries.push({
            playerIdx: i,
            count: count,
            before: before,
            delta: delta,
            after: after
          });
        }

        suitBreakdowns.push({
          suit: suit,
          maxCount: maxCount,
          entries: entries
        });
      }

      return {
        round: state.round,
        boardSide: 'A',
        suitBreakdowns: suitBreakdowns,
        triggersGameOver: state.round >= state.totalRounds
      };
    }

    // Lado B: avaliar primeiro jogadores com cartas (Casos A, B, C), depois jogadores sem cartas (Caso D)
    var playerEntries = [];
    var nonEmptyDeltas = [];

    for (var pIdx = 0; pIdx < numPlayers; pIdx++) {
      var area = players[pIdx].playArea;
      var suitCounts = {};
      var present = [];

      for (var k = 0; k < suits.length; k++) {
        var st = suits[k];
        var cnt = area[st].length;
        suitCounts[st] = cnt;
        if (cnt > 0) {
          present.push({ suit: st, count: cnt });
        }
      }

      if (present.length === 0) {
        playerEntries.push({
          playerIdx: pIdx,
          suitCounts: suitCounts,
          ruleCase: 'D',
          bestSuits: [],
          worstSuits: [],
          delta: null
        });
      } else if (present.length === 1) {
        var dC = present[0].count;
        nonEmptyDeltas.push(dC);
        playerEntries.push({
          playerIdx: pIdx,
          suitCounts: suitCounts,
          ruleCase: 'C',
          bestSuits: [present[0].suit],
          worstSuits: [],
          delta: dC
        });
      } else {
        var countsArr = present.map(function (x) { return x.count; });
        var maxV = Math.max.apply(null, countsArr);
        var minV = Math.min.apply(null, countsArr);

        if (maxV === minV) {
          var dB = countsArr.reduce(function (a, b) { return a + b; }, 0);
          nonEmptyDeltas.push(dB);
          playerEntries.push({
            playerIdx: pIdx,
            suitCounts: suitCounts,
            ruleCase: 'B',
            bestSuits: present.map(function (x) { return x.suit; }),
            worstSuits: [],
            delta: dB
          });
        } else {
          var best = present.filter(function (x) { return x.count === maxV; });
          var worst = present.filter(function (x) { return x.count === minV; });
          var bestSum = best.reduce(function (a, x) { return a + x.count; }, 0);
          var worstSum = worst.reduce(function (a, x) { return a + x.count; }, 0);
          var dA = bestSum - worstSum;
          nonEmptyDeltas.push(dA);
          playerEntries.push({
            playerIdx: pIdx,
            suitCounts: suitCounts,
            ruleCase: 'A',
            bestSuits: best.map(function (x) { return x.suit; }),
            worstSuits: worst.map(function (x) { return x.suit; }),
            delta: dA
          });
        }
      }
    }

    var highestRoundDelta = nonEmptyDeltas.length > 0 ? Math.max.apply(null, nonEmptyDeltas) : 0;

    for (var m = 0; m < playerEntries.length; m++) {
      var entry = playerEntries[m];
      if (entry.ruleCase === 'D') {
        entry.delta = highestRoundDelta;
      }
      var player = players[entry.playerIdx];
      var beforeB = player.trackB;
      var afterB = Math.max(1, beforeB + entry.delta);
      player.trackB = afterB;
      player.lastRoundDelta = entry.delta;
      entry.before = beforeB;
      entry.after = afterB;
    }

    var targetReached = players.some(function (p) { return p.trackB >= state.sideBTarget; });
    var triggersGameOver = targetReached || state.round >= state.totalRounds;

    return {
      round: state.round,
      boardSide: 'B',
      playerEntries: playerEntries,
      targetReached: targetReached,
      triggersGameOver: triggersGameOver
    };
  }

  /**
   * Calcula a classificação final da partida (incluindo ranking denso do Lado A e desempates).
   */
  function computeFinalStandings(state) {
    var numPlayers = state.numPlayers;
    var suits = C().SUITS;

    if (state.boardSide === 'A') {
      var pointSlots = numPlayers === 3 ? [5, 3, 2] : [5, 3, 2, 1];
      var perPlayer = state.players.map(function (p) {
        return {
          playerIdx: p.index,
          name: p.name,
          color: p.color,
          totalPoints: 0,
          trackResults: {}
        };
      });

      for (var s = 0; s < suits.length; s++) {
        var suit = suits[s];
        var positions = state.players.map(function (p) { return p.tracksA[suit]; });
        var uniqueDesc = [];
        for (var i = 0; i < positions.length; i++) {
          if (uniqueDesc.indexOf(positions[i]) === -1) {
            uniqueDesc.push(positions[i]);
          }
        }
        uniqueDesc.sort(function (a, b) { return b - a; });

        for (var pIdx = 0; pIdx < numPlayers; pIdx++) {
          var pos = positions[pIdx];
          var denseRank = uniqueDesc.indexOf(pos);
          var pts = pointSlots[denseRank] !== undefined ? pointSlots[denseRank] : 0;
          perPlayer[pIdx].trackResults[suit] = {
            position: pos,
            denseRank: denseRank,
            points: pts
          };
          perPlayer[pIdx].totalPoints += pts;
        }
      }

      // Contagem pairwise de trilhas à frente entre empatados por pontuação
      var rows = perPlayer.map(function (item) {
        var aheadCount = 0;
        var behindCount = 0;
        var tiedPeers = perPlayer.filter(function (other) {
          return other.playerIdx !== item.playerIdx && other.totalPoints === item.totalPoints;
        });
        for (var t = 0; t < tiedPeers.length; t++) {
          var peer = tiedPeers[t];
          for (var s2 = 0; s2 < suits.length; s2++) {
            var st = suits[s2];
            if (item.trackResults[st].position > peer.trackResults[st].position) aheadCount++;
            else if (item.trackResults[st].position < peer.trackResults[st].position) behindCount++;
          }
        }
        item.tiebreakNetTracks = aheadCount - behindCount;
        item.tiebreakTracksAhead = aheadCount;
        item.tiebreakTracksBehind = behindCount;
        return item;
      });

      rows.sort(function (a, b) {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.tiebreakNetTracks !== a.tiebreakNetTracks) return b.tiebreakNetTracks - a.tiebreakNetTracks;
        return a.playerIdx - b.playerIdx;
      });

      var topPts = rows[0].totalPoints;
      var topNet = rows[0].tiebreakNetTracks;
      var topGroup = rows.filter(function (r) { return r.totalPoints === topPts; });
      var winners = rows.filter(function (r) {
        return r.totalPoints === topPts && r.tiebreakNetTracks === topNet;
      });

      var sharedVictory = winners.length > 1;
      var tiebreakApplied = !sharedVictory && topGroup.length > 1;

      // Atribuir colocação final (1º, 2º...) respeitando empates reais
      var place = 1;
      for (var rIdx = 0; rIdx < rows.length; rIdx++) {
        if (rIdx > 0) {
          var prev = rows[rIdx - 1];
          var cur = rows[rIdx];
          if (cur.totalPoints !== prev.totalPoints || cur.tiebreakNetTracks !== prev.tiebreakNetTracks) {
            place = rIdx + 1;
          }
        }
        rows[rIdx].rank = place;
      }

      return {
        boardSide: 'A',
        rows: rows,
        winners: winners.map(function (w) { return w.playerIdx; }),
        sharedVictory: sharedVictory,
        tiebreakApplied: tiebreakApplied
      };
    }

    // Lado B
    var rowsB = state.players.map(function (p) {
      return {
        playerIdx: p.index,
        name: p.name,
        color: p.color,
        totalPoints: p.trackB,
        lastRoundDelta: p.lastRoundDelta
      };
    });

    rowsB.sort(function (a, b) {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.lastRoundDelta !== a.lastRoundDelta) return b.lastRoundDelta - a.lastRoundDelta;
      return a.playerIdx - b.playerIdx;
    });

    var bestPtsB = rowsB[0].totalPoints;
    var bestDeltaB = rowsB[0].lastRoundDelta;
    var tiedOnPtsB = rowsB.filter(function (r) { return r.totalPoints === bestPtsB; });
    var winnersB = rowsB.filter(function (r) {
      return r.totalPoints === bestPtsB && r.lastRoundDelta === bestDeltaB;
    });

    var sharedVictoryB = winnersB.length > 1;
    var tiebreakAppliedB = !sharedVictoryB && tiedOnPtsB.length > 1;

    var placeB = 1;
    for (var rb = 0; rb < rowsB.length; rb++) {
      if (rb > 0) {
        var pr = rowsB[rb - 1];
        var cu = rowsB[rb];
        if (cu.totalPoints !== pr.totalPoints || cu.lastRoundDelta !== pr.lastRoundDelta) {
          placeB = rb + 1;
        }
      }
      rowsB[rb].rank = placeB;
    }

    return {
      boardSide: 'B',
      rows: rowsB,
      winners: winnersB.map(function (w) { return w.playerIdx; }),
      sharedVictory: sharedVictoryB,
      tiebreakApplied: tiebreakAppliedB
    };
  }

  /**
   * Conclui a Etapa 4 (coleta para área de jogo / envio ao descarte), verifica fim de rodada
   * e avança o estado.
   */
  function finalizeBattle(state) {
    if (state.phase !== 'BATTLE_RESOLVED' || !state.pendingResolution) {
      throw new Error('Batalha não está pronta para finalização (fase atual: ' + state.phase + ').');
    }

    var res = state.pendingResolution;
    var winnerIdx = res.winnerIdx;
    var winnerArea = state.players[winnerIdx].playArea;
    var eliminatedSet = {};
    for (var e = 0; e < res.eliminatedPlayOrders.length; e++) {
      eliminatedSet[res.eliminatedPlayOrders[e]] = true;
    }

    var collectedCards = [];
    var discardedCards = [];

    for (var i = 0; i < state.arena.length; i++) {
      var play = state.arena[i];
      if (eliminatedSet[play.playOrder]) {
        // Já foi adicionada a state.discardPile na Etapa 3
        continue;
      }
      if (play.card.type === 'combat') {
        var isLead = state.leadSuit !== null && play.card.suit === state.leadSuit;
        var isChosenOffsuit =
          res.chosenOffsuitPlayOrder !== null && play.playOrder === res.chosenOffsuitPlayOrder;
        if (isLead || isChosenOffsuit) {
          winnerArea[play.card.suit].push(play.card);
          winnerArea[play.card.suit].sort(function (a, b) { return a.value - b.value; });
          collectedCards.push(play.card);
        } else {
          state.discardPile.push(play.card);
          discardedCards.push(play.card);
        }
      } else {
        state.discardPile.push(play.card);
        discardedCards.push(play.card);
      }
    }

    state.battleHistory.push({
      round: state.round,
      battleNumber: state.battleNumber,
      leaderIdx: state.leaderIdx,
      leadSuit: state.leadSuit,
      winnerIdx: winnerIdx,
      winReason: res.winReason,
      plays: state.arena.map(function (p) {
        return {
          playerIdx: p.playerIdx,
          card: p.card,
          declaredSuit: p.declaredSuit
        };
      }),
      eliminations: res.eliminations.slice(),
      collectedCards: collectedCards,
      discardedCards: discardedCards
    });

    state.arena = [];
    state.leadSuit = null;
    state.pendingResolution = null;

    var isEndOfRound = state.players.every(function (p) {
      return p.hand.length === 1;
    });

    if (!isEndOfRound) {
      state.leaderIdx = winnerIdx;
      state.currentPlayerIdx = winnerIdx;
      state.battleNumber += 1;
      state.phase = 'PLAYING_BATTLE';
      return state;
    }

    // Fim de rodada: todos descartam a última carta da mão para a pilha de descarte
    var discardedLast = [];
    for (var p = 0; p < state.numPlayers; p++) {
      var lastCard = state.players[p].hand.pop();
      if (lastCard) {
        state.discardPile.push(lastCard);
        discardedLast.push({ playerIdx: p, card: lastCard });
      }
    }
    state.lastDiscardedCards = discardedLast;

    var summary = scoreRound(state);
    state.lastRoundSummary = summary;
    state.roundHistory.push(summary);

    if (summary.triggersGameOver) {
      state.finalStandings = computeFinalStandings(state);
    }
    state.phase = 'ROUND_SUMMARY';
    return state;
  }

  /**
   * Avança após a tela de resumo da rodada: ou finaliza o jogo ou embaralha e inicia a próxima rodada.
   */
  function proceedAfterRoundSummary(state, rngOverride) {
    if (state.phase !== 'ROUND_SUMMARY' || !state.lastRoundSummary) {
      throw new Error('Estado inválido para avançar após resumo da rodada.');
    }
    if (state.lastRoundSummary.triggersGameOver) {
      if (!state.finalStandings) {
        state.finalStandings = computeFinalStandings(state);
      }
      state.phase = 'GAME_OVER';
      return state;
    }

    // Passa carta de primeiro jogador para a esquerda (sentido horário: índice + 1)
    state.firstPlayerIdx = (state.firstPlayerIdx + 1) % state.numPlayers;
    state.round += 1;
    state.battleNumber = 1;
    state.leaderIdx = state.firstPlayerIdx;
    state.currentPlayerIdx = state.firstPlayerIdx;

    // Recolhe todas as cartas em jogo (áreas de jogo + descarte + 2 cartas fora da rodada)
    var suits = C().SUITS;
    var pool = [];
    for (var i = 0; i < state.numPlayers; i++) {
      for (var s = 0; s < suits.length; s++) {
        var areaArr = state.players[i].playArea[suits[s]];
        for (var c = 0; c < areaArr.length; c++) {
          pool.push(areaArr[c]);
        }
      }
      if (state.players[i].hand.length > 0) {
        pool = pool.concat(state.players[i].hand);
      }
    }
    pool = pool.concat(state.discardPile, state.unusedCards);

    dealCardsIntoState(state, pool, rngOverride || state._rng);
    state.lastRoundSummary = null;
    state.phase = 'PLAYING_BATTLE';
    return state;
  }

  /**
   * Utilitário para verificar invariante de conservação de cartas em testes e depuração.
   */
  function countAllCardsInState(state) {
    var seen = {};
    var total = 0;
    var suits = C().SUITS;

    function addCard(card) {
      total++;
      seen[card.id] = (seen[card.id] || 0) + 1;
    }

    for (var i = 0; i < state.numPlayers; i++) {
      var p = state.players[i];
      p.hand.forEach(addCard);
      for (var s = 0; s < suits.length; s++) {
        p.playArea[suits[s]].forEach(addCard);
      }
    }
    state.arena.forEach(function (a) { addCard(a.card); });
    state.discardPile.forEach(addCard);
    state.unusedCards.forEach(addCard);

    var expectedTotal = state.numPlayers === 3 ? 41 : 50;
    var duplicates = Object.keys(seen).filter(function (id) { return seen[id] !== 1; });

    return {
      total: total,
      expectedTotal: expectedTotal,
      uniqueCount: Object.keys(seen).length,
      duplicates: duplicates,
      valid: total === expectedTotal && Object.keys(seen).length === expectedTotal && duplicates.length === 0
    };
  }

  Gladiadores.Engine = {
    makeEmptyPlayArea: makeEmptyPlayArea,
    buildDeckForPlayers: buildDeckForPlayers,
    createGame: createGame,
    cloneState: cloneState,
    getHandCount: getHandCount,
    getPlayAreaCount: getPlayAreaCount,
    getTotalPlayAreaCount: getTotalPlayAreaCount,
    getLegalMoves: getLegalMoves,
    getCardPlayRestriction: getCardPlayRestriction,
    isMoveLegal: isMoveLegal,
    getCombatEffectiveValue: getCombatEffectiveValue,
    resolveBattleSteps2And3: resolveBattleSteps2And3,
    playCard: playCard,
    chooseOffsuitCard: chooseOffsuitCard,
    finalizeBattle: finalizeBattle,
    scoreRound: scoreRound,
    proceedAfterRoundSummary: proceedAfterRoundSummary,
    computeFinalStandings: computeFinalStandings,
    countAllCardsInState: countAllCardsInState,
    cardSortComparator: cardSortComparator
  };
})(window);

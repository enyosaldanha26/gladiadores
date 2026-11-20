(function (global) {
  'use strict';

  var Gladiadores = (global.Gladiadores = global.Gladiadores || {});

  function C() {
    return Gladiadores.CONSTANTS;
  }

  function E() {
    return Gladiadores.Engine;
  }

  function getPlayAreaCountsArray(player) {
    var suits = C().SUITS;
    var counts = {};
    for (var i = 0; i < suits.length; i++) {
      counts[suits[i]] = player.playArea[suits[i]].length;
    }
    return counts;
  }

  function calcSideBPlayerDelta(counts, players) {
    var suits = C().SUITS;
    var present = [];
    for (var i = 0; i < suits.length; i++) {
      var st = suits[i];
      if (counts[st] > 0) present.push({ suit: st, count: counts[st] });
    }
    if (present.length === 0) {
      // Estimar melhor pontuação atual entre adversários para Caso D
      var bestOpp = 0;
      if (players) {
        for (var p = 0; p < players.length; p++) {
          var oc = getPlayAreaCountsArray(players[p]);
          var op = [];
          for (var s = 0; s < suits.length; s++) {
            if (oc[suits[s]] > 0) op.push(oc[suits[s]]);
          }
          if (op.length === 1) bestOpp = Math.max(bestOpp, op[0]);
          else if (op.length >= 2) {
            var mx = Math.max.apply(null, op);
            var mn = Math.min.apply(null, op);
            if (mx === mn) bestOpp = Math.max(bestOpp, op.reduce(function (a, b) { return a + b; }, 0));
            else {
              var bSum = op.filter(function (v) { return v === mx; }).reduce(function (a, b) { return a + b; }, 0);
              var wSum = op.filter(function (v) { return v === mn; }).reduce(function (a, b) { return a + b; }, 0);
              bestOpp = Math.max(bestOpp, bSum - wSum);
            }
          }
        }
      }
      return bestOpp;
    }
    if (present.length === 1) return present[0].count;
    var vals = present.map(function (x) { return x.count; });
    var maxV = Math.max.apply(null, vals);
    var minV = Math.min.apply(null, vals);
    if (maxV === minV) {
      return vals.reduce(function (a, b) { return a + b; }, 0);
    }
    var bestSum = vals.filter(function (v) { return v === maxV; }).reduce(function (a, b) { return a + b; }, 0);
    var worstSum = vals.filter(function (v) { return v === minV; }).reduce(function (a, b) { return a + b; }, 0);
    return bestSum - worstSum;
  }

  /**
   * Avalia o valor estratégico da área de jogo de `playerIdx` dadas contagens hipotéticas por naipe.
   */
  function evaluatePlayAreaValue(state, playerIdx, hypotheticalCounts, overridePlayers) {
    var suits = C().SUITS;
    var players = overridePlayers || state.players;
    var me = players[playerIdx];
    var counts = hypotheticalCounts || getPlayAreaCountsArray(me);

    if (state.boardSide === 'A') {
      var scoreA = 0;
      var roundProgress = state.round / state.totalRounds;

      for (var s = 0; s < suits.length; s++) {
        var suit = suits[s];
        var myCount = counts[suit];
        var maxAll = myCount;
        var maxOther = 0;
        for (var p = 0; p < players.length; p++) {
          if (p === playerIdx) continue;
          var oc = players[p].playArea[suit].length;
          if (oc > maxOther) maxOther = oc;
          if (oc > maxAll) maxAll = oc;
        }

        var delta = 0;
        if (maxAll > 0) {
          if (myCount === maxAll) delta = 1;
          else if (myCount === 0) delta = 0;
          else delta = maxAll - myCount >= 4 ? -2 : -1;
        }

        // Peso da trilha baseado na competição atual no tabuleiro
        var myTrackPos = me.tracksA[suit];
        var weight = 10 + roundProgress * 4;
        if (myTrackPos === 0 && delta < 0) weight *= 0.25;
        if (myTrackPos === 10 && delta > 0) weight *= 0.3;

        scoreA += delta * weight;

        // Pequeno bônus por folga na liderança e penalidade suave ao ficar vulnerável a diferença >= 4
        if (myCount > 0 && myCount >= maxOther) {
          scoreA += Math.min(2, myCount - maxOther) * 0.8;
        } else if (myCount > 0 && maxOther - myCount >= 3) {
          scoreA -= 1.2;
        }
      }
      return scoreA;
    }

    // Lado B
    var deltaB = calcSideBPlayerDelta(counts, players);
    var totalCards = 0;
    var nonZeroCount = 0;
    for (var k = 0; k < suits.length; k++) {
      if (counts[suits[k]] > 0) {
        totalCards += counts[suits[k]];
        nonZeroCount++;
      }
    }

    // Se vencer no final de jogo está próximo, valorizar cruzar o alvo
    var projectedPos = Math.max(1, me.trackB + deltaB);
    var winBonus = projectedPos >= state.sideBTarget ? 18 : 0;

    // Pequeno incentivo estrutural: concentrar 1-2 naipes ou manter equilíbrio uniforme
    var shapeBonus = 0;
    if (nonZeroCount === 1 && totalCards >= 2) shapeBonus += 1.2;
    else if (nonZeroCount >= 3 && deltaB < totalCards * 0.4) shapeBonus -= 0.8;

    return deltaB * 4.5 + winBonus + shapeBonus;
  }

  function simulatePlayOutcomeValue(state, playerIdx, cardId, declaredSuit) {
    var sim = E().cloneState(state);
    var baseMyValue = evaluatePlayAreaValue(sim, playerIdx);
    var baseOppSum = 0;
    for (var i = 0; i < sim.numPlayers; i++) {
      if (i !== playerIdx) baseOppSum += evaluatePlayAreaValue(sim, i);
    }

    E().playCard(sim, playerIdx, cardId, declaredSuit);

    // Se faltam outros jogadores na mesma batalha, esta função não é usada diretamente para finalização
    if (sim.phase === 'CHOOSE_OFFSUIT_CARD') {
      var winnerIdx = sim.pendingResolution.winnerIdx;
      var bestChoice = pickBestOffsuitInternal(sim, winnerIdx);
      E().chooseOffsuitCard(sim, winnerIdx, bestChoice);
    }

    if (sim.phase === 'BATTLE_RESOLVED') {
      // Aplicar coleta hipotética sem encerrar a rodada completa
      var res = sim.pendingResolution;
      var wArea = sim.players[res.winnerIdx].playArea;
      var elimSet = {};
      res.eliminatedPlayOrders.forEach(function (po) { elimSet[po] = true; });
      sim.arena.forEach(function (pl) {
        if (elimSet[pl.playOrder] || pl.card.type !== 'combat') return;
        var isLead = sim.leadSuit !== null && pl.card.suit === sim.leadSuit;
        var isOff = res.chosenOffsuitPlayOrder !== null && pl.playOrder === res.chosenOffsuitPlayOrder;
        if (isLead || isOff) wArea[pl.card.suit].push(pl.card);
      });
    }

    var afterMyValue = evaluatePlayAreaValue(sim, playerIdx, null, sim.players);
    var afterOppSum = 0;
    for (var j = 0; j < sim.numPlayers; j++) {
      if (j !== playerIdx) afterOppSum += evaluatePlayAreaValue(sim, j, null, sim.players);
    }

    var myGain = afterMyValue - baseMyValue;
    var oppGain = afterOppSum - baseOppSum;
    return myGain - oppGain * 0.42;
  }

  function pickBestOffsuitInternal(state, playerIdx) {
    var offSuits = state.pendingResolution.offSuitCards;
    var bestCard = offSuits[0].card;
    var bestScore = -Infinity;
    var baseCounts = getPlayAreaCountsArray(state.players[playerIdx]);

    for (var i = 0; i < offSuits.length; i++) {
      var card = offSuits[i].card;
      var nextCounts = Object.assign({}, baseCounts);
      nextCounts[card.suit] = (nextCounts[card.suit] || 0) + 1;
      var score = evaluatePlayAreaValue(state, playerIdx, nextCounts);
      if (score > bestScore) {
        bestScore = score;
        bestCard = card;
      }
    }
    return bestCard.id;
  }

  function estimateHeuristicMoveScore(state, playerIdx, card, declaredSuit) {
    var me = state.players[playerIdx];
    var handLen = me.hand.length;
    var arena = state.arena;
    var leadSuit = state.leadSuit;
    var myCounts = getPlayAreaCountsArray(me);
    var isLeading = arena.length === 0;

    // Custo de oportunidade de gastar cartas fortes cedo
    var cardSpendCost = 0;
    if (card.type === 'lion') {
      cardSpendCost = handLen > 4 ? 3.8 : 1.5;
    } else if (card.type === 'damaged') {
      cardSpendCost = handLen > 5 ? 1.6 : 0.8;
    } else {
      cardSpendCost = card.value * 0.14;
    }

    if (card.type === 'lion') {
      // Leão ganha a batalha atual a menos que alguém jogue outro leão depois
      var potSuit = leadSuit;
      var arenaCombatLeadCount = arena.filter(function (a) {
        return a.card.type === 'combat' && (potSuit === null || a.card.suit === potSuit);
      }).length;
      var lionReward = 2.5 + arenaCombatLeadCount * 2.2;
      if (potSuit && state.boardSide === 'A') {
        var nextC = Object.assign({}, myCounts);
        nextC[potSuit] += 1 + arenaCombatLeadCount;
        lionReward += (evaluatePlayAreaValue(state, playerIdx, nextC) - evaluatePlayAreaValue(state, playerIdx)) * 0.7;
      }
      return lionReward - cardSpendCost;
    }

    if (card.type === 'damaged') {
      var targetSuit = declaredSuit;
      var arenaTargets = arena.filter(function (a) {
        return a.card.type === 'combat' && a.card.suit === targetSuit;
      });

      var dmgScore = 0;
      if (arenaTargets.length > 0) {
        // Elimina uma carta na arena: bom se o líder ou carta alta adversária for afetada ou reduz competição
        dmgScore += 3.2;
        if (targetSuit === leadSuit && !isLeading) dmgScore += 1.4;
      } else {
        // Sem cartas na arena agora: pode atingir alguém depois ou área de jogo do vencedor
        var maxWinnerAreaCards = 0;
        for (var p = 0; p < state.numPlayers; p++) {
          maxWinnerAreaCards = Math.max(maxWinnerAreaCards, state.players[p].playArea[targetSuit].length);
        }
        dmgScore += maxWinnerAreaCards > 0 ? 1.5 : -0.6;
        // Cuidado para não liderar com Arma Danificada e punir a própria área de jogo
        if (isLeading && myCounts[targetSuit] > 0) {
          var afterSelf = Object.assign({}, myCounts);
          afterSelf[targetSuit] -= 1;
          var diffSelf = evaluatePlayAreaValue(state, playerIdx, afterSelf) - evaluatePlayAreaValue(state, playerIdx);
          dmgScore += diffSelf * 0.8;
        }
      }
      return dmgScore - cardSpendCost;
    }

    // Carta de combate
    var suit = card.suit;
    var isFollowingLead = leadSuit === null || suit === leadSuit;
    var nextMyCounts = Object.assign({}, myCounts);
    nextMyCounts[suit] += 1;
    var wantThisSuitDelta =
      evaluatePlayAreaValue(state, playerIdx, nextMyCounts) - evaluatePlayAreaValue(state, playerIdx);

    if (!isFollowingLead) {
      // Jogando fora do naipe líder (descarte ou pode ser escolhida pelo vencedor)
      if (state.boardSide === 'B' && wantThisSuitDelta < 0) {
        // Forçar carta ruim para o vencedor no Lado B se ele tiver menos cartas dela
        return 1.8 - card.value * 0.25;
      }
      return -card.value * 0.35 + wantThisSuitDelta * 0.15;
    }

    // Seguindo ou definindo o naipe líder
    var leadInArena = arena.filter(function (a) {
      return a.card.type === 'combat' && a.card.suit === suit;
    });
    var hasLionInArena = arena.some(function (a) { return a.card.type === 'lion'; });
    var has10InArena = leadInArena.some(function (a) { return a.card.value === 10; });
    var has1InArena = leadInArena.some(function (a) { return a.card.value === 1; });

    var winProb = 0.35;
    if (hasLionInArena) {
      winProb = 0;
    } else if (isLeading) {
      winProb = card.value >= 8 ? 0.65 : card.value === 1 ? 0.15 : card.value / 15;
    } else {
      var myEff = card.value === 1 && has10InArena ? 10.5 : card.value;
      var arenaBest = 0;
      for (var j = 0; j < leadInArena.length; j++) {
        var v = leadInArena[j].card.value;
        var eff = v === 1 && (has10InArena || card.value === 10) ? 10.5 : v;
        if (eff > arenaBest) arenaBest = eff;
      }
      if (myEff > arenaBest && !(has1InArena && card.value === 10)) {
        winProb = 0.5 + (myEff - arenaBest) * 0.04;
      } else {
        winProb = 0.03;
      }
    }

    // Regra especial: se 10 já está na arena, jogar 1 é ótimo; guardar 10 se achar arriscado
    if (card.value === 1 && has10InArena && !hasLionInArena) {
      winProb = 0.85;
    }

    var expectedGain = winProb * Math.max(0.5, wantThisSuitDelta + 2.5);
    if (wantThisSuitDelta < -2 && winProb < 0.2) {
      // Ótimo momento para descartar carta de um naipe que não quer vencer
      expectedGain += 1.4;
    }
    return expectedGain - cardSpendCost;
  }

  /**
   * Escolhe a jogada da IA `{ cardId, declaredSuit }`.
   */
  function chooseMove(state, playerIdx, difficulty) {
    var diff = difficulty || state.players[playerIdx].difficulty || 'estrategico';
    var legalMoves = E().getLegalMoves(state, playerIdx);
    if (legalMoves.length === 0) return null;

    var candidates = [];
    for (var i = 0; i < legalMoves.length; i++) {
      var mv = legalMoves[i];
      if (mv.card.type === 'damaged') {
        candidates.push({ cardId: mv.cardId, card: mv.card, declaredSuit: mv.declaredSuits[0] });
        candidates.push({ cardId: mv.cardId, card: mv.card, declaredSuit: mv.declaredSuits[1] });
      } else {
        candidates.push({ cardId: mv.cardId, card: mv.card, declaredSuit: null });
      }
    }

    var isLastPlayer = state.arena.length === state.numPlayers - 1;
    var scored = [];

    for (var c = 0; c < candidates.length; c++) {
      var cand = candidates[c];
      var score = isLastPlayer
        ? simulatePlayOutcomeValue(state, playerIdx, cand.cardId, cand.declaredSuit)
        : estimateHeuristicMoveScore(state, playerIdx, cand.card, cand.declaredSuit);

      // Pequena penalidade para guardar Leões se não for estratégico desperdiçar
      if (cand.card.type === 'lion' && state.players[playerIdx].hand.length > 6 && isLastPlayer) {
        score -= 2.2;
      }
      if (cand.card.type === 'damaged' && isLastPlayer && state.players[playerIdx].hand.length > 6) {
        score -= 0.7;
      }

      if (diff === 'casual') {
        score += (Math.random() - 0.5) * 6.5;
      } else {
        score += (Math.random() - 0.5) * 0.15;
      }

      scored.push({ cand: cand, score: score });
    }

    scored.sort(function (a, b) { return b.score - a.score; });
    return {
      cardId: scored[0].cand.cardId,
      declaredSuit: scored[0].cand.declaredSuit
    };
  }

  /**
   * Escolhe qual carta extra de naipe diferente coletar na Etapa 4 quando há >= 2 opções.
   */
  function chooseOffsuitCard(state, playerIdx, difficulty) {
    var diff = difficulty || state.players[playerIdx].difficulty || 'estrategico';
    var offSuits = state.pendingResolution.offSuitCards;
    if (!offSuits || offSuits.length === 0) return null;

    if (diff === 'casual' && Math.random() < 0.35) {
      var rnd = offSuits[Math.floor(Math.random() * offSuits.length)];
      return rnd.card.id;
    }

    return pickBestOffsuitInternal(state, playerIdx);
  }

  Gladiadores.AI = {
    evaluatePlayAreaValue: evaluatePlayAreaValue,
    chooseMove: chooseMove,
    chooseOffsuitCard: chooseOffsuitCard
  };
})(window);

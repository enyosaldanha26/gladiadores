(function (global) {
  'use strict';

  var Gladiadores = (global.Gladiadores = global.Gladiadores || {});
  var STORAGE_KEY = 'gladiadores_muted';

  var ctx = null;
  var muted = false;
  try {
    muted = global.localStorage && global.localStorage.getItem(STORAGE_KEY) === '1';
  } catch (e) {
    muted = false;
  }

  function ensureContext() {
    if (muted) return null;
    if (!ctx) {
      var AudioCtx = global.AudioContext || global.webkitAudioContext;
      if (!AudioCtx) return null;
      try {
        ctx = new AudioCtx();
      } catch (e) {
        return null;
      }
    }
    if (ctx.state === 'suspended') {
      try {
        ctx.resume();
      } catch (e) {
        // Ignorar se bloqueado antes de gesto do usuário
      }
    }
    return ctx;
  }

  function playTone(freqStart, freqEnd, duration, type, gainPeak, delay) {
    var c = ensureContext();
    if (!c) return;
    var now = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || 'triangle';
    osc.frequency.setValueAtTime(freqStart, now);
    if (freqEnd && freqEnd !== freqStart) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), now + duration);
    }
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak || 0.12, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  function playNoiseBurst(duration, filterFreq, qVal, gainPeak, delay) {
    var c = ensureContext();
    if (!c) return;
    var sampleCount = Math.max(1, Math.floor(c.sampleRate * duration));
    var buffer = c.createBuffer(1, sampleCount, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    var src = c.createBufferSource();
    src.buffer = buffer;

    var filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFreq || 1400;
    filter.Q.value = qVal || 1.2;

    var gain = c.createGain();
    var now = c.currentTime + (delay || 0);
    gain.gain.setValueAtTime(gainPeak || 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(now);
    src.stop(now + duration + 0.02);
  }

  function isMuted() {
    return muted;
  }

  function setMuted(val) {
    muted = !!val;
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORAGE_KEY, muted ? '1' : '0');
      }
    } catch (e) {
      // Ignorar erro de storage
    }
    return muted;
  }

  function toggleMuted() {
    return setMuted(!muted);
  }

  function cardPlay() {
    playNoiseBurst(0.055, 1800, 1.0, 0.16, 0);
    playTone(190, 95, 0.06, 'sine', 0.08, 0);
  }

  function deal() {
    for (var i = 0; i < 4; i++) {
      playNoiseBurst(0.035, 2200 + i * 240, 1.5, 0.08, i * 0.055);
    }
  }

  function lionRoar() {
    playTone(135, 62, 0.42, 'sawtooth', 0.13, 0);
    playTone(92, 48, 0.48, 'triangle', 0.16, 0.03);
    playNoiseBurst(0.32, 420, 0.8, 0.12, 0.02);
  }

  function damagedBreak() {
    playNoiseBurst(0.11, 3200, 2.2, 0.15, 0);
    playTone(620, 180, 0.18, 'square', 0.07, 0);
    playTone(430, 120, 0.16, 'triangle', 0.09, 0.04);
  }

  function cubeMove() {
    playTone(420, 260, 0.065, 'triangle', 0.11, 0);
    playNoiseBurst(0.025, 1100, 1.8, 0.08, 0);
  }

  function battleWin() {
    playTone(392, 392, 0.14, 'triangle', 0.09, 0);
    playTone(493.88, 493.88, 0.18, 'triangle', 0.09, 0.07);
    playTone(587.33, 587.33, 0.24, 'triangle', 0.10, 0.14);
  }

  function roundEnd() {
    playTone(329.63, 329.63, 0.18, 'triangle', 0.09, 0);
    playTone(392.0, 392.0, 0.18, 'triangle', 0.09, 0.1);
    playTone(523.25, 523.25, 0.34, 'triangle', 0.11, 0.2);
  }

  function gameOver() {
    var notes = [261.63, 329.63, 392.0, 523.25, 659.25];
    for (var i = 0; i < notes.length; i++) {
      playTone(notes[i], notes[i], i === notes.length - 1 ? 0.55 : 0.18, 'triangle', 0.11, i * 0.1);
    }
  }

  function summonPop() {
    playTone(130, 68, 0.14, 'sine', 0.14, 0);
    playTone(293.66, 587.33, 0.22, 'triangle', 0.10, 0.03);
    playNoiseBurst(0.08, 1600, 1.4, 0.09, 0.01);
  }

  function swordClash() {
    playNoiseBurst(0.11, 3400, 2.6, 0.16, 0);
    playTone(1240, 880, 0.16, 'triangle', 0.08, 0);
    playTone(1590, 1120, 0.19, 'sawtooth', 0.05, 0.015);
  }

  function crowdCheer() {
    var c = ensureContext();
    if (!c) return;
    var duration = 0.72;
    var sampleCount = Math.max(1, Math.floor(c.sampleRate * duration));
    var buffer = c.createBuffer(1, sampleCount, c.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < sampleCount; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    var src = c.createBufferSource();
    src.buffer = buffer;

    var filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(650, c.currentTime);
    filter.frequency.linearRampToValueAtTime(1150, c.currentTime + 0.28);
    filter.frequency.linearRampToValueAtTime(720, c.currentTime + duration);
    filter.Q.value = 0.75;

    var gain = c.createGain();
    var now = c.currentTime;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.13, now + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    src.start(now);
    src.stop(now + duration + 0.03);
  }

  function hornFanfare() {
    playTone(146.83, 146.83, 0.42, 'sawtooth', 0.08, 0);
    playTone(220.0, 220.0, 0.48, 'sawtooth', 0.07, 0.14);
    playTone(293.66, 293.66, 0.62, 'triangle', 0.10, 0.28);
  }

  Gladiadores.Audio = {
    isMuted: isMuted,
    setMuted: setMuted,
    toggleMuted: toggleMuted,
    cardPlay: cardPlay,
    deal: deal,
    lionRoar: lionRoar,
    damagedBreak: damagedBreak,
    cubeMove: cubeMove,
    battleWin: battleWin,
    roundEnd: roundEnd,
    gameOver: gameOver,
    summonPop: summonPop,
    swordClash: swordClash,
    crowdCheer: crowdCheer,
    hornFanfare: hornFanfare
  };
})(window);

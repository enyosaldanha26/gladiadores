@echo off
title Gladiadores - Jogo de Tabuleiro
echo Iniciando Gladiadores no computador...
echo Mantenha esta janela aberta enquanto joga.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\serve.ps1" -OpenApp

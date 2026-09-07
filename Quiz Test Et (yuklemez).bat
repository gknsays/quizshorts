@echo off
chcp 1254 >nul
title Quiz Test (yuklemez)
cd /d "%~dp0"
echo.
echo   TEST modu: video uretilecek ama YouTube'a YUKLENMEYECEK.
echo   Sonuc: out\quiz.mp4
echo.
call npm run quiz:test
echo.
pause

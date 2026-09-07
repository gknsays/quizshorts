@echo off
chcp 1254 >nul
title Quiz Yayinla
cd /d "%~dp0"
echo.
echo   Quiz videosu uretilip YouTube kanalina yuklenecek.
echo   Sorular once dogrulanacak; gecemeyenler elenip yenisi uretilir.
echo.
call npm run quiz
echo.
pause

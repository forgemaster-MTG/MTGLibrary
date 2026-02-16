@echo off
echo Starting MTG Library Local Server...
echo.
echo This will start a local web server to bypass CORS errors.
echo Please wait for the server to start, then open the URL shown (usually http://127.0.0.1:8080).
echo.
cd Public
call npx http-server -c-1 -o
pause

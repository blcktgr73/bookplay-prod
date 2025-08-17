@echo off
echo 📚 BookPlay 로컬 서버 시작...
echo.
echo 브라우저에서 http://localhost:8000 으로 접속하세요
echo 서버를 중지하려면 Ctrl+C를 누르세요
echo.
cd public
python -m http.server 8000
pause

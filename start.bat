@echo off
echo Starting Hampton Hawks Plant Sales...
echo.
echo Services:
echo   Web:      http://localhost:3000
echo   API:      http://localhost:8080
echo   Swagger:  http://localhost:8080/swagger
echo.
docker-compose up -d --build
echo.
echo Done! Open http://localhost:3000 in your browser.
pause

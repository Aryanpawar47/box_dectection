@echo off
echo ================================================
echo  Smart Inventory System ? Full Stack Startup
echo  MongoDB Atlas Connected: cluster0.ldikowe.mongodb.net
echo ================================================

set MONGODB_URI=mongodb+srv://aryanjaypawar47_db_user:C2ilbTvjNqtHGFTS@cluster0.ldikowe.mongodb.net/smart_inventory?retryWrites=true^&w=majority^&appName=Cluster0
set MONGODB_DB_NAME=smart_inventory

echo [1/2] Starting FastAPI Backend on http://localhost:8000 ...
start "FastAPI Backend" cmd /k "cd /d %~dp0backend && .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"

timeout /t 4 /nobreak >nul

echo [2/2] Starting Next.js Frontend on http://localhost:3000 ...
start "Next.js Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

echo.
echo ================================================
echo  Backend:  http://localhost:8000
echo  Frontend: http://localhost:3000
echo  Live Feed: http://localhost:3000/live
echo  Admin (MongoDB): http://localhost:3000/admin
echo  API Docs: http://localhost:8000/docs
echo ================================================
pause

@echo off
rem Levanta backend, frontend y el listener de Stripe con doble clic.
rem Con Windows Terminal abre una sola ventana con pestañas; si no, una ventana por servicio.
setlocal
cd /d "%~dp0"
set "RAIZ=%~dp0"

rem Instala dependencias solo si faltan
if not exist "backend\node_modules" (
  echo Instalando dependencias del backend...
  pushd backend & call npm install & call npx prisma generate & popd
)
if not exist "frontend\node_modules" (
  echo Instalando dependencias del frontend...
  pushd frontend & call npm install & popd
)

if not exist "backend\.env"  echo [AVISO] Falta backend\.env  - el backend no va a arrancar bien.
if not exist "frontend\.env" echo [AVISO] Falta frontend\.env - copia frontend\.env.example y llena las claves.

set "STRIPE_CMD=stripe.exe listen --forward-to localhost:4000/api/pagos/webhook"

where wt >nul 2>nul
if %errorlevel%==0 (
  wt -w new nt --title Backend -d "%RAIZ%backend" cmd /k npm run dev ; nt --title Frontend -d "%RAIZ%frontend" cmd /k npm run dev ; nt --title Stripe -d "%RAIZ%backend" cmd /k %STRIPE_CMD%
) else (
  start "Backend"  /d "%RAIZ%backend"  cmd /k npm run dev
  start "Frontend" /d "%RAIZ%frontend" cmd /k npm run dev
  start "Stripe"   /d "%RAIZ%backend"  cmd /k %STRIPE_CMD%
)

echo Esperando a que arranque el frontend...
timeout /t 6 /nobreak >nul
start "" http://localhost:8443
endlocal

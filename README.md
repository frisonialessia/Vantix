# Vantix

Plataforma de **Market & Customer Intelligence**. Predice churn y CLV, y lo traduce en decisiones que protegen y hacen crecer los ingresos.

Stack: **Next.js 14** (App Router) · React · Recharts · proxy serverless de LLM (Gemini por defecto, configurable).

---

## Desarrollo local

```bash
npm install          # instala dependencias
cp .env.example .env.local   # crea tu archivo de variables
# edita .env.local y pega tu GEMINI_API_KEY
npm run dev          # arranca en http://localhost:3000
```

Sin API key, el asistente funciona en **modo demo** (respuestas pre-generadas, costo cero):
en `.env.local` pon `LLM_PROVIDER=demo`.

---

## Variables de entorno

| Variable | Qué es | Ejemplo |
|----------|--------|---------|
| `LLM_PROVIDER` | Proveedor activo | `gemini` o `demo` |
| `GEMINI_API_KEY` | Tu clave de Google AI Studio | `AIza...` |
| `GEMINI_MODEL` | Modelo a usar | `gemini-2.5-flash` |

La API key **nunca** se sube al repo (la excluye `.gitignore`). Vive solo en `.env.local`
(local) o en las variables de entorno de Vercel (producción).

---

## Subir a GitHub

```bash
git init
git add .
git commit -m "Vantix: migración inicial a Next.js"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/vantix.git
git push -u origin main
```

(Crea primero el repositorio vacío en github.com con el nombre `vantix`.)

---

## Desplegar en Vercel

1. Entra a [vercel.com](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
2. **Add New → Project** y selecciona el repo `vantix`.
3. Vercel detecta Next.js automáticamente. No cambies nada de la configuración.
4. Antes de desplegar, abre **Environment Variables** y agrega:
   - `LLM_PROVIDER` = `gemini`
   - `GEMINI_API_KEY` = (tu clave de https://aistudio.google.com/apikey)
   - `GEMINI_MODEL` = `gemini-2.5-flash`
5. **Deploy**. En ~1 minuto tendrás tu URL pública (`vantix-xxx.vercel.app`).

Cada `git push` a `main` redespliega automáticamente.

---

## Estructura

```
vantix/
├── app/
│   ├── api/assistant/route.js   # proxy serverless del LLM (la API key vive aquí)
│   ├── layout.js                # layout raíz + fuentes
│   ├── page.js                  # monta la app
│   └── globals.css
├── components/
│   └── VantixApp.jsx            # toda la UI (landing + login + dashboard)
├── lib/
│   └── llm.js                   # cliente LLM configurable (núcleo reutilizable)
├── .env.example                 # plantilla de variables (sin secretos)
└── .gitignore                   # excluye node_modules, builds y .env
```

El cliente LLM (`lib/llm.js`) es la pieza pensada para reutilizarse entre Vantix
y los siguientes SaaS de la Factory.

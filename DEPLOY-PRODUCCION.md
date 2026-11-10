# Subir KM43 a producción (web + backend en Render + base Supabase)

Orden importante: **primero la web** (las fotos tienen que estar publicadas
antes de importar, porque Medusa guarda la URL de cada foto), **después el
backend**, **después los datos**.

## 0. Datos que hacen falta

| Dato | Valor |
|---|---|
| Dominio de la web (servicio en **Render**) | `https://km43pod.com` (servicio `km46-store.onrender.com`; `www` redirige al dominio) |
| URL del backend en Render | `https://__________.onrender.com` |
| Rama que publica la web | `merch-mobile-parte` |
| Build / Start command del backend en Render | `__________` / `__________` |
| Root Directory del backend en Render | `__________` |
| ¿El `DATABASE_URL` de Render es el mismo Supabase del `.env` local? | sí / no |

## 1. Web (repo `km46`)

1. Commit de los cambios y merge a la rama que se publica.
   Incluye `public/productos/` (147 fotos WebP, ~11 MB).
2. Variables de entorno en el hosting de la web:
   - `NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://<backend>.onrender.com`
   - `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=pk_...` (la de producción, paso 4)
3. Publicar y comprobar que abre `https://<web>/productos/general/la-running-cap/negro-1.webp`.

## 2. Backend (repo `km46-backend`, servicio de Render)

1. Commit y push a `master`: `medusa-config.ts` (SSL), `src/scripts/`
   (seed, import y `data/catalogo-km43.json`), `src/admin/widgets/`
   (panel "Datos del pago"), `tools/catalogo-km43/`.
2. Si Render **no** compila (usa el `.medusa/` que está en git), hay que
   correr `npm run build` en `apps/backend` y commitear `.medusa/` también.
   Si Render corre `npm run build`, no hace falta.
3. Variables de entorno en Render:
   - `DATABASE_URL` (Supabase), `JWT_SECRET`, `COOKIE_SECRET` (valores largos y secretos)
   - `STORE_CORS=https://<web>`
   - `ADMIN_CORS=https://<backend>.onrender.com`
   - `AUTH_CORS=https://<backend>.onrender.com,https://<web>`
   - `NODE_ENV=production`

## 3. Base de datos de producción (desde `apps/backend`, con el `.env` de producción)

```bash
npx medusa db:migrate
SEED_DEMO=false npx medusa exec ./src/scripts/seed-km46.ts        # región USD, envío $0, clave pública, stock
KM43_IMAGE_BASE_URL=https://<web> KM43_REMOVE_DEMO=true npx medusa exec ./src/scripts/import-km43.ts
npx medusa user -e <correo-del-cliente> -p <contraseña>             # acceso al Admin
```

- `SEED_DEMO=false`: no crea productos, eventos ni cupón de prueba.
- El seed imprime la **publishable key**: va en la web (paso 1.2).
- Si la base ya tenía el envío nacional en $5: Admin → Settings → Locations &
  Shipping → KM46 → editar precio a 0.

## 4. Prueba final

1. Comprar un producto en la web publicada.
2. En el Admin (`https://<backend>.onrender.com/app`): ver el pedido, el panel
   "Datos del pago", confirmar pago (Capture), crear envío (Fulfillment).
3. Cancelar ese pedido de prueba.

## Ten en cuenta

- **Render**: los servicios están en plan de paga, así que no se duermen.
- **Sin Redis** (`REDIS_URL` vacío): eventos y caché en memoria. Sirve para
  empezar; si crece el tráfico, conviene agregar Redis.
- **Fotos subidas desde el Admin**: en Render el disco se borra en cada
  despliegue. Las fotos del catálogo viven en la web (`/productos`), así que
  no se pierden; pero si la clienta sube fotos nuevas desde el Admin, hay que
  configurar un almacenamiento externo (S3, Cloudinary o Supabase Storage).

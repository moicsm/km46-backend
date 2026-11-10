# Catálogo KM43 → Medusa

Convierte el Excel de la clienta (`KM43 - Productos Web.xlsx`) y sus mockups en
productos de Medusa, con fotos por color, stock y textos.

## Qué hay aquí

| Archivo | Para qué |
|---|---|
| `generar_catalogo.py` | Lee el Excel + mockups y genera el catálogo y las fotos |
| `requirements.txt` | Dependencias de Python (`openpyxl`, `pillow`) |
| `../../apps/backend/src/scripts/data/catalogo-km43.json` | Catálogo generado (lo que se importa) |
| `../../apps/backend/src/scripts/import-km43.ts` | Importa el catálogo en Medusa |
| `km46/public/productos/...` (repo de la web) | Fotos en WebP que sirve la web |

## 1. Generar el catálogo (solo cuando cambie el Excel o lleguen fotos nuevas)

```bash
python -m venv .venv && .venv/Scripts/pip install -r requirements.txt
.venv/Scripts/python -I generar_catalogo.py \
  "<km46-material>/KM43 - Productos Web.xlsx" \
  "<km46-material>/MOCKUPS MERCH-.../MOCKUPS MERCH" \
  "<repo km46>/public" \
  "../../apps/backend/src/scripts/data/catalogo-km43.json" \
  "<km46-material>/verificacion" \
  --extras extras.json
```

- `extras.json`: productos que están en las carpetas pero **no** en el Excel
  (colecciones pasadas). Si tienen `datos_de`, copian precio, tallas, género,
  textos, categoría y tipo del producto del Excel con ese nombre; si no, se
  suben sin precio ni categoría (se completan luego en el Admin). En la web
  aparecen en "Mostrar todo", pero no en los filtros ni en las secciones
  destacadas, y no se pueden comprar hasta que tengan precio.
- Un producto del Excel sin ninguna foto (ej. Toalla mediana) se omite hasta
  que lleguen sus mockups.

- Las fotos quedan en `public/productos/<coleccion>/<producto>/<color>-<n>.webp`
  (1 frente, 2 espalda, 3 detalle).
- En `verificacion/` queda una hoja por colección para revisar que cada foto
  corresponde a su producto y color.
- Cualquier texto `[POR CONFIRMAR]` se quita automáticamente.
- Stock: 24 unidades por cada variante (talla × color × género).

## 2. Probar en local

Con un Postgres local (Docker: `docker compose up -d` en la raíz del backend):

```bash
cd apps/backend
export DATABASE_URL=postgres://postgres:postgres@localhost:5432/km46 DB_SSL=false
npx medusa db:migrate
npx medusa exec ./src/scripts/seed-km46.ts          # región, envíos, publishable key...
KM43_IMAGE_BASE_URL=http://localhost:3000 KM43_REMOVE_DEMO=true \
  npx medusa exec ./src/scripts/import-km43.ts
```

Copiar la publishable key que imprime el seed en `km46/.env.local`
(`NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`).

## 3. Producción

1. **Primero subir la web** con la carpeta `public/productos` (las fotos tienen
   que estar publicadas antes de importar, porque Medusa guarda la URL).
2. Si la base de producción todavía no tiene región / envíos / publishable key,
   correr `seed-km46.ts` contra producción.
   - El envío **no se cobra en la web** (se coordina con el cliente después del
     pago): el seed crea "Envío nacional por encomienda" en $0 y el checkout
     muestra "A CONVENIR". Si producción ya tenía esa opción en $5, cambiarla a
     $0 en el Admin: *Settings → Locations & Shipping → KM46 → editar precio*.
3. Importar (desde `apps/backend`, con el `.env` de producción):

```bash
KM43_IMAGE_BASE_URL=https://<dominio-de-la-web> KM43_REMOVE_DEMO=true \
  npx medusa exec ./src/scripts/import-km43.ts
```

| Variable | Qué hace |
|---|---|
| `KM43_IMAGE_BASE_URL` | Obligatoria. Dominio donde la web sirve `/productos/...` |
| `KM43_REMOVE_DEMO=true` | Borra la merch de prueba del seed (no toca eventos) |
| `KM43_REPLACE=true` | Borra y recrea los productos del catálogo (ej. al llegar fotos nuevas) |
| `KM43_PRUNE=true` | Borra los productos que cargó este script y ya no están en el catálogo |

Todos los productos quedan con el tipo **Merch**: la web lo usa para separar la
mercancía de los eventos (aunque un producto no tenga categoría).

El script se puede correr varias veces: los productos que ya existen se saltan.

## Pendiente de la clienta

- Mockups de **T-shirt Boxy Mujer** (Amarillo, Negro, Marrón) y **Toalla mediana**
  (Asfalto, Ávila, Tinto): los productos ya están cargados; cuando lleguen las
  fotos, regenerar el catálogo y correr el import con `KM43_REPLACE=true`.
- Bandanas finales (las actuales son provisionales).
- Datos marcados "por confirmar" en la hoja (no se muestran en la web).

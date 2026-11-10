// apps/backend/src/scripts/import-km43.ts
//
// Carga el catálogo real de KM43 (src/scripts/data/catalogo-km43.json, generado
// con tools/catalogo-km43/generar_catalogo.py desde el Excel de la clienta).
//
// Requiere que la tienda ya tenga región, canal de ventas, ubicación de stock y
// perfil de envío (los crea seed-km46.ts).
//
//   KM43_IMAGE_BASE_URL=http://localhost:3000 npx medusa exec ./src/scripts/import-km43.ts
//
// Variables:
//   KM43_IMAGE_BASE_URL  (obligatoria) dominio donde la web sirve /productos/...
//                        local: http://localhost:3000 · producción: https://<dominio de la web>
//   KM43_REMOVE_DEMO=true  borra los productos de MERCH de prueba del seed
//                          (metadata.demo = "true"; los eventos no se tocan)
//   KM43_REPLACE=true      borra y vuelve a crear los productos de este catálogo
//                          (por defecto, los que ya existen se saltan)
//   KM43_PRUNE=true        borra los productos que cargó este script antes y que
//                          ya no están en el catálogo (ej. Toalla mientras no tenga fotos)
//
// Todos los productos quedan con el tipo "Merch": así la web los distingue de
// los eventos aunque no tengan categoría.
//
// Es seguro correrlo varias veces: no duplica nada.
// Se importa (no se lee con fs) para que `medusa build` lo copie a .medusa/server
// y el script funcione también desde la versión compilada (Render).
import catalogData from "./data/catalogo-km43.json";
import { ExecArgs } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils";
import {
  batchVariantImagesWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createProductTagsWorkflow,
  createProductTypesWorkflow,
  deleteProductsWorkflow,
} from "@medusajs/medusa/core-flows";

const SOURCE = "catalogo-km43";

type CatalogVariant = { options: Record<string, string>; stock: number; images: string[] };
type CatalogProduct = {
  handle: string;
  title: string;
  collection: string | null;
  category: string | null;
  tag: string | null;
  price: number | null;
  description: string;
  details: string;
  care: string;
  options: Record<string, string[]>;
  colors: Record<string, string>;
  variants: CatalogVariant[];
  images: string[];
  thumbnail: string | null;
};
type Catalog = {
  fuente: string;
  generado: string;
  tipo?: string;
  colecciones: { title: string; handle: string }[];
  productos: CatalogProduct[];
};

const sku = (...parts: string[]) =>
  parts
    .join("-")
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // quita acentos (marcas combinantes tras NFD)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function loadCatalog(): Catalog {
  return catalogData as unknown as Catalog;
}

export default async function importKm43({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const storeService = container.resolve(Modules.STORE);
  const fulfillmentService = container.resolve(Modules.FULFILLMENT);

  const imageBase = (process.env.KM43_IMAGE_BASE_URL || "").replace(/\/$/, "");
  if (!/^https?:\/\//.test(imageBase)) {
    throw new Error("Falta KM43_IMAGE_BASE_URL (ej. http://localhost:3000 o https://<dominio de la web>)");
  }
  const url = (src: string) => `${imageBase}${encodeURI(src)}`;
  const removeDemo = process.env.KM43_REMOVE_DEMO === "true";
  const replace = process.env.KM43_REPLACE === "true";
  const prune = process.env.KM43_PRUNE === "true";

  const catalog = loadCatalog();
  logger.info(`Catálogo ${catalog.fuente} (${catalog.generado}): ${catalog.productos.length} productos`);

  const find = async (entity: string, filters: Record<string, unknown>, fields: string[]) => {
    const { data } = await query.graph({ entity, fields, filters } as any);
    return data as any[];
  };

  // 1) Infraestructura que deja seed-km46.ts
  const [store] = await storeService.listStores();
  const salesChannelId = store?.default_sales_channel_id;
  const locationId = store?.default_location_id;
  const [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" });
  if (!salesChannelId || !locationId || !shippingProfile) {
    throw new Error(
      "La tienda no tiene canal de ventas, ubicación de stock o perfil de envío. Corre primero: npx medusa exec ./src/scripts/seed-km46.ts"
    );
  }

  // 2) Categorías, tags y colecciones
  const categoryNames = [...new Set(catalog.productos.map((p) => p.category).filter((c): c is string => !!c))];
  const tagValues = [...new Set(catalog.productos.map((p) => p.tag).filter((t): t is string => !!t))];

  let categories = await find("product_category", {}, ["id", "name"]);
  const missingCategories = categoryNames.filter((n) => !categories.some((c) => c.name === n));
  if (missingCategories.length) {
    await createProductCategoriesWorkflow(container).run({
      input: { product_categories: missingCategories.map((name) => ({ name, is_active: true })) },
    });
    categories = await find("product_category", {}, ["id", "name"]);
  }

  let tags = await find("product_tag", {}, ["id", "value"]);
  const missingTags = tagValues.filter((v) => !tags.some((t) => t.value === v));
  if (missingTags.length) {
    await createProductTagsWorkflow(container).run({ input: { product_tags: missingTags.map((value) => ({ value })) } });
    tags = await find("product_tag", {}, ["id", "value"]);
  }

  const typeValue = catalog.tipo || "Merch";
  let [productType] = await find("product_type", { value: typeValue }, ["id", "value"]);
  if (!productType) {
    const { result } = await createProductTypesWorkflow(container).run({ input: { product_types: [{ value: typeValue }] } });
    productType = result[0];
  }

  let collections = await find("product_collection", {}, ["id", "title", "handle"]);
  const missingCollections = catalog.colecciones.filter((c) => !collections.some((x) => x.handle === c.handle));
  if (missingCollections.length) {
    await createCollectionsWorkflow(container).run({ input: { collections: missingCollections } });
    collections = await find("product_collection", {}, ["id", "title", "handle"]);
  }
  const collectionId = (title: string | null) =>
    title === null
      ? undefined
      : collections.find((c) => c.handle === catalog.colecciones.find((x) => x.title === title)?.handle)?.id;

  // 3) Limpieza opcional
  const existing = await find("product", {}, ["id", "handle", "metadata"]);
  const toDelete: string[] = [];
  if (removeDemo) {
    const demo = existing.filter((p) => p.metadata?.demo === "true" && !p.metadata?.event_date);
    toDelete.push(...demo.map((p) => p.id));
    logger.info(`Productos de merch de prueba a borrar: ${demo.length}`);
  }
  const catalogHandles = new Set(catalog.productos.map((p) => p.handle));
  if (replace) {
    const ours = existing.filter((p) => catalogHandles.has(p.handle));
    toDelete.push(...ours.map((p) => p.id));
    logger.info(`Productos del catálogo a reemplazar: ${ours.length}`);
  }
  if (prune) {
    const stale = existing.filter((p) => p.metadata?.fuente === SOURCE && !catalogHandles.has(p.handle));
    toDelete.push(...stale.map((p) => p.id));
    logger.info(`Productos que ya no están en el catálogo (se borran): ${stale.map((p) => p.handle).join(", ") || "ninguno"}`);
  }
  if (toDelete.length) {
    await deleteProductsWorkflow(container).run({ input: { ids: [...new Set(toDelete)] } });
  }
  const remainingHandles = new Set(
    (await find("product", {}, ["id", "handle"])).map((p) => p.handle as string)
  );

  // 4) Productos
  const pending = catalog.productos.filter((p) => !remainingHandles.has(p.handle));
  const skipped = catalog.productos.length - pending.length;
  if (skipped) logger.info(`Ya existían ${skipped} productos del catálogo (se saltan; usa KM43_REPLACE=true para recrearlos)`);

  for (const p of pending) {
    const tagId = p.tag ? tags.find((t) => t.value === p.tag)?.id : undefined;
    const optionOrder = Object.keys(p.options);
    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: p.title,
            handle: p.handle,
            description: p.description,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            thumbnail: p.thumbnail ? url(p.thumbnail) : undefined,
            images: p.images.map((src) => ({ url: url(src) })),
            category_ids: p.category ? [categories.find((c) => c.name === p.category)!.id] : [],
            type_id: productType.id,
            tag_ids: tagId ? [tagId] : [],
            collection_id: collectionId(p.collection),
            sales_channels: [{ id: salesChannelId }],
            options: optionOrder.map((title) => ({ title, values: p.options[title] })),
            variants: p.variants.map((v) => ({
              title: optionOrder.map((o) => v.options[o]).join(" / "),
              sku: sku("KM43", p.handle, ...optionOrder.map((o) => v.options[o])),
              manage_inventory: true,
              options: v.options,
              thumbnail: v.images[0] ? url(v.images[0]) : undefined,
              prices: p.price === null ? [] : [{ amount: p.price, currency_code: "usd" }],
            })),
            metadata: {
              fuente: SOURCE,
              coleccion: p.collection,
              detalles: p.details,
              cuidados: p.care,
              colores: p.colors,
            },
          },
        ],
      },
    });

    // Fotos de cada color → sus variantes
    const [created] = await find("product", { handle: p.handle }, [
      "id",
      "images.id",
      "images.url",
      "variants.id",
      "variants.sku",
    ]);
    const imageIdByUrl = new Map<string, string>(created.images.map((img: any) => [img.url, img.id]));
    for (const v of p.variants) {
      const variantSku = sku("KM43", p.handle, ...optionOrder.map((o) => v.options[o]));
      const variant = created.variants.find((x: any) => x.sku === variantSku);
      const imageIds = v.images.map((src) => imageIdByUrl.get(url(src))).filter((id): id is string => !!id);
      if (variant && imageIds.length) {
        await batchVariantImagesWorkflow(container).run({ input: { variant_id: variant.id, add: imageIds } });
      }
    }

    // Stock
    const skus = p.variants.map((v) => sku("KM43", p.handle, ...optionOrder.map((o) => v.options[o])));
    const items = await find("inventory_item", { sku: skus }, ["id", "sku"]);
    const stockBySku = new Map(p.variants.map((v, i) => [skus[i], v.stock]));
    if (items.length) {
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: items.map((it) => ({
            location_id: locationId,
            inventory_item_id: it.id,
            stocked_quantity: stockBySku.get(it.sku) ?? 0,
          })),
        },
      });
    }

    logger.info(
      `  ✓ ${p.title} (${p.collection ?? "sin colección"}) — ${p.variants.length} variantes, ${p.images.length} fotos` +
        (p.price === null ? " · SIN PRECIO" : "") +
        (p.category ? "" : " · SIN CATEGORÍA")
    );
  }

  logger.info("──────────────────────────────────────────────");
  logger.info(`Listo. Creados: ${pending.length} · saltados: ${skipped} · imágenes desde ${imageBase}`);
}

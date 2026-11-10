"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = importKm43;
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
const catalogo_km43_json_1 = __importDefault(require("./data/catalogo-km43.json"));
const utils_1 = require("@medusajs/framework/utils");
const core_flows_1 = require("@medusajs/medusa/core-flows");
const SOURCE = "catalogo-km43";
const sku = (...parts) => parts
    .join("-")
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // quita acentos (marcas combinantes tras NFD)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
function loadCatalog() {
    return catalogo_km43_json_1.default;
}
async function importKm43({ container }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const storeService = container.resolve(utils_1.Modules.STORE);
    const fulfillmentService = container.resolve(utils_1.Modules.FULFILLMENT);
    const imageBase = (process.env.KM43_IMAGE_BASE_URL || "").replace(/\/$/, "");
    if (!/^https?:\/\//.test(imageBase)) {
        throw new Error("Falta KM43_IMAGE_BASE_URL (ej. http://localhost:3000 o https://<dominio de la web>)");
    }
    const url = (src) => `${imageBase}${encodeURI(src)}`;
    const removeDemo = process.env.KM43_REMOVE_DEMO === "true";
    const replace = process.env.KM43_REPLACE === "true";
    const prune = process.env.KM43_PRUNE === "true";
    const catalog = loadCatalog();
    logger.info(`Catálogo ${catalog.fuente} (${catalog.generado}): ${catalog.productos.length} productos`);
    const find = async (entity, filters, fields) => {
        const { data } = await query.graph({ entity, fields, filters });
        return data;
    };
    // 1) Infraestructura que deja seed-km46.ts
    const [store] = await storeService.listStores();
    const salesChannelId = store?.default_sales_channel_id;
    const locationId = store?.default_location_id;
    const [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" });
    if (!salesChannelId || !locationId || !shippingProfile) {
        throw new Error("La tienda no tiene canal de ventas, ubicación de stock o perfil de envío. Corre primero: npx medusa exec ./src/scripts/seed-km46.ts");
    }
    // 2) Categorías, tags y colecciones
    const categoryNames = [...new Set(catalog.productos.map((p) => p.category).filter((c) => !!c))];
    const tagValues = [...new Set(catalog.productos.map((p) => p.tag).filter((t) => !!t))];
    let categories = await find("product_category", {}, ["id", "name"]);
    const missingCategories = categoryNames.filter((n) => !categories.some((c) => c.name === n));
    if (missingCategories.length) {
        await (0, core_flows_1.createProductCategoriesWorkflow)(container).run({
            input: { product_categories: missingCategories.map((name) => ({ name, is_active: true })) },
        });
        categories = await find("product_category", {}, ["id", "name"]);
    }
    let tags = await find("product_tag", {}, ["id", "value"]);
    const missingTags = tagValues.filter((v) => !tags.some((t) => t.value === v));
    if (missingTags.length) {
        await (0, core_flows_1.createProductTagsWorkflow)(container).run({ input: { product_tags: missingTags.map((value) => ({ value })) } });
        tags = await find("product_tag", {}, ["id", "value"]);
    }
    const typeValue = catalog.tipo || "Merch";
    let [productType] = await find("product_type", { value: typeValue }, ["id", "value"]);
    if (!productType) {
        const { result } = await (0, core_flows_1.createProductTypesWorkflow)(container).run({ input: { product_types: [{ value: typeValue }] } });
        productType = result[0];
    }
    let collections = await find("product_collection", {}, ["id", "title", "handle"]);
    const missingCollections = catalog.colecciones.filter((c) => !collections.some((x) => x.handle === c.handle));
    if (missingCollections.length) {
        await (0, core_flows_1.createCollectionsWorkflow)(container).run({ input: { collections: missingCollections } });
        collections = await find("product_collection", {}, ["id", "title", "handle"]);
    }
    const collectionId = (title) => title === null
        ? undefined
        : collections.find((c) => c.handle === catalog.colecciones.find((x) => x.title === title)?.handle)?.id;
    // 3) Limpieza opcional
    const existing = await find("product", {}, ["id", "handle", "metadata"]);
    const toDelete = [];
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
        await (0, core_flows_1.deleteProductsWorkflow)(container).run({ input: { ids: [...new Set(toDelete)] } });
    }
    const remainingHandles = new Set((await find("product", {}, ["id", "handle"])).map((p) => p.handle));
    // 4) Productos
    const pending = catalog.productos.filter((p) => !remainingHandles.has(p.handle));
    const skipped = catalog.productos.length - pending.length;
    if (skipped)
        logger.info(`Ya existían ${skipped} productos del catálogo (se saltan; usa KM43_REPLACE=true para recrearlos)`);
    for (const p of pending) {
        const tagId = p.tag ? tags.find((t) => t.value === p.tag)?.id : undefined;
        const optionOrder = Object.keys(p.options);
        await (0, core_flows_1.createProductsWorkflow)(container).run({
            input: {
                products: [
                    {
                        title: p.title,
                        handle: p.handle,
                        description: p.description,
                        status: utils_1.ProductStatus.PUBLISHED,
                        shipping_profile_id: shippingProfile.id,
                        thumbnail: p.thumbnail ? url(p.thumbnail) : undefined,
                        images: p.images.map((src) => ({ url: url(src) })),
                        category_ids: p.category ? [categories.find((c) => c.name === p.category).id] : [],
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
        const imageIdByUrl = new Map(created.images.map((img) => [img.url, img.id]));
        for (const v of p.variants) {
            const variantSku = sku("KM43", p.handle, ...optionOrder.map((o) => v.options[o]));
            const variant = created.variants.find((x) => x.sku === variantSku);
            const imageIds = v.images.map((src) => imageIdByUrl.get(url(src))).filter((id) => !!id);
            if (variant && imageIds.length) {
                await (0, core_flows_1.batchVariantImagesWorkflow)(container).run({ input: { variant_id: variant.id, add: imageIds } });
            }
        }
        // Stock
        const skus = p.variants.map((v) => sku("KM43", p.handle, ...optionOrder.map((o) => v.options[o])));
        const items = await find("inventory_item", { sku: skus }, ["id", "sku"]);
        const stockBySku = new Map(p.variants.map((v, i) => [skus[i], v.stock]));
        if (items.length) {
            await (0, core_flows_1.createInventoryLevelsWorkflow)(container).run({
                input: {
                    inventory_levels: items.map((it) => ({
                        location_id: locationId,
                        inventory_item_id: it.id,
                        stocked_quantity: stockBySku.get(it.sku) ?? 0,
                    })),
                },
            });
        }
        logger.info(`  ✓ ${p.title} (${p.collection ?? "sin colección"}) — ${p.variants.length} variantes, ${p.images.length} fotos` +
            (p.price === null ? " · SIN PRECIO" : "") +
            (p.category ? "" : " · SIN CATEGORÍA"));
    }
    logger.info("──────────────────────────────────────────────");
    logger.info(`Listo. Creados: ${pending.length} · saltados: ${skipped} · imágenes desde ${imageBase}`);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW1wb3J0LWttNDMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9zcmMvc2NyaXB0cy9pbXBvcnQta200My50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7OztBQWdGQSw2QkEwTEM7QUExUUQsMENBQTBDO0FBQzFDLEVBQUU7QUFDRixnRkFBZ0Y7QUFDaEYsNkVBQTZFO0FBQzdFLEVBQUU7QUFDRixnRkFBZ0Y7QUFDaEYsMkNBQTJDO0FBQzNDLEVBQUU7QUFDRiwyRkFBMkY7QUFDM0YsRUFBRTtBQUNGLGFBQWE7QUFDYixpRkFBaUY7QUFDakYsZ0dBQWdHO0FBQ2hHLDJFQUEyRTtBQUMzRSw2RUFBNkU7QUFDN0UsaUZBQWlGO0FBQ2pGLHVFQUF1RTtBQUN2RSxpRkFBaUY7QUFDakYsMkZBQTJGO0FBQzNGLEVBQUU7QUFDRiw4RUFBOEU7QUFDOUUsMENBQTBDO0FBQzFDLEVBQUU7QUFDRixvREFBb0Q7QUFDcEQsa0ZBQWtGO0FBQ2xGLG9FQUFvRTtBQUNwRSxtRkFBb0Q7QUFFcEQscURBQThGO0FBQzlGLDREQVNxQztBQUVyQyxNQUFNLE1BQU0sR0FBRyxlQUFlLENBQUM7QUEyQi9CLE1BQU0sR0FBRyxHQUFHLENBQUMsR0FBRyxLQUFlLEVBQUUsRUFBRSxDQUNqQyxLQUFLO0tBQ0YsSUFBSSxDQUFDLEdBQUcsQ0FBQztLQUNULFNBQVMsQ0FBQyxLQUFLLENBQUM7S0FDaEIsT0FBTyxDQUFDLFNBQVMsRUFBRSxFQUFFLENBQUMsQ0FBQyw4Q0FBOEM7S0FDckUsV0FBVyxFQUFFO0tBQ2IsT0FBTyxDQUFDLGFBQWEsRUFBRSxHQUFHLENBQUM7S0FDM0IsT0FBTyxDQUFDLFVBQVUsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUU3QixTQUFTLFdBQVc7SUFDbEIsT0FBTyw0QkFBaUMsQ0FBQztBQUMzQyxDQUFDO0FBRWMsS0FBSyxVQUFVLFVBQVUsQ0FBQyxFQUFFLFNBQVMsRUFBWTtJQUM5RCxNQUFNLE1BQU0sR0FBRyxTQUFTLENB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LEtBQUssTUFBTSxJQUFJLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUM1RixRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDeEMsTUFBTSxDQUFDLElBQUksQ0FBQywwQ0FBMEMsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDdkUsQ0FBQztJQUNELE1BQU0sY0FBYyxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUN2RSxJQUFJLE9BQU8sRUFBRSxDQUFDO1FBQ1osTUFBTSxJQUFJLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUNsRSxRQUFRLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDeEMsTUFBTSxDQUFDLElBQUksQ0FBQyx3Q0FBd0MsSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUM7SUFDckUsQ0FBQztJQUNELElBQUksS0FBSyxFQUFFLENBQUM7UUFDVixNQUFNLEtBQUssR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsUUFBUSxFQUFFLE1BQU0sS0FBSyxNQUFNLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBQ3JHLFFBQVEsQ0FBQyxJQUFJLENBQUMsR0FBRyxLQUFLLENB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
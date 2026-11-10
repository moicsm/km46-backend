"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = seedKm46;
const utils_1 = require("@medusajs/framework/utils");
const core_flows_1 = require("@medusajs/medusa/core-flows");
// ─── Datos de demostración ────────────────────────────────────────────────
const PROMO_CODE = "DEMO20"; // 20 % en los productos de la colección CORREMOS EN CASA
const CATEGORIES = ["ROPA", "ACCESORIOS"];
const TAGS = ["RUNNING", "POST-RUNNING"];
const COLLECTIONS = ["CORREMOS EN CASA", "CCS EN EL 26", "BURRITO SABANERO"];
const SIZES = ["S", "M", "L", "XL"];
const ONE = ["ÚNICA"];
const MERCH = [
    { title: "T-SHIRT BASIC", category: "ROPA", tag: "RUNNING", collection: "CORREMOS EN CASA", price: 24, colors: ["NEGRO", "BLANCO"], genders: ["UNISEX"], sizes: SIZES, featured: true },
    { title: "RUNNING TEE", category: "ROPA", tag: "RUNNING", collection: "CORREMOS EN CASA", price: 24, colors: ["NEGRO", "VERDE"], genders: ["UNISEX"], sizes: SIZES, featured: true },
    { title: "SINGLET", category: "ROPA", tag: "RUNNING", collection: "CORREMOS EN CASA", price: 30, colors: ["AZUL"], genders: ["HOMBRE", "MUJER"], sizes: ["S", "M", "L"], featured: true },
    { title: "HOODIE", category: "ROPA", tag: "POST-RUNNING", collection: "CCS EN EL 26", price: 45, colors: ["NEGRO"], genders: ["UNISEX"], sizes: SIZES, featured: true },
    { title: "CHECKERED TEE", category: "ROPA", tag: "POST-RUNNING", collection: "CCS EN EL 26", price: 35, colors: ["BLANCO"], genders: ["UNISEX"], sizes: SIZES },
    { title: "FLORA SINGLET", category: "ROPA", tag: "RUNNING", collection: "BURRITO SABANERO", price: 30, colors: ["ROSA"], genders: ["MUJER"], sizes: ["S", "M", "L"] },
    { title: "NET CAP", category: "ACCESORIOS", tag: "RUNNING", collection: "CORREMOS EN CASA", price: 18, colors: ["NEGRO"], genders: ["UNISEX"], sizes: ONE },
    { title: "BLACK TEE", category: "ROPA", tag: "POST-RUNNING", collection: "CCS EN EL 26", price: 24, colors: ["NEGRO"], genders: ["UNISEX"], sizes: SIZES, stockBySize: { S: 0, M: 3 } },
    { title: "BLUE CAMO", category: "ROPA", tag: "RUNNING", collection: "BURRITO SABANERO", price: 30, colors: ["AZUL"], genders: ["UNISEX"], sizes: SIZES },
    { title: "WHITE BASIC", category: "ROPA", tag: "POST-RUNNING", collection: "CORREMOS EN CASA", price: 24, colors: ["BLANCO"], genders: ["UNISEX"], sizes: SIZES },
    { title: "GREEN RUN", category: "ROPA", tag: "RUNNING", collection: "BURRITO SABANERO", price: 28, colors: ["VERDE"], genders: ["UNISEX"], sizes: SIZES },
    { title: "RED CHECK", category: "ROPA", tag: "POST-RUNNING", collection: "CCS EN EL 26", price: 35, colors: ["ROJO"], genders: ["UNISEX"], sizes: SIZES },
    { title: "NET CAP B", category: "ACCESORIOS", tag: "POST-RUNNING", collection: "BURRITO SABANERO", price: 18, colors: ["BLANCO"], genders: ["UNISEX"], sizes: ONE },
];
const PAST = (title, date, location) => ({
    title,
    when: date,
    location,
    modality: "PRESENCIAL",
    description: "Evento realizado. Mira las fotos en la galería.",
    // los eventos pasados quedan sin cupos para que nadie pueda comprarlos
    distances: [{ title: "GENERAL", price: 20, stock: 0 }],
});
const EVENTS = [
    {
        title: "VALENCIA RUN",
        when: 45,
        location: "VALENCIA, VEN",
        modality: "PRESENCIAL",
        featured: true,
        description: "Corremos en casa. Tres distancias para todos los niveles, con kit de corredor, medalla de finisher e hidratación en ruta.",
        distances: [
            { title: "5K", price: 20, stock: 100 },
            { title: "10K", price: 30, stock: 80 },
            { title: "21K", price: 40, stock: 50 },
        ],
    },
    {
        title: "CARACAS ROCK 2026",
        when: 90,
        location: "CARACAS, VEN",
        modality: "PRESENCIAL",
        description: "La carrera con música en vivo en cada kilómetro.",
        distances: [
            { title: "5K", price: 20, stock: 60 },
            { title: "10K", price: 30, stock: 60 },
        ],
    },
    {
        title: "COPENHAGEN 21K",
        when: 120,
        location: "COPENHAGEN, DEN",
        modality: "PRESENCIAL",
        description: "Media maratón internacional. Cupos agotados.",
        distances: [{ title: "21K", price: 60, stock: 0 }], // sirve para ver el estado SOLD OUT
    },
    PAST("CAF 2026", "2026-05-15", "CARACAS, VEN"),
    PAST("VALENCIA RUN 2025", "2025-06-08", "VALENCIA, VEN"),
    PAST("CARACAS ROCK 2025", "2025-03-20", "CARACAS, VEN"),
    PAST("TODASANA 2025", "2025-03-20", "CARACAS, VEN"),
    PAST("DE RUNNERS PARA RUNNERS", "2025-11-16", "VALENCIA, VEN"),
    PAST("COPENHAGEN 21K 2025", "2025-09-14", "COPENHAGEN, DEN"),
];
// ─── Utilidades ───────────────────────────────────────────────────────────
const slug = (s) => s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
const isoInDays = (n) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
// ─── Script ───────────────────────────────────────────────────────────────
async function seedKm46({ container }) {
    const logger = container.resolve(utils_1.ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(utils_1.ContainerRegistrationKeys.QUERY);
    const link = container.resolve(utils_1.ContainerRegistrationKeys.LINK);
    const fulfillmentService = container.resolve(utils_1.Modules.FULFILLMENT);
    const salesChannelService = container.resolve(utils_1.Modules.SALES_CHANNEL);
    const storeService = container.resolve(utils_1.Modules.STORE);
    // Las imágenes demo se sirven desde la carpeta /public de tu web (Next.js).
    const IMAGE_BASE = (process.env.SEED_IMAGE_BASE || "http://localhost:3000").replace(/\/$/, "");
    const img = (path) => `${IMAGE_BASE}/${encodeURI(path)}`;
    const MERCH_IMG = img("fotos y tipografia/Picture.png");
    const EVENT_IMG = img("Fotos Web/eventoshero.jpg");
    const find = async (entity, filters, fields = ["id"]) => {
        const { data } = await query.graph({ entity, fields, filters });
        return data;
    };
    // 1) Canal de ventas, moneda y tienda
    logger.info("1/8 Tienda, moneda y canal de ventas...");
    const [store] = await storeService.listStores();
    let [salesChannel] = await salesChannelService.listSalesChannels({ name: "Default Sales Channel" });
    if (!salesChannel) {
        const { result } = await (0, core_flows_1.createSalesChannelsWorkflow)(container).run({
            input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
        });
        salesChannel = result[0];
    }
    await (0, core_flows_1.updateStoresWorkflow)(container).run({
        input: {
            selector: { id: store.id },
            update: {
                supported_currencies: [{ currency_code: "usd", is_default: true }],
                default_sales_channel_id: salesChannel.id,
            },
        },
    });
    // 2) Región Venezuela con el proveedor de pago manual
    logger.info("2/8 Región Venezuela (USD, pago manual)...");
    let [region] = await find("region", { name: "Venezuela" }, ["id", "name"]);
    if (!region) {
        const { result } = await (0, core_flows_1.createRegionsWorkflow)(container).run({
            input: {
                regions: [
                    {
                        name: "Venezuela",
                        currency_code: "usd",
                        countries: ["ve"],
                        payment_providers: ["pp_system_default"],
                    },
                ],
            },
        });
        region = result[0];
    }
    if ((await find("tax_region", { country_code: "ve" })).length === 0) {
        await (0, core_flows_1.createTaxRegionsWorkflow)(container).run({
            input: [{ country_code: "ve", provider_id: "tp_system" }],
        });
    }
    // 3) Ubicación de stock, envío y opciones de entrega
    logger.info("3/8 Ubicación de stock y opciones de envío...");
    let [stockLocation] = await find("stock_location", { name: "KM46" }, ["id", "name"]);
    const isNewLocation = !stockLocation;
    if (isNewLocation) {
        const { result } = await (0, core_flows_1.createStockLocationsWorkflow)(container).run({
            input: {
                locations: [
                    {
                        name: "KM46",
                        address: { city: "Valencia", country_code: "VE", address_1: "" },
                    },
                ],
            },
        });
        stockLocation = result[0];
        await (0, core_flows_1.updateStoresWorkflow)(container).run({
            input: { selector: { id: store.id }, update: { default_location_id: stockLocation.id } },
        });
        await link.create({
            [utils_1.Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
            [utils_1.Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
        });
    }
    let [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" });
    if (!shippingProfile) {
        const { result } = await (0, core_flows_1.createShippingProfilesWorkflow)(container).run({
            input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
        });
        shippingProfile = result[0];
    }
    if (isNewLocation) {
        const fulfillmentSet = await fulfillmentService.createFulfillmentSets({
            name: "KM46 delivery",
            type: "shipping",
            service_zones: [
                {
                    name: "Venezuela",
                    geo_zones: [{ country_code: "ve", type: "country" }],
                },
            ],
        });
        await link.create({
            [utils_1.Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
            [utils_1.Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
        });
        const option = (name, code, description, amount) => ({
            name,
            price_type: "flat",
            provider_id: "manual_manual",
            service_zone_id: fulfillmentSet.service_zones[0].id,
            shipping_profile_id: shippingProfile.id,
            // El checkout busca las opciones por este "code": pickup / national / digital
            type: { label: name, description, code },
            prices: [
                { currency_code: "usd", amount },
                { region_id: region.id, amount },
            ],
            rules: [
                { attribute: "enabled_in_store", value: "true", operator: "eq" },
                { attribute: "is_return", value: "false", operator: "eq" },
            ],
        });
        await (0, core_flows_1.createShippingOptionsWorkflow)(container).run({
            input: [
                option("Retiro en persona", "pickup", "Retiro coordinado por WhatsApp.", 0),
                // Por ahora el envío no se cobra en la web: el costo se coordina con el
                // cliente después de confirmar el pago (el checkout muestra "A CONVENIR").
                option("Envío nacional por encomienda", "national", "Envío a todo el país. El costo se coordina con el cliente después del pago.", 0),
                option("Entrega digital", "digital", "Entradas de eventos, sin envío físico.", 0),
            ],
        });
    }
    await (0, core_flows_1.linkSalesChannelsToStockLocationWorkflow)(container)
        .run({ input: { id: stockLocation.id, add: [salesChannel.id] } })
        .catch(() => logger.info("(el canal de ventas ya estaba vinculado a la ubicación)"));
    // 4) Publishable API key
    logger.info("4/8 Publishable API key...");
    let [apiKey] = await find("api_key", { type: "publishable" }, ["id", "token", "title", "sales_channels.id"]);
    if (!apiKey) {
        const { result } = await (0, core_flows_1.createApiKeysWorkflow)(container).run({
            input: { api_keys: [{ title: "KM46 Web", type: "publishable", created_by: "" }] },
        });
        apiKey = result[0];
    }
    const linked = (apiKey.sales_channels ?? []).some((c) => c.id === salesChannel.id);
    if (!linked) {
        await (0, core_flows_1.linkSalesChannelsToApiKeyWorkflow)(container).run({
            input: { id: apiKey.id, add: [salesChannel.id] },
        });
    }
    // 5) Categorías, tags y colecciones (los nombres deben coincidir con los filtros del diseño)
    logger.info("5/8 Categorías, tags y colecciones...");
    const existingCategories = await find("product_category", {}, ["id", "name"]);
    const missingCategories = CATEGORIES.filter((n) => !existingCategories.some((c) => c.name === n));
    if (missingCategories.length) {
        await (0, core_flows_1.createProductCategoriesWorkflow)(container).run({
            input: { product_categories: missingCategories.map((name) => ({ name, is_active: true })) },
        });
    }
    const existingTags = await find("product_tag", {}, ["id", "value"]);
    const missingTags = TAGS.filter((v) => !existingTags.some((t) => t.value === v));
    if (missingTags.length) {
        await (0, core_flows_1.createProductTagsWorkflow)(container).run({
            input: { product_tags: missingTags.map((value) => ({ value })) },
        });
    }
    const existingCollections = await find("product_collection", {}, ["id", "title"]);
    const missingCollections = COLLECTIONS.filter((t) => !existingCollections.some((c) => c.title === t));
    if (missingCollections.length) {
        await (0, core_flows_1.createCollectionsWorkflow)(container).run({
            input: { collections: missingCollections.map((title) => ({ title, handle: slug(title) })) },
        });
    }
    const categories = await find("product_category", {}, ["id", "name"]);
    const tags = await find("product_tag", {}, ["id", "value"]);
    const collections = await find("product_collection", {}, ["id", "title"]);
    const idOf = (list, key, value) => list.find((x) => x[key] === value).id;
    // 6) Productos: merch + eventos
    // SEED_DEMO=false → no crea merch ni eventos de prueba ni el cupón DEMO20
    // (para producción: los productos reales los carga import-km43.ts).
    const withDemo = process.env.SEED_DEMO !== "false";
    logger.info(withDemo ? "6/8 Productos de merch y eventos de prueba..." : "6/8 (SEED_DEMO=false: sin productos de prueba)");
    const existingHandles = new Set((await find("product", {}, ["id", "handle"])).map((p) => p.handle));
    const stockBySku = {};
    const products = [];
    for (const m of withDemo ? MERCH : []) {
        const handle = slug(m.title);
        if (existingHandles.has(handle))
            continue;
        const variants = [];
        for (const size of m.sizes) {
            for (const color of m.colors) {
                for (const gender of m.genders) {
                    const sku = `${handle}-${size}-${color}-${gender}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
                    stockBySku[sku] = m.stockBySize?.[size] ?? 20;
                    variants.push({
                        title: `${size} / ${color} / ${gender}`,
                        sku,
                        manage_inventory: true,
                        options: { Color: color, Género: gender, Talla: size },
                        prices: [{ amount: m.price, currency_code: "usd" }],
                    });
                }
            }
        }
        products.push({
            title: m.title,
            handle,
            description: `${m.title}. Hecha de runners para runners.`,
            status: utils_1.ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            thumbnail: MERCH_IMG,
            images: [{ url: MERCH_IMG }],
            category_ids: [idOf(categories, "name", m.category)],
            tag_ids: [idOf(tags, "value", m.tag)],
            collection_id: idOf(collections, "title", m.collection),
            sales_channels: [{ id: salesChannel.id }],
            options: [
                { title: "Color", values: m.colors },
                { title: "Género", values: m.genders },
                { title: "Talla", values: m.sizes },
            ],
            variants,
            metadata: { demo: "true", ...(m.featured ? { featured: "true" } : {}) },
        });
    }
    for (const e of withDemo ? EVENTS : []) {
        const handle = slug(e.title);
        if (existingHandles.has(handle))
            continue;
        const date = typeof e.when === "number" ? isoInDays(e.when) : e.when;
        const variants = e.distances.map((d) => {
            const sku = `EVT-${handle}-${d.title}`.toUpperCase().replace(/[^A-Z0-9]+/g, "-");
            stockBySku[sku] = d.stock;
            return {
                title: d.title,
                sku,
                manage_inventory: true,
                options: { Distancia: d.title },
                prices: [{ amount: d.price, currency_code: "usd" }],
            };
        });
        products.push({
            title: e.title,
            handle,
            description: e.description,
            status: utils_1.ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            thumbnail: EVENT_IMG,
            images: [{ url: EVENT_IMG }],
            sales_channels: [{ id: salesChannel.id }],
            options: [{ title: "Distancia", values: e.distances.map((d) => d.title) }],
            variants,
            metadata: {
                demo: "true",
                event_date: date,
                location: e.location,
                modality: e.modality,
                ...(e.featured ? { featured: "true" } : {}),
            },
        });
    }
    if (products.length) {
        await (0, core_flows_1.createProductsWorkflow)(container).run({ input: { products } });
    }
    // 7) Stock: una cantidad por variante (los cupos de cada distancia son su stock)
    logger.info("7/8 Stock en la ubicación KM46...");
    const skus = Object.keys(stockBySku);
    if (skus.length) {
        const items = await find("inventory_item", { sku: skus }, ["id", "sku"]);
        await (0, core_flows_1.createInventoryLevelsWorkflow)(container).run({
            input: {
                inventory_levels: items.map((it) => ({
                    location_id: stockLocation.id,
                    inventory_item_id: it.id,
                    stocked_quantity: stockBySku[it.sku],
                })),
            },
        });
    }
    // 8) Cupón de prueba: aplica solo a los productos de la colección CORREMOS EN CASA
    logger.info("8/8 Cupón de prueba...");
    if (withDemo && (await find("promotion", { code: PROMO_CODE })).length === 0) {
        await (0, core_flows_1.createPromotionsWorkflow)(container).run({
            input: {
                promotionsData: [
                    {
                        code: PROMO_CODE,
                        type: "standard",
                        status: "active",
                        is_automatic: false,
                        application_method: {
                            type: "percentage",
                            target_type: "items",
                            allocation: "across",
                            value: 20,
                            currency_code: "usd",
                            target_rules: [
                                {
                                    attribute: "items.product.collection_id",
                                    operator: "in",
                                    values: [idOf(collections, "title", "CORREMOS EN CASA")],
                                },
                            ],
                        },
                    },
                ],
            },
        });
    }
    logger.info("──────────────────────────────────────────────");
    logger.info("Listo. Productos nuevos creados: " + products.length);
    logger.info("PUBLISHABLE KEY (ponla en el .env.local de la web):");
    logger.info("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=" + apiKey.token);
    logger.info(`Cupón de prueba: ${PROMO_CODE} (20 % en la colección CORREMOS EN CASA)`);
    logger.info("──────────────────────────────────────────────");
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VlZC1rbTQ2LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vc3JjL3NjcmlwdHMvc2VlZC1rbTQ2LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBNkpBLDJCQStVQztBQTlkRCxxREFJbUM7QUFDbkMsNERBaUJxQztBQUVyQyw2RUFBNkU7QUFFN0UsTUFBTSxVQUFVLEdBQUcsUUFBUSxDQUFDLENBQUMseURBQXlEO0FBRXRGLE1BQU0sVUFBVSxHQUFHLENBQUMsTUFBTSxFQUFFLFlBQVksQ0FBQyxDQUFDO0FBQzFDLE1BQU0sSUFBSSxHQUFHLENBQUMsU0FBUyxFQUFFLGNBQWMsQ0FBQyxDQUFDO0FBQ3pDLE1BQU0sV0FBVyxHQUFHLENBQUMsa0JBQWtCLEVBQUUsY0FBYyxFQUFFLGtCQUFrQixDQUFDLENBQUM7QUFnQjdFLE1BQU0sS0FBSyxHQUFHLENBQUMsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDcEMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUV0QixNQUFNLEtBQUssR0FBZ0I7SUFDekIsRUFBRSxLQUFLLEVBQUUsZUFBZSxFQUFFLFFBQVEsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxVQUFVLEVBQUUsa0JBQWtCLEVBQUUsS0FBSyxFQUFFLEVBQUUsRUFBRSxNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLEVBQUUsT0FBTyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsSUFBSSxFQUFFO0lBQ3ZMLEVBQUUsS0FBSyxFQUFFLGFBQWEsRUFBRSxRQUFRLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsVUFBVSxFQUFFLGtCQUFrQixFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxFQUFF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
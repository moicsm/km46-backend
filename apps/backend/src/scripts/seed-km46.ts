// apps/backend/src/scripts/seed-km46.ts
//
// Carga inicial de KM46 en Medusa. Se corre UNA vez con:
//
//   npx medusa exec ./src/scripts/seed-km46.ts
//
// Deja listo: moneda USD, región Venezuela (pago manual), ubicación de stock,
// 3 opciones de envío, publishable key, categorías / tags / colecciones,
// productos de merch, eventos (próximos y pasados) y el cupón de prueba DEMO20.
// Es seguro volver a correrlo: lo que ya existe no se duplica.
//
// Todo lo cargado como demo lleva metadata.demo = "true". Cuando subas tus
// productos reales, borra los demo desde el Admin.
import { ExecArgs } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createCollectionsWorkflow,
  createInventoryLevelsWorkflow,
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  createProductTagsWorkflow,
  createPromotionsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows";

// ─── Datos de demostración ────────────────────────────────────────────────

const PROMO_CODE = "DEMO20"; // 20 % en los productos de la colección CORREMOS EN CASA

const CATEGORIES = ["ROPA", "ACCESORIOS"];
const TAGS = ["RUNNING", "POST-RUNNING"];
const COLLECTIONS = ["CORREMOS EN CASA", "CCS EN EL 26", "BURRITO SABANERO"];

type MerchSeed = {
  title: string;
  category: string;
  tag: string;
  collection: string;
  price: number;
  colors: string[];
  genders: string[];
  sizes: string[];
  featured?: boolean;
  /** stock por talla (por defecto 20). Sirve para probar AGOTADO / QUEDAN X. */
  stockBySize?: Record<string, number>;
};

const SIZES = ["S", "M", "L", "XL"];
const ONE = ["ÚNICA"];

const MERCH: MerchSeed[] = [
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

type EventSeed = {
  title: string;
  /** días desde hoy (negativo = evento pasado) o una fecha fija AAAA-MM-DD */
  when: number | string;
  location: string;
  modality: string;
  description: string;
  featured?: boolean;
  distances: { title: string; price: number; stock: number }[];
};

const PAST = (title: string, date: string, location: string): EventSeed => ({
  title,
  when: date,
  location,
  modality: "PRESENCIAL",
  description: "Evento realizado. Mira las fotos en la galería.",
  // los eventos pasados quedan sin cupos para que nadie pueda comprarlos
  distances: [{ title: "GENERAL", price: 20, stock: 0 }],
});

const EVENTS: EventSeed[] = [
  {
    title: "VALENCIA RUN",
    when: 45,
    location: "VALENCIA, VEN",
    modality: "PRESENCIAL",
    featured: true,
    description:
      "Corremos en casa. Tres distancias para todos los niveles, con kit de corredor, medalla de finisher e hidratación en ruta.",
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

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const isoInDays = (n: number) =>
  new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

// ─── Script ───────────────────────────────────────────────────────────────

export default async function seedKm46({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const fulfillmentService = container.resolve(Modules.FULFILLMENT);
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL);
  const storeService = container.resolve(Modules.STORE);

  // Las imágenes demo se sirven desde la carpeta /public de tu web (Next.js).
  const IMAGE_BASE = (process.env.SEED_IMAGE_BASE || "http://localhost:3000").replace(/\/$/, "");
  const img = (path: string) => `${IMAGE_BASE}/${encodeURI(path)}`;
  const MERCH_IMG = img("fotos y tipografia/Picture.png");
  const EVENT_IMG = img("Fotos Web/eventoshero.jpg");

  const find = async (entity: string, filters: Record<string, unknown>, fields = ["id"]) => {
    const { data } = await query.graph({ entity, fields, filters } as any);
    return data as any[];
  };

  // 1) Canal de ventas, moneda y tienda
  logger.info("1/8 Tienda, moneda y canal de ventas...");
  const [store] = await storeService.listStores();
  let [salesChannel] = await salesChannelService.listSalesChannels({ name: "Default Sales Channel" });
  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: "Default Sales Channel" }] },
    });
    salesChannel = result[0];
  }
  await updateStoresWorkflow(container).run({
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
    const { result } = await createRegionsWorkflow(container).run({
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
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: "ve", provider_id: "tp_system" }],
    });
  }

  // 3) Ubicación de stock, envío y opciones de entrega
  logger.info("3/8 Ubicación de stock y opciones de envío...");
  let [stockLocation] = await find("stock_location", { name: "KM46" }, ["id", "name"]);
  const isNewLocation = !stockLocation;
  if (isNewLocation) {
    const { result } = await createStockLocationsWorkflow(container).run({
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
    await updateStoresWorkflow(container).run({
      input: { selector: { id: store.id }, update: { default_location_id: stockLocation.id } },
    });
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    });
  }

  let [shippingProfile] = await fulfillmentService.listShippingProfiles({ type: "default" });
  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
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
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    });

    const option = (name: string, code: string, description: string, amount: number) => ({
      name,
      price_type: "flat" as const,
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
        { attribute: "enabled_in_store", value: "true", operator: "eq" as const },
        { attribute: "is_return", value: "false", operator: "eq" as const },
      ],
    });

    await createShippingOptionsWorkflow(container).run({
      input: [
        option("Retiro en persona", "pickup", "Retiro coordinado por WhatsApp.", 0),
        // Por ahora el envío no se cobra en la web: el costo se coordina con el
        // cliente después de confirmar el pago (el checkout muestra "A CONVENIR").
        option("Envío nacional por encomienda", "national", "Envío a todo el país. El costo se coordina con el cliente después del pago.", 0),
        option("Entrega digital", "digital", "Entradas de eventos, sin envío físico.", 0),
      ],
    });
  }
  await linkSalesChannelsToStockLocationWorkflow(container)
    .run({ input: { id: stockLocation.id, add: [salesChannel.id] } })
    .catch(() => logger.info("(el canal de ventas ya estaba vinculado a la ubicación)"));

  // 4) Publishable API key
  logger.info("4/8 Publishable API key...");
  let [apiKey] = await find(
    "api_key",
    { type: "publishable" },
    ["id", "token", "title", "sales_channels.id"]
  );
  if (!apiKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: { api_keys: [{ title: "KM46 Web", type: "publishable", created_by: "" }] },
    });
    apiKey = result[0];
  }
  const linked = ((apiKey as any).sales_channels ?? []).some((c: any) => c.id === salesChannel.id);
  if (!linked) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: apiKey.id, add: [salesChannel.id] },
    });
  }

  // 5) Categorías, tags y colecciones (los nombres deben coincidir con los filtros del diseño)
  logger.info("5/8 Categorías, tags y colecciones...");
  const existingCategories = await find("product_category", {}, ["id", "name"]);
  const missingCategories = CATEGORIES.filter((n) => !existingCategories.some((c) => c.name === n));
  if (missingCategories.length) {
    await createProductCategoriesWorkflow(container).run({
      input: { product_categories: missingCategories.map((name) => ({ name, is_active: true })) },
    });
  }
  const existingTags = await find("product_tag", {}, ["id", "value"]);
  const missingTags = TAGS.filter((v) => !existingTags.some((t) => t.value === v));
  if (missingTags.length) {
    await createProductTagsWorkflow(container).run({
      input: { product_tags: missingTags.map((value) => ({ value })) },
    });
  }
  const existingCollections = await find("product_collection", {}, ["id", "title"]);
  const missingCollections = COLLECTIONS.filter((t) => !existingCollections.some((c) => c.title === t));
  if (missingCollections.length) {
    await createCollectionsWorkflow(container).run({
      input: { collections: missingCollections.map((title) => ({ title, handle: slug(title) })) },
    });
  }
  const categories = await find("product_category", {}, ["id", "name"]);
  const tags = await find("product_tag", {}, ["id", "value"]);
  const collections = await find("product_collection", {}, ["id", "title"]);
  const idOf = (list: any[], key: string, value: string) => list.find((x) => x[key] === value)!.id;

  // 6) Productos: merch + eventos
  // SEED_DEMO=false → no crea merch ni eventos de prueba ni el cupón DEMO20
  // (para producción: los productos reales los carga import-km43.ts).
  const withDemo = process.env.SEED_DEMO !== "false";
  logger.info(withDemo ? "6/8 Productos de merch y eventos de prueba..." : "6/8 (SEED_DEMO=false: sin productos de prueba)");
  const existingHandles = new Set((await find("product", {}, ["id", "handle"])).map((p) => p.handle));
  const stockBySku: Record<string, number> = {};
  const products: any[] = [];

  for (const m of withDemo ? MERCH : []) {
    const handle = slug(m.title);
    if (existingHandles.has(handle)) continue;
    const variants: any[] = [];
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
      status: ProductStatus.PUBLISHED,
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
    if (existingHandles.has(handle)) continue;
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
      status: ProductStatus.PUBLISHED,
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
    await createProductsWorkflow(container).run({ input: { products } });
  }

  // 7) Stock: una cantidad por variante (los cupos de cada distancia son su stock)
  logger.info("7/8 Stock en la ubicación KM46...");
  const skus = Object.keys(stockBySku);
  if (skus.length) {
    const items = await find("inventory_item", { sku: skus }, ["id", "sku"]);
    await createInventoryLevelsWorkflow(container).run({
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
    await createPromotionsWorkflow(container).run({
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
  logger.info("NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=" + (apiKey as any).token);
  logger.info(`Cupón de prueba: ${PROMO_CODE} (20 % en la colección CORREMOS EN CASA)`);
  logger.info("──────────────────────────────────────────────");
}
